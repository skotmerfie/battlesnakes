$(document).ready(function () {
	var deadForm = $("#deadForm")[0];
	var deadForm_name = $("#name")[0];
	var deadForm_color = $("#color")[0];
	var deadForm_play = $("#play")[0];
	var playerList = $("#playerList");

	var canvas = $("#canvas")[0];
	var ctx = canvas.getContext("2d");
	var screen_width = $("#canvas").width();
	var screen_height = $("#canvas").height();
	var cell_width = 10;

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
		for (snakeId in snakes) {
			var snake = snakes[snakeId];
			for (var i = 0; i < snake.cells.length; i++) {
				var cell = snake.cells[i];
				paintCell(cell.x, cell.y, snake.color);
			}
		}
	}

	function paintFood() {
		for (foodId in food) {
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

	function updateScoreboard() {
		playerList.empty();
		for (snakeId in snakes) {
			var snake = snakes[snakeId];
			$("<li><span class='bullet' style=\"color:" + snake.color + "\">■</span>" + snake.name + " (" + snake.score + ")</li>").appendTo(playerList);
		}
	}

	setInterval(function () {
		paintBackground();
		paintSnakes();
		paintFood();
	}, 30);

	setInterval(function () {
		updateScoreboard();

		if (me.alive === 0) {
			deadForm.style.display = "block";
		}
	}, 500);

	deadForm_play.onclick = function (evt) {
		var name = deadForm_name.value;
		var color = deadForm_color.value;

		if (name.length < 3 || name.length > 20) {
			alert('Name must be between 3 - 20 characters.');
		} else {
			me = {
				id: generateId(),
				name: name,
				color: color,
				direction: 'right',
				alive: 1
			};

			socket.emit('snake', me);
			deadForm.style.display = "none";
		}
	};

	socket.on('snakes', function (data) {
		snakes = data;
	});

	socket.on('food', function (data) {
		food = data;
	});

	socket.on('killedSnakes', function (data) {
		for (id in data) {
			if (id == me.id) {
				me.alive = 0;
			}
		}
	});

	$(document).keydown(function (e) {
		if (me.alive === 1) {
			var key = e.which;
			var newDir = me.direction;

			if (key == "37" && me.direction !== "right" && me.direction !== "left") newDir = "left";
			else if (key == "38" && me.direction !== "down" && me.direction !== "up") newDir = "up";
			else if (key == "39" && me.direction !== "left" && me.direction !== "right") newDir = "right";
			else if (key == "40" && me.direction !== "up" && me.direction !== "down") newDir = "down";

			if (me.direction !== newDir) {
				me.direction = newDir;
				socket.emit('direction', {
					id: me.id,
					direction: me.direction
				});
			}
		}
	});
});