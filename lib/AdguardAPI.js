'use strict';

const Homey = require('homey');
const http = require('httpreq');
const util = require('util')

class AdguardAPI {
    constructor(data) {
        // Add HTTP:// if it isn't found
        if(!data.address.toLowerCase().startsWith('http')){
            data.address = "http://"+data.address
        }

        if(data.address.toLowerCase().endsWith('/')){
            data.address = data.address.substring(0,data.address.length-1)
        }

        this.config = data;
        this.lastError = null;
        this.tz = "UTC"
    }

    async processData(data) {
        if (data.error) {
            console.error('processData', data);
            throw new Error("Could not read API");
        }

        return data;
    }

    async httpResponse(result) {
        var data = result && result.body || '';

        // HTML page is returned
        if (data.includes('<html>')) {
            console.error('HTML response', data);
            this.lastError = "Unexpected API responce";
            throw new Error("Unexpected API responce");
        }

        return await this.processData(data);
    }

    async httpRequest(command, type = 'GET', bodyInput = "") {
        var fullUrl = this.config.address + command;
        console.log(`Contacting [${type}]: ${fullUrl}`)
        
        var options = {
            url: fullUrl,
            method: type,
            body: bodyInput,
            headers: {
                "Content-Type": "application/json"
            },
            auth: `${this.config.username}:${this.config.password}`
        };

        const httpPromise = util.promisify(http.doRequest);

        // Do request
        return await httpPromise(options)
            .then(result => {
                return this.httpResponse(result);
            }).catch((error) => {
                console.error(error)
                this.lastError = error
                return false;
            });
    }

    async getJsonData(data) {
        try {
            return JSON.parse(data);
        } catch (error) {
            console.error('getJsonData', error);
            this.lastError = 'ERROR: (Parsing API) '+ error
            return false;
        }
    }
}

module.exports = AdguardAPI;