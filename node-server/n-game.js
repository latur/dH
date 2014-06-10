var PORT = 8967;
// iptables -A INPUT -p udp --dport 8960 -j ACCEPT
// Открыть порты, проверить роутер...

var SKEY = 'a5999cc6451ed0';
var OMAP = '/home/mathilde/www/relatur.tk/client/opacity-lazer.map.json'; // Карта лазерной проницаемости игрового поля
var deadpoints = '/home/mathilde/www/relatur.tk/client/deadpoints.json';
var messages   = '/home/mathilde/www/relatur.tk/client/messages.json';

var options = {
	'log level': 0,
	'authorization': isAuth
};

var crypto  = require('crypto');
var express = require('express');
var app     = express();
var fs      = require('fs');
var http    = require('http');
var server  = http.createServer(app);
var io      = require('socket.io').listen(server, options);

server.listen(PORT);

app.use('/static', express.static(__dirname + '/static'));
app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});


var clients = {};
var opacity_map = fs.readFileSync(OMAP, {encoding: 'utf-8'}).split('\n');
var opacity_map_WH = [1200, 600];
var deadpointsarray = fs.existsSync(deadpoints) ? JSON.parse(fs.readFileSync(deadpoints, {encoding: 'utf-8'})) : [];


io.sockets.on('connection', function (client) {
	var id = client.handshake.id;

	clients[id] = {
		'img'     : client.handshake.photo,	
		'name'    : client.handshake.full_name,
		'id'      : id,
		'life'    : true,
		'points'  : [0,0], // Координаты пользователей
		'reqtime' : 0	  // Запросы пользователя выдать всех — указываем время. 
	};

	// Сообщение о координате клиента
	client.on('txy', function (e){
		clients[id]['points'].push(e);
		clients[id]['points'] = clients[id]['points'].slice(-15);
	});

	// Клиент хочет узнать о местоположении всех и каждого
	client.on('vedere', function (e){
		if(!requestTime(id)) return false;
		var array = {};
		for (var uid in clients) if(clients[uid]['life']) array[uid] = clients[uid]['points'];
		client.emit('vedere', array);
	});

	// Клиент открывает огонь:
	client.on('fire', function (to){
		if(!requestTime(id)) return false;
		if(!clients[id]['life']) return false;
		
		var from = clients[id]['points'].slice(-1)[0];
		var info = fire(from, [ to[0] - from[0], to[1] - from[1] ], id);
		// Если кто-то убит, уточняем координату:
		if(info.dead){
			info.point = clients[info.dead]['points'].slice(-1)[0];
			clients[info.dead]['life'] = false;
			// Статистика. Сохраняем точку гибели:
			// Кто, Кого, Где
			deadpointsarray.push([id, info.dead, info.point]);
			fs.writeFileSync(deadpoints, JSON.stringify(deadpointsarray));
		}
		var e = { point : info.point, dead : info.dead, init : from , id : id};

		client.emit('fire', e);
		client.broadcast.emit('fire', e);
	});
	
	// Сообщенька
	client.on('chat-message', function (e) {
		var msg = {text : safe(e), img : clients[id].img, name : clients[id].name,};
		insertline(msg);
		client.emit('chat-message', msg);
		client.broadcast.emit('chat-message', msg);
	});

	client.on('disconnect', function (e) {
		delete clients[client.handshake.id];
		client.broadcast.emit('users', clients);
	});

	// Оповещение о приходе посетителя:
	client.broadcast.emit('users', clients);
	client.emit('users', clients);
	
	// Заготовка
	client.on('message', function (message){
		try {
			message.name = client.handshake.name;
			message.photo = client.handshake.photo;
			client.emit('message', message);
			client.broadcast.emit('message', message);
		} catch (e) {
			console.log(e);
			client.disconnect();
		}
	});
});


// ------------------------------------------------------------------------------------------------------------------------ //
// Возможность проведения децствия : не чаще раза в 6.5 сек.
function requestTime(id){
	var time = (new Date).getTime();
	if(clients[id]['reqtime'] + 2050 > time) return false;
	clients[id]['reqtime'] = time;
	return true;
}

// Проверка точки натолкновения на препятствие
function checkOpacity(point){
	// Избегаем ошибок
	if(isNaN(point[0]) || isNaN(point[1])) return false;
	// Выход за границы
	if(point[0] < 0 || point[1] < 0 || point[0] >= opacity_map_WH[0] || point[1] >= opacity_map_WH[1]) return false;
	// Непроницаемость поля
	return (opacity_map[point[1]][point[0]] == '1');
}

// Получение i-ой точки (на заданном расстоянии i * C от стрелявшего)
function pointGet(from, delta, i){
	var C = 3; // константа сдвига
	// Четверть выстрела
	var sign = (delta[0] < 0 && delta[1] < 0) ? -1 : 1;
	// Направление
	var point = (delta[0] > delta[1]) ? [C * i, Math.round(C * i * delta[1] / delta[0])] : [ Math.round(C * i * delta[0] / delta[1]) , C * i];
	// Смещение от начала
	return [sign * point[0] + from[0], sign * point[1] + from[1]];
}

// Есть ли в зоне поражения кто? 
function fireRadius(point, R, not){
	for(var uid in clients){
		if(uid == not || !clients[uid]['life']) continue; // Не убивать себя и мёртвых
		var t = clients[uid]['points'].slice(-1)[0]; // Точка последнего пребывания
		if(Math.abs(t[0] - point[0]) < R[0] && Math.abs(t[1] - point[1] - 5) < R[1]) return uid;
	}
	return false;
}

// Попытка открытия огня: возвращает массив точек проницаемости до стены
function fire(from, delta, cid){
	var i = 0, point;
	while(true){
		i++; point = pointGet(from, delta, i);

		// Проверка, не задела ли кого линия луча?
		var tmp = fireRadius(point, [13,13], cid);
		if(tmp) return { dead : tmp, point : false };

		// Проверка, не упёрлась ли в препятствие?
		if(!checkOpacity(point)){
			// Взрыв. Мог задеть кого? 
			var tmp = fireRadius(point, [38, 38], cid);
			if(tmp) return { dead : tmp, point : false };
			// НИкто не задет и не убит. Скука.
			return { dead : false, point : point };
		}
	}
}
// Чатик:
function safe(str){
	//return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function insertline(line){
	var lasts = fs.existsSync(messages) ? JSON.parse(fs.readFileSync(messages, {encoding: 'utf-8'})).slice(-500) : [];
	lasts.push(line);
	fs.writeFileSync(messages, JSON.stringify(lasts));
}




// ------------------------------------------------------------------------------------------------------------------------ //
function isAuth(handshakeData, callback) {
	var required = ['auth_key','full_name','id','name','photo','tm','sig'];
	var strToHash = '';
	for(var i in required){
		var paramName = required[i];
		if(!handshakeData.query[paramName]){
			callback(null, false);
			return;
		}
		if(paramName != "sig") strToHash += paramName + '=' + handshakeData.query[paramName];
	}

	var sig = handshakeData.query.sig;

	strToHash += SKEY;

	var hash = crypto.createHash('md5').update(strToHash).digest('hex');

	if (hash == sig) {
		// some http request to site api
		// to get and store user data
		handshakeData.full_name	= JSON.parse(handshakeData.query.full_name);
		handshakeData.name  = JSON.parse(handshakeData.query.name);
		handshakeData.photo = handshakeData.query.photo;
		handshakeData.id	= handshakeData.query.id;
		
		callback(null, true);
		return;
	}

	callback(null, false);
}