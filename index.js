'use strict';

const bodyParser = require('body-parser');
const compression = require('compression');
const express = require('express');
const handlebars = require('express-handlebars');
const stemmer = require('stemmer');
const credentials = require('./custom_modules/credentials');
const MySQLConnector = require('./custom_modules/mysql-connector');
const RedisConnector = require('./custom_modules/redis-connector');

const app = express();

// use compression!!!
app.use(compression());

// redirect bootstrap and jquery dependencies
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js'));
app.use('/js', express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css'));

// set handlbars as templating framework
app.engine('handlebars', handlebars({
	defaultLayout: 'main',
	helpers: {
		inc: function(value) {
			return parseInt(value) + 1;
		}
	}
}));
app.set('view engine', 'handlebars');

// parse form information
app.use(bodyParser.urlencoded({extended: true}));

// redirect '/'
app.get('/', function (req, res) {
    res.render('home');
});

app.post('/', function(req, res) {
	const queryParts = req.body.query.split(" ").map(stemmer);

	console.log("[SERVER]: query: " + queryParts);

	const redis_connector = new RedisConnector();
	redis_connector.getResults(queryParts, 10, function(redisResults) {
		const mysql_connector = new MySQLConnector(credentials);
		mysql_connector.getPageURLs(redisResults, function(mysqlResults) {
			res.render('home', {query: req.body.query, results: mysqlResults});
			console.log("[SERVER]: task completed");
			mysql_connector.close();
		});
		redis_connector.close();
	});
});

// start app on port 3000
app.listen(3000, function() {
	console.log("[SERVER]: Application started on port 3000");
});
