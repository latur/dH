var options = {
	frame  : { width : 1200, height : 600 },
	hero   : { width : 17,   height : 29, sprite : '/client/img/mario.png' },
	front  : $('#world-front').css({ backgroundImage :  'url(' + map.front  + ')' }),
	map    : $('#world-shadow').css({ backgroundImage : 'url(' + map.shadow + ')' }),
	back   : $('#world-back').css({ backgroundImage :   'url(' + map.back   + ')' }),
	light  : $('#world-light').css({ backgroundImage :  'url(' + map.light  + ')' }),
	level  : $('div.lazerlevel'),
	canvas : $('#canvas')
};


//client/sounds/spark.wav

var action = (function(e){
	var socket = io.connect(connection);
	// Цикл переотрисовки сцены
	var	draw_scene;
	// Главный герой, его ускорение, количество жизней
	var agent = { 'x' : initpoint[0], 'y' : initpoint[1], 'dx' : 0, 'dy' : 0, 'state' : 0, e : $('#me'), bg : 0, bgOffset : 0};
	var opacity_map;
	// Состояние клавиш
	var state = { 'L' : false, 'T' : false, 'R' : false, 'B' : false, 'M' : false, 'S' : false};
	// Разрешение действия
	var action = 85, max_action = 85, backOpacity = 0;
	var users = {}, chat_input = false;
	// Расстояние от игрового поля до края браузера:
	// Отступы для фиксации точки клика
	var addXY = [($(window).width() - e.frame.width)/2, 50];
	window.onresize = function(){ addXY = [($(window).width() - e.frame.width)/2, 50]; };

	var sounds = {
		'boom' : [	
			new Audio('/client/sounds/boom-1.wav'),
			new Audio('/client/sounds/boom-2.wav'),
			new Audio('/client/sounds/boom-3.wav'),
			new Audio('/client/sounds/boom-4.wav'),
			new Audio('/client/sounds/boom-5.wav'),
			new Audio('/client/sounds/boom-6.wav'),
			new Audio('/client/sounds/boom-7.wav'),
			new Audio('/client/sounds/boom-8.wav'), 
		],
		'up' : new Audio('/client/sounds/up.wav'), 
		'spark' : new Audio('/client/sounds/spark.wav'), 

	};
	
	// ------------------------------------------------------------------------------------------------------------------------ //
	// Реагирование на нажатие клавиш
	function keydown(e)
	{
		if(e.which == 13) message(true);   // Q
		if(e.which == 27) message(false);  // ESC
		if(chat_input) return;
		//e.preventDefault();
		if(e.which == 37 || e.which == 65) state.L = true;
		if(e.which == 38 || e.which == 87) state.T = true;
		if(e.which == 39 || e.which == 68) state.R = true;
		if(e.which == 40 || e.which == 83) state.B = true;
		if(e.which == 32) state.S = true; // пробел
		if(e.which == 81) vedereInit();   // Q
	}
	function keyup(e)
	{
		if(chat_input) return;
		//e.preventDefault();
		if(e.which == 37 || e.which == 65) state.L = false;
		if(e.which == 38 || e.which == 87) state.T = false;
		if(e.which == 39 || e.which == 68) state.R = false;
		if(e.which == 40 || e.which == 83) state.B = false;
		if(e.which == 32) state.S = false; // пробел
	}
	function mousedown(e)
	{
		state.M = [e.pageX - addXY[0], e.pageY - addXY[1]];
		fireInit();
	}
	function mousemove(e)
	{
		if(state.M) state.M = [e.pageX - addXY[0], e.pageY - addXY[1]];
	}
	function mouseup(e)
	{
		state.M = false;
	}


	// Проверка проницаемости точки в координатах мира
	function checkOpacityH(y,x,dx,k){
		if(opacity_map[ y ][ x + dx ] == '1') return dx;
		return checkOpacityH(y, x, dx + k, k);
	}
	function checkOpacityV(y,x,dy,k){
		if(opacity_map[ y + dy ][ x ] == '1') return dy;
		return checkOpacityV(y, x, dy + k, k);
	}


	// ------------------------------------------------------------------------------------------------------------------------ //
	// Проекция персонажей иных измерений
	function makeOthers(points)
	{
		sounds['spark'].play();
		// if(points.length == 0) return;
		for(var i in points) $('<div class="other e"></div>').css({ left : points[i][0], top: points[i][1], opacity : i/points.length }).appendTo('#container');
		// Гасим пользователей фоновых
		$('.other.e').removeClass('e').animate({ opacity : 0 }, 5000, function(){ $(this).remove(); });
		// Скрываем стену
		backOpacity = 0;
	}
	// Отрисовка линнии-лазера
	function fireline(point, init, isme)
	{
		// Радиус луча
		var ro  = Math.round(Math.sqrt( (init[0] - point[0])*(init[0] - point[0]) + (init[1] - point[1])*(init[1] - point[1]) ));
		// Смещение со знаком
		var zDX = (init[0] - point[0]) / ro, zDY = (init[1] - point[1])/ro;
		// Начальная точка
		var from = [init[0] + 10, init[1] + 10];
		// Звуковое сопровождение
		sounds['boom'][ isme ? (Math.floor(Math.random() * 6) + 1) : 0 ].play();

		// 1. Проведение молниеобразной линии, анимационно
		e.ctx.beginPath();
		e.ctx.moveTo(from[0], from[1]);
		e.ctx.strokeStyle = (isme) ? 'rgba(200,0,0,0.8)' : 'rgba(100,0,150,0.8)';
		e.ctx.lineWidth = 2;
		for(var i = 0; 10*i < ro; i++){
			var mx = [from[0] - zDX * 10 * i + Math.random() * 15 - 8, from[1] - zDY * 10 * i + Math.random() * 15 - 8];
			e.ctx.lineTo(mx[0], mx[1]);
			e.ctx.moveTo(mx[0], mx[1]);
		}
		e.ctx.stroke();
		
		// 2. плавное угасание экрана canvas
		setTimeout(function(){
			e.canvas.animate({ opacity : 0 }, 500, function(){ 
				e.ctx.clearRect(0, 0, e.frame.width, e.frame.height);
				$(this).css({ opacity : 1 }); 
			})
		}, 500);
	}
	// ВЗРЫВ
	function explosion(point)
	{
		var x = point[0], y = point[1];
		var exp = '/client/img/exp.64.png';
		$("#container").append('<div class="sprite"></div>');
		var area = $("#container .sprite:last");
		area.css({ width : 64, height : 64, top : y - 64/2, left : x - 64/2, backgroundImage : 'url(' + exp + ')'});
		var i = 40;
		var counter = setInterval(function(){
			if(i == 0)
			{
				clearInterval(counter);
				return area.remove();
			}
			area.css({backgroundPosition :  -(40 - i) * 64 + 'px 0px'});
			i--;
		}, 25);
	}
	// Смерть
	function dead(point, uid, killer)
	{
		users[uid].life = false;
		updateUserlist();
		explosion( [point[0] + 5, point[1] + 8] );

		// Пятно в место гибели
		$('<div class="deadUnit"></div>')
			.css({ top : point[1], left : point[0] })
			.appendTo('#container')
			.animate({ opacity : 0 }, 15 * 1000, function(){ $(this).remove() });
		
		// Если убили меня, сообщить
		if(uid == me.id){
			clearInterval(draw_scene);
			agent.e.remove();
			e.light.remove();
			$('a.howtoplay').remove();
			$('<div class="message">Вас уничтожили.  Убийца — '+ users[killer].name +'<br/><a href="'+location.href+'" class="btn">перерождение</a></div>')
				.appendTo('#container')
				.fadeIn(1500);
		}
	}
	
	// ------------------------------------------------------------------------------------------------------------------------ //
	// Чатик.
	// Новое сообщение или отправка. Всё в одном
	function message(send)
	{
		if(chat_input){
			if(send && $('#msgwrite').val() != '') socket.emit('chat-message', $('#msgwrite').val());
			chat_input = false;
			$('#msgwrite').blur();
			$('#msgarea').remove();
			return true;
		}
		chat_input = true;
		$('<div class="message" id="msgarea"><input id="msgwrite" type="text" placeholder="Напечатайте текст сообщения.     Отправка — Enter, отмена — ESC" /></div>')
			.appendTo('#container')
			.fadeIn(300);
		$('#msgwrite').focus();
	}
	// Входящее сообщение, показать
	function incoming(e)
	{
		var insert = '<div class="user"><img src="' + e.img + '" /><b>' + e.name + ':</b><br/>'+e.text+'</div>';
		$(insert).prependTo('#mailbox');
	}


	// Запрос на межпространственное зрение
	function vedereInit()
	{
		if(action < max_action) return;
		socket.emit('vedere', {});
		action = 0;
	}
	// Отработка кликов в экран
	function fireInit()
	{
		// Отрисовок в сек : 1000/30
		// 6.5 сек - 6.5 * 1000/30 ~ 216 ~ 220 отрисовок
		if(action < max_action) return;
		socket.emit('fire', state.M);
		action = 15;
	}
	// Обновление списка пользователей 
	function updateUserlist()
	{
		$('#users').html('');
		for(var uid in users)
		$('#users').append('<div class="user'+ ((users[uid].life) ? '' : ' dead') +'">' + 
			'<img src="' + users[uid].img + '" title="' + users[uid].name + '" /></div>');
	}

	// ------------------------------------------------------------------------------------------------------------------------ //
	// Потеря инерции игрока, смещение игрока, изменение состояния
	function onTimePosition()
	{
		agent.y += e.hero.height;
		
		// Телепортация?
		for (var p in map.ports){
			if(agent.x > map.ports[p][0][0] - 10 && agent.x < map.ports[p][0][0] + 10 && agent.y > map.ports[p][0][1] - 10 && agent.y < map.ports[p][0][1] + 10){
				agent.x = map.ports[p][1][0];
				agent.y = map.ports[p][1][1];
				return false;
			}
		}
		
		// Инерция: погашение ускорения
		if(agent.dy != 0) agent.dy = (agent.dy > 0) ? agent.dy - 1 : agent.dy + 1;
		if(agent.dx != 0) agent.dx = (agent.dx > 0) ? agent.dx - 1 : agent.dx + 1;
		
		// Координация ПРАВО-ЛЕВО доступна всегда
		if( state.L ){
			agent.bgOffset = 1;
			agent.dx = -6;
		}
		if( state.R ){
			agent.dx =  6;
			agent.bgOffset = 0;
		}

		// -- Есть ли под ногами земля? 
		
		if(opacity_map[ agent.y + 1 ][ agent.x ] != '1'){
			// Прыжок
			// Вертикальная непроницамость должна быть больше этого числа!
			if(state.S || state.T) {
				sounds['up'].play();
				agent.dy = -20;
			}
			if(agent.dx != 0){
				agent.bg = (agent.bg == 2) ? 0 : agent.bg + 0.5;
				agent.e.css({ backgroundPosition : '-' + (agent.bgOffset*52 + Math.round(agent.bg) * e.hero.width) + 'px 0px' });
			} else {
				agent.e.css({ backgroundPosition : - agent.bgOffset*52 + 'px 0px' });
			}
		}
		// -- Пустота под ногами
		if(opacity_map[ agent.y + 1 ][ agent.x ] == '1'){
			// Падение
			agent.dy += 2;
			agent.e.css({ backgroundPosition : - (agent.bgOffset*52 + 36) + 'px 0px' });
		}
		
		// Проверка ПРАВО-ЛЕВО проницаемости
		if(agent.dy + agent.y < 0 || agent.dy + agent.y >= e.frame.height) agent.dy = 0;
		if(agent.dx + agent.x < 0 || agent.dx + agent.x >= e.frame.width) agent.dx = 0;
		agent.dx = (agent.dx > 0) ? checkOpacityH(agent.y, agent.x, agent.dx, -1) : checkOpacityH(agent.y, agent.x, agent.dx, 1);
		// Вертикальня проницаемость
		agent.dy = checkOpacityV(agent.y, agent.x, agent.dy, ((agent.dy > 0) ? -1 : +1));

		// Смещение на скорость
		agent.x += agent.dx;
		agent.y += agent.dy - e.hero.height;
	}

	// Визуализация освещения, теней сцены
	function onTimeBackgrounds()
	{
		// Отрисовка двидения фонов
		var lightX = agent.x - agent.dx - 125;
		var lightY = agent.y - agent.dy - 125;
		e.light.css({ top : lightY, left : lightX, backgroundPosition : (- lightX) + 'px ' + (- lightY) + 'px' });
		
		// Тенька
		var sx = (1 - agent.x/1200)*100 - 100;
		var sy = (1 - agent.y/600 )*50 - 50;
		e.map.css({left : sx, top : sy});
		
		// Заряд лазера 
		var i = action/max_action; 
		var p = (i > 1) ? 100 : (i * 100);
		e.level.css({ background : 'rgba(225, 55, '+ (190 - Math.round(p * 2)) +', '+ (p * 0.003) +')' , width : p+'%' });
		
		// Суперзрение
		if(backOpacity < 1){
			backOpacity += 0.005;
			e.back[0].style.opacity = backOpacity;
		}
	}

	// Событие в единицу времени
	function one_event()
	{
		var txy = agent.x * agent.y;
		
		action++;

		onTimePosition();
		onTimeBackgrounds()

		// Оповещение сервера о передвижении агента
		agent.e.css({ top : agent.y, left : agent.x });
		if(txy != agent.x * agent.y) socket.emit("txy", [agent.x, agent.y]);
	}

	// ------------------------------------------------------------------------------------------------------------------------ //
	// Инициализация приложения
	function init()
	{
		agent.e
			.width(e.hero.width)
			.height(e.hero.height)
			.css({backgroundImage : 'url('+e.hero.sprite+')'});

		$('#container')
			.css({ opacity : 0 })
			.width(e.frame.width)
			.height(e.frame.height)
			.animate({ opacity : 1 }, 3000);

		// События клавиш
		$(document).on('keydown', 	 keydown);
		$(document).on('keyup', 	 keyup);
		$(document).on('mousedown', mousedown);
		$(document).on('mousemove', mousemove);
		$(document).on('mouseup', 	 mouseup);

		// Запуск отрисовщика
		draw_scene = setInterval(one_event, 30);
		e.ctx = e.canvas[0].getContext("2d");
		
		// Вставка чатико-соощений
		$.post(map.chat, {}, function(e){ e = e.slice(-10); for(var i in e) incoming(e[i]); }, "json");
		$('a.howtoplay').hover(function(){ $('#howtoplay').fadeIn(100); }, function(){ $('#howtoplay').fadeOut(100); })
	}

	// ------------------------------------------------------------------------------------------------------------------------ //
	// Пришло сообщение от друзей или меня
	socket.on('chat-message', function(e){
		incoming(e)
		console.log(e);
	});
	// Пришёл ответ с местоположением людей:
	socket.on('vedere', function(e){
		for (var id in e) if(id != me.id) makeOthers(e[id]);
	});
	// Пришёл ответ с проницаемостью выстрела
	socket.on('fire', function(e){
		// Луч
		fireline(e.point, e.init, (e.id == me.id));
		// Взрыв / Убитые
		if(e.dead) dead(e.point, e.dead, e.id); else explosion(e.point);
	});
	// Я пришёл, мне список пользователей
	socket.on('users', function(e){
		users = e;
		updateUserlist();
	});
	

	socket.on('connecting', function () {
		console.log('Соединение...');
	});
	socket.on('connect', function () {
		console.log('Соединение установленно!');
	});
	
	// Получение карты проницаемости, запуск
	$.post(map.oUser, {}, function(e){ opacity_map = e; init(); });
})(options);
