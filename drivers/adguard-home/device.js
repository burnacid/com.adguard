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

    this.log(`Address: ${this.config.address}, Username: ${this.config.username}`)

    this.refreshing = false
    this.api = new AdguardAPI(this.config);

    this.intervalId = setInterval(this._syncDevice.bind(this), refreshTimeout);

    this.registerCapabilityListener('onoff.protection_enabled', async () => {
      await this.toggleProtection();
    });

    // TRIGGER FLOWS
    this._protectionEnabledFlow = this.homey.flow.getDeviceTriggerCard("protection_enabled");
    this._protectionDisabledFlow = this.homey.flow.getDeviceTriggerCard("protection_disabled");

    // TRIGGER CONDITIONAL
    const isProtectionEnabledCondition = this.homey.flow.getConditionCard('is_protection_enabled');
    isProtectionEnabledCondition.registerRunListener(async (args, state) => {
      this.log("[FLOW CONDITION] Is protection enabled")
      let status = await this.api.httpRequest("/control/status")
      if (status == false) {
        this.error(this.api.lastError)
        throw new Error(this.api.lastError)
      }

      let json = await this.api.getJsonData(status)
      return json.protection_enabled
    });

    // TRIGGER ACTIONS
    const enableProtectionAction = this.homey.flow.getActionCard('enable_protection');
    enableProtectionAction.registerRunListener(async (args, state) => {
      this.log("[FLOW ACTION] Enable Protection")
      let currentValue = this.getCapabilityValue('onoff.protection_enabled')

      this.setCapabilityValue('onoff.protection_enabled', true);
      let responce = await this.api.httpRequest("/control/protection", "POST", '{"enabled": true}')
      responce = responce.trim()
      if (responce != "OK") {
        this.setCapabilityValue('onoff.protection_enabled', currentValue);
        throw new Error(`Protection could not be enabled (${responce})`)
      }
    });

    const disableProtectionAction = this.homey.flow.getActionCard('disable_protection');
    disableProtectionAction.registerRunListener(async (args, state) => {
      this.log("[FLOW ACTION] Disable Protection")
      let currentValue = this.getCapabilityValue('onoff.protection_enabled')

      this.setCapabilityValue('onoff.protection_enabled', false);
      let responce = await this.api.httpRequest("/control/protection", "POST", '{"enabled": false}')
      responce = responce.trim()
      if (responce != "OK") {
        this.setCapabilityValue('onoff.protection_enabled', currentValue);
        throw new Error(`Protection could not be enabled (${responce})`)
      }
    });

    this.queryTimeUnit = ''
    this.timeunitString = ''

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

    if(changedKeys.includes('address')){
      this.api.setAddress(newSettings.address)
    }
    if(changedKeys.includes('username')){
      this.api.setUsername(newSettings.username)
    }
    if(changedKeys.includes('password')){
      this.api.setPassword(newSettings.password)
    }

    await this._syncDevice()
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
    if (protection.trim() != "OK") {
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
      // Get status information
      let status = await this.api.httpRequest("/control/status")

      if (status == false) {
        this.setUnavailable(this.api.lastError)
        this.refreshing = false
        return
      }

      if(!await this.api.isJsonString(status)){
        this.setUnavailable(status)
        this.refreshing = false
        return
      }

      let json = await this.api.getJsonData(status)
      
      if(!json){
        this.setUnavailable(this.api.lastError)
        this.refreshing = false
        return
      }

      // Protection State
      let currentValue = this.getCapabilityValue('onoff.protection_enabled')
      if (currentValue != json.protection_enabled) {
        this.setCapabilityValue('onoff.protection_enabled', json.protection_enabled);

        if (json.protection_enabled) {
          this.log("[FLOW TRIGGER] Protection Enabled")
          this._protectionEnabledFlow.trigger(this, {}, {}).then(this.log).catch(this.error);
        } else {
          this.log("[FLOW TRIGGER] Protection Disabled")
          this._protectionDisabledFlow.trigger(this, {}, {}).then(this.log).catch(this.error);
        }
      }
      this.changeCapabilityValue('onoff.running', json.running)

      // Query information
      let queryDetails = await this.api.httpRequest("/control/stats")

      if (queryDetails == false) {
        this.setUnavailable(this.api.lastError)
        this.refreshing = false
        return
      }

      if(!await this.api.isJsonString(queryDetails)){
        this.setUnavailable(queryDetails)
        this.refreshing = false
        return
      }

      let queryDetailsJson = await this.api.getJsonData(queryDetails)
      
      if(!queryDetailsJson){
        this.setUnavailable(this.api.lastError)
        this.refreshing = false
        return
      }

      if(queryDetailsJson.time_units != this.queryTimeUnit){
        this.queryTimeUnit = queryDetailsJson.time_units
        this.timeunitString = this.queryTimeUnit.substring(0, this.queryTimeUnit.length - 1)
        
        this.setCapabilityOptions('measure_query.total',{title: `Queries last ${this.timeunitString}`})
      }

      // Number of Queries
      let currentNumberOfQueries = this.getCapabilityValue('measure_query.total')
      if (currentNumberOfQueries != queryDetailsJson.dns_queries.at(-1)) {
        this.setCapabilityValue('measure_query.total', queryDetailsJson.dns_queries.at(-1));

        // if (json.protection_enabled) {
        //   this.log("[FLOW TRIGGER] Protection Enabled")
        //   this._protectionEnabledFlow.trigger(this, {}, {}).then(this.log).catch(this.error);
        // } else {
        //   this.log("[FLOW TRIGGER] Protection Disabled")
        //   this._protectionDisabledFlow.trigger(this, {}, {}).then(this.log).catch(this.error);
        // }
      }

      
      this.log()

    } catch (error) {
      this.error(error);
      this.setUnavailable(error.message);
    }

    this.setAvailable();
    this.refreshing = false
  }

}

module.exports = AdguardHomeDevice;
