const mysql = require('mysql');
const async = require('async');
const _ = require('underscore');

class MySQLConnector {
	constructor(credentials) {
		this.credentials = credentials;
		this.connection = null;
	}

	createConnection() {
		this.connection = mysql.createConnection({
		  host     : this.credentials.host,
		  user     : this.credentials.username,
		  password : this.credentials.password,
		  database : this.credentials.database
		});

		this.connection.connect();
	}

	destroyConnection() {
		if(this.connection == null) {
			console.log("[SERVER]: no connection to destroy");
		}

		this.connection.end();
	}

	getResults(queryParts, outerCallback) {
		async.map(queryParts, function(word, innerCallback) {
			this.connection.query('SELECT PAGES FROM Words WHERE WORD="' + word + '"', function(err, rows, fields) {
			  if (err) throw err;

			  if(rows[0] == null) {
			  	return innerCallback(null, []);
			  } else {
			  	// convert string to actual array
			  	innerCallback(null, JSON.parse(rows[0]['PAGES'].replace(/\'/g, '\"')));	
			  }
			});
		}.bind({connection: this.connection}), function(err, results) {
			// get intersection of all arrays
			outerCallback(_.intersection.apply(_, results));
		});
	}

	getPageObjects(queryParts, pageIds, outerCallback) {
		async.map(pageIds, function(id, innerCallback) {
			this.connection.query('SELECT URL, WORDS FROM Pages WHERE ID="' + id + '"', function(err, rows, fields) {
			  if (err) throw err;

			  if(rows[0]['URL'] != null && rows[0]['WORDS'] != null) {
			  	const pageWords = JSON.parse(rows[0]['WORDS'].replace(/\'/g, '\"'));

			  	let tfidf_score = 0.0;
			  	queryParts.forEach(word => {
			  		tfidf_score += pageWords[word]['tfidf'];
			  	});

			  	innerCallback(null, {url: rows[0]['URL'], tfidf: tfidf_score});	
			  }
			});
		}.bind({connection: this.connection}), function(err, results) {
			outerCallback(results.sort(function(a, b) {
				// sort in descending order
				return b.tfidf - a.tfidf;
			}).slice(0, 10));
		});
	}
}

module.exports = MySQLConnector;