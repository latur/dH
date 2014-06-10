<?php
// Файл данных 
// Массив пользователей, их фотографий, имён, id, сессий
define('DB', 'database.json');
// Ключ связки NODE-PHP
define('SKEY', 'a5999cc6451ed0');
define('HOME', 'http://relatur.tk/');


// Настройки OAUTH:
// Скрипт авторизации
$redirect = HOME . 'auth';
// ID приложения
$vk_appid = '3475695';
// Ключ приложения (этот не настоящий!)
$vk_rcode = 'p75g6d7fn23d7f8d7f8c8';
// Запрос прав приложения: 
// http://vk.com/developers.php?oid=-1&p=%D0%9F%D1%80%D0%B0%D0%B2%D0%B0_%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%B0_%D0%BF%D1%80%D0%B8%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9
$vk_scope = 'friends';
// Ссылка авторизации
$auth_url = 'http://oauth.vk.com/authorize?client_id='.$vk_appid.'&scope='.$vk_scope.'&redirect_uri='.urlencode($redirect).'&response_type=code	';
