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

        // Show thinking status
        const statusEl = document.getElementById('ai-status');
        if (statusEl) statusEl.style.display = 'block';

        // Beam Search Configuration (High Performance Balancing)
        const MAX_PLANNING_DEPTH = 5; // Search up to 5 moves deep
        const BEAM_WIDTH = 4; // Track 4 best candidates at each depth
        
        if (!nextFruits || nextFruits.length === 0) {
            if (statusEl) statusEl.style.display = 'none';
            return canvasWidth / 2;
        }

        // Current candidate pool for the root layer
        let pool = [];
        const type0 = nextFruits[0];
        const r0 = FRUITS[type0].size / 2;
        
        // Root Layer Sampling
        for (let x0 = r0; x0 <= canvasWidth - r0; x0 += 10) { 
            const res = this.simulateDrop(x0, type0, fruits, canvasWidth, canvasHeight);
            if (!res.failed) {
                const centerDistance = Math.abs(x0 - (canvasWidth / 2));
                const tieBreaker = -(centerDistance * 0.05); // Stronger center preference for root
                pool.push({
                    x0: x0,
                    board: res.fruits,
                    score: res.score + tieBreaker
                });
            }
        }

        // Beam layers: Depth 1 onward
        for (let d = 1; d < Math.min(nextFruits.length, MAX_PLANNING_DEPTH); d++) {
            // Prune to BEAM_WIDTH
            pool.sort((a, b) => b.score - a.score);
            const candidates = pool.slice(0, BEAM_WIDTH);
            let nextPool = [];
            
            const typeD = nextFruits[d];
            const rD = FRUITS[typeD].size / 2;

            for (const cand of candidates) {
                // Heuristic: search narrower as we go deeper to save CPU
                const step = 20 + (d * 10); 
                for (let xD = rD; xD <= canvasWidth - rD; xD += step) {
                    const res = this.simulateDrop(xD, typeD, cand.board, canvasWidth, canvasHeight);
                    if (!res.failed) {
                        const discountedScore = res.score * Math.pow(0.85, d);
                        nextPool.push({
                            x0: cand.x0, // Carry root move history
                            board: res.fruits,
                            score: cand.score + discountedScore
                        });
                    }
                }
            }
            if (nextPool.length === 0) break;
            pool = nextPool;
        }

        // Result: best x0 from the highest-scoring candidate path
        pool.sort((a, b) => b.score - a.score);
        const bestX = pool.length > 0 ? pool[0].x0 : (canvasWidth / 2);

        if (statusEl) statusEl.style.display = 'none';
        return this.clamp(bestX, r0, canvasWidth - r0);
    }

    simulateDrop(x, type, inputFruits, canvasWidth, canvasHeight) {
        const dropRadius = FRUITS[type].size / 2;
        let landY = canvasHeight - dropRadius;
        let hitFruit = null;
        
        for (const f of inputFruits) {
            const fRadius = f.size / 2;
            const distanceX = Math.abs(f.x - x);
            const minDistance = dropRadius + fRadius + 0.5; // Match script.js 0.5 buffer
            
            if (distanceX < minDistance && f.y > 30) { 
                const dx2 = distanceX * distanceX;
                const dist2 = minDistance * minDistance;
                const dy = Math.sqrt(Math.max(0, dist2 - dx2));
                const touchY = f.y - dy;
                
                if (touchY < landY) {
                    landY = touchY;
                    hitFruit = f;
                }
            }
        }
        
        let score = landY; // Base reward: deeper is better
        
        // Bonus for starting a new column in empty space
        const typeExists = inputFruits.some(f => f.type === type);
        const onFloor = Math.abs(landY - (canvasHeight - dropRadius)) < 1;
        if (!typeExists && onFloor) {
            score += 3000; 
        }
        
        // Vertical Alignment Bonus (Rescue buried fruits)
        for (const f of inputFruits) {
            if (f.type === type && f.y > landY) {
                const dx = Math.abs(f.x - x);
                const colWidth = (dropRadius + f.size / 2) * 0.8;
                if (dx < colWidth) {
                    const alignmentFactor = 1 - (dx / colWidth);
                    score += 1500 * alignmentFactor * (5 - type); // Increased from 600
                }
            }
        }

        // Strategy: Predecessor Stacking (Chain Setup)
        for (const f of inputFruits) {
            if (f.type === type + 1 && f.y > landY) {
                const dx = Math.abs(f.x - x);
                const colWidth = (dropRadius + f.size / 2) * 0.9;
                if (dx < colWidth) {
                    const alignmentFactor = 1 - (dx / colWidth);
                    score += 1000 * alignmentFactor * (5 - type); // Increased from 400
                }
            }
        }
        
        // Direct Contact Reward
        if (hitFruit && hitFruit.type === type && Math.abs(hitFruit.x - x) < 5) {
            score += 2000; // Increased from 1000
        } else if (hitFruit && Math.abs(hitFruit.x - x) >= 5) {
            // Nudge/Slide heuristics...
            const pushDir = Math.sign(hitFruit.x - x);
            const slideDir = Math.sign(x - hitFruit.x);
            const massRatio = Math.pow(FRUITS[type].size / FRUITS[hitFruit.type].size, 2);
            
            if (massRatio >= 0.8) { 
                for (const other of inputFruits) {
                    if (other !== hitFruit && other.type === hitFruit.type) {
                        const dirToOther = Math.sign(other.x - hitFruit.x);
                        if (dirToOther === pushDir || dirToOther === 0) {
                            const dist = Math.abs(other.x - hitFruit.x);
                            if (dist > 0 && dist < 200) {
                                score += 800 * (hitFruit.type + 1);
                            }
                        }
                    }
                }
            } else {
                for (const other of inputFruits) {
                    if (other.type === type && other.y > hitFruit.y) { 
                        const dirToOther = Math.sign(other.x - x);
                        if (dirToOther === slideDir || dirToOther === 0) {
                            const dist = Math.abs(other.x - x);
                            if (dist < 150) {
                                score += 600 * (type + 1);
                            }
                        }
                    }
                }
            }
        }
        
        let newFruits = inputFruits.map(f => ({...f}));
        let activeFruit = { x, y: landY, type, size: FRUITS[type].size };
        let merged = true;
        
        // Resolve recursive chain merges
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
                
                // Exponential reward for merges (Base 2.5 and higher multiplier)
                score += 25000 * Math.pow(2.5, activeFruit.type); 
                
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
        
        // Adjacency Evaluation
        for (const f of newFruits) {
            const dist = Math.hypot(f.x - activeFruit.x, f.y - activeFruit.y);
            const maxAdjacencyDist = activeFruit.size/2 + f.size/2 + 30; // Slightly more generous
            if (dist > 0 && dist < maxAdjacencyDist) {
                if (f.type === activeFruit.type) score += 2000;
                else if (f.type === activeFruit.type + 1) score += 1000;
                else if (f.type === activeFruit.type - 1) score += 500;
                else if (f.type > activeFruit.type) score += 200;
            }
        }
        
        if (activeFruit.type < FRUITS.length - 1) {
            newFruits.push(activeFruit);
        } else {
            score += 500000; // Massively reward clearing the board
        }
        
        // Global Death Penalty
        const highestFruitY = newFruits.reduce((minY, f) => Math.min(minY, f.y - f.size/2), canvasHeight);
        if (highestFruitY < 120) return { failed: true, score: -1000000 };
        
        // Global Board Evaluation
        for (let i = 0; i < newFruits.length; i++) {
            const f1 = newFruits[i];
            
            // 1. Exponential Height Penalty (Aggressive)
            if (f1.y < 500) {
                const distToDanger = Math.max(1, f1.y - 60);
                score -= Math.pow(600 / distToDanger, 2.5); // Steeper penalty curve
            }

            // 2. Size Gradient (L->R: Small -> Big)
            const targetX = (f1.type / (FRUITS.length - 1)) * canvasWidth;
            score -= Math.abs(f1.x - targetX) * 1.5; // Stronger pull
            
            // 3. Holes / Buried Small Fruit Penalty (CRITICAL for Tetris-like efficiency)
            for (let j = i + 1; j < newFruits.length; j++) {
                const f2 = newFruits[j];
                const dx = Math.abs(f1.x - f2.x);
                const avgSize = (f1.size + f2.size) / 2;
                
                if (dx < avgSize * 0.9) {
                    if (f1.y > f2.y && f1.type < f2.type) { 
                        // f1 buried beneath larger f2
                        score -= 5000 * Math.pow(3, f2.type - f1.type);
                    } else if (f2.y > f1.y && f2.type < f1.type) {
                        // f2 buried beneath larger f1
                        score -= 5000 * Math.pow(3, f1.type - f2.type);
                    }
                }
            }
        }

        // Global Flatness (Variance)
        const binCount = 6;
        const binWidth = canvasWidth / binCount;
        const columnHeights = new Array(binCount).fill(canvasHeight);
        for (const f of newFruits) {
            const binIdx = Math.floor(this.clamp(f.x, 0, canvasWidth - 1) / binWidth);
            const topY = f.y - f.size / 2;
            if (topY < columnHeights[binIdx]) columnHeights[binIdx] = topY;
        }
        const avgHeight = columnHeights.reduce((a, b) => a + b, 0) / binCount;
        let variance = 0;
        for (const h of columnHeights) variance += Math.pow(h - avgHeight, 2);
        score -= Math.sqrt(variance / binCount) * 10;
        
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
