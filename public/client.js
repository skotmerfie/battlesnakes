$(document).ready(function () {
	var cell_width = 10;
	var max_pings = 10;
	var pings = [];
	var snakes = {};
	var food = {};
	var me = { alive: 0 };
	var socket = io.connect();

	paintScoreboard($("#canvas_scoreboard")[0].getContext("2d"));
	$("#deadForm")[0].style.display = "block";
	$("#name")[0].focus();

	function calcSnakeScore(snake) {
		return (snake.size - 5) + snake.kills;
	}

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
		ctx.fillRect(0, 0, ctx.canvas.clientWidth, ctx.canvas.clientHeight);
	}

	function paintCell(ctx, x, y, color) {
		ctx.fillStyle = color;
		ctx.fillRect(x * cell_width, y * cell_width, cell_width, cell_width);
		ctx.strokeStyle = "black";
		ctx.strokeRect(x * cell_width, y * cell_width, cell_width, cell_width);
	}

	function paintSnakes(ctx) {
		for (var s in snakes) {
			var snake = snakes[s];
			for (var i = 0; i < snake.cells.length; i++) {
				var cell = snake.cells[i];
				paintCell(ctx, cell.x, cell.y, snake.color);
			}
		}
	}

	function paintFood(ctx) {
		for (var f in food) {
			var eatMe = food[f];
			paintCell(ctx, eatMe.x, eatMe.y, "Green");
		}
	}

	function paintScoreboard(ctx) {
		clearCanvas(ctx);

		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = 'black';
		ctx.font = 'bold 28px Arial';
		ctx.textAlign = 'center';
		ctx.fillText('Players', ((ctx.canvas.clientWidth - 20) / 2), 40);
		ctx.fillRect(10, 43, ctx.canvas.clientWidth - 20, 2);

		ctx.font = 'bold 14px Arial';
		ctx.textAlign = 'left';
		ctx.fillText('name', 30, 65, 150);

		ctx.textAlign = 'center';
		ctx.fillText('age', 200, 65);
		ctx.fillText('size', 250, 65);
		ctx.fillText('kills', 300, 65);
		ctx.fillText('score', 350, 65);

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
			ctx.fillText(calcSnakeAge(snake), 200, snakeRow * 25 + 85, 50);
			ctx.fillText(snake.size, 250, snakeRow * 25 + 85, 50);
			ctx.fillText(snake.kills, 300, snakeRow * 25 + 85, 50);
			ctx.fillText(calcSnakeScore(snake), 350, snakeRow * 25 + 85, 50);

			snakeRow++;
		}
	}

	function paintPing(ctx) {
		ctx.fillStyle = "black";
		ctx.font = "10px Arial";
		ctx.textAlign = "left";
		ctx.fillText("Ping: " + calculatePing() + "ms", 5, 10);
	}

	setInterval(function () {
		socket.emit("latencyStart", Date.now());
		paintScoreboard($("#canvas_scoreboard")[0].getContext("2d"));
	}, 1000);

	socket.on("latencyStop", function (data) {
		pings.push(Date.now() - data);
		if (pings.length > max_pings) {
			pings = pings.slice(1, pings.length);
		}
		paintPing($("#canvas_scoreboard")[0].getContext("2d"));
	});

	socket.on("data", function(data) {
		snakes = data.snakes;
		food = data.food;
		if (snakes[socket.id] !== undefined && me.lastMove === "") {
			me.lastMove = snakes[socket.id].direction;
		}
		if (data.killedSnakes[socket.id] !== undefined) {
			me.alive = 0;
			$("#deadForm")[0].style.display = "block";
			$("#name")[0].focus();
		}

		var ctx = $("#canvas")[0].getContext("2d");
		clearCanvas(ctx);
		paintSnakes(ctx);
		paintFood(ctx);
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
			$("#deadForm")[0].style.display = "none";
			$("#chatInput")[0].focus();
		}
		e.preventDefault();
	});

	// Chat events
	$('#chatForm').submit(function (e) {
		var message = $('#chatInput')[0].value;
		if (message.length > 0) {
			socket.emit('message', {
				name: me.name,
				color: me.color,
				message: message
			});
			$('#chatInput')[0].value = '';
		}
		e.preventDefault();
	});

	socket.on('chat', function (message) {
		$('#messages').append($('<li><b>' + message.name + '</b>: ' + message.message + '</li>'));
		$('#messages')[0].scrollTop = $('#messages')[0].scrollHeight;
	});
});