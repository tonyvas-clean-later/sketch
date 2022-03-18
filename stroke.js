const Point = require('./point');

class Stroke{
    constructor(color, x, y){
        this.color = color;

        this.points = [new Point(x, y)];
        this.ended = false;
        this.id = Math.floor(Math.random() * 1000000);
    }

    newPoint(x, y){
        if (!this.ended){
            this.points.push(new Point(x, y));
        }
    }

    end(){
        this.ended = true;
        
        let loop = true;
        while (loop){
            loop = false;
            for (let i = 0; i < this.points.length; i++){
                const point = this.points[i];
                if (point.x == undefined || point.y == undefined){
                    this.points.splice(i, 1);
                    loop = true;
                    break;
                }
            }
        }
    }
}

module.exports = Stroke;