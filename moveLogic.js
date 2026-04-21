export default function move(gameState) {
    const myHead = gameState.you.body[0];
    const myBody = gameState.you.body;
    const myLength = gameState.you.length;
    const myHealth = gameState.you.health;
    const board = gameState.board;
    const boardWidth = board.width;
    const boardHeight = board.height;
    const allSnakes = board.snakes;
    const turn = gameState.turn;

    
    const blocked = new Set();
    
    for (const snake of allSnakes) {
        const bodyWithoutTail = snake.body.slice(0, -1);
        for (const seg of bodyWithoutTail) {
            blocked.add(`${seg.x},${seg.y}`);
        }
    }

    
    if (myBody.length > 1) {
        blocked.add(`${myBody[1].x},${myBody[1].y}`);
    }

    function isSafe(x, y) {
        // Double-check bounds and blocked positions
        if (x < 0 || x >= boardWidth || y < 0 || y >= boardHeight) {
            return false;
        }
        return !blocked.has(`${x},${y}`);
    }

    
    function floodFill(startX, startY, maxIterations = 500) {
        const visited = new Set();
        const queue = [[startX, startY]];
        visited.add(`${startX},${startY}`);
        let count = 0;
        
        while (queue.length > 0 && count < maxIterations) {
            const [cx, cy] = queue.shift();
            count++;
            
            for (const [nx, ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]) {
                const key = `${nx},${ny}`;
                if (
                    nx >= 0 && nx < boardWidth &&
                    ny >= 0 && ny < boardHeight &&
                    !blocked.has(key) &&
                    !visited.has(key)
                ) {
                    visited.add(key);
                    queue.push([nx, ny]);
                }
            }
        }
        return count;
    }

    function manhattanDist(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    function getWallDistance(x, y) {
        return Math.min(x, y, boardWidth - 1 - x, boardHeight - 1 - y);
    }

    
    function getThreats() {
        const threats = [];
        for (const snake of allSnakes) {
            if (snake.id === gameState.you.id || snake.length <= myLength) continue;
            const dist = manhattanDist(myHead.x, myHead.y, snake.body[0].x, snake.body[0].y);
            threats.push({ snake, dist });
        }
        threats.sort((a, b) => a.dist - b.dist);
        return threats;
    }

    
    function getClosestFood() {
        const food = board.food;
        if (food.length === 0) return null;
        let closest = food[0];
        let minDist = manhattanDist(myHead.x, myHead.y, food[0].x, food[0].y);
        for (let i = 1; i < food.length; i++) {
            const dist = manhattanDist(myHead.x, myHead.y, food[i].x, food[i].y);
            if (dist < minDist) {
                minDist = dist;
                closest = food[i];
            }
        }
        return { food: closest, dist: minDist };
    }

    const directions = {
        up:    { x: myHead.x,     y: myHead.y + 1 },
        down:  { x: myHead.x,     y: myHead.y - 1 },
        left:  { x: myHead.x - 1, y: myHead.y     },
        right: { x: myHead.x + 1, y: myHead.y     },
    };

    
    let safeMoves = Object.entries(directions).filter(([_, pos]) => isSafe(pos.x, pos.y));

    if (safeMoves.length === 0) {
        console.log(`MOVE ${turn}: TRAPPED - no safe moves`);
        return { move: "up" };
    }

    
    const hazardSet = new Set((board.hazards || []).map(h => `${h.x},${h.y}`));
    const nonHazard = safeMoves.filter(([_, pos]) => !hazardSet.has(`${pos.x},${pos.y}`));
    if (nonHazard.length > 0) safeMoves = nonHazard;

    
    const threats = getThreats();
    const closestFood = getClosestFood();

    const scored = safeMoves.map(([dir, pos]) => {
        const space = floodFill(pos.x, pos.y, 300);
        const wallDist = getWallDistance(pos.x, pos.y);
        
        let threatDist = 100;
        if (threats.length > 0) {
            threatDist = manhattanDist(pos.x, pos.y, threats[0].snake.body[0].x, threats[0].snake.body[0].y);
        }
        
        let foodDist = 100;
        if (closestFood) {
            foodDist = manhattanDist(pos.x, pos.y, closestFood.food.x, closestFood.food.y);
        }
        
        return { dir, pos, space, wallDist, threatDist, foodDist };
    });

    
    let candidates = scored.filter(m => {
        if (threats.length === 0) return true;
        return m.threatDist > 1 || threats[0].snake.length < myLength;
    });
    if (candidates.length === 0) candidates = scored;

    
    let viable = candidates.filter(m => m.space >= myLength * 0.5);
    if (viable.length === 0) viable = candidates;

    

    
    if (myHealth < 40 && closestFood && closestFood.dist < 10) {
        const foodMoves = viable.filter(m => m.space >= myLength * 0.6);
        if (foodMoves.length > 0) {
            const best = foodMoves.reduce((a, b) => a.foodDist < b.foodDist ? a : b);
            console.log(`MOVE ${turn}: ${best.dir} (hunting food)`);
            return { move: best.dir };
        }
    }

    
    viable.sort((a, b) => {
        if (Math.abs(a.space - b.space) > 5) return b.space - a.space;
        if (Math.abs(a.threatDist - b.threatDist) > 2) return b.threatDist - a.threatDist;
        return b.wallDist - a.wallDist;
    });

    const bestMove = viable[0];
    
    
    const finalPos = directions[bestMove.dir];
    if (!isSafe(finalPos.x, finalPos.y)) {
        console.log(`MOVE ${turn}: SAFETY OVERRIDE - ${bestMove.dir} was unsafe, picking fallback`);
        
        const emergencyMove = safeMoves[0];
        return { move: emergencyMove[0] };
    }
    
    console.log(`MOVE ${turn}: ${bestMove.dir} (space:${bestMove.space})`);
    return { move: bestMove.dir };
}
