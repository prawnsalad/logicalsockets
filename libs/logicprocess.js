var net = require('net');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var _ = require('lodash');
var packets = require('./packets');




function SocketConnection(addr){
	EventEmitter.call(this);

	this.id = 0;
	this.buffer = '';
	this.socket = net.createConnection(addr);
	this.socket.on('data', this.onLine.bind(this));
	this.socket.on('close', () => {
		this.socket.removeAllListeners();
		this.socket = null;
		this.emit('close')
	});
}

util.inherits(SocketConnection, EventEmitter);

SocketConnection.prototype.onLine = function(raw_line) {
	this.buffer += raw_line.toString();
	this.processBuffer();
};
SocketConnection.prototype.processBuffer = function() {
	var parts = this.buffer.split('\n');
	this.buffer = '';

	// If the last item is not an empty string, then last item must be incomplete
	if (parts[parts.length-1] !== '') {
		this.buffer += parts.pop();
	} else {
		parts.pop();
	}

	var val = '';
	var packet;
	for(var i=0; i<parts.length; i++){
		val = parts[i];

		packet = JSON.parse(val);
		if (!packet) return;
		if (packet.type === packets.TYPE_HELLO) {
			this.id = packet.node;
			this.emit('ready');
		}
		this.emit('packet', packet);
	}
};
SocketConnection.prototype.write = function(line) {
	this.socket && this.socket.write(line) + '\n';
};





module.exports = LogicProcess;

function LogicProcess() {
	EventEmitter.call(this);
	this.listener_processes = Object.create(null);
}
util.inherits(LogicProcess, EventEmitter);


LogicProcess.prototype.attachToListener = function(addr) {
	var socks = new SocketConnection(addr);
	socks.on('ready', () => {
		this.listener_processes[socks.id] = socks;
	});
	socks.on('close', () => {
		delete this.listener_processes[socks.id];
		socks.removeAllListeners();
		socks = null;
	});

	socks.on('packet', (packet) => {
		if (packet.type === packets.TYPE_FROM_CLIENT) {
			this.emit('line', packet.client, packet.data);
		}
	});
};



LogicProcess.prototype.sendDataToClient = function(client, data) {
	var packet = {
		type: packets.TYPE_TO_CLIENT,
		client: client,
		data: data
	};
	this.listener_processes[client.node].write(JSON.stringify(packet) + '\n');
};


LogicProcess.prototype.broadcastData = function(data) {
	var packet = {
		type: packets.TYPE_BROADCAST,
		data: data
	};
	var to_send = JSON.stringify(packet) + '\n';

	var chunks = _.chunk(Object.keys(this.listener_processes), 500);
	var self = this;
	(function nextChunk(chunk_idx) {
		if (chunk_idx > chunks.length - 1) return;

		chunks[chunk_idx].forEach((listener_id) => {
			if (self.listener_processes[listener_id]) {
				self.listener_processes[listener_id].write(to_send);
			}
		});

		process.nextTick(function() {
			nextChunk(chunk_idx+1);
		});
	})(0);
};