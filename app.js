console.clear();

const ip = require('ip');
const httpServer = require('./httpServer')
const socketioServer = require('./socketioServer');

function start(){
    setEnv();
    console.log('Environment variables set');

    let server = httpServer.start();
    console.log(`HTTP server started at http://${ip.address()}:${process.env.SERVER_PORT}`);

    socketioServer.start(server);
    console.log('Socket.io server started');
}

function setEnv(){
    process.env.STROKES_DATA_DIR = `${__dirname}/strokes`
    process.env.PUBLIC_PATH = `${__dirname}/public`;
    process.env.SERVER_PORT = 8080;
}

start();