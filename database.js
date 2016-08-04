module.exports = {
	make: function(pg, url, isLive) {
		this.pg = pg;
		this.url = url;
		this.isLive = isLive;
		this.pg.defaults.ssl = this.isLive;
		return this;
	},
	init: function (callback) {
		this.pg.connect(this.url, function (err, client) {
			if (err) console.log(err);
			console.log('QUERY');
			var query = client.query('create table if not exists highscore ( id serial primary key, username varchar(20) not null, dateUtc timestamp without time zone default (now() at time zone \'utc\'), score integer not null );');
			query.on('end', function () {
				client.end();
				callback();
			});
			query.on('error', function(error) {
				console.log('error!');
				console.log(error);
			});
		});
	},
	getHighscores: function (top, callback) {
		var results = [];
		console.log("getHighscores");
		this.pg.connect(this.url, function (err, client) {
			console.log("pg.connect callback");
			if (err) console.log(err);
			console.log('QUERY');
			var query = client.query('select * from highscore order by score desc limit ' + top);
			query.on('row', function (row, result) {
				results.push(row);
			});
			query.on('end', function () {
				client.end();
				callback(results);
			});
			query.on('error', function(error) {
				console.log('error!');
				console.log(error);
			});
		});
	},
	saveHighscore: function (name, score, callback) {
		console.log('saveHighscore');
		this.pg.connect(this.url, function (err, client) {
			console.log('pg.connect callback');
			
			if (err) console.log(err);
			console.log('QUERY no err');
			
			var query = client.query('insert into highscore (username, score) VALUES (\'' + name + '\', ' + score + ');');

			query.on('end', function () {
				client.end();
				callback();
			});
			query.on('error', function(error) {
				console.log('error!');
				console.log(error);
			});
		});
	}
};

