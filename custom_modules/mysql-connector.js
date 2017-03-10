'use strict';

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

	close() {
		if(this.connection !== null) {
			this.connection.end();
		}
	}

	getPageURLs(pageObjects, callback) {
		this.createConnection();

		if(pageObjects.length === 0) {
			return callback([]);
		}

		let sqlQuery = 'SELECT ID, URL FROM Pages WHERE ';
		let counter = true;
		pageObjects.forEach(obj => {
			if(counter) {
				sqlQuery += 'ID="' + obj.id + '"';
				counter = false;
			} else {
				sqlQuery += ' OR ID="' + obj.id + '"';
			}
		});

		this.connection.query(sqlQuery, function(err, rows) {
		  if (err) throw err;

		  rows.forEach(row => {
		  	pageObjects.forEach(obj => {
		  		if(row.ID === obj.id) {
		  			obj.url = row.URL;
		  		}
		  	});
		  });

		  return callback(pageObjects);
		});


	}
}

module.exports = MySQLConnector;