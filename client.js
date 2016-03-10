$(document).ready(function () {
	var deadForm = $("#deadForm")[0];
	var deadForm_name = $("#name")[0];
	var deadForm_color = $("#color")[0];
	var deadForm_play = $("#play")[0];

	var canvas = $("#canvas")[0];
	var ctx = canvas.getContext("2d");
	var screen_width = $("#canvas").width();
	var screen_height = $("#canvas").height();
	var cell_width = 10;
	var max_pings = 100;

	var canvas_scoreboard = $("#canvas_scoreboard")[0];
	var ctx_sb = canvas_scoreboard.getContext("2d");
	var scoreboard_width = $("#canvas_scoreboard").width();
	var scoreboard_height = $("#canvas_scoreboard").height();

	var pings = [];
	var snakes = {};
	var food = {};
	var me = { alive: 0 };
	var socket = io.connect();

	function generateId() {
		return Date.now();
	}

	function paintCell(x, y, color) {
		ctx.fillStyle = color;
		ctx.fillRect(x * cell_width, y * cell_width, cell_width, cell_width);
		ctx.strokeStyle = "black";
		ctx.strokeRect(x * cell_width, y * cell_width, cell_width, cell_width);
	}

	function paintSnakes() {
		for (var snakeId in snakes) {
			var snake = snakes[snakeId];
			for (var i = 0; i < snake.cells.length; i++) {
				var cell = snake.cells[i];
				paintCell(cell.x, cell.y, snake.color);
			}
		}
	}

	function paintFood() {
		for (var foodId in food) {
			var eatMe = food[foodId];
			paintCell(eatMe.x, eatMe.y, "Green");
		}
	}

	function paintBackground() {
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, screen_width, screen_height);
		ctx.strokeStyle = "black";
		ctx.strokeRect(0, 0, screen_width, screen_height);
	}

	function calcSnakeScore(snake) {
		return (snake.size - 5) + snake.kills;
	}

	function calcSnakeAge(snake) {
		return Math.round((Date.now() - snake.lifeStart) / 1000);
	}

	function updateScoreboard() {
		ctx_sb.textBaseline = 'alphabetic';
		ctx_sb.fillStyle = 'white';
		ctx_sb.fillRect(0, 0, scoreboard_width, scoreboard_height);

		ctx_sb.fillStyle = 'black';
		ctx_sb.font = 'bold 28px Arial';
		ctx_sb.textAlign = 'center';
		ctx_sb.fillText('Players', ((scoreboard_width - 20) / 2), 40);
		ctx_sb.fillRect(10, 43, scoreboard_width - 20, 2);

		ctx_sb.font = 'bold 14px Arial';
		ctx_sb.textAlign = 'left';
		ctx_sb.fillText('name', 30, 65, 150);

		ctx_sb.textAlign = 'center';
		ctx_sb.fillText('age', 200, 65);
		ctx_sb.fillText('size', 250, 65);
		ctx_sb.fillText('kills', 300, 65);
		ctx_sb.fillText('score', 350, 65);

		var snakeRow = 0;
		for (var snakeId in snakes) {
			var snake = snakes[snakeId];

			ctx_sb.fillStyle = snake.color;
			ctx_sb.fillRect(10, snakeRow * 25 + 80, 10, 10);
			ctx_sb.strokeStyle = 'black';
			ctx_sb.strokeRect(10, snakeRow * 25 + 80, 10, 10);

			ctx_sb.fillStyle = 'black';
			ctx_sb.font = '12px Arial';
			ctx_sb.textBaseline = 'middle';
			ctx_sb.textAlign = 'left';
			ctx_sb.fillText(snake.name, 30, snakeRow * 25 + 85, 150);
			ctx_sb.textAlign = 'center';
			ctx_sb.fillText(calcSnakeAge(snake), 200, snakeRow * 25 + 85, 50);
			ctx_sb.fillText(snake.size, 250, snakeRow * 25 + 85, 50);
			ctx_sb.fillText(snake.kills, 300, snakeRow * 25 + 85, 50);
			ctx_sb.fillText(calcSnakeScore(snake), 350, snakeRow * 25 + 85, 50);

			snakeRow++;
		}
	}

	function calculatePing() {
		var totalPing = 0;
		for (var i = 0; i < pings.length; i++) {
			totalPing += pings[i];
		}
		return Math.round(totalPing / pings.length * 100) / 100;
	}

	function updatePing() {
		ctx_sb.fillStyle = "black";
		ctx_sb.font = "10px Arial";
		ctx_sb.textAlign = "left";
		ctx_sb.fillText("Ping: " + calculatePing() + "ms", 5, 10);
	}

	setInterval(function () {
		paintBackground();
		paintSnakes();
		paintFood();
	}, 30);

	setInterval(function () {
		updateScoreboard();
		updatePing();

		if (me.alive === 0) {
			deadForm.style.display = "block";
		}
	}, 500);

	deadForm_play.onclick = function () {
		var name = deadForm_name.value;
		var color = deadForm_color.value;

		if (name.length < 3 || name.length > 20) {
			alert('Name must be between 3 - 20 characters.');
		} else {
			me = {
				id: generateId(),
				name: name,
				color: color,
				lastMove: "",
				alive: 1
			};

			socket.emit("snake", me);
			deadForm.style.display = "none";
		}
	};

	socket.on("data", function(data) {
		snakes = data.snakes;
		food = data.food;
		if (snakes[me.id] !== undefined && me.lastMove === "") {
			me.lastMove = snakes[me.id].direction;
		}
		if (data.killedSnakes[me.id] !== undefined) {
			me.alive = 0;
		}
		pings.push(Date.now() - data.ping);
		if (pings.length > max_pings) {
			pings = pings.slice(1, pings.length);
		}
	});

	$(document).keydown(function (e) {
		if (me.alive === 1) {
			var key = e.which;
			var nextMove = "";

			if (key === 37 && me.lastMove !== "right") nextMove = "left";
			else if (key === 38 && me.lastMove !== "down") nextMove = "up";
			else if (key === 39 && me.lastMove !== "left") nextMove = "right";
			else if (key === 40 && me.lastMove !== "up") nextMove = "down";

			if (nextMove !== "" && nextMove !== me.lastMove) {
				me.lastMove = nextMove;
				socket.emit("direction", {
					id: me.id,
					direction: nextMove
				});
			}
		}
	});
});