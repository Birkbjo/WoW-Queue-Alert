# WoW-Queue-Alert

A small Node.js application that monitors your WoW-queue and notifies you when it's your turn to play!

## How does it work?

It's pretty simple: it takes a screenshot of your monitor and use [OCR](https://github.com/tesseract-ocr/) to
recognize key-words that should be present on the screen when you are in character select. [Pushbullet](https://www.pushbullet.com/) integration gives you a notifcation straight to your device!

No violation of TOS, no automation!


## Installation

1. Download [Node.js](https://nodejs.org/en/)
2. Clone this repo (or download the [zip](https://github.com/Birkbjo/WoW-Queue-Alert/archive/master.zip))
3. Open a terminal and `cd` to the downloaded folder and run `npm install`.

## Usage

1. Open a terminal and `cd` to the folder of this project.
2. `node index.js` or `npm start`

## Setup

By default it takes screenshots of your primary monitor, and plays an alert when it thinks you are in Character Select screen.

Ideally, you should try running the program on a character-select screen (eg. log into a low-population server), and verify that it recognizes that you are not in a queue.

### Notifications
To get notifications to your device:

1. Make a [Pushbullet](https://www.pushbullet.com/)-account (one-click signup with google and facebook).
2. Go to your [Account](https://www.pushbullet.com/#settings/account) and click 'Create Access Token'.
3. Open `config.json` and paste in the API-key under `PUSHBULLET.API_KEY`.
4. Download Pushbullet to your device. [Android](https://play.google.com/store/apps/details?id=com.pushbullet.android&hl=en). [iOS](https://apps.apple.com/us/app/pushbullet/id810352052).
5. Start the program with `npm start`, and follow the interactive device-selection.
6. Run `npm run dry` to do a dry-run and test your setup.

### Configuration

The configuration-file is located in `config.json`.

`PUSHBULLET` - Contains parameters for pushbullet integration. See [Notifications](#notifications).

`PLAY_SOUND` - A path to a `mp3`-file to be played when character selection screen is shown. Can be an absolute-path, or relative to the project. If empty or `false`, no sound is played.

`CHECK_INTERVAL` - Time in `ms` between every screenshot and queue-check. Default: 30000 (30 sec).

`UPDATE_INTERVAL` - Time in `ms` between every position notification update. Default: 180000 (30min).

`POSITION_THRESHOLD` - Queue position threshold for sending a notification regardless of `UPDATE_INTERVAL`. If your position is lower than this, a notifcation is sent. Default: 200

`DISPLAY` - The display ID that WoW is running in. When you run `npm run dry` several `.png`-files will be saved to the `current working directory` , eg. `0.png`. You can run this command and look at the images to find the correct ID of your monitor.

### CLI options

#### --dry
Do a dry-run, which 'simulates' queue completion. Use this to test notifications-setup and get sample images of each monitor. Note that the volume may be loud!

#### --setup, -s,
Rerun first-time setup. E.g change PushBullet-device.

### --verbose, -v
Sets log level to debug. Also outputs the processed image the OCR uses for recognition to `output.png`.

## Limitations

* Currently, the way we capture screenshots on `windows` may result in pretty bad image quality, so the OCR-lib may fail to recognize the queue position and estimated time.

* World of Warcraft must be running in the foreground of the specified monitor.

* You should try to have WoW running in fullscreen/fullscreen windowed, as more text on the screen is taxing for the OCR. You may also get false positives, as any of the matching words could be on your screen.