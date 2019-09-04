const fs = require('fs');
const path = require('path');
const config = require('./config.json');

function writeConfig(override) {
    fs.writeFileSync(
        path.join(__dirname,'config.json'),
        JSON.stringify(config, null, 4).concat('\n'),
        'utf8'
    );
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


module.exports = {
    writeConfig,
    sleep
}