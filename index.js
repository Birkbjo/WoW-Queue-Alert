const screenshot = require('screenshot-desktop');
const { TesseractWorker, OEM, PSM } = require('tesseract.js');
const Notifier = require('./notify');
const fs = require('fs');
const path = require('path');
const log = require('ulog')('WQA');
const sharp = require('sharp');
const inquirer = require('inquirer');
const { writeConfig, sleep, config, playSound } = require('./utils');
const ocrWorker = new TesseractWorker();
const notifier = new Notifier();
const bottomBar = new inquirer.ui.BottomBar();

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
        // Black pixels below 180, white above = way easier for OCR to recognize text
        .threshold(180)
        .png()
        .toBuffer();
    return processed;
}

async function recognize(img, opts = { debug: true }) {
    const processedImg = await processImage(img);
    const job = ocrWorker
        .recognize(processedImg, 'eng', {
            tessedit_ocr_engine_mode: OEM.TESSERACT_ONLY,
            tessedit_pageseg_mode: PSM.SPARSE_TEXT_OSD
        })
        .progress(p => {
            bottomBar.updateBottomBar(
                `${p.status}: ${Math.round(p.progress * 100)}% `
            );
        });

    if (opts.debug) {
        fs.writeFile('output.png', processedImg, err => err && log.error(err));
    }

    try {
        const res = await job;
        log.debug(res.text);
        return [res.text, res.words];
    } catch (e) {
        log.error('Recognizer failed', e);
        return [null, null];
    }
}

function findNumber(arr, start, end) {
    for (let i = end; i > start && i < arr.length; i--) {
        const parsed = parseInt(arr[i]);
        if (!isNaN(parsed)) {
            return parsed;
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

function isProbablyLoggedIn(tesseractWords) {
    const minMatches = 2;
    const loggedInWords = [
        'enter',
        'world',
        'back',
        'create',
        'delete',
        'character'
    ];
    const queueWords = ['full', 'position', 'in', 'queue'];
    let queueWordMatches = [];
    let loggedInMatches = [];
    for (tw of tesseractWords) {
        const w = tw.text.toLowerCase();
        if (queueWords.includes(w)) {
            queueWordMatches.push(w);
        }
        if (loggedInWords.includes(w)) {
            loggedInMatches.push(w);
        }
    }
    return (
        loggedInMatches.length >= minMatches &&
        queueWordMatches.length < minMatches
    );
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

function handleNotLoggedIn(words, retries, lastUpdate) {
    const posTime = recognizeQueuePosition(words);
    let didNotify = false;
    let posStr = posTime
        ? `Position: ${posTime[0]}. Estimated time: ${posTime[1]} min. `
        : '';
    if (posTime) {
        didNotify = handlePositionUpdate(posTime, lastUpdate);
    } else {
        if (retries-- < 1) {
            log.warn('Queue not recognized for a long time, shutting down...');
            process.exit(-1);
        }
        log.warn(
            'Queue not recognized. Is WoW running on the specified monitor?'
        );
    }
    bottomBar.updateBottomBar(`${posStr}Waiting for next check...`);
    return didNotify;
}

async function run(argv) {
    const sleepT = config.CHECK_INTERVAL || 60000;
    let loggedIn = false;
    let lastUpdate = new Date();
    let retryNoQueue = 10;

    log.info('WoW Queue Alert running... (Press Ctrl+C to exit)');
    while (loggedIn === false) {
        const img = await screenShot(config.DISPLAY);
        const [screenText, words] = await recognize(img, argv);
        if (!screenText) {
            process.exit(-1);
        }
        loggedIn = isProbablyLoggedIn(words);
        if (!loggedIn) {
            const didNotify = handleNotLoggedIn(
                words,
                retryNoQueue,
                lastUpdate
            );
            if (didNotify) {
                lastUpdate = new Date();
            }
            await sleep(sleepT);
        }
    }
    log.info('\nQueue complete!. Shutting down...');
    ocrWorker.terminate();
    await timesUp(argv);
}

async function timesUp(argv) {
    if (notifier.active) {
        const body =
            queueDoneQuotes[Math.floor(Math.random() * queueDoneQuotes.length)];
        notifier.notify('WoW queue complete!', body);
    }
    if (!argv.mute && config.PLAY_SOUND) {
        try {
            await playSound(config.PLAY_SOUND);
        } catch (e) {
            log.error('Failed to play sound:', e.message);
        }
    }
}

function parseArgs(argv) {
    const parsedArgv = {
        debug: false,
        dryRun: false,
        setup: false,
        mute: false,
        interactive: false
    };

    for (i in argv) {
        const arg = argv[i];
        switch (arg) {
            case '-d':
            case '--debug': {
                parsedArgv.debug = true;
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
            case '-m':
            case '--mute': {
                parsedArgv.mute = true;
                break;
            }
            case '-i':
            case '--interactive': {
                parsedArgv.interactive = true;
                break;
            }
        }
    }
    return parsedArgv;
}

async function interactiveStart(argv) {
    const answers = await inquirer.prompt([
        {
            type: 'list',
            message: 'What do you want to do?',
            name: 'answer',
            choices: [
                {
                    name: 'Start Queue monitor',
                    value: 'run'
                },
                {
                    name: 'Dry run. Used for testing setup',
                    value: 'dryRun'
                },
                {
                    name: 'Start setup',
                    value: 'setup'
                },
                {
                    name: 'Exit',
                    value: 'exit'
                }
            ]
        }
    ]);
    switch (answers.answer) {
        case 'run': {
            await run(argv);
            break;
        }
        case 'dryRun': {
            await dryRun(argv);
            break;
        }
        case 'setup': {
            argv.setup = true;
            await setup(argv);

            break;
        }
        case 'exit': {
            return;
        }
    }
    await interactiveStart(argv);
}

async function interactiveDisplay(argv) {
    const displays = await screenshot.listDisplays();

    if (displays.length < 2) {
        log.info('Only one monitor found. Using primary.');
        return;
    }
    const answer = await inquirer.prompt([
        {
            type: 'list',
            message: 'Select the monitor that WoW is running on:',
            name: 'display',
            choices: displays.map(d => ({
                name: `${d.name} (id: ${d.id})${d.primary ? ' [Primary]' : ''}`,
                value: d
            }))
        }
    ]);
    const display = answer.display;
    config.DISPLAY = display.id;
    writeConfig();
    log.info('Display selected:', display.name);
}

async function setup(argv) {
    await notifier.init(config.PUSHBULLET.API_KEY, argv);
    if (argv.setup) {
        await interactiveDisplay();
    }
}

async function dryRun(argv) {
    const displays = await screenshot.listDisplays();
    for (d in displays) {
        const display = displays[d];
        screenShot(display.id, d).catch(err => {
            log.error('Failed to screenshot:', err);
        });
    }
    await timesUp(argv);
}

async function main(args) {
    const argv = parseArgs(args.slice(2));
    if (argv.interactive) {
        await interactiveStart(argv);
    } else {
        await setup(argv);
        if (argv.dryRun) {
            await dryRun(argv);
        } else {
            await run(argv);
        }
    }
    bottomBar.close();
}
main(process.argv);
