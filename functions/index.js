'use strict';

const functions = require('firebase-functions');
const { WebhookClient, Card, Suggestion } = require('dialogflow-fulfillment');
var BadRequestError = require('./http-errors').BadRequestError;
var UnauthorizedError = require('./http-errors').UnauthorizedError;

var mqtt = require('mqtt');
var formatter = new Intl.DateTimeFormat("ru", { //формат даты

  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  timeZone: "Europe/Moscow"
});

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

exports.post = functions.region('europe-west1').https.onRequest((request, response) => {

  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  const agent = new WebhookClient({ request, response });

  try {
    // Safety first. Check to see if the API key is what we configured before deploying the function
    if (functions.config().access.api_key != request.headers.api_key) {
      throw new UnauthorizedError("Invalid API Key - please check your configuration.");
    }

    function device_switch(agent) { //наш интент
      let devices = agent.parameters.devices.toString();
      let status = agent.parameters.status.toString();

      var topic = 'device_switch';
      var message = JSON.stringify({ devices, status }); //отправляем, что насобиралось в контейнер
      agent.add(message);
      return publishToMqtt(topic, message); //хыдыдыщ! 
    }

    function device_set(agent) { //наш интент
      let devices = agent.parameters.devices.toString();
      let status;
      let color;
      let level;

      if (agent.parameters.status != null) {
        status = agent.parameters.status.toString();
      }
      if (agent.parameters.level != null) {
        level = agent.parameters.level.toString();
      }
      if (agent.parameters.color != null) {
        color = agent.parameters.color.toString();
      }

      var topic = 'device_set';
      var message = JSON.stringify({ devices, status, level, color }); //отправляем, что насобиралось в контейнер
      agent.add(message);
      return publishToMqtt(topic, message); //хыдыдыщ! 
    }

    function device_time(agent) { //наш интент
      let devices = agent.parameters.devices.toString();
      let status = agent.parameters.status.toString();
      let event;
      let time;

      if (agent.parameters.time.toString() != '') {
        console.log('time != null ' + agent.parameters.time.toString());//проверяем, что параметр не пустой и пихаем в стринг
        let value = agent.parameters.time.toString().split(','); //отделяем число от единиц измерения

        time = value[0];
        let unit = value[1];

        if (unit == "hour") {
          console.log('time_now = ' + Date.now());
          time = Date.now() + parseInt(time) * 3600000; //текущая дата-время + кол-во минут ожидания
          console.log('time_milis = ' + time);
        }
        else if (unit == "min") {
          time = Date.now() + arseInt(time) * 60000;
        }
        time = formatter.format(time).toString(); //делаем формат понятный domoticz
        console.log('time_formatted = ' + time);
      }

      else if (agent.parameters.in_date_time.toString() != '') {
        console.log('in_date_time != null ' + agent.parameters.in_date_time.toString());
        time = agent.parameters.in_date_time.toString().replace('T', ' ').slice(0, 19);
      }

      else if (agent.parameters.start_date_time.startDateTime != null) {
        console.log('start_date_time != null ' + agent.parameters.start_date_time.startDateTime.toString());
        time = agent.parameters.start_date_time.startDateTime.toString().replace('T', ' ').slice(0, 19);
      }

      else if (agent.parameters.date_time.date_time != null) {
        console.log('date_time != null ' + agent.parameters.date_time.date_time.toString());
        time = agent.parameters.date_time.date_time.toString().replace('T', ' ').slice(0, 19);
      }
      else {
        agent.add('No time parameters');
      }

      if (agent.parameters.event.toString() != '') {
        console.log('event != null ' + agent.parameters.event.toString());
        event = agent.parameters.event.toString();
      }
      else {
        event = ''; //событие в установленное время, если не задано иное
      }
      console.log('time =' + time);
      var topic = 'device_time';
      var message = JSON.stringify({ devices, status, time, event }); //отправляем, что насобиралось в контейнер
      agent.add(message); //лень лезть в консоль файрбэйса, поэтому дебаг здесь))
      return publishToMqtt(topic, message); //хыдыдыщ! 
    }

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map();
    intentMap.set('device_set', device_set); //сюда добавляем интенты
    intentMap.set('device_switch', device_switch);
    intentMap.set('device_time', device_time);
    agent.handleRequest(intentMap);
  }

  catch (err) {
    console.error(err);
    agent.add(err.message);
    agent.send_();
  }
});


function publishToMqtt(topic, message) {
  //Options for connecting to the MQTT host
  var options = {
    port: functions.config().mqtt.server.port,
    host: functions.config().mqtt.server.host,
    clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
    username: functions.config().mqtt.server.user,
    password: functions.config().mqtt.server.password,
    keepalive: 60,
    reconnectPeriod: 1000,
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    clean: true,
    encoding: 'utf8'
  };

  //Let's connect
  var client = mqtt.connect(functions.config().mqtt.server.host, options);

  client.on('connect', function () {
    console.log('client connected');
  });

  client.on('error', function (err) {
    console.error(err);
  });

  //debugging - check the firebase function log
  console.log("topic: " + topic);
  console.log("message: " + message);

  //publish the topic and payload
  client.publish(topic, message, function (err) {
    // handle the error
    if (err) {
      console.log("Error:" + err);
      response.send("Error:" + err);
      return;
    }

    //If the publish is successful then return
    response.send("Successfullly published message: '" + message + "' to topic: " + topic);

    //end the connection to the mqtt server
    client.end();
  });
}
