const { promisify } = require('util');
const Pushbullet = require('pushbullet');
const inquirer = require('inquirer');
const fs = require('fs');
const log = require('ulog')('notifier');
const { writeConfig, config } = require('./utils.js');

class Notifier {
    constructor() {
        this.active = false;
        this.lastNotificationDate = null;
    }

    async init(argv) {
        if (!config || !config.PUSHBULLET.API_KEY) {
            log.info('Notifier not configured');
            return;
        }

        this.createPB(config.PUSHBULLET.API_KEY);

        if (
            (!config.PUSHBULLET.DEVICE_ID &&
                config.PUSHBULLET.DEVICE_ID !== null) ||
            argv.setup
        ) {
            const success = await this.setup();
            if (success) {
                this.active = true;
            } else {
                log.info('Failed to setup notifier');
            }
        } else {
            this.device = config.PUSHBULLET.DEVICE_ID;
            this.active = true;
            this.createPB(config.PUSHBULLET.API_KEY);
        }
    }

    createPB(apiKey) {
        this.PB = new Pushbullet(apiKey);
        this.PB.note = promisify(this.PB.note);
        this.PB.devices = promisify(this.PB.devices);
        return this.PB;
    }

    setupQuestions(devices) {
        return [
            {
                type: 'list',
                message: 'Select a device to send notifications to:',
                name: 'device',
                choices:
                    devices.map(d => ({
                        name: `${d.nickname} [${d.type}]`,
                        value: d,
                    }))
                    .concat({
                        name: 'All devices',
                        value: { nickname: 'All devices', iden: null },
                    })
                }
        ];
    }

    async setup() {
        try {
            const res = await this.PB.devices();
            if (!res.devices || res.devices.length < 1) {
                log.error('No devices found.');
                return;
            }
            const answer = await inquirer.prompt(this.setupQuestions(res.devices));
            this.device = answer.device.iden;
            config.PUSHBULLET.DEVICE_ID = this.device;
            writeConfig();
            log.info(
                `Device set to: ${answer.device.nickname} (id:${answer.device.iden})`
            );
            return true;
        } catch (e) {
            log.error('Failed to get devices: ', e);
            return false;
        }
    }

    async notify(title, body) {
        let res;
        try {
            res = await this.PB.note(this.device, title, body);
            this.lastNotificationDate = new Date();
            log.debug('Notification sent!');
        } catch (e) {
            log.error('Failed to send notification: ', e);
        }
        return res;
    }
}

module.exports = Notifier;
