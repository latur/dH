const options = { 'log level': 0, 'authorization': isAuth };
const crypto  = require('crypto');
const express = require('express');
const app     = express();
const fs      = require('fs');
const https   = require('https');
// -------------------------------------------------------------------------- //
// Настроечки:

const PORT = 8967;
const SKEY = ''; // Шифроключ для связи с PHP (авторизация)
const ROOT = '/home/www/relatur.tk'; // Путь к корню проекта

const key  = fs.readFileSync('/crtx/relatur.tk.key'); // SSL key
const cert = fs.readFileSync('/crtx/relatur.tk.crt'); // SSL cert

// -------------------------------------------------------------------------- //

const MAPS = '/client/maps/config.json';
const SIZE = [1200, 600];
const server = https.createServer({ key: key, cert: cert, requestCert: false, rejectUnauthorized: false }, app);

const io = require('socket.io').listen(server, options);
const bot = require('./n-bot.js');

// ------------------------------------------------------------------------------------------------------------------------ //
// Статика:
app.use('/static', express.static(__dirname + '/static'));
app.get('/', function (req, res) { res.sendfile(__dirname + '/index.html'); });
server.listen(PORT);

// ------------------------------------------------------------------------------------------------------------------------ //
// Импорт информации по картам:
var clients = {}
var map_info = JSON.parse(fs.readFileSync(ROOT + MAPS, {encoding: 'utf-8'})), maps = {};
for(var mapid in map_info){
	// Статистика сметрей
	map_info[mapid]['DParray'] = fs.existsSync(ROOT + map_info[mapid]['deads']) ? JSON.parse(fs.readFileSync(ROOT + map_info[mapid]['deads'], {encoding: 'utf-8'})) : [];
	// Лазерная проницаемость:
	map_info[mapid]['opacity'] = JSON.parse( fs.readFileSync(ROOT + map_info[mapid]['oLaser'], {encoding: 'utf-8'}) );
	// Клиенты разделены по картам:
	clients[mapid] = {};
}

// ------------------------------------------------------------------------------------------------------------------------ //
// ------------------------------------------------------------------------------------------------------------------------ //
// Боты:
// - Точка атаки. Там, где последний раз был замечен клиент
var DreamBotFP = [rand(0, SIZE[0]), rand(0, SIZE[1])];
// Создание ботов:
// - Граф перемещений
var trace_file = './bot_traces/dream.json';
var trace = JSON.parse( fs.readFileSync(trace_file, {encoding: 'utf-8'}) );
// - Бот в карте «Мечта»
var DreamBot = new bot('dream', 'Робот Крушитель', '/client/img/robot.jpg', trace);
clients[DreamBot.map][DreamBot.id] = DreamBot.GetClient();

// ------------------------------------------------------------------------------------------------------------------------ //
// Перемещения ботов:
setInterval(function(){
	if(clients[DreamBot.map][DreamBot.id].life == false){
		DreamBot.point  = 'A1';
		DreamBot.branch = false;
		return;
	}
	clients[DreamBot.map][DreamBot.id]['points'].push( DreamBot.action() );
	clients[DreamBot.map][DreamBot.id]['points'] = clients[DreamBot.map][DreamBot.id]['points'].slice(-15);
}, 55);

// Действия ботов:
setInterval(function(){
	var m = DreamBot.map, i = DreamBot.id;

	// Воскрешение
	if(clients[m][i].life == false){
		setTimeout(function(){
			clients[m][i].life = true;
			io.sockets.to(m).emit('users', clients[m]);
		}, 5000);
		return;
	}
	// Открыть огонь
	if(Math.random() > 0.3){
		//var to = (Math.random() > 0.35) ? DreamBotFP : [rand(0, SIZE[0]), rand(0, SIZE[1])];
		var to   = DreamBotFP;
		var from = clients[m][i]['points'].slice(-1)[0];
		var info = fire(from, [ to[0] - from[0], to[1] - from[1] ], i, m);
		if(info.dead){
			info.point = clients[m][info.dead]['points'].slice(-1)[0];
			clients[m][info.dead]['life'] = false;
		}
		var e = { point : info.point, dead : info.dead, init : from , id : i};
		io.sockets.to(m).emit('fire', e);
		return;
	}
	// Проверить, кто где (проекция)
	var points = userpositions(m);
	for(var k in points) if(k != 'bot') DreamBotFP = points[k].slice(-1)[0];
}, 2181);

// ------------------------------------------------------------------------------------------------------------------------ //
// ------------------------------------------------------------------------------------------------------------------------ //
// Спонтанное врубание проекции. Общее для всех, так честнее.
setInterval(function(){
	var map = 'dream';
	if(Math.random() < 0.35){
		var points = userpositions(map);
		io.sockets.to(map).emit('vedere', userpositions(map));
		for(var i in points) if(i != 'bot') DreamBotFP = points[i].slice(-1)[0];
	}
}, 3181);


// ------------------------------------------------------------------------------------------------------------------------ //
// ------------------------------------------------------------------------------------------------------------------------ //
io.sockets.on('connection', function (client) {
    
	var id  = client.handshake.query.id;
	var map = client.handshake.query.map;

	client.join(map);
	clients[map][id] = {
		'img'     : client.handshake.query.photo,	
		'name'    : JSON.parse(client.handshake.query.full_name),
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
		client.emit('vedere', userpositions(map));
	});

	// Клиент открывает огонь:
	client.on('fire', function (to){
		if(!requestTime(id, map)) return false; // запрет преждевременного огня
		if(!clients[map][id]['life']) return false; // запрет на стркльбц мертвецам
		
		var from = clients[map][id]['points'].slice(-1)[0];
		var info = fire(from, [ to[0] - from[0], to[1] - from[1] ], id, map);
		DreamBotFP = from;
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
// ------------------------------------------------------------------------------------------------------------------------ //
// Возможность проведения децствия : не чаще раза в 6.5 сек.
function requestTime(id, map){
	var time = (new Date).getTime();
	if(clients[map][id]['reqtime'] + 2050 > time) return false;
	clients[map][id]['reqtime'] = time;
	return true;
}

// Кто где находится
function userpositions(map){
    var array = {};
    for (var uid in clients[map]) if(clients[map][uid]['life']) array[uid] = clients[map][uid]['points'];
    return array;
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
		if(Math.abs(t[0] - point[0]) < R[0] && Math.abs(t[1] - point[1] - 0) < R[1]) return uid;
	}
	return false;
}

// Попытка открытия огня
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
			var tmp = fireRadius(point, [35, 35], cid, map);
			if(tmp) return { dead : tmp, point : false };
			// Никто не задет и не убит. Скука.
			return { dead : false, point : point };
		}
	}
}

// Случайное число в интервале
function rand(min, max){
	return Math.round(min - 0.5 + Math.random() * (max - min + 1));
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