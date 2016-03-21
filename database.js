module.exports = {
	make: function(pg, url, isLive) {
		this.pg = pg;
		this.url = url;
		this.isLive = isLive;
		this.pg.defaults.ssl = this.isLive;
		return this;
	},
	init: function () {
		this.pg.connect(this.url, function (err, client) {
			if (err) throw err;
			client.query('');
		});
	},
	getHighscores: function () {
		this.pg.connect(this.url, function (err, client) {
			if (err) throw err;
			client.query('');
		});
	}
};

