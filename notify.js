const { promisify } = require('util');
const config = require('./config.json');
const Pushbullet = require('pushbullet');
const inquirer = require('inquirer');
const fs = require('fs');
const log = require('ulog')('notifier');

class Notifier {
    async init(argv) {
        if (!config || !config.PUSHBULLET.API_KEY) {
            log.info('Notifier not configured');
            return;
        }

        this.PB = new Pushbullet(config.PUSHBULLET.API_KEY);
        this.PB.note = promisify(this.PB.note);
        this.PB.devices = promisify(this.PB.devices);

        if (
            (!config.PUSHBULLET.DEVICE_ID &&
                config.PUSHBULLET.DEVICE_ID !== null) ||
            argv.setup
        ) {
            await this.setup();
        } else {
            this.device = config.PUSHBULLET.DEVICE_ID;
        }
    }

    async setup() {
        try {
            const res = await this.PB.devices();
            if (!res.devices || res.devices.length < 1) {
                log.error('No devices found.');
                return;
            }
            
            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    message: 'Select a device to send notifications to:',
                    name: 'device',
                    choices: res.devices
                        .map(d => ({
                            name: `${d.nickname} [${d.type}]`,
                            value: d,
                        }))
                        .concat({
                            name: 'All devices',
                            value: { nickname: 'All devices', iden: null },
                        }),
                },
            ]);
            this.device = answer.device.iden;
            config.PUSHBULLET.DEVICE_ID = this.device;
            fs.writeFileSync(
                'config.json',
                JSON.stringify(config, null, 4).concat('\n'),
                'utf8'
            );
            log.info(
                `Device set to: ${answer.device.nickname} (id:${answer.device.iden})`
            );
        } catch (e) {
            log.error('Failed to get devices: ', e);
        }
    }

    async notify(title, body) {
        try {
            const d = await this.PB.note(this.device, title, body);
            log.debug('Notification sent!');
        } catch (e) {
            log.error('Failed to send notification: ', e);
        }
    }
}

module.exports = Notifier;