var cluster = require('cluster');


if (cluster.isMaster) {
	// Simple reporting of how many conected clients we have
	var counts = Object.create(null);
	setInterval(() => {
		var total_count = 0;
		Object.keys(counts).forEach((pid) => {
			total_count += counts[pid];
		});

		console.log('Client count:', total_count);

	}, 5000);



	var worker;

	// Create some listeners..
	for(var i=0; i<1; i++) {
		worker = cluster.fork({childtype: 'listener'});
		worker.childtype = 'listener';
	}

	// Create some logic processes..
	for(var i=0; i<5; i++) {
		worker = cluster.fork({childtype: 'logic'});
		worker.childtype = 'logic';
	}

	cluster.on('exit', function(worker, code, signal) {
		console.log(worker.childtype + ' worker [' + worker.process.pid + '] died with code ' + code);
		if (counts[worker.process.pid]) delete counts[worker.process.pid];
		cluster.fork(worker.childtype);
	});

	// Workers will report back with how many connections it has
	cluster.on('message', (message) => {
		if (typeof message.client_count === 'number') {
			counts[message.pid] = message.client_count;
		}
	});

} else {

	if (process.env.childtype === 'listener') {
		// Start listening for connections
		console.log('Starting listener process..')
		require('./listener');

	} else if (process.env.childtype === 'logic') {
		// Require some logic
		console.log('Starting logic process..')
		require('./logic');
	}
}