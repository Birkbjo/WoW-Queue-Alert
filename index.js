const screenshot = require("screenshot-desktop");
const { TesseractWorker, OEM, PSM } = require("tesseract.js");
const Notifier = require("./notify");
const config = require("./config.json");

const ocrWorker = new TesseractWorker();

async function screenShot(display = 0) {
    const img = await screenshot({ format: "png" });
    return img;
}

async function regocnize(img) {
    const res = await ocrWorker
        .recognize(img, "eng", {
            tessedit_ocr_engine_mode: OEM.TESSERACT_ONLY,
            tessedit_pageseg_mode: PSM.SPARSE_TEXT_OSD
            //   tessedit_char_whitelist: "realmisfulchng0123456789" // "changerlmt1234567890"
        })
        .progress(p => console.log(p));

    console.log(res.text);
    return res.text;
}

async function listDisplays() {
    const displays = await screenshot.listDisplays();
    for (d of displays) {
        console.log(d);
    }
}

function isProbablyLoggedIn(text) {
    const lowertext = text.toLowerCase();
    const words = ["enter", "world", "back", "create", "delete", "character"];
    return words.some(w => lowertext.includes(w));
}

async function run() {
    const sleepT = config.CHECK_INTERVAL || 60000;
    let loggedIn = false;
    while (loggedIn === false) {
        const img = await screenShot(0);
        const screenText = await regocnize(img, isProbablyLoggedIn);
        loggedIn = isProbablyLoggedIn(screenText);
        if (!loggedIn) {
            await sleep(sleepT);
        }
    }
    console.log("NOT IN QUEUE");
    ocrWorker.terminate();
}

function main(args) {
    if (args.length < 3) {
        //const Not = new Notifier();
        run();
    } else if (args.includes("test")) {
    }
}

main(process.argv);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
