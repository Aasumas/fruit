// Game configuration
const FRUITS = [
    { emoji: '🍒', size: 50, points: 1 },
    { emoji: '🍓', size: 60, points: 3 },
    { emoji: '🫐', size: 70, points: 6 },
    { emoji: '🍇', size: 84, points: 10 },
    { emoji: '🥝', size: 100, points: 15 },
    { emoji: '🍋', size: 116, points: 21 },
    { emoji: '🍊', size: 132, points: 28 },
    { emoji: '🍎', size: 150, points: 36 },
    { emoji: '🍑', size: 168, points: 45 },
    { emoji: '🥭', size: 188, points: 55 },
    { emoji: '🍍', size: 210, points: 66 },
    { emoji: '🥥', size: 232, points: 78 }
];

class FruitGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.fruits = [];
        this.score = 0;
        this.gameOver = false;
        this.dropPosition = this.canvas.width / 2;
        this.isDropping = false;
        this.gameStartTime = Date.now();
        this.maxUnlockedFruit = 2; // Start with first 3 fruits unlocked (0, 1, 2)
        this.dropPoolCap = 4; // MUST set this before calling generateNextFruit()
        this.nextFruits = [
            this.generateNextFruit(),
            this.generateNextFruit(),
            this.generateNextFruit()
        ]; // Queue of next 3 fruits
        this.dangerStartTime = null; // When fruits first crossed the danger line
        this.isDangerMode = false; // Whether we're in danger mode
        this.dangerAlpha = 0; // Alpha for red background fade
        this.fruitAboveLineTime = null; // When fruits first went above line (for delay)
        
        this.setupResizeObserver();
        this.setupEventListeners();
        this.updateNextFruit();
        this.gameLoop();
    }

    setupResizeObserver() {
        const container = document.querySelector('.canvas-container');
        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                this.handleResize(width, height);
            }
        });
        this.resizeObserver.observe(container);
    }

    handleResize(width, height) {
        // Update canvas internal resolution to match display size
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Clamp drop position to new width
        this.dropPosition = Math.min(this.dropPosition, this.canvas.width - 25);
        this.dropPosition = Math.max(25, this.dropPosition);
        
        this.updateDropLine();
    }
    
    setupEventListeners() {
        // Mouse movement for drop position
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.gameOver && !this.isDropping) {
                const rect = this.canvas.getBoundingClientRect();
                this.dropPosition = e.clientX - rect.left;
                this.updateDropLine();
            }
        });
        
        // Click to drop fruit
        this.canvas.addEventListener('click', () => {
            this.dropFruit();
        });
        
        // Button controls
        document.getElementById('dropBtn').addEventListener('click', () => {
            this.dropFruit();
        });
        
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });

        // Drop pool limit selector
        const limitSelector = document.getElementById('maxDropFruit');
        limitSelector.addEventListener('change', (e) => {
            this.dropPoolCap = parseInt(e.target.value);
            // Ensure maxUnlockedFruit is at least the cap
            if (this.maxUnlockedFruit < this.dropPoolCap) {
                this.maxUnlockedFruit = this.dropPoolCap;
            }
            console.log(`Drop pool capped at: ${FRUITS[this.dropPoolCap].emoji}`);
        });
    }
    
    updateDropLine() {
        const dropLine = document.querySelector('.drop-line');
        const percentage = (this.dropPosition / this.canvas.width) * 100;
        dropLine.style.left = percentage + '%';
    }
    
    dropFruit() {
        if (this.gameOver || this.isDropping) return;
        
        this.isDropping = true;
        const currentFruitType = this.nextFruits[0];
        const fruit = new Fruit(
            this.dropPosition,
            30, // Start higher up to avoid immediate collision with game over line
            currentFruitType,
            this.ctx
        );
        
        this.fruits.push(fruit);
        
        // Shift queue and add new fruit
        this.nextFruits.shift();
        this.nextFruits.push(this.generateNextFruit());
        this.updateNextFruit();
        
        setTimeout(() => {
            this.isDropping = false;
        }, 500);
    }
    
    generateNextFruit() {
        // Only generate fruits from unlocked types, capped at the user-selected limit
        const maxIndex = Math.min(this.maxUnlockedFruit, this.dropPoolCap);
        return Math.floor(Math.random() * (maxIndex + 1));
    }
    
    updateNextFruit() {
        const nextFruitDisplay = this.nextFruits.map(type => FRUITS[type].emoji).join(' ');
        document.getElementById('next-fruit').textContent = nextFruitDisplay;
    }
    
    // Expose internal state to AI
    getGameState() {
        return {
            canvasWidth: this.canvas.width,
            canvasHeight: this.canvas.height,
            fruits: this.fruits.map(f => ({
                x: f.x,
                y: f.y,
                type: f.type,
                size: f.size,
                vx: f.vx,
                vy: f.vy,
                isSleeping: f.isSleeping
            })),
            nextFruitType: this.nextFruits[0],
            nextFruits: [...this.nextFruits], // Queue of next 3 fruit types
            isDropping: this.isDropping,
            gameOver: this.gameOver,
            score: this.score,
            danger: this.isDangerMode || this.fruitAboveLineTime !== null
        };
    }
    
    handleFruitCollisions() {
        for (let i = 0; i < this.fruits.length; i++) {
            for (let j = i + 1; j < this.fruits.length; j++) {
                const fruit1 = this.fruits[i];
                const fruit2 = this.fruits[j];
                
                // Only apply physics collision if they're different types or not ready to merge
                if (this.isColliding(fruit1, fruit2)) {
                    if (fruit1.type !== fruit2.type || fruit1.age <= 5 || fruit2.age <= 5) {
                        this.resolveFruitCollision(fruit1, fruit2);
                    }
                }
            }
        }
    }
    
    checkCollisions() {
        for (let i = 0; i < this.fruits.length; i++) {
            for (let j = i + 1; j < this.fruits.length; j++) {
                const fruit1 = this.fruits[i];
                const fruit2 = this.fruits[j];
                
                // Check if fruits are the same type and touching
                if (fruit1.type === fruit2.type && this.isColliding(fruit1, fruit2)) {
                    // More lenient merge conditions - just need to be touching and not brand new
                    if (fruit1.age > 5 && fruit2.age > 5) {
                        this.mergeFruits(fruit1, fruit2, i, j);
                        return; // Only merge one pair per frame
                    }
                }
            }
        }
    }
    
    isColliding(fruit1, fruit2) {
        const dx = fruit1.x - fruit2.x;
        const dy = fruit1.y - fruit2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Use same minimal buffer as collision resolution
        const minDistance = (FRUITS[fruit1.type].size + FRUITS[fruit2.type].size) / 2 + 0.5;
        return distance < minDistance;
    }
    
    resolveFruitCollision(fruit1, fruit2) {
        const dx = fruit1.x - fruit2.x;
        const dy = fruit1.y - fruit2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) {
            // If fruits are at exact same position, separate them horizontally
            fruit1.x += 1;
            fruit2.x -= 1;
            return;
        }
        
        const radius1 = FRUITS[fruit1.type].size / 2;
        const radius2 = FRUITS[fruit2.type].size / 2;
        const minDistance = radius1 + radius2 + 0.5; // Minimal buffer to prevent overlap while appearing to touch
        
        if (distance < minDistance) {
            // Calculate how much we need to separate them
            const totalSeparationNeeded = minDistance - distance;
            
            // Normalize collision vector
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Move fruits apart by the FULL amount needed to prevent any overlap
            const separation = totalSeparationNeeded / 2;
            
            let sep1x = nx * separation;
            let sep1y = ny * separation;
            let sep2x = -nx * separation;
            let sep2y = -ny * separation;
            
            // Check if separation would push fruits out of bounds
            const canvasWidth = this.canvas.width;
            const canvasHeight = this.canvas.height;
            
            // Prevent pushing through left/right walls - use full separation
            if (fruit1.x + sep1x - radius1 < 0 || fruit1.x + sep1x + radius1 > canvasWidth) {
                sep1x = 0;
                sep2x = -nx * totalSeparationNeeded; // Push other fruit by full amount
            }
            if (fruit2.x + sep2x - radius2 < 0 || fruit2.x + sep2x + radius2 > canvasWidth) {
                sep2x = 0;
                sep1x = nx * totalSeparationNeeded; // Push other fruit by full amount
            }
            
            // Prevent pushing through bottom - use full separation
            if (fruit1.y + sep1y + radius1 > canvasHeight) {
                sep1y = 0;
                sep2y = -ny * totalSeparationNeeded; // Push other fruit by full amount
            }
            if (fruit2.y + sep2y + radius2 > canvasHeight) {
                sep2y = 0;
                sep1y = ny * totalSeparationNeeded; // Push other fruit by full amount
            }
            
            // Apply separation
            fruit1.x += sep1x;
            fruit1.y += sep1y;
            fruit2.x += sep2x;
            fruit2.y += sep2y;
            
            // Stop all velocity to prevent further compression
            fruit1.vx *= 0.5; // Reduce velocity significantly
            fruit1.vy *= 0.5;
            fruit2.vx *= 0.5;
            fruit2.vy *= 0.5;
            
            // Wake up sleeping fruits when they collide
            fruit1.isSleeping = false;
            fruit1.stillFrames = 0;
            fruit2.isSleeping = false;
            fruit2.stillFrames = 0;
        }
    }
    
    mergeFruits(fruit1, fruit2, index1, index2) {
        if (fruit1.type >= FRUITS.length - 1) {
            // Even if we can't create a bigger fruit, still merge for points and cleanup
            console.log("Maximum fruit reached! Merging for points only.");
        }
        
        // Calculate merge position
        const mergeX = (fruit1.x + fruit2.x) / 2;
        const mergeY = (fruit1.y + fruit2.y) / 2;
        
        // Remove old fruits
        this.fruits.splice(Math.max(index1, index2), 1);
        this.fruits.splice(Math.min(index1, index2), 1);
        
        // Create new merged fruit (only if not at max level)
        if (fruit1.type < FRUITS.length - 1) {
            const newFruitType = fruit1.type + 1;
            
            // If it's the final fruit (Coconut), it "vanishes" immediately for points
            if (newFruitType === FRUITS.length - 1) {
                console.log("CONGRATULATIONS! Final fruit reached! 🥥");
                this.createMergeEffect(mergeX, mergeY, true); // True for bigger effect
            } else {
                const newFruit = new Fruit(mergeX, mergeY, newFruitType, this.ctx);
                newFruit.vx = (fruit1.vx + fruit2.vx) / 4; // Inherit some momentum
                newFruit.vy = (fruit1.vy + fruit2.vy) / 4;
                this.fruits.push(newFruit);
            }
        }
        
        // Add score (use current fruit type if at max level)
        const scoreType = fruit1.type < FRUITS.length - 1 ? fruit1.type + 1 : fruit1.type;
        this.score += FRUITS[scoreType].points * 2; // Double points for max level merges
        this.updateScore();
        
        // Create merge effect
        this.createMergeEffect(mergeX, mergeY);
    }
    
    createMergeEffect(x, y, isBig = false) {
        // Simple visual effect - could be enhanced with particles
        this.ctx.save();
        this.ctx.globalAlpha = 0.7;
        this.ctx.fillStyle = isBig ? '#FF4500' : '#FFD700'; // Orange-red for big merge
        this.ctx.beginPath();
        this.ctx.arc(x, y, isBig ? 100 : 30, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
    }
    
    checkGameOver() {
        // Don't check game over for the first 3 seconds
        if (Date.now() - this.gameStartTime < 3000) return;
        
        // Check if any fruit is above the danger line (y=60)
        let fruitAboveLine = false;
        for (let fruit of this.fruits) {
            // Check if fruit's top edge is above the danger line
            if (fruit.y - FRUITS[fruit.type].size / 2 <= 60) {
                fruitAboveLine = true;
                break;
            }
        }
        
        if (fruitAboveLine) {
            if (this.fruitAboveLineTime === null) {
                // First time fruits went above line
                this.fruitAboveLineTime = Date.now();
            }
            
            // Only activate danger mode after fruits have been above line for 0.5 seconds
            // This prevents flashing when fruits are just falling past the line
            if (Date.now() - this.fruitAboveLineTime > 500) {
                if (!this.isDangerMode) {
                    // First time entering danger mode (after delay)
                    this.isDangerMode = true;
                    this.dangerStartTime = Date.now();
                }
                
                // Check if we've been in danger mode for more than 3 seconds
                if (Date.now() - this.dangerStartTime > 3000) {
                    this.gameOver = true;
                    this.showGameOver();
                }
            }
        } else {
            // No fruits above line, reset everything
            this.isDangerMode = false;
            this.dangerStartTime = null;
            this.fruitAboveLineTime = null;
        }
    }
    
    showGameOver() {
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').style.display = 'block';
    }
    
    restartGame() {
        this.fruits = [];
        this.score = 0;
        this.gameOver = false;
        this.isDropping = false;
        this.gameStartTime = Date.now(); // Reset game start time
        this.maxUnlockedFruit = 2; // Reset to first 3 fruits
        this.nextFruits = [
            this.generateNextFruit(),
            this.generateNextFruit(),
            this.generateNextFruit()
        ]; // Reset fruit queue
        
        // Reset danger mode and background fade
        this.isDangerMode = false;
        this.dangerStartTime = null;
        this.fruitAboveLineTime = null;
        this.dangerAlpha = 0; // Reset background fade
        
        this.updateScore();
        this.updateNextFruit();
        document.getElementById('gameOver').style.display = 'none';
    }
    

    
    update() {
        if (this.gameOver) return;
        
        // Update physics for all fruits
        for (let fruit of this.fruits) {
            fruit.update(this.canvas.width, this.canvas.height);
        }
        
        // Handle fruit-to-fruit collisions
        this.handleFruitCollisions();
        
        // Check collisions and merges
        this.checkCollisions();
        
        // Check game over condition
        this.checkGameOver();
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update danger mode alpha for pulsing effect
        if (this.isDangerMode) {
            // Pulse between 0.1 and 0.4 alpha
            const pulseSpeed = 0.1;
            this.dangerAlpha = 0.25 + 0.15 * Math.sin(Date.now() * pulseSpeed * 0.01);
        } else {
            // Fade out danger alpha
            this.dangerAlpha = Math.max(0, this.dangerAlpha - 0.05);
        }
        
        // Draw background
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw red danger overlay if in danger mode
        if (this.dangerAlpha > 0) {
            this.ctx.fillStyle = `rgba(255, 0, 0, ${this.dangerAlpha})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw game over line
        this.ctx.strokeStyle = '#ff6b6b';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, 60);
        this.ctx.lineTo(this.canvas.width, 60);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Draw all fruits
        for (let fruit of this.fruits) {
            fruit.draw();
        }
        
        // Draw preview fruit if not dropping
        if (!this.isDropping && !this.gameOver) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.7;
            const nextFruitType = this.nextFruits[0];
            this.ctx.font = `${FRUITS[nextFruitType].size}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                FRUITS[nextFruitType].emoji,
                this.dropPosition,
                25
            );
            this.ctx.restore();
        }
    }
    
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class Fruit {
    constructor(x, y, type, ctx) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.ctx = ctx;
        this.vx = 0;
        this.vy = 0;
        this.gravity = 0.5;
        this.bounce = 0.01; // Almost no bounce
        this.friction = 0.8; // Very high friction
        this.size = FRUITS[type].size;
        this.emoji = FRUITS[type].emoji;
        this.age = 0; // Track how long the fruit has existed
        this.stillFrames = 0; // Track how long the fruit has been still
        this.isSleeping = false; // Whether the fruit is in sleep mode
        
        // Weight system - larger fruits are heavier (for collision physics only)
        this.weight = Math.pow(this.size / 50, 2); // Exponential weight based on size
    }
    
    update(canvasWidth, canvasHeight) {
        // Increment age
        this.age++;
        
        // Check if fruit should be sleeping (completely still)
        if (Math.abs(this.vx) < 0.05 && Math.abs(this.vy) < 0.05) {
            this.stillFrames++;
            if (this.stillFrames > 15) { // After 15 frames of being still (faster sleep)
                this.isSleeping = true;
                this.vx = 0;
                this.vy = 0;
                return; // Skip all physics when sleeping
            }
        } else {
            this.stillFrames = 0;
            this.isSleeping = false;
        }
        
        // Skip physics if sleeping
        if (this.isSleeping) return;
        
        // Apply gravity (simplified - no weight multiplication)
        this.vy += this.gravity;
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Boundary collisions with strict enforcement
        const radius = this.size / 2;
        
        // Left wall - completely solid
        if (this.x - radius <= 0) {
            this.x = radius;
            this.vx = Math.abs(this.vx) * this.bounce; // Force positive velocity
        }
        
        // Right wall - completely solid
        if (this.x + radius >= canvasWidth) {
            this.x = canvasWidth - radius;
            this.vx = -Math.abs(this.vx) * this.bounce; // Force negative velocity
        }
        
        // Bottom wall - completely solid with maximum stability
        if (this.y + radius >= canvasHeight) {
            this.y = canvasHeight - radius;
            this.vy = -Math.abs(this.vy) * this.bounce; // Force upward velocity
            
            // Maximum ground friction to completely stop movement
            this.vx *= 0.05; // Extreme ground friction
            
            // Stop micro-movements when nearly still
            if (Math.abs(this.vy) < 2.0) {
                this.vy = 0;
            }
            if (Math.abs(this.vx) < 0.5) {
                this.vx = 0;
            }
        }
        
        // Apply maximum air resistance
        this.vx *= 0.9; // Maximum air resistance
        this.vy *= 0.95;
        
        // Additional stability - stop tiny movements with very high thresholds
        if (Math.abs(this.vx) < 0.3) this.vx = 0;
        if (Math.abs(this.vy) < 0.3) this.vy = 0;
    }
    
    draw() {
        this.ctx.save();
        this.ctx.font = `${this.size}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.emoji, this.x, this.y);
        this.ctx.restore();
    }
}

// Global restart function
function restartGame() {
    if (window.game) {
        window.game.restartGame();
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    window.game = new FruitGame();
});