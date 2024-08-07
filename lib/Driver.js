'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {

    onPair(socket) {
        socket.setHandler('search_devices', async (data) => {
            if (this._onPairSearchDevices) {
                this._onPairSearchDevices(data);
                await socket.nextView();
            } else {
                new Error('missing _onPairSearchDevices');
            }
        });

        socket.setHandler('list_devices', async () => {
            if (this._onPairListDevices) {
                return this._onPairListDevices();
            } else {
                new Error('missing _onPairListDevices');
            }
        });
    }

};

module.exports = Driver;