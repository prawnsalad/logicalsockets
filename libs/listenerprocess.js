var net = require('net');
var _ = require('lodash');
var packets = require('./packets');



module.exports = ListenerProcess;


function ListenerProcess() {
	this.node_id = 1;
	this.logic_processes = [];

	this.clients = Object.create(null);
	this.client_count = 0;
	this.next_client_id = 0;
}

// Listen for logic processes
ListenerProcess.prototype.listenForLogicProcesses = function(sock_addr) {
	var self = this;

	net.createServer((socket) => {
		console.log('New logic process attached');

		var buffer = '';
		
		socket.on('close', () => {
			this.logic_processes = _.without(this.logic_processes, socket);
			socket.removeAllListeners();
		});

		// TODO: Buffer into lines
		socket.on('data', (data) => {
			buffer += data.toString();
			processBuffer();
		});

		this.logic_processes.push(socket);

		socket.write(JSON.stringify({
			type: packets.TYPE_HELLO,
			node: this.node_id
		}) + '\n');

		function processBuffer() {
			var parts = buffer.split('\n');
			buffer = '';

			// If the last item is not an empty string, then last item must be incomplete
			if (parts[parts.length-1] !== '') {
				buffer = parts.pop();
			} else {
				parts.pop();
			}

			for(var i=0; i<parts.length; i++){
				self.onLogicSocketData(socket, parts[i]);
			}
		}

	}).listen(sock_addr);
}



ListenerProcess.prototype.onLogicSocketData = function(socket, line) {
	var packet = JSON.parse(line);

	if (packet.type === packets.TYPE_TO_CLIENT) {
		var client = this.clients[packet.client.id];
		if (!client) return;
		client.write(packet.data);
	}

	if (packet.type === packets.TYPE_TO_CLIENTS) {
		packet.clients.forEach((client_id) => {
			var client = this.clients[client_id];
			if (!client) return;
			client.write(packet.data);
		});
	}

	// This could be slow. Logic processes should avoid using it
	if (packet.type === packets.TYPE_BROADCAST) {
		Object.keys(this.clients).forEach((client_id) => {
			this.clients[client_id].write(packet.data);
		});
	}
}


ListenerProcess.prototype.sendToLogic = function(packet) {
	var logic_process = this.logic_processes[Math.floor(Math.random() * this.logic_processes.length)];
	if (!logic_process) {
		return;
	}

	logic_process.write(JSON.stringify(packet) + '\n');
}





ListenerProcess.prototype.clientCount = function() {
	return this.client_count;
};


ListenerProcess.prototype.addClient = function(client_obj, event_names) {
	var self = this;

	if (this.logic_processes.length === 0) {
		return false;
	}

	var id = ++this.next_client_id;
	var full_id = {
		node: this.node_id,
		id: id
	};
	var connected = true;

	event_names = event_names || {
		onData: 'data',
		onClose: 'close',
		write: (data) => { client_obj.write(data); }
	};

	this.clients[id] = {
		id: id,
		full_id: full_id,
		client_obj: client_obj,
		write: function(data) {
			if (!connected) return;
			event_names.write(data);
		}
	};

	//console.log('New client', id);

	client_obj.on(event_names.onData, onData);
	client_obj.on(event_names.onClose, onClose);

	this.sendToLogic({
		client: full_id,
		type: packets.TYPE_CLIENT_CONNECT
	});

	this.client_count++;

	return true;

	// TODO: Does this need buffering + split to lines?
	// As it is, any raw data comes in and sent to logics. Maybe that's a good thing.
	// The logics can decide how to deal with it..
	function onData(line) {
		var packet = {
			client: full_id,
			type: packets.TYPE_FROM_CLIENT,
			data: line.toString()
		};

		self.sendToLogic(packet);
	}

	function onClose() {
		//console.log('Closing client', id);
		connected = false;
		delete self.clients[id];
		client_obj.removeAllListeners();
		var packet = {
			client: full_id,
			type: packets.TYPE_CLIENT_DISCONNECT
		};
		self.sendToLogic(packet);

		client_obj.removeListener('data', onData);
		client_obj.removeListener('close', onClose);
		client_obj = null;

		self.client_count--;
	}
};








