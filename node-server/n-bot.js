// n-bot.js
// ================================================================ //
var Bot = function (map, name, photo, trace) {
	this.id     = (Math.random() + '').replace('0.', 'bot');
	this.map    = map;   // Карта обитания
	this.name   = name;   // Имя
	this.photo  = photo;   // Фото

	this.trace  = trace; // Граф маршрутов робота
	this.point  = 'A1';  // Точка: вершина графа перемещений
	this.branch = false; // Ветка
	this.step   = 0;     // Положение в ветке
	this.steps  = false; // Всего шагов в ветке

	console.log('Пробуждён ' + name);
};

// Шаг по времени
Bot.prototype.action = function(){
	// Если бот на распутье, выбор произвольной ветки из возможных
	if(this.branch === false){
		// Ветка
		this.branch = rand(0, this.trace[this.point].length - 1);
		// Шагов в ветке:
		this.steps  = this.trace[this.point][this.branch][0].length;
	}
	// Если шаг - последний в этой ветке, бот в новой точке - вершине графа
	if(this.step >= this.steps - 1){
		this.point  = this.trace[this.point][this.branch][1];
		this.step   = 0;
		this.steps  = false;
		this.branch = false;
		return this.trace[this.point][0][0][this.step]
	} else {
		this.step++;
		return this.trace[this.point][this.branch][0][this.step];
	}
};

// Внешние параметры клиента, которого видят игроки
Bot.prototype.GetClient = function(){
	return {
		'img'     : this.photo,
		'name'    : this.name,
		'id'      : this.id,
		'life'    : true,
		'points'  : [10,50],
		'reqtime' : 0
	}
};

// Случайное число в интервале
function rand(min, max){
	return Math.round(min - 0.5 + Math.random() * (max - min + 1));
}

module.exports = Bot;
