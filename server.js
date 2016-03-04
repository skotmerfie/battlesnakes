var port = process.env.PORT || 8080;
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

app.get('/client.js', function (req, res) {
	res.sendFile(__dirname + '/client.js');
});

http.listen(port, function () { });

var snakes = {};
var killedSnakes = {};
var food = {};
var max_food = 5;
var grid_max_width = 100;
var grid_max_height = 70;
var starting_snake_length = 5;

function log(message) {
	console.log(Date.now() + ': ' + message);
}

io.on('connection', function (socket) {
	socket.on('snake', function (data) {
		var newSnake = {
			id: data.id,
			name: data.name,
			color: data.color,
			direction: 'right',
			cells: []
		};

		var startingLocation = randomCoordinates();
		while (startingLocation.x < starting_snake_length) {
			startingLocation = randomCoordinates();
		}
		
		for (var i = 0; i < starting_snake_length; i++) {
			newSnake.cells.push({ x: startingLocation.x - i, y: startingLocation.y });
		}

		snakes[newSnake.id] = newSnake;
	});

	socket.on('direction', function (data) {
		var snake = snakes[data.id];
		snake.direction = data.direction;
	});

	setInterval(function () {
		socket.emit('snakes', snakes);
		socket.emit('food', food);
		socket.emit('killedSnakes', killedSnakes);
	}, 10);
});

setInterval(function () {
	for (id in snakes) {
		var snake = snakes[id];

		var newX = snake.cells[0].x;
		var newY = snake.cells[0].y;
		if (snake.direction === 'right') {
			newX++;
		} else if (snake.direction === 'left') {
			newX--;
		} else if (snake.direction === 'down') {
			newY++;
		} else if (snake.direction === 'up') {
			newY--;
		}

		if (newX === -1 || newX === grid_max_width || newY === -1 || newY === grid_max_height || checkSnakeCollision(newX, newY)) {
			killedSnakes[id] = id;
			delete snakes[id];
		} else {
			var eatenFood = checkFoodCollision(newX, newY);
			if (eatenFood >= 0) {
				delete food[eatenFood];
				createFood();
			} else {
				snake.cells.pop();
			}

			snake.cells.unshift({
				x: newX,
				y: newY
			});
		}
	}
}, 60);

setInterval(function () {
	createFood();
	killedSnakes = {};
}, 15000);

function randomCoordinates() {
	return {
		x: Math.round(Math.random() * grid_max_width),
		y: Math.round(Math.random() * grid_max_height)
	};
}

function checkSnakeCollision(x, y, id) {
	for (snakeId in snakes) {
		var snake = snakes[snakeId];
		if (snake.id !== id) {
			for (var i = 0; i < snake.cells.length; i++) {
				if (snake.cells[i].x === x && snake.cells[i].y === y) {
					return true;
				}
			}
		}
	}
	return false;
}

function checkFoodCollision(x, y) {
	for (id in food) {
		if (x === food[id].x && y === food[id].y) {
			return id;
		}
	}
	return -1;
}

function countSnakes() {
	var count = 0;
	for (snake in snakes) {
		count++;
	}
	return count;
}

function coundFood() {
	var count = 0;
	for (f in food) {
		count++;
	}
	return count;
}

function createFood() {
	if (coundFood() < Math.min(Math.max(1, countSnakes()), max_food)) {
		food[Date.now()] = randomCoordinates();
	}
}
createFood();