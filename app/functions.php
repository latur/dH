<?php
// Найти пользователя в базе
function find($key){
	$db = (array) json_decode(@file_get_contents(DB));
	foreach($db as $user) if($user->key === $key) return $user;
	return false;
}

// Добавить пользователя
function uadd($info){
	$db  = (array) json_decode(file_get_contents(DB));
	$new = array();
	// Проверка повторной авторизации
	foreach($db as $user) if($user->id != $info['id']) $new[] = $user;
	// Добавление пользователя
	$new[] = $info;
	// Сохраниение
	$H = fopen(DB, 'w+');
	fputs($H, json_encode($new));
	fclose($H);
	setcookie('u', $info['key'], time() + 60*60*24*200);
}

// Авторизация. Человек с кодом
function auth(){
	if(isset($_GET['error']) || !isset($_GET['code'])) die('<pre>Неведомая ошибка! Эвакуируемся');
	
	// Code получен. Попытка получения token'а с помощью code
	$request = array(
		'client_id' => $GLOBALS['vk_appid'],
		'client_secret' => $GLOBALS['vk_rcode'],
		'code' => $_GET['code'],
		'redirect_uri' => $GLOBALS['redirect']
	);
	
	$data = json_decode( file_get_contents( 'https://oauth.vk.com/access_token?' . http_build_query($request)));
	if(@!$data->access_token) die('<pre>В самый последний внезапный момент крах вас настиг. Соболезнуем');
	
	// Успех:
	// Картинка пользователя, имя, данные, запись в куки
	$req  = 'https://api.vk.com/method/users.get?uid='.$data->user_id.'&fields=first_name,last_name,sex,photo&access_token='.$data->access_token;
	$info = json_decode( file_get_contents( $req ) );
	
	if(@$info->response[0]->uid != $data->user_id) die('<pre>Катастрофа!');
	
	$newUser = array(
		'id' => $data->user_id,
		'name' => $info->response[0]->first_name,
		'lastname' => $info->response[0]->last_name,
		'sex' => $info->response[0]->sex,
		'photo' => $info->response[0]->photo,
		'key' => sha1(uniqid())
	);
	
	uadd($newUser);
	header("Location: ".HOME);
}

// Главная страница
function main($mapid = 'first'){
	$user = find(@$_COOKIE['u']);
	if($user){
		// Список карт:
		$maps = file_get_contents('client/maps/config.json');
		$maps = str_replace("/",'\\/',$maps);
		$maps = json_decode($maps);
		$mapid = @$maps->{$mapid} ? $mapid : 'first';

		// Данные для вторизации NODE.JS
		$auth = array(
			'id' => $user->id,
			'name' => json_encode($user->name),
			'full_name' => json_encode($user->name . ' ' . $user->lastname),
			'photo' => $user->photo,
			'auth_key' => md5(uniqid('chat', true)),
			'tm' => time(),
			'map' => $mapid
		);
		$auth['sig'] = signature($auth);

		// Последние сообщения 
		$saved = explode("\n", file_get_contents('messages.json'));
		$messages = array();
		foreach($saved as $e) if($e != '') $messages[] = json_decode($e);

		// Информация о карте
		$map  = $maps->{$mapid};

		include 'views/main.php';
		exit;
	}
	include 'views/login.php';
}

// Выбрать карту
function maps(){
	$user = find(@$_COOKIE['u']);
	if(!$user) return auth();
	include 'views/maps.php';
	exit;
}


// Выход из системы
function quit(){
	setcookie('u', '', 0);
	header("Location: ".HOME);
}

// Генерация подписи
function signature($array){
	ksort($array);
	$str = '';
	foreach ($array as $k => $v) $str .= "$k=$v";
	return md5($str . SKEY);
}

//  chown mathilde:www-data /home/mathilde/www/pioggia.tk/database.json
//  chown mathilde:www-data /home/mathilde/www/pioggia.tk/messages.json


