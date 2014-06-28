var PORT = 8967;
var SKEY = '99cc6451ed05';

var ROOT = '/home/mathilde/www/relatur.tk';
var MAPS = '/client/maps/config.json';
var SIZE = [1200, 600];

var options = {
	'log level': 0,
	'authorization': isAuth
};

var crypto  = require('crypto');
var express = require('express');
var fs      = require('fs');
var http    = require('http');
var server  = http.createServer(app);
var io      = require('socket.io').listen(server, options);

// Статика
var app = express();
app.use('/static', express.static(__dirname + '/static'));
app.get('/', function (req, res) { res.sendfile(__dirname + '/index.html'); });

server.listen(PORT);

// Импорт информации по картам:
var map_info = JSON.parse(fs.readFileSync(ROOT + MAPS, {encoding: 'utf-8'})), maps = {};
for(var mapid in map_info){
	// Статистика сметрей
	map_info[mapid]['DParray'] = fs.existsSync(ROOT + map_info[mapid]['deads']) ? JSON.parse(fs.readFileSync(ROOT + map_info[mapid]['deads'], {encoding: 'utf-8'})) : [];
	// Лазерная проницаемость:
	map_info[mapid]['opacity'] = JSON.parse( fs.readFileSync(ROOT + map_info[mapid]['oLaser'], {encoding: 'utf-8'}) );
}
// Клиенты разделены по картам:
var clients  = { 'first' : {}, 'dream' : {} };

io.sockets.on('connection', function (client) {
	var id  = client.handshake.id;
	var map = client.handshake.map;
	
	client.join(map);

	clients[map][id] = {
		'img'     : client.handshake.photo,	
		'name'    : client.handshake.full_name,
		'id'      : id,
		'life'    : true,
		'points'  : [0,0], // Координаты пользователея
		'reqtime' : 0      // Запросы пользователя огонь/выдать всех — указываем время. 
	};

	// Сообщение о координате клиента
	client.on('txy', function (e){
		clients[map][id]['points'].push(e);
		clients[map][id]['points'] = clients[map][id]['points'].slice(-15);
	});

	// Клиент хочет узнать о местоположении всех и каждого
	client.on('vedere', function (e){
		if(!requestTime(id, map)) return false;
		var array = {};
		for (var uid in clients[map]) if(clients[map][uid]['life']) array[uid] = clients[map][uid]['points'];
		client.emit('vedere', array);
	});

	// Клиент открывает огонь:
	client.on('fire', function (to){
		if(!requestTime(id, map)) return false;
		if(!clients[map][id]['life']) return false;
		
		var from = clients[map][id]['points'].slice(-1)[0];
		var info = fire(from, [ to[0] - from[0], to[1] - from[1] ], id, map);
		// Если кто-то убит, уточняем координату:
		if(info.dead){
			info.point = clients[map][info.dead]['points'].slice(-1)[0];
			clients[map][info.dead]['life'] = false;
			// Статистика. Сохраняем точку гибели:
			// Кто, Кого, Где
			map_info[map]['DParray'].push([id, info.dead, info.point]);
			fs.writeFileSync(ROOT + map_info[map]['deads'], JSON.stringify(map_info[map]['DParray']));
		}
		var e = { point : info.point, dead : info.dead, init : from , id : id};
		
		//broad(clients[map], e, false);

		client.emit('fire', e);
		client.broadcast.to(map).emit('fire', e);
	});

	// Сообщенька
	client.on('chat-message', function (e) {
		var msg = {text : safe(e), img : clients[map][id].img, name : clients[map][id].name,};
		insertline(msg, map);
		client.emit('chat-message', msg);
		client.broadcast.to(map).emit('chat-message', msg);
	});

	client.on('disconnect', function (e) {
		delete clients[map][client.handshake.id];
		client.broadcast.to(map).emit('users', clients[map]);
	});

	// Оповещение о приходе посетителя:
	client.broadcast.to(map).emit('users', clients[map]);
	client.emit('users', clients[map]);
	
	// Заготовка
	client.on('message', function (message){
		try {
			message.name = client.handshake.name;
			message.photo = client.handshake.photo;
			client.emit('message', message);
			client.broadcast.to(map).emit('message', message);
		} catch (e) {
			console.log(e);
			client.disconnect();
		}
	});
});


// ------------------------------------------------------------------------------------------------------------------------ //
// Возможность проведения децствия : не чаще раза в 6.5 сек.
function requestTime(id, map){
	var time = (new Date).getTime();
	if(clients[map][id]['reqtime'] + 2050 > time) return false;
	clients[map][id]['reqtime'] = time;
	return true;
}

// Проверка точки натолкновения на препятствие
function checkOpacity(point, map){
	// Избегаем ошибок
	if(isNaN(point[0]) || isNaN(point[1])) return false;
	// Выход за границы
	if(point[0] < 0 || point[1] < 0 || point[0] >= SIZE[0] || point[1] >= SIZE[1]) return false;
	// Непроницаемость поля
	return (map_info[map]['opacity'][point[1]][point[0]] == '1');
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
function fireRadius(point, R, not, map){
	for(var uid in clients[map]){
		if(uid == not || !clients[map][uid]['life']) continue; // Не убивать себя и мёртвых
		var t = clients[map][uid]['points'].slice(-1)[0]; // Точка последнего пребывания
		if(Math.abs(t[0] - point[0]) < R[0] && Math.abs(t[1] - point[1] - 5) < R[1]) return uid;
	}
	return false;
}

// Попытка открытия огня: возвращает массив точек проницаемости до стены
function fire(from, delta, cid, map){
	var i = 0, point;
	while(true){
		i++; point = pointGet(from, delta, i);

		// Проверка, не задела ли кого линия луча?
		var tmp = fireRadius(point, [13,13], cid, map);
		if(tmp) return { dead : tmp, point : false };

		// Проверка, не упёрлась ли в препятствие?
		if(!checkOpacity(point, map)){
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
function insertline(line, map){
	var f = ROOT + map_info[map]['chat'];
	var lasts = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, {encoding: 'utf-8'})).slice(-500) : [];
	lasts.push(line);
	fs.writeFileSync(f, JSON.stringify(lasts));
}




// ------------------------------------------------------------------------------------------------------------------------ //
function isAuth(handshakeData, callback) {
	var required = ['auth_key','full_name','id','map','name','photo','tm','sig'];

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
		handshakeData.name	= JSON.parse(handshakeData.query.name);
		handshakeData.photo	= handshakeData.query.photo;
		handshakeData.id	= handshakeData.query.id;
		handshakeData.map	= handshakeData.query.map;
		
		callback(null, true);
		return;
	}

	callback(null, false);
}