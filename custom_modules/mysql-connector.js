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
			console.log("[SERVER]: No connection to destroy");
		}

		this.connection.end();
	}

	getResults(queryString, renderCallback) {
		this.createConnection();

		console.log("Your query string was: " + queryString);

		async.map(queryString.split(" "), function(word, callback) {
			this.connection.query('SELECT PAGES FROM Words WHERE WORD="' + word + '"', function (err, rows, fields) {
			  if (err) throw err;

			  if(rows[0] == null) {
			  	callback(null, []);
			  }
			  else {
			  	// convert string to actual array
			  	callback(null, JSON.parse(rows[0]['PAGES'].replace(/\'/g, '\"')));	
			  }
			});
		}.bind({connection: this.connection}), function(err, results) {
			// get intersection of all arrays
			console.log(_.intersection.apply(_, results));

			renderCallback(_.intersection.apply(_, results));
		});
	}
}

module.exports = MySQLConnector;