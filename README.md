# Google Assistant (via DialogFlow) -> Cloud Function -> MQTT bridge

Based on https://github.com/harperreed/node-ifttt-mqtt-bridge

Fullfillment for DialogFlow intent, breaks down the entites to topic and message and sends to the MQTT broker. 

## Getting started

* Create a project at Firebase.com
* firebase init

### Configure firebase

Install Firebase tools:

`$ npm install -g firebase-tools`

Instantiate your project: 

`$ firebase init functions`

Don't overwrite existing package.json and index.js

### App/MQTT Configuration

You will have to configure a handful of firebase config vars. 

* `firebase functions:config:set mqtt.server.port=12345`
* `firebase functions:config:set mqtt.server.host=mqtt://mxx.cloudmqtt.com`
* `firebase functions:config:set mqtt.server.user=username`
* `firebase functions:config:set mqtt.server.password=password`
* `firebase functions:config:set access.api_key=secretapikey`

You should generate a unique access.api_key, then add it to dialogflow fulfillment as header "api_key" 


### Deploy

After you configure your vars, you can then deploy:

`$ firebase deploy`

## Usage

Once you deploy you will get a URL: `https://us-central1-mqtttest.cloudfunctions.net/post`

You can use this url as dialogflow webhook:

## Contribute

1. Fork the repo
2. Make a pull request
3.     
4. Profit 
