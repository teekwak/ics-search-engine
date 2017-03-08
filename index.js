const express = require('express');
const handlebars = require('express-handlebars');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const credentials = require('./credentials');

const app = express();

// redirect bootstrap and jquery dependencies
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js'));
app.use('/js', express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css'));

// set handlbars as templating framework
app.engine('handlebars', handlebars({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// parse form information
app.use(bodyParser.urlencoded({extended: true}))

// redirect '/'
app.get('/', function (req, res) {
    res.render('home');
});

app.post('/search', function(req, res) {
	console.log(req.body.query);

	var connection = mysql.createConnection({
	  host     : credentials.host,
	  user     : credentials.username,
	  password : credentials.password,
	  database : credentials.database
	});

	connection.connect();

	connection.query('SELECT COUNT(*) FROM Pages', function (err, rows, fields) {
	  if (err) throw err;

	  console.log('The output is: ', rows[0]);
	})

	connection.end();

	res.render('home');
});

// start app on port 3000
app.listen(3000, function() {
	console.log("[SERVER]: Application started on port 3000");
})