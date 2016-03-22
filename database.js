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
			if (err) throw err;
			var query = client.query('create table if not exists highscore ( id serial primary key, username varchar(20) not null, dateUtc timestamp without time zone default (now() at time zone \'utc\'), score integer not null );');
			query.on('end', function () {
				client.end();
				callback();
			});
		});
	},
	getHighscores: function (callback) {
		var results = [];
		this.pg.connect(this.url, function (err, client) {
			if (err) throw err;
			var query = client.query('select * from highscore order by score desc');
			query.on('row', function (row, result) {
				results.push(row);
			});
			query.on('end', function () {
				client.end();
				callback(results);
			});
		});
	},
	saveHighscore: function (name, score, oldId, callback) {
		this.pg.connect(this.url, function (err, client) {
			if (err) throw err;
			var query = client.query('insert into highscore (username, score) VALUES (\'' + name + '\', ' + score + '); delete from highscore where id = ' + oldId + ';');
			query.on('end', function () {
				client.end();
				callback();
			});
		});
	}
};

