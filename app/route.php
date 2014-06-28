<?php
$req = explode('/', str_replace('?', '/', $_SERVER['REQUEST_URI']));

switch($req[1]){
	case 'exit': quit(); break; // Выйти
	case 'maps': maps(); break; // Список карт
	case 'main': main(@$req[2]); break; // Игра
	case 'auth': auth(@$req[2]); break; // Страница входа
	default:     main(); break;
}
