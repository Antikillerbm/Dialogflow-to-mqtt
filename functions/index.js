'use strict';

const functions = require('firebase-functions');
const { WebhookClient, Card, Suggestion } = require('dialogflow-fulfillment');
var UnauthorizedError = require('./http-errors').UnauthorizedError;

var mqtt = require('mqtt');

process.env.DEBUG = 'dialogflow:debug';

exports.post = functions.region('europe-west1').https.onRequest((request, response) => {

  const agent = new WebhookClient({ request, response });

  try {

    if (functions.config().access.api_key != request.headers.api_key) {
      throw new UnauthorizedError("Invalid API Key - please check your configuration.");
    }

    function device_switch(agent) {

      let message = {
        devices: agent.parameters.devices.toString(),
        status: agent.parameters.status.toString()
      };

      message = JSON.stringify(message);
      return publishToMqtt('device_switch', message).then((output) => {
        agent.add(output);
      }).catch(error => {
        agent.add('Ожидаемой реакции сервера не последовало');
      });
    }

    function device_set(agent) {

      let message = {
        devices: agent.parameters.devices.toString(),
        status: agent.parameters.status.toString(),
        color: agent.parameters.color.toString(),
        level: agent.parameters.level.toString()
      };

      message = JSON.stringify(message);
      return publishToMqtt('device_set', message).then((output) => {
        agent.add(output);
      }).catch(error => {
        agent.add('Ожидаемой реакции сервера не последовало');
      });
    }

    function device_time(agent) { //Парсим некое значение времени и переводим все в мс

      if (agent.parameters.duration.unit == "h") {

        var duration = agent.parameters.duration.amount * 3600000;
      }
      else if (agent.parameters.duration.unit == "min") {
        var duration = agent.parameters.duration.amount * 60000;
      }
      else {
        var duration = agent.parameters.duration.amount * 1000;
      };

      if (agent.parameters.date_time.date_time != null) { //Проверяем контейнер date_time, т.к. некоторые параметры имеют иную структуру 
        var date_time = agent.parameters.date_time.date_time;
      }
      else {
        date_time = agent.parameters.date_time;
      };

      let message = {
        devices: agent.parameters.devices.toString(),
        status: agent.parameters.status.toString(),
        duration: duration.toString(),
        date_time: date_time.toString()
      };

      message = JSON.stringify(message);
      return publishToMqtt('device_time', message).then((output) => {
        agent.add(output);
      }).catch(error => {
        agent.add('Ожидаемой реакции сервера не последовало');
      });
    }
    function device_get(agent) {

      let message = {
        devices: agent.parameters.devices.toString(),
        get_info: agent.parameters.get_info.toString(),
      };

      message = JSON.stringify(message);
      return publishToMqtt('device_get', message).then((output) => {
        agent.add(output);
      }).catch(error => {
        agent.add('Ожидаемой реакции сервера не последовало');
      });
    }

    let intentMap = new Map();  //Список интентов и их функции
    intentMap.set('device_set', device_set);
    intentMap.set('device_switch', device_switch);
    intentMap.set('device_time', device_time);
    intentMap.set('device_get', device_get);
    agent.handleRequest(intentMap);
  }

  catch (err) {  //Возвращаем ошибку, если http запрос крашнулся
    console.error(err);
    agent.add(err.message);
    agent.send_();
  }
});

function publishToMqtt(topic, message) {   //Функция отправки по mqtt

  return new Promise((resolve, reject) => { //Просим подождать пока вернется сообщение
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

    var client = mqtt.connect(functions.config().mqtt.server.host, options); //Коннектимся к брокеру

    client.on('connect', function () {
      console.log('client connected');
    });

    client.on('error', function (err) {
      console.error(err); //На случай, если соединение не удалось, завершаем ожидание
      reject();
    });

    client.subscribe('response'); //Подписка на входящие сообщения
    client.publish(topic, message, function (err) { //Отправка

      if (err) {
        console.log("Error:" + err);
        response.send("Error:" + err);
        reject();
      }

    });

    client.on('message', function (topic, message) { //Ждем ответного сообщения
      console.log("client on");
      let output = message.toString();

      resolve(output);
      client.end();
      clearTimeout(noResp);  //Пришло, убираем таймаут и завершаем соединение
    });
    let noResp = setTimeout(() => { //Если не приходит, ждем 2 секунды и говорим агенту, что все пропало
      console.log("No connection");
      reject();
      client.end();
    }, 2000)

  });
}
