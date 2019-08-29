const { promisify } = require("util");
const config = require("./config.json");
const Pushbullet = require("pushbullet");

class Notifier {
    constructor() {
        this.init();
    }

    async init() {
        if (!config || !config.PUSHBULLET_API_KEY) {
            console.log("Notifier not configured");
            return;
        }
        this.PB = new Pushbullet(config.PUSHBULLET_API_KEY);
        this.PB.note = promisify(this.PB.note);
        this.device = config.PUSHBULLET_DEVICE_ID;
        const d = await this.PB.devices();
        console.log(d);
        console.log();
        this.notify("Test", "body");
    }

    async notify(title, body) {
        const d = await this.PB.note(this.device, title, body);
        console.log(d);
    }
}

module.exports = Notifier;
