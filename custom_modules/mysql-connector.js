const mysql = require('mysql');

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

	getResults(queryString, callback) {
		this.createConnection();

		console.log("Your query string was: " + queryString);

		this.connection.query('SELECT PAGES FROM Words WHERE WORD="' + queryString + '"', function (err, rows, fields) {
		  if (err) throw err;

		  callback(rows[0]);
		});
	}
}

module.exports = MySQLConnector;