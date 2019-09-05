const fs = require('fs');
const path = require('path');

const USER_CONFIG = 'config.json'
const configPath = p => path.join(__dirname, p);
const configLocs = ['default.config.json', USER_CONFIG].map(configPath);

let CONFIG = null

function writeConfig(override) {
    fs.writeFileSync(
        path.join(__dirname, USER_CONFIG),
        JSON.stringify(override || CONFIG, null, 4).concat('\n'),
        'utf8'
    );
}

function loadFile(path) {
    try {
        return require(path);
    } catch (e) {
        return null;
    }
}

function getConfig() {
    if(CONFIG) {
        return CONFIG;
    }
    CONFIG = configLocs
        .map(cfg => loadFile(cfg))
        .filter(cfg => !!cfg)
        .reduce((acc, cfg) => ({ ...acc, ...cfg }), {});
    return CONFIG;
}

function playSound(filePath) {
    const playPath = path.isAbsolute(filePath)
        ? path.normalize(filePath)
        : path.normalize(path.join(__dirname, filePath));

    const errHandler = err => err && log.error('Failed to play sound', err);
    let proc
    if (process.platform === 'win32') {
        proc = child_process.execFile(
            'cscript.exe',
            [path.join(__dirname, 'win32', 'wmplayer.vbs'), playPath],
            errHandler
        );
    } else if (process.platform === 'darwin') {
        proc = child_process.execFile('afplay', [playPath], errHandler);
    }
    return
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    config: getConfig(),
    playSound,
    sleep,
    writeConfig,
};
