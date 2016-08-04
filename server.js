var port = process.env.PORT || 8080;
var dbUrl = process.env.DATABASE_URL || 'postgresql://battlesnakes:eatTheFood@localhost:5432/battlesnakes';
var isLive = process.env.DATABASE_URL !== undefined;

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var pg = require('pg');
var db = require('./database.js').make(pg, dbUrl, isLive);


function getHighscoresResult(data) {
	highscores = data;
	emitHighscores();
}
function loadHighscores() {
	db.getHighscores(max_highscores, getHighscoresResult);
}
db.init(loadHighscores);

http.listen(port);
app.use(express.static(path.join(__dirname, 'public')));
app.get("/", function (req, res) {
	res.sendFile(path.join(__dirname, 'public') + "/index.html");
});

var clients = {};
var snakes = {};
var food = {};
var highscores = [];

var min_food = 3;
var max_food = 5;
var max_bots = 10;
var grid_max_width = 80;
var grid_max_height = 80;
var starting_snake_length = 5;
var max_highscores = 5;
var botCounter = 1;

function log(message) {
	console.log(Date.now() + ": " + message);
}

function addSnake(snake) {
	var startingLocation = randomCoordinates();
	var left = startingLocation.x;
	var right = grid_max_width - startingLocation.x;
	var top = startingLocation.y;
	var bottom = grid_max_height - startingLocation.y;
	var closestWall = Math.min(left, right, top, bottom);

	if (left === closestWall) {
		snake.direction = "right";
		for (var i = 0; i < starting_snake_length; i++) {
			snake.cells.push({ x: startingLocation.x + starting_snake_length - i, y: startingLocation.y });
		}
	} else if (right === closestWall) {
		snake.direction = "left";
		for (var i = 0; i < starting_snake_length; i++) {
			snake.cells.push({ x: startingLocation.x - starting_snake_length + i, y: startingLocation.y });
		}
	} else if (top === closestWall) {
		snake.direction = "down";
		for (var i = 0; i < starting_snake_length; i++) {
			snake.cells.push({ x: startingLocation.x, y: startingLocation.y + starting_snake_length - i });
		}
	} else if (bottom === closestWall) {
		snake.direction = "up";
		for (var i = 0; i < starting_snake_length; i++) {
			snake.cells.push({ x: startingLocation.x, y: startingLocation.y - starting_snake_length + i });
		}
	}

	snakes[snake.id] = snake;
}

io.on("connection", function (socket) {
	clients[socket.id] = socket;
	socket.on("disconnect", function () {
		delete clients[socket.id];
	});

	socket.on("snake", function (data) {
		addSnake({
			id: socket.id.substr(2),
			isBot: false,
			name: data.name,
			color: data.color,
			direction: "",
			lifeStart: Date.now(),
			size: starting_snake_length,
			kills: 0,
			cells: [],
			moves: []
		});
	});

	socket.on("direction", function (data) {
		var snake = snakes[socket.id.substr(2)];
		if (snake !== undefined && snake !== null) {
			snake.moves.unshift(data.direction);
		}
	});

	socket.on("latencyStart", function (data) {
		socket.emit("latencyStop", data);
	});

	socket.on('message', function (message) {
		emitMessage(message);
	});

	socket.on('addbot', function() {
		var howManyBots = 0;
		for (var s in snakes) {
			if (snakes[s].isBot) {
				howManyBots++;
			}
		}
		if (howManyBots < max_bots) {
			var id = botCounter++;
			//var botAvoidDeathChance = 1;
			//var botFindFoodChance = 1;
			var botAvoidDeathChance = Math.random() * 0.2 + 0.8;
			var botFindFoodChance = Math.random() * 0.5 + 0.1;
			var botAvoidOtherSnakes = Math.random() < 0.1 ? 0 : Math.random() * 640;
			var botName = "bot " + id + " (" + botAvoidDeathChance.toFixed(2) + "; " + botFindFoodChance.toFixed(2) + "; " + botAvoidOtherSnakes.toFixed(0) + ")";

			addSnake({
				id: id,
				isBot: true,
				botAvoidDeathChance: botAvoidDeathChance,
				botFindFoodChance: botFindFoodChance,
				botAvoidOtherSnakes: botAvoidOtherSnakes,
				name: botName,
				color: randomColor(),
				direction: "",
				lifeStart: Date.now(),
				size: starting_snake_length,
				kills: 0,
				cells: [],
				moves: []
			});
		}
	});

	if (highscores.length > 0) {
		socket.emit("highscores", highscores);
	}
});

function emitMessage(message) {
	for (var c in clients) {
		if (clients[c] !== null) {
			clients[c].emit('chat', message);
		}
	}
}

function emitHighscores() {
	for (var c in clients) {
		if (clients[c] !== null) {
			clients[c].emit('highscores', highscores);
		}
	}
}

setInterval(function () {
	var killedSnakes = {};
	for (var s in snakes) {
		var snake = snakes[s];
		var newX = snake.cells[0].x;
		var newY = snake.cells[0].y;

		if (snake.isBot) {
			moveBot(snake);
		}

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
		if (newX === -1 || newX === grid_max_width || newY === -1 || newY === grid_max_height || snakeCollision !== "") {
			if (snakeCollision !== "" && snakeCollision !== snake.id) {
				snakes[snakeCollision].kills++;
			}
			if (!snake.isBot) {
				checkHighscore(snake.name, calculateScore(snake));
			}
			killedSnakes[snake.id] = snake.id;
			delete snakes[snake.id];
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
			food: food
		});
	}
}, 60);

function moveBot(snake) {
	var currentDirection = snake.direction;
	var botX = snake.cells[0].x;
	var botY = snake.cells[0].y;
	if (Math.random() < snake.botFindFoodChance) {
		var targetFood = findTargetFood(snake, botX, botY);
		if (targetFood != null) {
			var moveUpOrDown = "";
			if (botY > targetFood.y)
				moveUpOrDown = "up"
			else if (botY < targetFood.y)
				moveUpOrDown = "down";

			var moveLeftOrRight = "";
			if (botX > targetFood.x)
				moveLeftOrRight = "left"
			else if (botX < targetFood.x)
				moveLeftOrRight = "right";
			
			if (currentDirection !== moveUpOrDown && currentDirection !== moveLeftOrRight) {
				if (currentDirection === "up") {
					if (moveLeftOrRight !== "") {
						if (!checkBotDeath(botX, botY, moveLeftOrRight)) {
							snake.moves.unshift(moveLeftOrRight);
							return;
						}
					}
				} else if (currentDirection === "down") {
					if (moveLeftOrRight !== "") {
						if (!checkBotDeath(botX, botY, moveLeftOrRight)) {
							snake.moves.unshift(moveLeftOrRight);
							return;
						}
					}
				} else if (currentDirection === "right") {
					if (moveUpOrDown !== "") {
						if (!checkBotDeath(botX, botY, moveUpOrDown)) {
							snake.moves.unshift(moveUpOrDown);
							return;
						}
					}
				} else if (currentDirection === "left") {
					if (moveUpOrDown !== "") {
						if (!checkBotDeath(botX, botY, moveUpOrDown)) {
							snake.moves.unshift(moveUpOrDown);
							return;
						}
					}
				}
			}
		}
	}
	var willDie = checkBotDeath(botX, botY, currentDirection);
	if (willDie && Math.random() < snake.botAvoidDeathChance) {
		if (currentDirection === "up" || currentDirection === "down") {
			var willDieLeft = checkBotDeath(botX, botY, "left");
			var willDieRight = checkBotDeath(botX, botY, "right");
			if (!willDieLeft && !willDieRight) {
				snake.moves.unshift(Math.random() < 0.5 ? "left" : "right");
			} else if (!willDieLeft) {
				snake.moves.unshift("left");
			} else {
				snake.moves.unshift("right");
			}
		} else {
			var willDieUp = checkBotDeath(botX, botY, "up");
			var willDieDown = checkBotDeath(botX, botY, "down");
			if (!willDieUp && !willDieDown) {
				snake.moves.unshift(Math.random() < 0.5 ? "up" : "down");
			} else if (!willDieUp) {
				snake.moves.unshift("up");
			} else {
				snake.moves.unshift("down");
			}
		}
	}
}

function checkBotDeath(x, y, direction) {
	var newX = x;
	var newY = y; 
	if (direction === "right") {
		newX++;
	} else if (direction === "left") {
		newX--;
	} else if (direction === "down") {
		newY++;
	} else if (direction === "up") {
		newY--;
	}

	var snakeCollision = checkSnakeCollision(newX, newY);
	if (newX === -1 || newX === grid_max_width || newY === -1 || newY === grid_max_height || snakeCollision !== "") {
		return true;
	}
}

function findClosestFood(x, y) {
	var closestFood = null;
	var closestFoodDistance = 9999999999999;

	for (var f in food) {
		var checkFood = food[f];
		var distance = Math.abs(checkFood.x - x) + Math.abs(checkFood.y - y);
		if (distance < closestFoodDistance) {
			closestFood = checkFood;
			closestFoodDistance = distance;
		}
	}
	return closestFood;
}

function findTargetFood(snake, x, y) {
	var bestFood = null;
	var bestFoodScore = -999999;

	for (var f in food) {
		var checkFood = food[f];
		var distance = Math.abs(checkFood.x - x) + Math.abs(checkFood.y - y);
		var closestEnemyDistance = 999999;
		for (var s in snakes) {
			var enemySnake = snakes[s];
			if (enemySnake.id !== snake.id) {
				var enemyDistance = Math.abs(checkFood.x - enemySnake.cells[0].x) + Math.abs(checkFood.y - enemySnake.cells[0].y);
				if (enemyDistance < closestEnemyDistance) {
					closestEnemyDistance = enemyDistance;
				}
			}
		}

		var foodScore = (160 / distance) - (snake.botAvoidOtherSnakes / closestEnemyDistance);

		if (foodScore > bestFoodScore) {
			bestFood = checkFood;
			bestFoodScore = foodScore;
		}
	}
	return bestFood;
}

function findFoodOnX(x) {
	for (var f in food) {
		if (food[f].x === x)
			return food[f];
	}
	return null;
}

function findFoodOnY(y) {
	for (var f in food) {
		if (food[f].y === y)
			return food[f];
	}
	return null;
}

function randomCoordinates() {
	return {
		x: Math.floor(Math.random() * grid_max_width),
		y: Math.floor(Math.random() * grid_max_height)
	};
}

function checkSnakeCollision(x, y) {
	for (var s in snakes) {
		var snake = snakes[s];
		for (var i = 0; i < snake.cells.length; i++) {
			if (snake.cells[i].x === x && snake.cells[i].y === y) {
				return snake.id;
			}
		}
	}
	return "";
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

function checkHighscore(name, score) {
	if (highscores.length < max_highscores) {
		db.saveHighscore(name, score, loadHighscores);
	} else {
		console.log("");
		console.log("NewScore: " + score);
		console.log("WorstHighScore: " + highscores[max_highscores - 1].score);
		if (score > highscores[max_highscores - 1].score) {
			console.log("attempting to save highscore");
			db.saveHighscore(name, score, loadHighscores);
		}
	}
}

function calculateScore(snake) {
	return (snake.size - starting_snake_length) + snake.kills;
}

function randomColor() {
	var red = Math.floor(Math.random() * 255);
	var green = Math.floor(Math.random() * 255);
	var blue = Math.floor(Math.random() * 255);
	return "rgb(" + red + "," + green + "," + blue + ")";
}