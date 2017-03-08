const express = require('express');
const handlebars = require('express-handlebars');
const bodyParser = require('body-parser');
const credentials = require('./custom_modules/credentials');
const MySQLConnector = require('./custom_modules/mysql-connector')

const app = express();

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
	const connector = new MySQLConnector(credentials);
	connector.getResults(req.body.query, function(pageIds) {
		connector.getPageObjects(req.body.query, pageIds, function(pageObjects) {
			res.render('home', {results: pageObjects});
			connector.destroyConnection();
		});
	});
});

// start app on port 3000
app.listen(3000, function() {
	console.log("[SERVER]: Application started on port 3000");
})