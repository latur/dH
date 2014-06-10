<?php
$module = isset($_GET['module']) ? strtolower($_GET['module']) : 'main';
if(preg_match('/[^a-z]/', $module)) $module = 'main';

switch($module){
	case 'exit': quit(); break;
	case 'main': main(); break;
	case 'auth': auth(); break;
	default: die('<pre>1≠0'); break;
}
