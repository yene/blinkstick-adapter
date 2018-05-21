/**
 * blinkstick-adapter.js - Blinkstick adapter.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

let Adapter, Device, Property;
let blinkstick = require('blinkstick');

try {
  Adapter = require('../adapter');
  Device = require('../device');
  Property = require('../property');
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') {
    throw e;
  }

  const gwa = require('gateway-addon');
  Adapter = gwa.Adapter;
  Device = gwa.Device;
  Property = gwa.Property;
}

class BlinkstickProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
  }

  /**
   * Set the value of the property.
   *
   * @param {*} value The new value to set
   * @returns a promise which resolves to the updated value.
   *
   * @note it is possible that the updated value doesn't match
   * the value passed in.
   */
  setValue(value) {
    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        // Note: no idea how errors are propagated
        blinkstick.findBySerial(this.device.serial, (d) => {
          if (this.name === 'on') {
            if (this.value) {
              d.setColor(this.device.color);
            } else {
              d.turnOff();
            }
            resolve(updatedValue);
            this.device.notifyPropertyChanged(this);
          }
          if (this.name === 'color') {
            d.setColor(this.value);
            this.device.color = this.value;
            resolve(updatedValue);
            this.device.notifyPropertyChanged(this);
          }
        });
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

class BlinkstickDevice extends Device {
  constructor(adapter, id, serial, color, deviceDescription) {
    super(adapter, id);
    this.serial = serial;
    this.color = color;
    this.name = deviceDescription.name;
    this.type = deviceDescription.type;
    this.description = deviceDescription.description;
    for (const propertyName in deviceDescription.properties) {
      const propertyDescription = deviceDescription.properties[propertyName];
      const property = new BlinkstickProperty(this, propertyName, propertyDescription);
      this.properties.set(propertyName, property);
    }
  }
}

class BlinkstickAdapter extends Adapter {
  constructor(addonManager, packageName) {
    super(addonManager, 'BlinkstickAdapter', packageName);
    addonManager.addAdapter(this);
  }

  /**
   * Example process to add a new device to the adapter.
   *
   * The important part is to call: `this.handleDeviceAdded(device)`
   *
   * @param {String} deviceId ID of the device to add.
   * @param {String} deviceDescription Description of the device to add.
   * @return {Promise} which resolves to the device added.
   */
  addDevice(deviceId, deviceDescription) {
    return new Promise((resolve, reject) => {
      if (deviceId in this.devices) {
        reject('Device: ' + deviceId + ' already exists.');
      } else {
        const device = new BlinkstickDevice(this, deviceId, 'serial', 'color', deviceDescription);
        this.handleDeviceAdded(device);
        resolve(device);
      }
    });
  }

  /**
   * Example process ro remove a device from the adapter.
   *
   * The important part is to call: `this.handleDeviceRemoved(device)`
   *
   * @param {String} deviceId ID of the device to remove.
   * @return {Promise} which resolves to the device removed.
   */
  removeDevice(deviceId) {
    return new Promise((resolve, reject) => {
      const device = this.devices[deviceId];
      if (device) {
        this.handleDeviceRemoved(device);
        resolve(device);
      } else {
        reject('Device: ' + deviceId + ' not found.');
      }
    });
  }

  /**
   * Start the pairing/discovery process.
   *
   * @param {Number} timeoutSeconds Number of seconds to run before timeout
   */
  startPairing(_timeoutSeconds) {
    console.log('BlinkstickAdapter:', this.name, 'id', this.id, 'pairing started');
  }

  /**
   * Cancel the pairing/discovery process.
   */
  cancelPairing() {
    console.log('BlinkstickAdapter:', this.name, 'id', this.id, 'pairing cancelled');
  }

  /**
   * Unpair the provided the device from the adapter.
   *
   * @param {Object} device Device to unpair with
   */
  removeThing(device) {
    console.log('BlinkstickAdapter:', this.name, 'id', this.id, 'removeThing(', device.id, ') started');
    this.removeDevice(device.id).then(() => {
      console.log('BlinkstickAdapter: device:', device.id, 'was unpaired.');
    }).catch((err) => {
      console.error('BlinkstickAdapter: unpairing', device.id, 'failed');
      console.error(err);
    });
  }

  /**
   * Cancel unpairing process.
   *
   * @param {Object} device Device that is currently being paired
   */
  cancelRemoveThing(device) {
    console.log('BlinkstickAdapter:', this.name, 'id', this.id, 'cancelRemoveThing(', device.id, ')');
  }
}

function loadBlinkstickAdapter(addonManager, manifest, _errorCallback) {
  const adapter = new BlinkstickAdapter(addonManager, manifest.name);
  var d = blinkstick.findFirst();
  if (d === undefined) {
    return;
  }

  d.getSerial(function(error, serial) {
    if (error) {
      console.log('Unexpected error', error);
      return;
    }
    d.getColorString(0, function(error, color) {
      if (error) {
        console.log('Unexpected error', error);
        return;
      }

      const device = new BlinkstickDevice(adapter, 'blinkstick', serial, color, {
        name: 'Blinkstick',
        type: 'onOffColorLight',
        description: 'Blinkstick USB Device #' + serial,
        properties: {
          on: {
            name: 'on',
            type: 'boolean',
            value: color !== '#000000',
          },
          color: {
            name: 'color',
            type: 'string',
            value: color,
          },
        },
      });
      adapter.handleDeviceAdded(device);
    });
  });
}

module.exports = loadBlinkstickAdapter;
