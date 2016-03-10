var port = process.env.PORT || 8080;
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get("/", function (req, res) {
	res.sendFile(__dirname + "/index.html");
});

app.get("/client.js", function (req, res) {
	res.sendFile(__dirname + "/client.js");
});

app.get("/style.css", function (req, res) {
	res.sendFile(__dirname + "/style.css");
});

http.listen(port, function () { });

var clients = {};
var snakes = {};
var food = {};

var min_food = 3;
var max_food = 5;
var grid_max_width = 100;
var grid_max_height = 70;
var starting_snake_length = 5;

function log(message) {
	console.log(Date.now() + ": " + message);
}

io.on("connection", function (socket) {
	clients[socket.id] = socket;
	socket.on("snake", function (data) {
		var newSnake = {
			id: data.id,
			name: data.name,
			color: data.color,
			direction: "",
			lifeStart: Date.now(),
			size: starting_snake_length,
			kills: 0,
			cells: [],
			moves: []
		};
		
		var startingLocation = randomCoordinates();
		var left = startingLocation.x;
		var right = grid_max_width - startingLocation.x;
		var top = startingLocation.y;
		var bottom = grid_max_height - startingLocation.y;
		var closestWall = Math.min(left, right, top, bottom);

		if (left === closestWall) {
			newSnake.direction = "right";
			for (var i = 0; i < starting_snake_length; i++) {
				newSnake.cells.push({ x: startingLocation.x + starting_snake_length - i, y: startingLocation.y });
			}
		} else if (right === closestWall) {
			newSnake.direction = "left";
			for (var i = 0; i < starting_snake_length; i++) {
				newSnake.cells.push({ x: startingLocation.x - starting_snake_length + i, y: startingLocation.y });
			}
		} else if (top === closestWall) {
			newSnake.direction = "down";
			for (var i = 0; i < starting_snake_length; i++) {
				newSnake.cells.push({ x: startingLocation.x, y: startingLocation.y + starting_snake_length - i });
			}
		} else if (bottom === closestWall) {
			newSnake.direction = "up";
			for (var i = 0; i < starting_snake_length; i++) {
				newSnake.cells.push({ x: startingLocation.x, y: startingLocation.y - starting_snake_length + i });
			}
		}

		snakes[newSnake.id] = newSnake;
	});

	socket.on("direction", function (data) {
		var snake = snakes[data.id];
		if (snake !== undefined && snake !== null) {
			snake.moves.unshift(data.direction);
		}
	});
});

setInterval(function () {
	var killedSnakes = {};
	for (var id in snakes) {
		var snake = snakes[id];

		var newX = snake.cells[0].x;
		var newY = snake.cells[0].y;
		snake.direction = snake.moves.length === 0 ? snake.direction : snake.moves.pop();
		if (snake.direction === "right") {
			newX++;
		} else if (snake.direction === "left") {
			newX--;
		} else if (snake.direction === "down") {
			newY++;
		} else if (snake.direction === "up") {
			newY--;
		}

		var snakeCollision = checkSnakeCollision(newX, newY);
		if (newX === -1 || newX === grid_max_width || newY === -1 || newY === grid_max_height || snakeCollision >= 0) {
			killedSnakes[id] = snake.id;
			delete snakes[id];

			if (snakeCollision >= 0 && snakeCollision !== snake.id) {
				snakes[snakeCollision].kills++;
			}
		} else {
			var eatenFood = checkFoodCollision(newX, newY);
			if (eatenFood >= 0) {
				delete food[eatenFood];
				createFood();
				snake.size++;
			} else {
				snake.cells.pop();
			}

			snake.cells.unshift({
				x: newX,
				y: newY
			});
		}
	}
	createFood();
	
	for (var c in clients) {
		clients[c].emit("data", {
			snakes: snakes,
			killedSnakes: killedSnakes,
			food: food,
			ping: Date.now()
		});
	}
}, 60);

function randomCoordinates() {
	return {
		x: Math.floor(Math.random() * grid_max_width),
		y: Math.floor(Math.random() * grid_max_height)
	};
}

function checkSnakeCollision(x, y, id) {
	for (var snakeId in snakes) {
		var snake = snakes[snakeId];
		if (snake.id !== id) {
			for (var i = 0; i < snake.cells.length; i++) {
				if (snake.cells[i].x === x && snake.cells[i].y === y) {
					return snake.id;
				}
			}
		}
	}
	return -1;
}

function checkFoodCollision(x, y) {
	for (var id in food) {
		if (x === food[id].x && y === food[id].y) {
			return id;
		}
	}
	return -1;
}

function countSnakes() {
	var count = 0;
	for (var snake in snakes) {
		count++;
	}
	return count;
}

function countFood() {
	var count = 0;
	for (var f in food) {
		count++;
	}
	return count;
}

function createFood() {
	if (countFood() < Math.min(Math.max(min_food, countSnakes()), max_food)) {
		food[Date.now()] = randomCoordinates();
	}
}