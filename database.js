module.exports = {
	make: function(pg, url, isLive) {
		this.pg = pg;
		this.url = url;
		this.isLive = isLive;
		this.pg.defaults.ssl = this.isLive;
		return this;
	},
	init: function (callback) {
		var client = new this.pg.Client(this.url);
		client.connect(function(err) {
			if (err) console.log(err);
			client.query('create table if not exists highscore (id serial primary key, username varchar(50) not null, isbot boolean not null, score integer not null, gamemode integer not null, dateutc timestamp without time zone default (now() at time zone \'utc\'));', function(err, result) {
				if (err) console.log(err);
				client.end(function(err) {
					if (err) console.log(err);
				});
				callback();
			});
		});
	},
	getHighscores: function (top, gameMode, callback) {
		var client = new this.pg.Client(this.url);
		client.connect(function(err) {
			if (err) console.log(err);
			client.query('select username, isbot, score, dateutc at time zone \'gmt\' as dateutc from highscore where gamemode = ' + gameMode + ' order by score desc limit ' + top, function(err, results) {
				if (err) console.log(err);
				client.end(function(err) {
					if (err) console.log(err);
				});
				callback(results.rows);
			});
		});
	},
	saveHighscore: function (name, isBot, score, gameMode, callback) {
		var client = new this.pg.Client(this.url);
		client.connect(function(err) {
			if (err) console.log(err);
			client.query('insert into highscore (username, isbot, score, gamemode) values (\'' + name + '\', ' + isBot + ', ' + score + ', ' + gameMode + ');', function(err) {
				if (err) console.log(err);
				client.end(function(err) {
					if (err) console.log(err);
				});
				callback();
			});
		});
	}
};

