<!DOCTYPE html>
<html lang="ru">
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
	<title>∆H › L </title>
	<link href="/client/style.css" rel="stylesheet" type="text/css" />
</head>
<body>
	<noscript>JavaScript is required :(</noscript>
	<div id="page">
		<!-- Список игроков -->
		<div id="users"></div>
		<!-- Игровая зона -->
		<div id="container">
			<div id="world-back"></div>
			<div id="world-shadow"></div>
			<div id="world-front"></div>
			<div id="world-light"></div>
			<div id="me"></div>
			<canvas id="canvas" width="1200" height="600"></canvas>
			<div class="message" id="howtoplay">
				<p><span class="btn">A</span> <span class="btn">W</span> <span class="btn">D</span> или 
				<span class="btn">&larr;</span> <span class="btn">&uarr;</span> <span class="btn">&rarr;</span> — перемещение.<br/>
				<span class="btn">Q</span> — межпространственное <b>зрение</b><br/>
				<span class="btn level">клик мышью в экран</span> — гиперпространственый <b>лазер</b>
				<span class="btn level">Enter</span> — отправка <b>сообщения</b> всем игрокам</p>
			</div>
		</div>
		<!-- Чат, уровень «маны» -->
		<div id="subcontainer">
			<div class="lazerlevel"></div>
			<div id="mailbox"></div>
			<a class="btn logout" href="/exit">выйти</a> <a class="btn howtoplay" >как играть?</a>
		</div>
	</div>
	<script type="text/javascript">
		var map = <?=json_encode($map)?>;
		var initpoint  = <?=json_encode($map->points[rand(0, count($map->points) - 1)])?>;
		var connection = '<?=(WS.'?'.http_build_query($auth))?>';
		var me = { name : '<?=json_decode($auth['name'])?>', photo : '<?=$auth['photo']?>', id : '<?=$auth['id']?>' };
	</script>
	<script src="http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js"></script>
	<script src="<?=WS?>socket.io/socket.io.js"></script>
	<script src="/client/app.js"></script>
</body>
</html>