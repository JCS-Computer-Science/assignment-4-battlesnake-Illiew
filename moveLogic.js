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
    const hazardSet = new Set((board.hazards || []).map(h => `${h.x},${h.y}`));
    
    for (const snake of allSnakes) {
        if (snake.id === gameState.you.id) {
            
            const bodyWithoutTail = myBody.slice(0, -1);
            for (const seg of bodyWithoutTail) {
                blocked.add(`${seg.x},${seg.y}`);
            }
        } else {
            
            const bodyWithoutTail = snake.body.slice(0, -1);
            for (const seg of bodyWithoutTail) {
                blocked.add(`${seg.x},${seg.y}`);
            }
            
            
            const headPos = snake.body[0];
            const prevPos = snake.body[1] || headPos;
            const direction = { x: headPos.x - prevPos.x, y: headPos.y - prevPos.y };
            
            for (let futureMove = 1; futureMove <= 3; futureMove++) {
                const futureX = headPos.x + direction.x * futureMove;
                const futureY = headPos.y + direction.y * futureMove;
                if (futureX >= 0 && futureX < boardWidth && futureY >= 0 && futureY < boardHeight) {
                    blocked.add(`${futureX},${futureY}`);
                }
            }
        }
    }

    function isSafe(x, y) {
        if (x < 0 || x >= boardWidth || y < 0 || y >= boardHeight) return false;
        return !blocked.has(`${x},${y}`);
    }

  
    function dijkstra(startX, startY, targetX, targetY) {
        const distances = new Map();
        const visited = new Set();
        const queue = [[0, startX, startY]]; 
        const parent = new Map();
        
        distances.set(`${startX},${startY}`, 0);
        
        while (queue.length > 0) {
            queue.sort((a, b) => a[0] - b[0]);
            const [dist, cx, cy] = queue.shift();
            const key = `${cx},${cy}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            
            if (cx === targetX && cy === targetY) break;
            
            for (const [nx, ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]) {
                if (nx < 0 || nx >= boardWidth || ny < 0 || ny >= boardHeight) continue;
                const nkey = `${nx},${ny}`;
                if (visited.has(nkey)) continue;
                
                
                const weight = hazardSet.has(nkey) ? 14 : 1;
                const penalty = blocked.has(nkey) ? 1000 : 0;
                const newDist = dist + weight + penalty;
                
                if (!distances.has(nkey) || newDist < distances.get(nkey)) {
                    distances.set(nkey, newDist);
                    parent.set(nkey, `${cx},${cy}`);
                    queue.push([newDist, nx, ny]);
                }
            }
        }
        
        const targetKey = `${targetX},${targetY}`;
        if (!distances.has(targetKey)) return null; 
        
        // Reconstruct path
        const path = [];
        let current = targetKey;
        while (parent.has(current)) {
            path.unshift(current);
            current = parent.get(current);
        }
        return { path, distance: distances.get(targetKey) };
    }

    
    function connectedComponentSize(startX, startY, maxIterations = 1000) {
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

    
    function getTargets() {
        const targets = [];
        
        // All food
        for (const food of board.food) {
            targets.push({ 
                type: 'food', 
                pos: food, 
                priority: 1 
            });
        }
        
       
        for (const snake of allSnakes) {
            if (snake.id !== gameState.you.id && snake.length < myLength) {
                targets.push({ 
                    type: 'snake', 
                    pos: snake.body[0], 
                    priority: 2,
                    snake 
                });
            }
        }
        
        return targets;
    }

    function getClosestTarget() {
        const targets = getTargets();
        if (targets.length === 0) return null;
        
        let closest = targets[0];
        let minDist = manhattanDist(myHead.x, myHead.y, targets[0].pos.x, targets[0].pos.y);
        
        for (let i = 1; i < targets.length; i++) {
            const dist = manhattanDist(myHead.x, myHead.y, targets[i].pos.x, targets[i].pos.y);
            if (dist < minDist || (dist === minDist && targets[i].priority < closest.priority)) {
                minDist = dist;
                closest = targets[i];
            }
        }
        
        return { target: closest, dist: minDist };
    }

   
    function getDirectionPriority() {
  
        if (myBody.length > 1) {
            const lastPos = myBody[1];
            const forward = { 
                x: myHead.x - lastPos.x, 
                y: myHead.y - lastPos.y 
            };
            
            const dirName = getDirectionName(forward.x, forward.y);
            if (dirName) {
                const clockwise = rotateClockwise(dirName);
                const counterClockwise = rotateCounterClockwise(dirName);
                return [dirName, clockwise, counterClockwise];
            }
        }
        
        return ['up', 'right', 'down', 'left'];
    }

    function getDirectionName(dx, dy) {
        if (dx === 0 && dy === 1) return 'up';
        if (dx === 0 && dy === -1) return 'down';
        if (dx === 1 && dy === 0) return 'right';
        if (dx === -1 && dy === 0) return 'left';
        return null;
    }

    function rotateClockwise(dir) {
        const map = { up: 'right', right: 'down', down: 'left', left: 'up' };
        return map[dir];
    }

    function rotateCounterClockwise(dir) {
        const map = { up: 'left', left: 'down', down: 'right', right: 'up' };
        return map[dir];
    }

    const directions = {
        up:    { x: myHead.x,     y: myHead.y + 1 },
        down:  { x: myHead.x,     y: myHead.y - 1 },
        left:  { x: myHead.x - 1, y: myHead.y     },
        right: { x: myHead.x + 1, y: myHead.y     },
    };

    let safeMoves = Object.entries(directions)
        .filter(([_, pos]) => isSafe(pos.x, pos.y))
        .sort(([dirA], [dirB]) => {
            const priority = getDirectionPriority();
            return priority.indexOf(dirA) - priority.indexOf(dirB);
        });

    if (safeMoves.length === 0) {
        console.log(`MOVE ${turn}: TRAPPED`);
        return { move: "up" };
    }

    const hazardAvoid = safeMoves.filter(([_, pos]) => !hazardSet.has(`${pos.x},${pos.y}`));
    if (hazardAvoid.length > 0) safeMoves = hazardAvoid;

    const threats = getThreats();
    const closestTarget = getClosestTarget();

   
    const scored = safeMoves.map(([dir, pos]) => {
        const space = connectedComponentSize(pos.x, pos.y, 600);
        const wallDist = getWallDistance(pos.x, pos.y);
        
        let threatDist = 100;
        if (threats.length > 0) {
            threatDist = manhattanDist(pos.x, pos.y, threats[0].snake.body[0].x, threats[0].snake.body[0].y);
        }
        
        let targetDist = 100;
        if (closestTarget) {
            targetDist = manhattanDist(pos.x, pos.y, closestTarget.target.pos.x, closestTarget.target.pos.y);
        }
        
    
        let dijkstraDist = targetDist;
        if (closestTarget && closestTarget.dist < 20) {
            const path = dijkstra(pos.x, pos.y, closestTarget.target.pos.x, closestTarget.target.pos.y);
            if (path) dijkstraDist = path.distance;
        }
        
        return { dir, pos, space, wallDist, threatDist, targetDist, dijkstraDist };
    });

   
    if (myHealth < 30 && closestTarget && closestTarget.target.type === 'snake') {
        const foodMoves = scored.filter(m => m.space >= myLength * 0.4);
        if (foodMoves.length > 0) {
            const best = foodMoves.reduce((a, b) => a.dijkstraDist < b.dijkstraDist ? a : b);
            console.log(`MOVE ${turn}: ${best.dir} (hunting weaker snake, health: ${myHealth})`);
            return { move: best.dir };
        }
    }

  
    if (myHealth < 50 && closestTarget && closestTarget.dist < 12) {

        const candidates = scored.filter(m => m.space >= myLength * 0.4);
        if (candidates.length > 0) {
            candidates.sort((a, b) => a.dijkstraDist - b.dijkstraDist);
            console.log(`MOVE ${turn}: ${candidates[0].dir} (low health food rush)`);
            return { move: candidates[0].dir };
        }
    }

    const myTail = myBody[myBody.length - 1];
    const nearTail = manhattanDist(myHead.x, myHead.y, myTail.x, myTail.y) <= 3;
    
    if (myHealth > 60 && nearTail && turn > 100) {
   
        const tailMoves = scored.filter(m => {
            const distToTail = manhattanDist(m.pos.x, m.pos.y, myTail.x, myTail.y);
            return distToTail <= 2;
        });
        
        if (tailMoves.length > 0) {
            tailMoves.sort((a, b) => b.space - a.space);
            console.log(`MOVE ${turn}: ${tailMoves[0].dir} (tail cycling)`);
            return { move: tailMoves[0].dir };
        }
    }


    scored.sort((a, b) => {

        if (Math.abs(a.space - b.space) > 10) return b.space - a.space;

        if (Math.abs(a.threatDist - b.threatDist) > 3) return b.threatDist - a.threatDist;

        if (Math.abs(a.dijkstraDist - b.dijkstraDist) > 2) return a.dijkstraDist - b.dijkstraDist;

        return b.wallDist - a.wallDist;
    });

    const bestMove = scored[0];
    
    if (!isSafe(bestMove.pos.x, bestMove.pos.y)) {
        console.log(`MOVE ${turn}: SAFETY OVERRIDE`);
        return { move: safeMoves[0][0] };
    }
    
    console.log(`MOVE ${turn}: ${bestMove.dir} (space:${bestMove.space}, health:${myHealth})`);
    return { move: bestMove.dir };
}
