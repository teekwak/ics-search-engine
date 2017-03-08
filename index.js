const bodyParser = require('body-parser');
const compression = require('compression');
const express = require('express');
const handlebars = require('express-handlebars');
const stemmer = require('stemmer');
const credentials = require('./custom_modules/credentials');
const MySQLConnector = require('./custom_modules/mysql-connector')

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
		inc: function(value, options) {
			return parseInt(value) + 1;
		}
	}
}));
app.set('view engine', 'handlebars');

// parse form information
app.use(bodyParser.urlencoded({extended: true}))

// redirect '/'
app.get('/', function (req, res) {
    res.render('home');
});

app.post('/', function(req, res) {
	queryParts = req.body.query.split(" ").map(stemmer);

	console.log("[SERVER]: query: " + queryParts);

	const connector = new MySQLConnector(credentials);
	connector.createConnection();
	connector.getResults(queryParts, function(pageIds) {
		connector.getPageObjects(queryParts, pageIds, function(pageObjects) {
			res.render('home', {query: req.body.query, results: pageObjects});
			connector.destroyConnection();
			console.log("[SERVER]: task completed")
		});
	});
});

// start app on port 3000
app.listen(3000, function() {
	console.log("[SERVER]: Application started on port 3000");
})