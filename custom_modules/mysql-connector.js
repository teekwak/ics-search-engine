"use strict";

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
		if(this.connection === null) {
			console.log("[SERVER]: no MySQL connection to close");
			return;
		}

		this.connection.end();
	}

	getPageURLs(pageObjects, callback) {
		if(pageObjects.length === 0) {
			return callback([]);
		}

		this.createConnection();

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

		  	// pageObjects[row['ID']]['url'] = row['URL'];
		  });

		  return callback(pageObjects);
		});

		
	} 

	// getResults(queryParts, callback) {
	// 	// create query
	// 	let sqlQuery = 'SELECT WORD, PAGES FROM Words WHERE ';
	// 	let counter = true;
	// 	queryParts.forEach(part => {
	// 		if(counter) {
	// 			sqlQuery += 'WORD="' + part + '"';
	// 			counter = false;
	// 		} else {
	// 			sqlQuery += ' OR WORD="' + part + '"';	
	// 		}
	// 	});

	// 	// parse results
	// 	this.connection.query(sqlQuery, function(err, rows, fields) {
	// 	  if (err) throw err;
	// 	  if(rows.length === 0) return callback([]);

	// 	  const wordsFound = new Set();
	// 	  const combinedResults = [];
	// 	  rows.forEach(row => {
	// 	  	combinedResults.push(JSON.parse(row['PAGES'].replace(/\'/g, '\"')));
	// 	  	wordsFound.add(row['WORD']);
	// 	  });

	// 	  // if not every word showed up, return callback([])
	// 	  let missingWord = false;
	// 	  queryParts.forEach(part => {
	// 	  	if(!wordsFound.has(part)) {
	// 	  		missingWord = true; // this does not work
	// 	  	}
	// 	  });

	// 	  return missingWord ? callback([]) : callback(_.intersection.apply(_, combinedResults));
	// 	});
	// }

	// getPageObjects(queryParts, pageIds, callback) {
	// 	if(pageIds.length === 0) {
	// 		return callback([]);
	// 	}

	// 	// create query
	// 	let sqlQuery = 'SELECT URL, WORDS FROM Pages WHERE ';
	// 	let counter = true;
	// 	pageIds.forEach(id => {
	// 		if(counter) {
	// 			sqlQuery += 'ID="' + id + '"';
	// 			counter = false;
	// 		} else {
	// 			sqlQuery += ' OR ID="' + id + '"';	
	// 		}
	// 	});

	// 	this.connection.query(sqlQuery, function(err, rows, fields) {
	// 	  if (err) throw err;

	// 	  const combinedResults = [];
	// 	  rows.forEach(row => {
	// 	  	const pageWords = JSON.parse(row['WORDS'].replace(/\'/g, '\"'));

	// 	  	let tfidf_score = 0.0;
	// 	  	queryParts.forEach(word => {
	// 	  		tfidf_score += pageWords[word]['tfidf'];
	// 	  	});

	// 	  	combinedResults.push({url: row['URL'], tfidf: tfidf_score});
	// 	  });

	// 	  console.log("[SERVER]: " + combinedResults.length +  " total number of matches");

	// 	  return callback(combinedResults.sort(function(a, b) {
	// 	  	// sort in descending order
	// 	  	return b.tfidf - a.tfidf;
	// 	  }).slice(0, 10));
	// 	});
	// }
}

module.exports = MySQLConnector;