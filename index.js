'use strict';

const bodyParser = require('body-parser');
const compression = require('compression');
const express = require('express');
const handlebars = require('express-handlebars');
const stemmer = require('stemmer');
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

	var t0 = Date.now();
	console.log("[SERVER]: query: " + queryParts);

	const redis_connector = new RedisConnector();
	redis_connector.getORResults(new Set(queryParts), function(redisResults) {
		redis_connector.addMagnitude(redisResults, function(magnitudeResults) {
			redis_connector.addCosineSimilarityScores(queryParts, magnitudeResults, function(scoreResults) {
				redis_connector.addPageRankScores(scoreResults, 10, function(resultsNeedURLs) {
					redis_connector.getPageURLs(resultsNeedURLs, function(finalResults) {
						res.render('home', {query: req.body.query, results: finalResults});
						var t1 = Date.now();
						console.log("[SERVER]: task completed in " + (t1 - t0) + " ms");
						redis_connector.close();
					});
				});
			});
		});
	});
});

// start app on port 3000
app.listen(3000, function() {
	console.log("[SERVER]: Application started on port 3000");
});
