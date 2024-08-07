'use strict';

const { Device } = require('homey');
const AdguardAPI = require('../../lib/AdguardAPI');

const refreshTimeout = 1000 * 30; // 30 seconds

class AdguardHomeDevice extends Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('AdguardHome has been initialized');

    this.config = this.getSettings();

    this.log(`Address: ${this.config.address}, Username: ${this.config.address}`)

    this.refreshing = false
    this.api = new AdguardAPI(this.config);

    this.intervalId = setInterval(this._syncDevice.bind(this), refreshTimeout);

    this.registerCapabilityListener('onoff.protection_enabled', async () => {
      await this.toggleProtection();
    });

    await this._syncDevice()
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Adguard has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Adguard settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('Adguard was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('Adguard has been deleted');
  }

  async toggleProtection() {
    this.log("Toggle protection")
    let currentState = await this.getCapabilityValue('onoff.protection_enabled')
    let protection = await this.api.httpRequest("/control/protection", "POST", `{"enabled": ${!currentState}}`)
    this.log(protection.trim())
    if(protection.trim() != "OK"){
      this.log(`Unable to disable protection (${protection.trim()})`)
      throw new Error(`Unable to disable protection (${protection.trim()})`)
    }
  }

  changeCapabilityValue(capability, value, flowTrigger = null, tokens = null, state = null) {
    try {
      if (!this.hasCapability(capability)) {
        this.log(capability + " doesn't exist")
        return false
      }

      let currentValue = this.getCapabilityValue(capability)
      if (currentValue != value) {
        this.setCapabilityValue(capability, value);

        if (flowTrigger != null) {
          flowTrigger.trigger(this, tokens, state).catch(this.error);
        }
      }
    } catch (error) {
      this.log(error.message)
    }
  }

  async _syncDevice() {
    if (this.refreshing) {
      this.setWarning("Refresh seems to take long...")
      return
    }

    this.refreshing = true

    try {
      let status = await this.api.httpRequest("/control/status")

      if (status == false) {
        this.setUnavailable(this.api.lastError)
        this.refreshing = false
        return
      }

      let json = await this.api.getJsonData(status)
      this.log(json)

      this.changeCapabilityValue('onoff.protection_enabled',json.protection_enabled)
      this.changeCapabilityValue('onoff.running',json.running)
    } catch (error) {
      this.error(error);
      this.setUnavailable(error.message);
    }

    this.refreshing = false
  }

}

module.exports = AdguardHomeDevice;
