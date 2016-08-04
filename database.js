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
			client.query('create table if not exists highscore ( id serial primary key, username varchar(20) not null, dateUtc timestamp without time zone default (now() at time zone \'utc\'), score integer not null );', function(err, result) {
				if (err) console.log(err);
				client.end(function(err) {
					if (err) console.log(err);
				});
				callback();
			});
		});
	},
	getHighscores: function (top, callback) {
		var client = new this.pg.Client(this.url);
		client.connect(function(err) {
			if (err) console.log(err);
			client.query('select * from highscore order by score desc limit ' + top, function(err, results) {
				if (err) console.log(err);
				client.end(function(err) {
					if (err) console.log(err);
				});
				callback(results.rows);
			});
		});
	},
	saveHighscore: function (name, score, callback) {
		var client = new this.pg.Client(this.url);
		client.connect(function(err) {
			if (err) console.log(err);
			client.query('insert into highscore (username, score) VALUES (\'' + name + '\', ' + score + ');', function(err) {
				if (err) console.log(err);
				client.end(function(err) {
					if (err) console.log(err);
				});
				callback();
			});
		});
	}
};

