const express = require('express');
const handlebars = require('express-handlebars')
const app = express();

// redirect bootstrap and jquery dependencies
app.use('/js', express.static(__dirname + '/node_modules/bootstrap/dist/js'));
app.use('/js', express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/css', express.static(__dirname + '/node_modules/bootstrap/dist/css'));

// set handlbars as templating framework
app.engine('handlebars', handlebars({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// redirect '/'
app.get('/', function (req, res) {
    res.render('home');
});

// start app on port 3000
app.listen(3000, function() {
	console.log("[SERVER]: Application started on port 3000");
})