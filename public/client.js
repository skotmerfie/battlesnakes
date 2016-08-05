$(document).ready(function () {
	var cell_width = 10;
	var max_pings = 10;
	var pings = [];
	var snakes = [];
	var food = {};
	var highscores = [];
	var me = { alive: 0 };
	var socket = io.connect();

	function showSnakeForm() {
		$("#deadForm")[0].style.display = "block";
		$("#name")[0].focus();
	}

	function hideSnakeForm() {
		$("#deadForm")[0].style.display = "none";
		$("#chatInput")[0].focus();
	}

	paintScoreboard($("#canvas_scoreboard")[0].getContext("2d"));
	showSnakeForm();

	function calcSnakeAge(snake) {
		return Math.round((Date.now() - snake.lifeStart) / 1000);
	}

	function calculatePing() {
		var totalPing = 0;
		for (var i = 0; i < pings.length; i++) {
			totalPing += pings[i];
		}
		return Math.round(totalPing / pings.length * 100) / 100;
	}

	function clearCanvas(ctx) {
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	}

	function paintCell(ctx, x, y, bodyColor, outlineColor) {
		ctx.fillStyle = bodyColor;
		ctx.fillRect(x * cell_width, y * cell_width, cell_width, cell_width);
		ctx.strokeStyle = outlineColor;
		ctx.strokeRect(x * cell_width, y * cell_width, cell_width, cell_width);
	}

	function paintSnakes(ctx) {
		for (var s in snakes) {
			var snake = snakes[s];
			for (var i = snake.cells.length - 1; i >= 0; i--) {
				var cell = snake.cells[i];
				paintCell(ctx, cell.x, cell.y, i == 0 ? (snake.isBot ? "Black" : "White") : snake.color, snake.isBot ? "Gray" : "Black");
			}
		}
	}

	function paintFood(ctx) {
		for (var f in food) {
			var eatMe = food[f];
			paintCell(ctx, eatMe.x, eatMe.y, "Green", "Black");
		}
	}

	function paintScoreboard(ctx) {
		ctx.fillStyle = 'black';
		ctx.textBaseline = 'alphabetic';
		ctx.font = 'bold 28px Arial';

		ctx.textAlign = 'center';
		ctx.fillText('Players', 275, 40);
		ctx.fillRect(10, 43, 550, 2);

		ctx.textBaseline = 'middle';
		ctx.font = 'bold 14px Arial';

		ctx.textAlign = 'left';
		ctx.fillText('name', 30, 65, 150);

		ctx.textAlign = 'center';
		ctx.fillText('age', 250, 65);
		ctx.fillText('size', 325, 65);
		ctx.fillText('kills', 400, 65);
		ctx.fillText('score', 475, 65);

		var snakeRow = 0;
		for (var s in snakes) {
			var snake = snakes[s];

			ctx.fillStyle = snake.color;
			ctx.fillRect(10, snakeRow * 25 + 80, 10, 10);
			ctx.strokeStyle = 'black';
			ctx.strokeRect(10, snakeRow * 25 + 80, 10, 10);

			ctx.fillStyle = 'black';
			ctx.font = '12px Arial';
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'left';
			ctx.fillText(snake.name, 30, snakeRow * 25 + 85, 150);
			ctx.textAlign = 'center';
			ctx.fillText(calcSnakeAge(snake), 250, snakeRow * 25 + 85, 50);
			ctx.fillText(snake.size, 325, snakeRow * 25 + 85, 50);
			ctx.fillText(snake.kills, 400, snakeRow * 25 + 85, 50);
			ctx.fillText(snake.score, 475, snakeRow * 25 + 85, 50);

			snakeRow++;
		}
	}

	function paintHighscores(ctx) {
		ctx.fillStyle = 'black';
		ctx.textBaseline = 'alphabetic';
		ctx.font = 'bold 28px Arial';

		ctx.textAlign = 'center';
		ctx.fillText('High Scores', 275, 390);
		ctx.fillRect(10, 393, 550, 2);

		ctx.textBaseline = 'middle';
		ctx.font = 'bold 14px Arial';

		ctx.textAlign = 'left';
		ctx.fillText('name', 30, 415);
		ctx.fillText('date', 200, 415);
		ctx.textAlign = 'center';
		ctx.fillText('score', 450, 415);

		for (var i = 0; i < highscores.length; i++) {
			var score = highscores[i];
			ctx.fillStyle = 'black';
			ctx.font = '12px Arial';
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'left';
			ctx.fillText(score.username, 30, i * 25 + 435, 200);
			ctx.fillText(new Date(score.dateutc).toLocaleString(), 200, i * 25 + 435, 150);
			ctx.textAlign = 'center';
			ctx.fillText(score.score, 450, i * 25 + 435, 150);
		}
	}

	function paintPing(ctx) {
		var ping = calculatePing();
		if (!isNaN(ping)) {
			ctx.fillStyle = "black";
			ctx.font = "10px Arial";
			ctx.textAlign = "left";
			ctx.fillText("Ping: " + ping + "ms", 5, 10);
		}
	}

	setInterval(function () {
		socket.emit("latencyStart", Date.now());
		var ctx = $("#canvas_scoreboard")[0].getContext("2d");
		clearCanvas(ctx);
		paintScoreboard(ctx);
		paintHighscores(ctx);
		paintPing(ctx);
	}, 1000);

	socket.on("latencyStop", function (data) {
		pings.push(Date.now() - data);
		if (pings.length > max_pings) {
			pings = pings.slice(1, pings.length);
		}
	});

	socket.on("data", function(data) {
		snakes = data.snakes;
		food = data.food;
		if (me.lastMove === "") {
			for (var s in snakes) {
				if (snakes[s].id === socket.id) {
					me.lastMove = snakes[s].direction;
					break;
				}
			}
		}
		if (data.killedSnakes[socket.id] !== undefined) {
			me.alive = 0;
			showSnakeForm();
		}

		var ctx = $("#canvas")[0].getContext("2d");
		clearCanvas(ctx);
		paintSnakes(ctx);
		paintFood(ctx);
	});

	socket.on("highscores", function (data) {
		highscores = data;
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
					direction: nextMove
				});
			}

			if (key >= 37 && key <= 40) {
				e.preventDefault();
			}
		}
	});

	$("#snakeForm").submit(function (e) {
		var name = $("#name")[0].value;
		var color = $("#color")[0].value;

		if (name.length < 3 || name.length > 20) {
			alert('Name must be between 3 - 20 characters.');
		} else {
			me = {
				name: name,
				color: color,
				lastMove: "",
				alive: 1
			};

			socket.emit("snake", me);
			hideSnakeForm();
		}
		e.preventDefault();
	});

	$('#chatForm').submit(function (e) {
		var message = $('#chatInput')[0].value;
		if (message.length > 0) {
			if (message === "/help") {
				printHelp();
				addMessageToChatWindow("\"/spectate\" will hide the \"new snake\" form if you just want to watch.");
				addMessageToChatWindow("\"/play\" will show the \"new snake\" form to join the game.");
				addMessageToChatWindow("\"/play\" will show the \"new snake\" form to join the game.");
			} else if (message === "/spectate") {
				hideSnakeForm();
			} else if (message === "/play") {
				showSnakeForm();
			} else {
				socket.emit('message', {
					name: me.name,
					color: me.color,
					message: message
				});
			}
			$('#chatInput')[0].value = '';
		}
		e.preventDefault();
	});

	socket.on('chat', function (message) {
		var who = message.name === undefined ? "unknown" : message.name;
		addMessageToChatWindow('<b>' + who + '</b>: ' + message.message);
	});

	function addMessageToChatWindow(message) {
		$('#messages').append($('<li>' + message + '</li>'));
		$('#messages')[0].scrollTop = $('#messages')[0].scrollHeight;
	}
});