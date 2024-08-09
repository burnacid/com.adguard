'use strict';

const { Driver } = require('homey');
const AdguardAPI = require('../../lib/AdguardAPI');

let foundDevices = [];

class AdguardHomeDriver extends Driver {

  onPair(session) {
    session.setHandler('search_devices', async (data) => {
      foundDevices = []

      this.log(data)
  
      const api = new AdguardAPI(data);
  
      await api.httpRequest('/control/status')
        .then(result => {
          this.log(result)
          if (result) {
            this.log("Can connect to AdGuard Home")
            foundDevices = [
              {
                name: "Adguard Home test",
                data: {
                  id: data.address
                },
                store: {
                  address: data.address
                },
                settings: {
                  address: data.address,
                  username: data.username,
                  password: data.password
                }
              }];
          } else {
            this.log('No Result');
            console.error('processData', data);
            throw new Error("Error processing API data");
          }
        }).catch(error => {
          return error;
        });
  
      this.log("Finished ")
      return true
    });
  }
}

module.exports = AdguardHomeDriver;
