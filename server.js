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
var max_food = 10;
var grid_max_width = 80;
var grid_max_height = 80;
var starting_snake_length = 5;
var max_highscores = 5;
var max_bots = 10;
var botCounter = 1;
var desiredBots = 0;
var desiredTickRate = 60;

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
		var command = message.message;
		if (command.startsWith("/bots")) {
			var splitCommand = command.split(" ");
			if (splitCommand.length > 1) {
				var botCount = parseInt(splitCommand[1]);
				if (!isNaN(botCount)) {
					desiredBots = Math.max(0, Math.min(botCount, max_bots));
				}
			}
		} else if (command.startsWith("/clearbots")) {
			desiredBots = 0;
			killBots();
		} else if (command.startsWith("/tick")) {
			var splitCommand = command.split(" ");
			if (splitCommand.length > 1) {
				var tickRate = parseInt(splitCommand[1]);
				if (!isNaN(tickRate)) {
					desiredTickRate = Math.max(10, Math.min(tickRate, 1000));
				}
			}
		} else {
			if (message.name === undefined) {
				message.name = "unknown " + socket.id.substr(2);
			}
			emitMessage(message);
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

setTimeout(tick, desiredTickRate);
function tick() {
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
			checkHighscore(snake.name, calculateScore(snake));
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
	createBots();

	for (var c in clients) {
		clients[c].emit("data", {
			snakes: sortedSnakes(),
			killedSnakes: killedSnakes,
			food: food
		});
	}

	setTimeout(tick, desiredTickRate);
}

function sortedSnakes() {
	var sortableSnakes = [];
	for (var s in snakes) {
		var snake = snakes[s];
		snake.score = calculateScore(snake);
		sortableSnakes.push(snake);
	}
	return sortableSnakes.sort(function(a,b) {
		return b.score - a.score;
	});
}

function killBots() {
	for (var s in snakes) {
		if (snakes[s].isBot) {
			delete snakes[s];
		}
	}
}

function addBot() {
	if (countBots() < max_bots) {
		var id = botCounter++;
		var botAvoidDeathChance = Math.random() * 0.2 + 0.8;
		var botFindFoodChance = Math.random() * 0.5 + 0.25;
		var botAvoidOtherSnakes = Math.random() < 0.1 ? 0 : Math.random() * 640;
		var botName = "bot " + id + " (" + botAvoidDeathChance.toFixed(2) + "; " + botFindFoodChance.toFixed(2) + "; " + botAvoidOtherSnakes.toFixed(0) + ")";

		addSnake({
			id: id,
			isBot: true,
			botAvoidDeathChance: botAvoidDeathChance,
			botFindFoodChance: botFindFoodChance,
			botAvoidOtherSnakes: botAvoidOtherSnakes,
			botLastMoves: {
				rotation: "",
				countMoves: 0,
				countTicks: 0
			},
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
}

function checkBotMove(snake, direction) {
	var botX = snake.cells[0].x;
	var botY = snake.cells[0].y;

	if (checkBotDeath(botX, botY, direction)) {
		return false;
	}

	var rotation = getRotation(snake.direction, direction);
	if (snake.botLastMoves.rotation === rotation && snake.botLastMoves.countMoves === 3 && snake.botLastMoves.countTicks <= snake.size) {
		return false;
	}

	return true;
}

function makeBotMove(snake, direction) {
	var rotation = getRotation(snake.direction, direction);
	if (snake.botLastMoves.rotation === rotation) {
		snake.botLastMoves.countMoves++;
	} else {
		snake.botLastMoves.rotation = rotation;
		snake.botLastMoves.countMoves = 1;
		snake.botLastMoves.countTicks = 1;
	}

	snake.moves.unshift(direction);
}

function getRotation(fromDirection, toDirection) {
	if ((fromDirection === "up" && toDirection === "right") ||
		(fromDirection === "right" && toDirection === "down") ||
		(fromDirection === "down" && toDirection === "left") ||
		(fromDirection === "left" && toDirection === "up")
	) {
		return "clockwise";
	} else if ((fromDirection === "up" && toDirection === "left") ||
		(fromDirection === "left" && toDirection === "down") ||
		(fromDirection === "down" && toDirection === "right") ||
		(fromDirection === "right" && toDirection === "up")
	) {
		return "counter-clockwise";
	}
}

function moveBot(snake) {
	var currentDirection = snake.direction;
	var botX = snake.cells[0].x;
	var botY = snake.cells[0].y;
	snake.botLastMoves.countTicks++;
	
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
				if (currentDirection === "up" || currentDirection === "down") {
					if (moveLeftOrRight !== "") {
						if (checkBotMove(snake, moveLeftOrRight)) {
							makeBotMove(snake, moveLeftOrRight);
							return;
						}
					}
				} else if (currentDirection === "right" || currentDirection === "left") {
					if (moveUpOrDown !== "") {
						if (checkBotMove(snake, moveUpOrDown)) {
							makeBotMove(snake, moveUpOrDown);
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
			var canMoveLeft = checkBotMove(snake, "left");
			var canMoveRight = checkBotMove(snake, "right");
			if (canMoveLeft && canMoveRight) {
				makeBotMove(snake, Math.random() < 0.5 ? "left" : "right");
			} else if (canMoveLeft) {
				makeBotMove(snake, "left");
			} else if (canMoveRight) {
				makeBotMove(snake, "right");
			} else {
				/*
				console.log("")
				console.log("oh no, going to die!");
				console.log(snake.name + ": (" + snake.cells[0].x + "," + snake.cells[0].y + ") " + snake.direction);
				console.log("up: " + whyNoMove(snake, "up"));
				console.log("down: " + whyNoMove(snake, "down"));
				console.log("left: " + whyNoMove(snake, "left"));
				console.log("right: " + whyNoMove(snake, "right"));
				*/
			}
		} else {
			var canMoveUp = checkBotMove(snake, "up");
			var canMoveDown = checkBotMove(snake, "down");
			if (canMoveUp && canMoveDown) {
				makeBotMove(snake, Math.random() < 0.5 ? "up" : "down");
			} else if (canMoveUp) {
				makeBotMove(snake, "up");
			} else if (canMoveDown) {
				makeBotMove(snake, "down");
			} else {
				/*
				console.log("")
				console.log("oh no, going to die!");
				console.log(snake.name + ": (" + snake.cells[0].x + "," + snake.cells[0].y + ") " + snake.direction);
				console.log("up: " + whyNoMove(snake, "up"));
				console.log("down: " + whyNoMove(snake, "down"));
				console.log("left: " + whyNoMove(snake, "left"));
				console.log("right: " + whyNoMove(snake, "right"));
				*/
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

function whyNoMove(snake, direction) {
	var newX = snake.cells[0].x;
	var newY = snake.cells[0].y;
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
	var rotation = getRotation(snake.direction, direction);

	if (newX === -1 || newX === grid_max_width || newY === -1 || newY === grid_max_height) {
		return "WALL";
	} else if (snakeCollision !== "") {
		return "SNAKE-" + snakeCollision;
	} else if (snake.botLastMoves.rotation === rotation && snake.botLastMoves.countMoves === 3 && snake.botLastMoves.countTicks <= snake.size) {
		return "BOX-IN";
	}
	return "???"
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

function countBots() {
	var howManyBots = 0;
	for (var s in snakes) {
		if (snakes[s].isBot) {
			howManyBots++;
		}
	}
	return howManyBots;
}

function createFood() {
	if (countFood() < Math.min(Math.max(min_food, Math.floor(countSnakes() * 0.75)), max_food)) {
		food[Date.now()] = randomCoordinates();
	}
}

function createBots() {
	if (countBots() < desiredBots) {
		addBot();
	}
}

function checkHighscore(name, score) {
	if (highscores.length < max_highscores) {
		db.saveHighscore(name, score, loadHighscores);
	} else {
		if (score > highscores[max_highscores - 1].score) {
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