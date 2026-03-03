const {
    FIRE_RATE,
    BULLET_RANGE
} = require('../shared/constants');

// NPC Difficulty multipliers
const DIFFICULTY_MULTIPLIERS = {
    EASY: {
        successRate: 0.4   // 40% success rate
    },
    MEDIUM: {
        successRate: 0.6  // 60% success rate
    },
    HARD: {
        successRate: 0.95  // 95% success rate
    }
};


class NPC {
    constructor(id, username, difficulty = 'MEDIUM', customConfig = {}) {
        this.id = id;
        this.username = username;
        this.difficulty = difficulty;
        
        // Get base multipliers from difficulty
        const baseMultipliers = DIFFICULTY_MULTIPLIERS[difficulty] || DIFFICULTY_MULTIPLIERS.MEDIUM;
        
        // Apply multipliers from difficulty settings (only successRate)
        this.successRate = baseMultipliers.successRate;
        
        // Default values (same as normal players)
        // Custom config can override these
        this.speedMultiplier = customConfig.speedMultiplier !== undefined 
            ? customConfig.speedMultiplier 
            : 1.0;
        this.fireRateMultiplier = customConfig.fireRateMultiplier !== undefined 
            ? customConfig.fireRateMultiplier 
            : 1.0;
        this.bulletRange = customConfig.bulletRange !== undefined 
            ? customConfig.bulletRange 
            : BULLET_RANGE;
        
        // AI state
        this.targetId = null;
        this.lastTargetUpdate = 0;
        this.targetUpdateInterval = 1000; // Update target every second
        this.lastDecisionTime = 0;
        this.decisionInterval = 100; // Make decisions every 100ms
        this.lastDirectionChange = 0;
        this.directionChangeInterval = 500; // Change direction every 500ms (for randomness)
        
        // Movement state
        this.currentDirection = { dx: 0, dy: 0 };
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.lastWanderUpdate = 0;
        
        // Combat state
        this.spaceHeld = false;
        this.keys = {};
        
        // Item pickup priority
        this.itemPriority = ['HEART', 'SHIELD_POTION', 'HP_FLASK'];
    }

    // Calculate distance between two points
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    // Check if action should succeed based on success rate
    shouldSucceed() {
        return Math.random() < this.successRate;
    }

    // Returns { type: 'enemy' | 'item' | null, target: enemy/item object }
    selectTarget(players, enemies, items) {
        const now = Date.now();
        if (now - this.lastTargetUpdate < this.targetUpdateInterval) {
            return this.targetId;
        }
        this.lastTargetUpdate = now;

        const myPlayer = players[this.id];
        if (!myPlayer) {
            this.targetId = null;
            return null;
        }

        // Find nearest enemy
        let nearestEnemy = null;
        let nearestEnemyDist = Infinity;
        for (const enemy of Object.values(enemies)) {
            const dist = this.distance(myPlayer.x, myPlayer.y, enemy.x, enemy.y);
            if (dist < nearestEnemyDist) {
                nearestEnemyDist = dist;
                nearestEnemy = enemy;
            }
        }

        // If enemy exists, always target it
        if (nearestEnemy) {
            this.targetId = { type: 'enemy', target: nearestEnemy };
            return this.targetId;
        }

        // No enemies - look for items by priority
        let nearestItem = null;
        let nearestItemDist = Infinity;

        // Search for items in priority order (first found is selected)
        for (const priorityType of this.itemPriority) {
            for (const item of Object.values(items)) {
                if (item.itemType === priorityType) {
                    const dist = this.distance(myPlayer.x, myPlayer.y, item.x, item.y);
                    if (dist < nearestItemDist) {
                        nearestItemDist = dist;
                        nearestItem = item;
                    }
                }
            }
            // If we found an item of this priority type, use it (prioritize first types)
            if (nearestItem) {
                break;
            }
        }

        if (nearestItem) {
            this.targetId = { type: 'item', target: nearestItem };
            return this.targetId;
        }

        // No targets available
        this.targetId = null;
        return null;
    }

    // Decide movement direction
    decideMovement(player, targetInfo, items, enemies) {
        const now = Date.now();
        
        // Update decision periodically
        if (now - this.lastDecisionTime < this.decisionInterval) {
            return this.currentDirection;
        }
        this.lastDecisionTime = now;

        let dx = 0;
        let dy = 0;

        // Extract target from targetInfo
        const target = targetInfo ? targetInfo.target : null;
        const targetType = targetInfo ? targetInfo.type : null;

        if (target) {
            // Move towards target based on type
            const dist = this.distance(player.x, player.y, target.x, target.y);
            const angle = Math.atan2(target.y - player.y, target.x - player.x);

            if (targetType === 'enemy') {
                // Check if should succeed
                if (!this.shouldSucceed()) {
                    // Sometimes fail to move optimally - move slightly off target
                    const errorAngle = angle + (Math.random() - 0.5) * 0.5; // ±0.25 radians error
                    dx = Math.cos(errorAngle) * 0.5; // Move slower when failing
                    dy = Math.sin(errorAngle) * 0.5;
                } else {
                    // Always chase enemies - get close enough to shoot
                    const approachRange = this.bulletRange * 0.8;
                    if (dist > approachRange) {
                        // Move closer to enemy
                        dx = Math.cos(angle);
                        dy = Math.sin(angle);
                    } else {
                        // Close enough, strafe around enemy to avoid getting hit
                        // Only strafe occasionally, not constantly
                        if (Math.random() < 0.3) {
                            const strafeAngle = angle + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
                            dx = Math.cos(strafeAngle) * 0.5;
                            dy = Math.sin(strafeAngle) * 0.5;
                            // Still move slightly towards enemy
                            dx += Math.cos(angle) * 0.5;
                            dy += Math.sin(angle) * 0.5;
                        } else {
                            // Most of the time, just maintain position and shoot
                            dx = 0;
                            dy = 0;
                        }
                    }
                }
            } else if (targetType === 'item') {
                // Move towards item
                if (this.shouldSucceed()) {
                    dx = Math.cos(angle);
                    dy = Math.sin(angle);
                } else {
                    // Sometimes fail to reach item
                    dx = 0;
                    dy = 0;
                }
            }
        } else {
            //no wandering when no target
            dx = 0;
            dy = 0;
        }

        // Avoid enemies that are very close if we're not targeting them (to prevent damage)
        if (targetType !== 'enemy') {
            for (const enemy of Object.values(enemies)) {
                const dist = this.distance(player.x, player.y, enemy.x, enemy.y);
                if (dist < 80) { // Very close, avoid to prevent damage
                    const avoidAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
                    dx += Math.cos(avoidAngle) * 0.5;
                    dy += Math.sin(avoidAngle) * 0.5;
                }
            }
        }

        // Normalize direction
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
            dx /= len;
            dy /= len;
        }

        // Store direction (speed multiplier is applied in game.js)
        this.currentDirection = {
            dx: dx,
            dy: dy
        };

        return this.currentDirection;
    }

    // Decide if should shoot
    decideShooting(player, targetInfo, now) {
        // Check cooldown (adjusted by difficulty)
        // Use player's lastFired (updated by game.js) instead of NPC's own lastFired
        // Higher fireRateMultiplier = faster shooting (divide instead of multiply)
        const adjustedFireRate = FIRE_RATE / this.fireRateMultiplier;
        if (now - (player.lastFired || 0) < adjustedFireRate) {
            return false;
        }

        // Check if space is held (prevent continuous firing)
        if (this.spaceHeld) {
            return false;
        }

        if (!targetInfo || !targetInfo.target) {
            return false;
        }

        // Only shoot at enemies, never at players or items
        if (targetInfo.type !== 'enemy') {
            return false;
        }

        // Check if should succeed
        if (!this.shouldSucceed()) {
            return false;
        }

        const target = targetInfo.target;

        // Calculate distance to enemy
        const dist = this.distance(player.x, player.y, target.x, target.y);

        // Shoot when enemy is reasonably close (within 90% of bullet range)
        return dist < this.bulletRange * 0.9;
    }

    // Generate input for NPC
    generateInput(player, players, enemies, items, now) {
        // Select target (returns { type: 'enemy'|'player', target: object } or null)
        const targetInfo = this.selectTarget(players, enemies, items);
        const target = targetInfo ? targetInfo.target : null;

        // Decide movement
        const movement = this.decideMovement(player, targetInfo, items, enemies);
        
        // Convert movement to keys
        const keys = {};
        
        // Check if movement is significant enough to register as key press
        if (Math.abs(movement.dx) > 0.1) {
            if (movement.dx > 0) {
                keys['ArrowRight'] = true;
                keys['KeyD'] = true;
            } else {
                keys['ArrowLeft'] = true;
                keys['KeyA'] = true;
            }
        }
        if (Math.abs(movement.dy) > 0.1) {
            if (movement.dy > 0) {
                keys['ArrowDown'] = true;
                keys['KeyS'] = true;
            } else {
                keys['ArrowUp'] = true;
                keys['KeyW'] = true;
            }
        }

        // Update last direction for shooting (point towards target)
        if (target) {
            player.lastDirection = Math.atan2(target.y - player.y, target.x - player.x);
        } else if (movement.dx !== 0 || movement.dy !== 0) {
            player.lastDirection = Math.atan2(movement.dy, movement.dx);
        }

        // Decide shooting
        const shouldShoot = this.decideShooting(player, targetInfo, now);
        if (shouldShoot) {
            keys['Space'] = true;
            this.spaceHeld = true;
            // Note: lastFired is updated in game.js when bullet is actually created
            // Release space after a short delay
            setTimeout(() => {
                this.spaceHeld = false;
            }, 50);
        }

        this.keys = keys;
        return keys;
    }
}

module.exports = { NPC, DIFFICULTY_MULTIPLIERS };

