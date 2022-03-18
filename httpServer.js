const http = require('http');
const express = require('express');

function start(){
    const app = express();
    const server = http.createServer(app);
    
    server.listen(process.env.SERVER_PORT);

    app.use(express.static(process.env.PUBLIC_PATH));

    return server;
}

module.exports = {start}