'use strict';

const Homey = require('homey');

class AdguardHome extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('Adguard Home has been initialized');
  }

}

module.exports = AdguardHome;
