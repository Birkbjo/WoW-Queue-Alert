const screenshot = require('screenshot-desktop');
const { TesseractWorker, OEM, PSM } = require('tesseract.js');
const Notifier = require('./notify');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');
const log = require('ulog')('WQA');
const sharp = require('sharp');
const inquirer = require('inquirer');
const child_process = require('child_process');

const ocrWorker = new TesseractWorker();
const notifier = new Notifier();

let positionNotificationSent = false;

const queueDoneQuotes = [
    "Time's up, let's do this! LEEEEEERRROYYYYY JENKKKIIINNNSS",
    "Lok'tar ogar!",
    'Light be with you friend.',
    'Elune be with you!',
    'Queue is da POOP!',
    'GOOD NEWS EVERYONE!',
    'Well met!'
];

async function screenShot(screen = 0, filename = null) {
    if (filename) {
        filename = `${filename}.png`;
    }

    const img = await screenshot({ filename, format: 'png', screen });
    return img;
}
async function processImage(img) {
    const processed = await sharp(img)
        // Black pixels below 200, white above = way easier for OCR to recognize text
        .threshold(180)
        .png()
        .toBuffer();
    return processed;
}

async function regocnize(img, opts = { verbose: true }) {
    const processedImg = await processImage(img);
    const job = ocrWorker.recognize(processedImg, 'eng', {
        tessedit_ocr_engine_mode: OEM.TESSERACT_ONLY,
        tessedit_pageseg_mode: PSM.SPARSE_TEXT_OSD
    });

    if (opts.verbose) {
        fs.writeFile('output.png', processedImg, err => err && log.error(err));
        job.progress(p => log.debug(p));
    }
    let res;
    try {
        res = await job;
    } catch (e) {
        log.error('Recognizer failed', e);
        return null;
    }

    log.debug(res.text);
    return [res.text, res.words];
}

function findNumber(arr, start, end) {
    for (let i = end; i > start && i < arr.length; i--) {
        if (!isNaN(parseInt(arr[i]))) {
            return arr[i];
        }
    }
    return null;
}

function recognizeQueuePosition(tesseractWords) {
    const words = tesseractWords.map(w => w.text.toLowerCase());
    const positionKeywords = ['position', 'in', 'queue'];

    for (let i = 0; i < words.length; i++) {
        let w = words[i];
        if (positionKeywords.includes(w)) {
            //OCR may fail some words, so we try some positions ahead
            const pos = findNumber(words, i, i + 3);
            if (pos) {
                //try to find time:
                const time = findNumber(words, i, i + 8);
                return [pos, time];
            }
        }
    }
    return null;
}

function isProbablyLoggedIn(text) {
    const lowertext = text.toLowerCase();
    const words = ['enter', 'world', 'back', 'create', 'delete', 'character'];
    return words.some(w => lowertext.includes(w));
}

function handlePositionUpdate([pos, time], lastUpdate) {
    const updateThreshold = config.UPDATE_INTERVAL || 1800000; // 30 min
    const positionThreshold = config.POSITION_THRESHOLD || 200;
    const now = new Date();
    log.debug('Position:', pos, ' Estimated time:', time);
    const positionSend = !positionNotificationSent && pos <= positionThreshold;

    if (positionSend) {
        log.debug('Position below threshold, sending notification');
        positionNotificationSent = true;
    }

    if (positionSend || now - lastUpdate >= updateThreshold) {
        if (notifier.active) {
            notifier.notify(
                'Queue position update',
                `You are now in position: ${pos}.\nEstimated time: ${time} min.`
            );
        }
        return true;
    }
    return false;
}

async function run(argv) {
    const sleepT = config.CHECK_INTERVAL || 60000;
    let loggedIn = false;
    let lastUpdate = new Date();

    while (loggedIn === false) {
        const img = await screenShot(config.DISPLAY);
        const [screenText, words] = await regocnize(img, argv);
        process.exit(-1);
        if (!screenText) {
        }

        loggedIn = isProbablyLoggedIn(screenText);
        const posTime = recognizeQueuePosition(words);
        if (posTime) {
            const didNotify = handlePositionUpdate(posTime, lastUpdate);
            if (didNotify) {
                lastUpdate = new Date();
            }
        }
        if (!loggedIn) {
            await sleep(sleepT);
        }
    }
    log.info('Queue complete!. Shutting down...');
    ocrWorker.terminate();
    await timesUp();
}

function playSound() {
    const playPath = path.isAbsolute(config.PLAY_SOUND)
        ? config.PLAY_SOUND
        : path.join(__dirname, config.PLAY_SOUND);

    const errHandler = err => err && log.error('Failed to play sound', err);
    if (process.platform === 'win32') {
        child_process.execFile(
            'cscript.exe',
            [path.join(__dirname, 'win32', 'wmplayer.vbs'), playPath],
            errHandler
        );
    } else if (process.playform === 'darwin') {
        child_process.execFile('afplay', [playPath], errHandler);
    }
}

async function timesUp() {
    if (notifier.active) {
        const body =
            queueDoneQuotes[Math.floor(Math.random() * queueDoneQuotes.length)];
        notifier.notify('WoW queue complete!', body);
    }
    if (config.PLAY_SOUND) {
        const playPath = path.isAbsolute(config.PLAY_SOUND)
            ? config.PLAY_SOUND
            : path.join(__dirname, config.PLAY_SOUND);

        playSound(playPath);
    }
}

function parseArgs(argv) {
    const parsedArgv = {
        verbose: false,
        dryRun: false,
        setup: false
    };

    for (i in argv) {
        const arg = argv[i];
        switch (arg) {
            case '-v':
            case '--verbose': {
                parsedArgv.verbose = true;
                log.level = log.DEBUG;
                break;
            }
            case '--dry': {
                parsedArgv.dryRun = true;
                break;
            }
            case '-s':
            case '--setup': {
                parsedArgv.setup = true;
                break;
            }
        }
    }
    return parsedArgv;
}

async function setup(argv) {
    await notifier.init(argv);
}

async function dryRun(argv) {
    const displays = await screenshot.listDisplays();
    for (d in displays) {
        const display = displays[d];
        screenShot(display.id, d).catch(err => {
            log.error('Failed to screenshot:', err);
        });
    }
    timesUp();
}

async function main(args) {
    const argv = parseArgs(args.slice(2));
    await setup(argv);
    if (argv.dryRun) {
        dryRun(argv);
    } else {
        run(argv);
    }
}
main(process.argv);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
