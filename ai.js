class AutoPlayer {
    constructor() {
        this.isActive = false;
        this.intervalId = null;
        this.actionDelay = 200; // Check state frequency
        this.lastDropTime = 0; // Prevent spam dropping
        
        this.setupControls();
    }

    setupControls() {
        const aiBtn = document.getElementById('aiBtn');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => {
                this.toggleAI();
            });
        }
    }

    toggleAI() {
        this.isActive = !this.isActive;
        const aiBtn = document.getElementById('aiBtn');
        if (aiBtn) {
            aiBtn.textContent = this.isActive ? "AI: ON" : "Toggle AI";
            aiBtn.style.backgroundColor = this.isActive ? "#4CAF50" : "";
            aiBtn.style.color = this.isActive ? "white" : "";
        }

        if (this.isActive) {
            this.startLoop();
        } else {
            this.stopLoop();
        }
    }

    startLoop() {
        if (!this.intervalId) {
            this.intervalId = setInterval(() => this.makeDecision(), this.actionDelay);
            console.log("AI Player started");
        }
    }

    stopLoop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("AI Player stopped");
        }
    }

    makeDecision() {
        if (!window.game) return;
        
        const state = window.game.getGameState();
        
        if (state.gameOver) return;
        if (state.isDropping) return;

        const timeSinceLastDrop = Date.now() - this.lastDropTime;

        // Dynamic delay: base 800ms + 50ms per fruit on board to allow for some settling
        const minDelay = 800 + (Math.max(0, state.fruits.length - 5) * 50);
        if (timeSinceLastDrop < minDelay) return;

        // Ensure board is mostly settled before dropping
        // Relaxed threshold back to 0.1 for much faster play
        const isStill = state.fruits.every(f => Math.abs(f.vy) < 0.1 && Math.abs(f.vx) < 0.1);
        
        // Wait for things to stop moving up to 4 seconds (reduced from 6)
        if (!isStill && state.fruits.length > 0 && timeSinceLastDrop < 4000) return;

        // Check if there are any fruits of the SAME TYPE that are VERY CLOSE to each other
        // If they are, wait for them to merge (up to 2 seconds since last drop)
        let pendingMerge = false;
        if (timeSinceLastDrop < 2000) {
            for (let i = 0; i < state.fruits.length; i++) {
                for (let j = i + 1; j < state.fruits.length; j++) {
                    const f1 = state.fruits[i];
                    const f2 = state.fruits[j];
                    if (f1.type === f2.type) {
                        const dist = Math.hypot(f1.x - f2.x, f1.y - f2.y);
                        const touchDist = (f1.size / 2) + (f2.size / 2);
                        if (dist < touchDist + 20) {
                            pendingMerge = true;
                            break;
                        }
                    }
                }
                if (pendingMerge) break;
            }
        }
        
        // Wait for potential adjacent merges to resolve before dropping
        if (pendingMerge) return;

        const bestX = this.calculateBestDropPosition(state);
        
        this.executeDrop(bestX);
    }

    executeDrop(x) {
        if (window.game && !window.game.isDropping && !window.game.gameOver) {
            this.lastDropTime = Date.now();
            window.game.dropPosition = x;
            window.game.updateDropLine();
            window.game.dropFruit();
        }
    }

    calculateBestDropPosition(state) {
        const { fruits, nextFruits, canvasWidth, canvasHeight } = state;
        
        if (fruits.length === 0) {
            return canvasWidth / 2;
        }

        let bestScore = -Infinity;
        let bestX = canvasWidth / 2;
        
        // Ensure nextFruits contains 3 elements as safely provided via script array
        if (!nextFruits || nextFruits.length === 0) return canvasWidth / 2;
        
        const type0 = nextFruits[0];
        const r0 = FRUITS[type0].size / 2;
        const minX0 = r0;
        const maxX0 = canvasWidth - r0;
        
        // Depth 0: High resolution (step 2 for precision stacking)
        for (let x0 = minX0; x0 <= maxX0; x0 += 2) {
            const result0 = this.simulateDrop(x0, type0, fruits, canvasWidth, canvasHeight);
            if (result0.failed) continue;
            
            let score0 = result0.score;
            
            // Depth 1: Medium resolution (step 10)
            if (nextFruits.length > 1) {
                let maxScore1 = -Infinity;
                const type1 = nextFruits[1];
                const r1 = FRUITS[type1].size / 2;
                for (let x1 = r1; x1 <= canvasWidth - r1; x1 += 10) {
                    const result1 = this.simulateDrop(x1, type1, result0.fruits, canvasWidth, canvasHeight);
                    if (result1.failed) continue;
                    
                    let score1 = result1.score;
                    
                    // Depth 2: Low resolution (step 20)
                    if (nextFruits.length > 2) {
                        let maxScore2 = -Infinity;
                        const type2 = nextFruits[2];
                        const r2 = FRUITS[type2].size / 2;
                        for (let x2 = r2; x2 <= canvasWidth - r2; x2 += 20) {
                            const result2 = this.simulateDrop(x2, type2, result1.fruits, canvasWidth, canvasHeight);
                            if (!result2.failed && result2.score > maxScore2) {
                                maxScore2 = result2.score;
                            }
                        }
                        if (maxScore2 !== -Infinity) {
                            score1 += maxScore2 * 0.5; // Discount future rewards slightly
                        }
                    }
                    
                    if (score1 > maxScore1) {
                        maxScore1 = score1;
                    }
                }
                if (maxScore1 !== -Infinity) {
                     score0 += maxScore1 * 0.8; // Discount earlier future rewards
                }
            }
            
            // Slightly favor drops closer to the center to break ties natively
            // instead of dropping on the extreme left always when tying
            const centerDistance = Math.abs(x0 - (canvasWidth / 2));
            score0 -= (centerDistance * 0.01);

            if (score0 > bestScore) {
                bestScore = score0;
                bestX = x0;
            }
        }
        
        return bestScore !== -Infinity ? this.clamp(bestX, minX0, maxX0) : (canvasWidth / 2);
    }

    simulateDrop(x, type, inputFruits, canvasWidth, canvasHeight) {
        const dropRadius = FRUITS[type].size / 2;
        let landY = canvasHeight - dropRadius;
        let hitFruit = null;
        
        for (const f of inputFruits) {
            const fRadius = f.size / 2;
            const distanceX = Math.abs(f.x - x);
            const minDistance = dropRadius + fRadius;
            
            // If the drop x-coordinate is within horizontal bounds of the fruit f
            if (distanceX < minDistance && f.y > 30) { 
                const dx2 = distanceX * distanceX;
                const dist2 = minDistance * minDistance;
                // Calculate how high up the center of the dropped fruit will be when the edges touch
                const dy = Math.sqrt(Math.max(0, dist2 - dx2));
                
                // The center Y of the new fruit when touching `f` from above
                const touchY = f.y - dy;
                
                // We can't land lower than the highest contact point we find
                // This correctly identifies the top-most fruit we collide with
                if (touchY < landY) {
                    landY = touchY;
                    hitFruit = f;
                }
            }
        }
        
        if (landY < 120) return { failed: true }; // Death penalty
        
        let score = landY; // Reward lower drops
        
        // NEW: Prioritize empty space for fruits NOT on the board
        const typeExists = inputFruits.some(f => f.type === type);
        const onFloor = Math.abs(landY - (canvasHeight - dropRadius)) < 1;
        if (!typeExists && onFloor) {
            score += 2000; // Significant bonus for starting a new type in empty floor space
        }
        
        // NEW: Vertical Potential Bonus (Rescue buried fruits)
        // If we drop a fruit in the same vertical column as a matching fruit below us
        for (const f of inputFruits) {
            if (f.type === type && f.y > landY) {
                const dx = Math.abs(f.x - x);
                const colWidth = (dropRadius + f.size / 2) * 0.8; // Use slightly narrower column for precision
                if (dx < colWidth) {
                    // We are in the same relative "column"
                    // Bonus scales by alignment and prioritizes smaller, harder-to-rescue fruits
                    const alignmentFactor = 1 - (dx / colWidth);
                    score += 600 * alignmentFactor * (5 - type); 
                }
            }
        }

        // NEW: Predecessor Stacking Bonus (Strategic chaining)
        // If we drop a fruit on top of a fruit that is the NEXT type in the cycle
        // e.g. Cherry (0) on top of Strawberry (1)
        for (const f of inputFruits) {
            if (f.type === type + 1 && f.y > landY) {
                const dx = Math.abs(f.x - x);
                const colWidth = (dropRadius + f.size / 2) * 0.9;
                if (dx < colWidth) {
                    const alignmentFactor = 1 - (dx / colWidth);
                    // Strong bonus for setting up a chain reaction
                    score += 400 * alignmentFactor * (5 - type);
                }
            }
        }
        
        // Reward exact alignment ONLY if we directly contact the identical fruit
        // This solves the issue where AI targets a covered fruit
        if (hitFruit && hitFruit.type === type && Math.abs(hitFruit.x - x) < 5) {
            score += 1000;
        } else if (hitFruit && Math.abs(hitFruit.x - x) >= 5) {
            // NUDGE HEURISTIC: Dropping off-center pushes hitFruit and slides the dropped fruit
            const pushDir = Math.sign(hitFruit.x - x); // Direction hitFruit gets pushed
            const slideDir = Math.sign(x - hitFruit.x); // Direction we slide
            
            // Mass ratio determines if we push them, or they push us
            const massRatio = Math.pow(FRUITS[type].size / FRUITS[hitFruit.type].size, 2);
            
            if (massRatio >= 0.8) { 
                // We are heavy enough to push hitFruit. Does this push it towards a match?
                for (const other of inputFruits) {
                    if (other !== hitFruit && other.type === hitFruit.type) {
                        const dirToOther = Math.sign(other.x - hitFruit.x);
                        if (dirToOther === pushDir || dirToOther === 0) {
                            const dist = Math.abs(other.x - hitFruit.x);
                            if (dist > 0 && dist < 200) {
                                score += 600 * (hitFruit.type + 1); // Reward nudging!
                            }
                        }
                    }
                }
            } else {
                // We are small, so we slide down hitFruit. Does this slide us towards our match?
                for (const other of inputFruits) {
                    if (other.type === type && other.y > hitFruit.y) { 
                        const dirToOther = Math.sign(other.x - x);
                        if (dirToOther === slideDir || dirToOther === 0) {
                            const dist = Math.abs(other.x - x);
                            if (dist < 150) {
                                score += 400 * (type + 1); // Reward slide merging!
                            }
                        }
                    }
                }
            }
        }
        
        let newFruits = inputFruits.map(f => ({...f}));
        let activeFruit = { x, y: landY, type, size: FRUITS[type].size };
        let merged = true;
        
        // Resolve recursive chain merges exactly as the evolution path outlines
        while (merged) {
            merged = false;
            let mergeTargetIdx = -1;
            
            for (let i = 0; i < newFruits.length; i++) {
                const f = newFruits[i];
                if (f.type === activeFruit.type) {
                    const dist = Math.hypot(f.x - activeFruit.x, f.y - activeFruit.y);
                    if (dist < (activeFruit.size/2 + f.size/2 + 15)) {
                        mergeTargetIdx = i;
                        break;
                    }
                }
            }
            
            if (mergeTargetIdx !== -1 && activeFruit.type < FRUITS.length - 1) {
                const target = newFruits[mergeTargetIdx];
                newFruits.splice(mergeTargetIdx, 1);
                
                // Huge exponential reward for successfully modeling merges in our simulation
                score += 5000 * Math.pow(1.5, activeFruit.type); 
                
                const nextType = activeFruit.type + 1;
                activeFruit = {
                    x: (activeFruit.x + target.x) / 2,
                    y: (activeFruit.y + target.y) / 2,
                    type: nextType,
                    size: FRUITS[nextType].size
                };
                merged = true;
            }
        }
        
        // Evaluate grouped adjacent evolution structure
        for (const f of newFruits) {
            const dist = Math.hypot(f.x - activeFruit.x, f.y - activeFruit.y);
            const maxAdjacencyDist = activeFruit.size/2 + f.size/2 + 25;
            if (dist > 0 && dist < maxAdjacencyDist) { // > 0 to ignore self if somehow included
                if (f.type === activeFruit.type) score += 1000; // Reward being very close to identical fruit even if it didn't perfectly merge in simulation
                else if (f.type === activeFruit.type + 1) score += 500;
                else if (f.type === activeFruit.type - 1) score += 300;
                else if (f.type > activeFruit.type) score += 100;
                else score -= 200;
            }
        }
        
        // Only add to board if it's NOT the final vanishing fruit (Coconut)
        if (activeFruit.type < FRUITS.length - 1) {
            newFruits.push(activeFruit);
        }
        
        // Global board evaluation: penalize identical large fruits that are far apart
        const typeGroups = {};
        for (const f of newFruits) {
            if (!typeGroups[f.type]) typeGroups[f.type] = [];
            typeGroups[f.type].push(f);
        }
        
        for (const type in typeGroups) {
            const t = parseInt(type);
            const group = typeGroups[type];
            // Only penalize spreading for larger fruits (type 3=Grape and above)
            if (t >= 3 && group.length > 1) { 
                let maxDist = 0;
                for (let i=0; i<group.length; i++) {
                    for (let j=i+1; j<group.length; j++) {
                        const distX = Math.abs(group[i].x - group[j].x); // Horizontal spread penalty
                        if (distX > maxDist) maxDist = distX;
                    }
                }
                // Massive penalty based on horizontal spread and fruit size
                // E.g. lemons (type 5) spreading 200px -> penalty = 200 * 5 * 3 = -3000
                score -= maxDist * t * 3;
            }
        }
        
        // Suika-style advanced heuristics: Size-sorting and Board Height
        for (let i = 0; i < newFruits.length; i++) {
            const f1 = newFruits[i];
            
            // 1. Exponential Height Penalty: CRITICAL to prevent towering.
            // Game over line is at y=60. Danger mode starts after 0.5s above that.
            // We penalize heavily as we approach or cross y=120 (approximate buffer).
            if (f1.y < 450) {
                // As y gets smaller (closer to top), penalty grows significantly
                // Using (y-60) to measure distance to danger line
                const distToDanger = Math.max(1, f1.y - 60);
                score -= Math.pow(450 / distToDanger, 2); 
            }

            // 2. Board Flatness: Identify "towers" and "holes"
            // We want to reward filling holes and penalize creating high peaks.
            // (Heuristic: already covered by landY score and height penalty, 
            // but we add a specific reward for keeping the surface level)

            // NEW 3. Size Gradient: Organize fruits by type horizontally
            // Larger fruits -> Right, Smaller fruits -> Left
            // This creates a natural "slope" that facilitates cascading merges
            const targetXRatio = f1.type / (FRUITS.length - 1);
            const targetX = targetXRatio * canvasWidth;
            score -= Math.abs(f1.x - targetX) * 0.5; // Gentle pull towards side
            
            // 4. Buried Small Fruit Penalty
            for (let j = i + 1; j < newFruits.length; j++) {
                const f2 = newFruits[j];
                const dx = Math.abs(f1.x - f2.x);
                const avgSize = (f1.size + f2.size) / 2;
                
                // If they are vertically aligned (sharing the same column)
                if (dx < avgSize) {
                    // Penalize exponentially if the fruit on TOP is LARGER than the fruit on BOTTOM
                    // y=0 is top, y=canvasHeight is bottom. f1.y > f2.y means f1 is below f2.
                    if (f1.y > f2.y && f1.type < f2.type) { 
                        // f1 is under f2, and f1 is smaller
                        score -= 1000 * Math.pow(2, f2.type - f1.type);
                    } else if (f2.y > f1.y && f2.type < f1.type) {
                        // f2 is under f1, and f2 is smaller
                        score -= 1000 * Math.pow(2, f1.type - f2.type);
                    }
                }
            }
        }

        // Global Flatness Heuristic: Calculate height variance across bins
        const binCount = 8;
        const binWidth = canvasWidth / binCount;
        const columnHeights = new Array(binCount).fill(canvasHeight);
        
        for (const f of newFruits) {
            const binIdx = Math.floor(this.clamp(f.x, 0, canvasWidth - 1) / binWidth);
            const topY = f.y - f.size / 2;
            if (topY < columnHeights[binIdx]) {
                columnHeights[binIdx] = topY;
            }
        }
        
        const avgHeight = columnHeights.reduce((a, b) => a + b, 0) / binCount;
        let variance = 0;
        for (const h of columnHeights) {
            variance += Math.pow(h - avgHeight, 2);
        }
        score -= Math.sqrt(variance / binCount) * 5; // Reduced weight from 10 to 5 to allow for gradient slope
        
        return { failed: false, score, fruits: newFruits };
    }

    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }
}

// Initialize AI when page loads
window.addEventListener('load', () => {
    window.aiPlayer = new AutoPlayer();
});
