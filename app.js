console.log('\n'.repeat(10));

const clientPath = `${__dirname}/client`;
const port = process.env.PORT || 6942;
const address = '0.0.0.0';

const fs = require('fs');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');

const Stroke = require('./stroke');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(clientPath));

const clients = {};
const usernames = [];

loadFromFile().then(obj => {
    for (const key in obj){
        clients[key] = obj[key];
    }
    console.log('Loaded from file!');
}).catch(err => {
    console.error('Failed to load from file: ', err);
})

function requestAllScrollPositions(){
    for (const username in clients){
        const socket = clients[username].socket;
        if (socket){
            socket.emit('scrollPosition')
        }
    }
}

function saveToFile(){
    return new Promise((resolve, reject) => {
        const objToSave = {};
        for (const username in clients){
            objToSave[username] = {};
            for (const key of Object.keys(clients[username])){
                if (key != 'socket' && key != 'clearArea'){
                    objToSave[username][key] = clients[username][key];
                }
            }
        }

        fs.writeFile('strokes.json', JSON.stringify(objToSave), (err) => {
            if (err){
                reject(err);
            }
            else{
                resolve();
            }
        })
    })
}

function loadFromFile(){
    return new Promise((resolve, reject) => {
        fs.readFile('strokes.json', 'utf-8', (err, data) => {
            if (err){
                reject(err);
            }
            else{
                try {
                    const obj = JSON.parse(data);
                    resolve(obj)
                } catch (error) {
                    reject(error);
                }
            }
        })
    })
}

io.on('connection', (sock) => {
    console.log('connected!');
    let thisclient = null;

    sock.on('username', username => {
        if (!usernames.includes(username)){
            usernames.push(username);
            if (!clients[username]){
                clients[username] = {
                    strokes: [],
                    undoneStrokes: [],
                    erasedStrokes: [],
                    clearArea: null,
                    username: username
                };
            }
    
            thisclient = clients[username];
            thisclient.socket = sock;
            requestAllScrollPositions();
        }
        else{
            sock.emit('username', `Username "${username}" already exists!`);
        }
    })

    sock.on('left_click', ({color, pos}) => {
        if (thisclient){
            thisclient.erasedStrokes = [];
            thisclient.undoneStrokes = [];

            const stroke = new Stroke(color, pos.x, pos.y);
            thisclient.strokes.push(stroke);
        }
        requestAllScrollPositions();
    })

    sock.on('left_unclick', () => {
        if (thisclient){
            if (thisclient.strokes.length > 0){
                const stroke = thisclient.strokes[thisclient.strokes.length - 1];
                if (!stroke.ended){
                    stroke.end();

                    saveToFile().then(() => {
                        console.log('Saved to file!');
                    }).catch(err => {
                        console.log('Failed saving to file: ', err);
                    })
                }
            }
        }
    })

    sock.on('right_click', pos => {
        if (thisclient){
            thisclient.clearArea = {start: pos, end: pos};
            requestAllScrollPositions();
        }
    })

    sock.on('right_unclick', () => {
        if (thisclient){
            if (thisclient.clearArea){
                const clearArea = thisclient.clearArea;
                const minX = Math.min(clearArea.start.x, clearArea.end.x);
                const maxX = Math.max(clearArea.start.x, clearArea.end.x);
                const minY = Math.min(clearArea.start.y, clearArea.end.y);
                const maxY = Math.max(clearArea.start.y, clearArea.end.y);

                const toErase = {};
                for (const username in clients){
                    const client = clients[username];
                    for (const stroke of client.strokes){
                        if (stroke.ended){
                            for (const point of stroke.points){
                                if (point.x >= minX){
                                    if (point.x <= maxX){
                                        if (point.y >= minY){
                                            if (point.y <= maxY){
                                                if (!toErase[username]){
                                                    toErase[username] = [];
                                                }
                                                toErase[username].push(stroke);
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                const erased = [];
                for (const username in toErase){
                    while (toErase[username].length > 0){
                        const strokes = clients[username].strokes;
                        const stroke = toErase[username][0];
                        erased.push(strokes.splice(strokes.indexOf(stroke), 1)[0]);
                        toErase[username].shift();
                    }
                }

                if (erased.length > 0){
                    thisclient.erasedStrokes.push(erased);
                }
                thisclient.clearArea = null;
                requestAllScrollPositions();
            }
        }
    })

    sock.on('mouse_move_left_click', pos => {
        if (thisclient){
            if (thisclient.strokes.length > 0){
                const stroke = thisclient.strokes[thisclient.strokes.length - 1];
                if (!stroke.ended){
                    stroke.newPoint(pos.x, pos.y);
                    requestAllScrollPositions();
                }
            }
        }
    });

    sock.on('mouse_move_right_click', pos => {
        if (thisclient){
            if (thisclient.clearArea){
                thisclient.clearArea.end = pos;
                requestAllScrollPositions();
            }
        }
    });

    sock.on('undo', () => {
        if (thisclient){
            let changed = false;

            if (thisclient.erasedStrokes.length > 0){
                const erased = thisclient.erasedStrokes.pop();
                for (const stroke of erased){
                    thisclient.strokes.push(stroke);
                }
                changed = true;
            }
            else if (thisclient.strokes.length > 0){
                thisclient.undoneStrokes.push(thisclient.strokes.pop());
                changed = true;
            }
    
            if (changed){
                saveToFile().then(() => {
                    console.log('Saved to file!');
                }).catch(err => {
                    console.log('Failed saving to file: ', err);
                })
    
                requestAllScrollPositions();
            }
        }
    })

    sock.on('redo', () => {
        if (thisclient){
            if (thisclient.undoneStrokes.length > 0){
                thisclient.strokes.push(thisclient.undoneStrokes.pop());

                saveToFile().then(() => {
                    console.log('Saved to file!');
                }).catch(err => {
                    console.log('Failed saving to file: ', err);
                })
    
                requestAllScrollPositions();
            }
        }
    })

    sock.on('scrollPosition', ({scroll, width, height}) => {
        if (thisclient){
            const leftX = scroll.x;
            const rightX = scroll.x + width;
            const topY = scroll.y;
            const bottomY = scroll.y + height;

            const strokesToSend = [];
            const clearAreasToSend = [];
            for (const username in clients){
                const client = clients[username];

                if (client.clearArea){
                    if (leftX <= client.clearArea.end.x && rightX >= client.clearArea.start.x){
                        if (topY <= client.clearArea.end.y && bottomY >= client.clearArea.start.y){
                            clearAreasToSend.push(client.clearArea);
                        }
                    }
                }

                for (const stroke of client.strokes){
                    for (const point of stroke.points){
                        if (leftX <= point.x <= rightX && topY <= point.y <= bottomY){
                            strokesToSend.push(stroke);
                            break;
                        }
                    }
                }
            }

            sock.emit('draw', {strokes: strokesToSend, clearAreas: clearAreasToSend});
        }
    })

    sock.on('clearall', () => {
        for (const username in clients){
            const client = clients[username];
            client.strokes = [];
            client.undoneStrokes = [];
            requestAllScrollPositions();
        }
    })

    sock.on('disconnect', () => {
        if (thisclient){
            const i = usernames.indexOf(thisclient.username);
            if (i >= 0){
                usernames.splice(i, 1);
            }
        }
        console.log('disconnected!');
    });
});

server.listen(port, address, () => {
    console.log(`Sketch server running on port ${port}!`);
});