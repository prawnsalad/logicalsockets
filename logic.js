var LogicProcess = require('./libs/logicprocess');

var logic = new LogicProcess();
logic.attachToListener('./clients.sock');


logic.on('line', (client, line) => {
	line = line.trim();
	
	if (line === 'crash') {
		nonExistantFunction();
	}

	logic.broadcastData(client.id + ': ' + line + '\n');
});



