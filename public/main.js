const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

let scrollPositionX = 0;
let scrollPositionY = 0;
let leftClicking = false;
let rightClicking = false;
let currentColor = 'black';

const socket = io();

function emit(name, data){
    socket.emit(name, data);
}

function getMouseEventGlobalPosition(e){
    const rel = getMouseEventRelativePosition(e);
    return {x: rel.x + scrollPositionX, y: rel.y + scrollPositionY};
}

function getMouseEventRelativePosition(e){
    return {x: e.clientX - canvas.offsetLeft, y: e.clientY - canvas.offsetTop};
}

function drawGrid(){
    for (let y = 0; y < canvas.height; y += 100){
        const mod = scrollPositionY % 100;
        context.fillStyle = 'black';
        context.fillRect(0, y + mod, canvas.width, 2);
    }

    for (let x = 0; x < canvas.width; x += 100){
        const mod = scrollPositionX % 100;
        context.fillStyle = 'black';
        context.fillRect(x + mod, 0, 2, canvas.height);
    }
}

function drawStrokes(strokes){
    for (const stroke of strokes){
        if (stroke.points.length == 1){
            const point = stroke.points[0];

            context.fillStyle = stroke.color;
            context.beginPath();
            context.arc(point.x - scrollPositionX, point.y - scrollPositionY, 2, 0, Math.PI * 2);
            context.fill();
        }
        else{
            context.strokeStyle = stroke.color;
            context.lineWidth = 2;
            context.beginPath();
            for (const point of stroke.points){
                context.lineTo(point.x - scrollPositionX, point.y - scrollPositionY);
            }
            context.stroke();
        }
    }
}

function drawClearAreas(clearAreas){
    for (const area of clearAreas){
        const x = Math.min(area.start.x, area.end.x);
        const y = Math.min(area.start.y, area.end.y);
        const w = Math.abs(area.end.x - area.start.x);
        const h = Math.abs(area.end.y - area.start.y);

        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.beginPath();
        context.rect(x - scrollPositionX, y - scrollPositionY, w, h);
        context.stroke();
    }
}

function draw(strokes = [], clearAreas = []){
    context.clearRect(0, 0, canvas.width, canvas.height);
    //drawGrid();
    drawStrokes(strokes);
    drawClearAreas(clearAreas);
}

function onLeftClick(e){
    if (!rightClicking){
        leftClicking = true;
        emit('left_click', {color: currentColor, pos: getMouseEventGlobalPosition(e)});
    }
}

function onLeftUnclick(e){
    leftClicking = false;
    emit('left_unclick');
}

function onRightClick(e){
    if (!leftClicking){
        rightClicking = true;
        emit('right_click', getMouseEventGlobalPosition(e));
    }
}

function onRightUnclick(e){
    rightClicking = false;
    emit('right_unclick');
}

function onMouseMove(e){
    if (leftClicking != rightClicking){
        if (leftClicking){
            emit('mouse_move_left_click', getMouseEventGlobalPosition(e));
        }
        else if (rightClicking){
            emit('mouse_move_right_click', getMouseEventGlobalPosition(e));
        }
    }
}

function onWheelScroll(e){
    scrollPositionX += e.deltaX;
    scrollPositionY += e.deltaY;
    emit('scrollPosition', {scroll: {x: scrollPositionX, y: scrollPositionY}, width: canvas.width, height: canvas.height});
}

function undo(){
    if (!leftClicking && !rightClicking){
        emit('undo');
    }
}

function redo(){
    if (!leftClicking && !rightClicking){
        emit('redo');
    }
}

function drawColorSelector(){
    const COLORS = ['red', 'green', 'blue', 'magenta', 'lime', 'cyan', 'purple', 'yellow', 'orange', 'white', 'black']

    let div = document.getElementById('colors');
    
    for (let color of COLORS){
        let button = document.createElement('button');
        button.style.backgroundColor = color;
        button.classList.add('color')

        button.onclick = () => {
            currentColor = color;
            for (let btn of div.children){
                if (button == btn){
                    btn.disabled = true;
                    btn.classList.add('flashing')
                }
                else{
                    btn.disabled = false;
                    btn.classList.remove('flashing')
                }
            }
        }

        div.appendChild(button);
    }

    div.children[0].click();
}

canvas.onmousedown = e => {
    switch (e.button) {
        case 0:
            onLeftClick(e);
            break;
        case 1:
            onRightClick(e);
            break;
    }
}

canvas.onmouseup = (e) => {
    switch (e.button) {
        case 0:
            onLeftUnclick(e);
            break;
        case 1:
            onRightUnclick(e);
            break;
    }
}

canvas.onwheel = e => {
    onWheelScroll(e);
}

canvas.onmousemove = e => {
    onMouseMove(e);
}

canvas.oncontextmenu = e => {
    e.preventDefault();
    return false;
}

document.body.onload = () => {
    drawColorSelector();

    let username = prompt('Enter a username!');
    // let username = 'ree'
    while (!username){
        username = prompt('Enter an actual fucking username!');
    }

    emit('username', username);
}

document.body.onkeydown = e => {
    const key = e.key.toLowerCase();

    switch (key) {
        case 'z':
            undo();
            break;

        case 'y':
            redo();
            break;

        case 'q':
            if (confirm('Are you sure you want to clear everything?')){
               emit('clearall');
            }
            break;
    }
}

socket.on('scrollPosition', () => {
    emit('scrollPosition', {scroll: {x: scrollPositionX, y: scrollPositionY}, width: canvas.width, height: canvas.height});
})

socket.on('draw', ({strokes, clearAreas}) => {
    draw(strokes, clearAreas);
})

socket.on('username', msg => {
    alert(msg);
    window.location = window.location;
})
