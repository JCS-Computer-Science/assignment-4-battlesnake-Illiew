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

    // Build blocked set (all snake bodies except their tails)
    const blocked = new Set();
    const myBodySet = new Set();
    
    for (const segment of myBody) {
        myBodySet.add(`${segment.x},${segment.y}`);
    }
    
    for (const snake of allSnakes) {
        const bodyWithoutTail = snake.body.slice(0, -1);
        for (const seg of bodyWithoutTail) {
            blocked.add(`${seg.x},${seg.y}`);
        }
    }

    function isSafe(x, y) {
        return x >= 0 && x < boardWidth && y >= 0 && y < boardHeight && !blocked.has(`${x},${y}`);
    }

    // Flood fill to measure accessible space
    function floodFill(startX, startY, maxIterations = 500) {
        const visited = new Set();
        const queue = [[startX, startY]];
        visited.add(`${startX},${startY}`);
        let count = 0;
        let iterations = 0;
        
        while (queue.length > 0 && iterations < maxIterations) {
            const [cx, cy] = queue.shift();
            count++;
            iterations++;
            
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

    // Manhattan distance
    function manhattanDist(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    // Get wall proximity score (closer to center is better for more space)
    function getWallDistance(x, y) {
        return Math.min(x, y, boardWidth - 1 - x, boardHeight - 1 - y);
    }

    // Check if a move leads to a trap
    function isTrap(x, y) {
        const space = floodFill(x, y, 200);
        // If we'd only have half our length worth of space, it's risky
        return space < myLength * 0.6;
    }

    // Get opponent info
    function getOpponentInfo(opponentSnakes) {
        const threats = [];
        const smallerSnakes = [];
        
        for (const snake of opponentSnakes) {
            if (snake.id === gameState.you.id) continue;
            const dist = manhattanDist(myHead.x, myHead.y, snake.body[0].x, snake.body[0].y);
            
            if (snake.length > myLength) {
                threats.push({ snake, dist });
            } else if (snake.length < myLength) {
                smallerSnakes.push({ snake, dist });
            }
        }
        
        threats.sort((a, b) => a.dist - b.dist);
        smallerSnakes.sort((a, b) => a.dist - b.dist);
        
        return { threats, smallerSnakes };
    }

    // Find closest food
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

    // Check for safe path to food
    function canReachFood(targetFood, movePos, candidates) {
        const targetDist = manhattanDist(movePos.x, movePos.y, targetFood.x, targetFood.y);
        // Calculate space available from this position
        const spaceFromPos = floodFill(movePos.x, movePos.y, 150);
        // Only chase if we have enough space and won't starve
        return spaceFromPos >= myLength * 0.7 && targetDist <= 10;
    }

    const directions = {
        up:    { x: myHead.x,     y: myHead.y + 1 },
        down:  { x: myHead.x,     y: myHead.y - 1 },
        left:  { x: myHead.x - 1, y: myHead.y     },
        right: { x: myHead.x + 1, y: myHead.y     },
    };

    let safeMoves = Object.entries(directions).filter(([_, pos]) => isSafe(pos.x, pos.y));

    if (safeMoves.length === 0) {
        return { move: "up" }; // Last resort
    }

    // Avoid hazards if available
    const hazardSet = new Set((board.hazards || []).map(h => `${h.x},${h.y}`));
    const nonHazard = safeMoves.filter(([_, pos]) => !hazardSet.has(`${pos.x},${pos.y}`));
    if (nonHazard.length > 0) safeMoves = nonHazard;

    // Avoid obvious traps
    const nonTrap = safeMoves.filter(([_, pos]) => !isTrap(pos.x, pos.y));
    if (nonTrap.length > 0) safeMoves = nonTrap;

    // Get opponent info
    const { threats, smallerSnakes } = getOpponentInfo(allSnakes);
    const closestFood = getClosestFood();

    // Score all remaining moves
    const scored = safeMoves.map(([dir, pos]) => {
        const space = floodFill(pos.x, pos.y);
        const wallDist = getWallDistance(pos.x, pos.y);
        
        // Distance to closest threat
        let threatDist = 100;
        if (threats.length > 0) {
            threatDist = manhattanDist(pos.x, pos.y, threats[0].snake.body[0].x, threats[0].snake.body[0].y);
        }
        
        // Distance to closest food
        let foodDist = 100;
        if (closestFood) {
            foodDist = manhattanDist(pos.x, pos.y, closestFood.food.x, closestFood.food.y);
        }
        
        // Head-to-head collision risk
        let headCollisionRisk = 0;
        for (const threat of threats) {
            const dist = manhattanDist(pos.x, pos.y, threat.snake.body[0].x, threat.snake.body[0].y);
            if (dist === 1) headCollisionRisk += 1;
        }
        
        return {
            dir,
            pos,
            space,
            wallDist,
            threatDist,
            foodDist,
            headCollisionRisk,
        };
    });

    // PRIMARY RULE: Avoid head-to-head with larger snakes
    const noHeadCollision = scored.filter(m => {
        if (m.headCollisionRisk === 0) return true;
        // Only allow if we're larger than all threats nearby
        if (threats.length > 0 && myLength > threats[0].snake.length) return true;
        return false;
    });
    if (noHeadCollision.length > 0) scored.splice(0, scored.length, ...noHeadCollision);

    // SECONDARY RULE: Maintain survivable space
    const survivableSpace = scored.filter(m => m.space >= myLength);
    let candidates = survivableSpace.length > 0 ? survivableSpace : scored;

    // TERTIARY LOGIC: Decide whether to chase food or maintain position
    let bestMove = null;

    // If hungry and food is close AND we have space, chase it
    if (myHealth < 40 && closestFood && closestFood.dist < 15) {
        const foodMoves = candidates.filter(m => 
            canReachFood(closestFood.food, m.pos, candidates)
        );
        
        if (foodMoves.length > 0) {
            // Pick the move that gets us closest to food
            bestMove = foodMoves.reduce((best, curr) => 
                curr.foodDist < best.foodDist ? curr : best
            );
        }
    }

    // If we haven't found a good food move, maximize space and stay safe
    if (!bestMove) {
        const maxSpace = Math.max(...candidates.map(m => m.space));
        const spacePriority = candidates.filter(m => m.space >= maxSpace * 0.8);
        
        bestMove = spacePriority.reduce((best, curr) => {
            // Prefer staying away from threats
            if (curr.threatDist !== best.threatDist) {
                return curr.threatDist > best.threatDist ? curr : best;
            }
            // Prefer center over edges when not in danger
            if (threats.length === 0 || threats[0].dist > 10) {
                const centerX = (boardWidth - 1) / 2;
                const centerY = (boardHeight - 1) / 2;
                const currCenter = manhattanDist(curr.pos.x, curr.pos.y, centerX, centerY);
                const bestCenter = manhattanDist(best.pos.x, best.pos.y, centerX, centerY);
                return currCenter < bestCenter ? curr : best;
            }
            // When in danger, stay near walls for control
            return curr.wallDist > best.wallDist ? curr : best;
        });
    }

    console.log(`MOVE ${turn}: ${bestMove.dir} (space:${bestMove.space} threat:${bestMove.threatDist} food:${bestMove.foodDist})`);
    return { move: bestMove.dir };
}