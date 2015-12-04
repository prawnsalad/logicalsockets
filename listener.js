var ListenerProcess = require('./libs/listenerprocess');

var listener = new ListenerProcess();
listener.listenForLogicProcesses('./clients.sock');


// Report back with the number of connected clients we have
setInterval(() => {
  process.send({pid: process.pid, client_count: listener.clientCount()});
}, 1000);



/**
 * TCP Server example
 */
var net = require('net');
net.createServer((socket) => {
	listener.addClient(socket);
}).listen(6000);




/**
 * Sockjs example
 */
var http = require('http');
var fs = require('fs');
var sockjs = require('sockjs');

var server = http.createServer(function (req, res) {
  fs.readFile(__dirname + '/public/sockjs_example.html',
  function (err, data) {
    res.writeHead(200);
    res.end(data);
  });
});
server.listen(5002);

var echo = sockjs.createServer({ sockjs_url: 'http://cdn.jsdelivr.net/sockjs/1.0.1/sockjs.min.js', log:function(){} });
echo.on('connection', function(socket) {
	listener.addClient(socket);
});

echo.installHandlers(server, {prefix:'/transport'});




/**
 * Socket.io example
 */
/*
var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');

app.listen(5001);

function handler (req, res) {
  fs.readFile(__dirname + '/public/socketio_example.html',
  function (err, data) {
    res.writeHead(200);
    res.end(data);
  });
}

io.on('connection', function (socket) {
	listener.addClient(socket, {
		onData: 'message',
		onClose: 'disconnect',
		write: (data) => { socket.emit('message', data); }
	});
});
*/