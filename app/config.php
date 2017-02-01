<?php
// Файл данных 
// Массив пользователей, их фотографий, имён, id, сессий
define('DB', 'database.json');
// Ключ связки NODE-PHP
define('SKEY', '');
define('HOME', 'https://relatur.tk/');
define('WS',   'https://relatur.tk:8967/');


// Настройки OAUTH:
// Скрипт авторизации
$redirect = HOME . 'auth';
// ID приложения
$vk_appid = '4560732';
// Ключ приложения
$vk_rcode = '';
// Запрос прав приложения: 
// http://vk.com/developers.php?oid=-1&p=%D0%9F%D1%80%D0%B0%D0%B2%D0%B0_%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%B0_%D0%BF%D1%80%D0%B8%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9
$vk_scope = 'friends';
// Ссылка авторизации
$auth_url = 'http://oauth.vk.com/authorize?client_id='.$vk_appid.'&scope='.$vk_scope.'&redirect_uri='.urlencode($redirect).'&response_type=code	';
