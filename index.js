const screenshot = require('screenshot-desktop');
const { TesseractWorker, OEM, PSM } = require('tesseract.js');
const Notifier = require('./notify');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');
const player = require('play-sound')();
const log = require('ulog')('WQA');

const ocrWorker = new TesseractWorker();

const notifier = new Notifier();

const queueDoneQuotes = [
    "Time's up, let's do this! LEEEEEERRROYYYYY JENKKKIIINNNSS",
    "Lok'tar ogar!",
    'Light be with you friend.',
    'Elune be with you!',
    'Queue is da POOP!',
    'GOOD NEWS EVERYONE!',
    'Well met!',
];

async function screenShot(screen = 0, save) {
    let filename = null;
    if (save) {
        filename = `${screen}.png`;
    }

    const img = await screenshot({ filename, format: 'png', screen });
    return img;
}

async function regocnize(img, opts = { verbose: true }) {
    const job = ocrWorker.recognize(img, 'eng', {
        tessedit_ocr_engine_mode: OEM.TESSERACT_ONLY,
        tessedit_pageseg_mode: PSM.SPARSE_TEXT_OSD,
    });
    if (opts.verbose) {
        job.progress(p => log.debug(p));
    }

    const res = await job;
    return res.text;
}

function isProbablyLoggedIn(text) {
    const lowertext = text.toLowerCase();
    const words = ['enter', 'world', 'back', 'create', 'delete', 'character'];
    return words.some(w => lowertext.includes(w));
}

async function run(argv) {
    const sleepT = config.CHECK_INTERVAL || 60000;
    let loggedIn = false;
    while (loggedIn === false) {
        const img = await screenShot(config.DISPLAY);
        const screenText = await regocnize(img, argv);
        loggedIn = isProbablyLoggedIn(screenText);
        if (!loggedIn) {
            await sleep(sleepT);
        }
    }
    log.info('NOT IN QUEUE!');
    ocrWorker.terminate();
    timesUp();
}

function timesUp() {
    if (config.PLAY_SOUND) {
        player.play(
            config.PLAY_SOUND,
            err => err && log.error('Failed to play: ', err)
        );
    }
    if (config.PUSHBULLET && config.PUSHBULLET.API_KEY) {
        const body =
            queueDoneQuotes[Math.floor(Math.random() * queueDoneQuotes.length)];
        notifier.notify('WoW queue complete!', body);
    }
}

function parseArgs(argv) {
    const parsedArgv = {
        verbose: false,
        dryRun: false,
        setup: false,
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
        screenShot(display.id, true)
            .catch(err => {
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
