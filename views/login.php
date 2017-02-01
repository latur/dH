<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <title>∆H › Многомерная сетевая игра</title>
    <link href="/client/style.css" rel="stylesheet" type="text/css" />
</head>
<body class="white">
	<div id="help">
		<div class="title">∆H 
			<p class="panel"><? if($user){ ?>
			<a class="btn" href="/main/dream">Мечта</a> <a class="btn" href="/main/first">Бессонница</a> 
			<? } else { ?>
			<a class="btn" href="<?=$GLOBALS['auth_url']?>">Войти с помощью ВКонтакте</a>
			<? } ?></p>
		</div>
		<p>Многомерная сетевая HTML игра на JavaScript'е с использованием Socket.IO</p>
		<img src="/client/img/demo-3.jpg" />
		<p>Идея заключается в том, что каждый игрок находится в своём собственном измерении и не может перебраться в любое другое. 
		Для уничтожения соперников в вашем распоряжении есть два инструмента:<br/>
		<b>Проекция</b> (межпространственное зрение). Нажав клавишу Q вы можете увидеть проекцию игроков из всех измерений в ваши два.<br/>
		<b>Гиперпространственный лазер</b>, поражающий всех во всех измерениях. Активируется кликом мыши в нужное место экрана. 
		Место соприкосновения лазера с поверхностью сопровождается взрывом.</p>
		<p>P.S. <a href="https://github.com/latur/dH" target="_blank">Исходный код.</a></p>
		<img src="/client/img/demo-1.jpg" /> <img src="/client/img/demo-2.jpg" /><br/>
	</div>
</body>
</html>