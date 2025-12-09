const net = require('net');

console.log('--- Testing net.connect with string port ---');
try {
    const socket = net.connect({ port: "3001", host: "localhost" });
    socket.destroy();
    console.log('SUCCESS: net.connect accepts string port');
} catch (e) {
    console.log('FAILURE: net.connect threw: ' + e.message);
}

console.log('--- Testing net.connect with number port ---');
try {
    const socket = net.connect({ port: 3001, host: "localhost" });
    socket.destroy();
    console.log('SUCCESS: net.connect accepts number port');
} catch (e) {
    console.log('FAILURE: net.connect threw: ' + e.message);
}
