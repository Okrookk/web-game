const {
    PLAYER_SPEED,
    BULLET_SPEED,
    ENEMY_SPEED,
    PLAYER_SIZE,
    BULLET_SIZE,
    BULLET_RANGE,
    ENEMY_SIZE,
    MAP_WIDTH,
    MAP_HEIGHT,
    FIRE_RATE,
    ENEMY_SPAWN_RATE,
    POINTS_PER_KILL,
    MIN_PLAYERS,
    MAX_PLAYERS,
    GAME_DURATION,
    COUNTDOWN_DURATION,
    GAME_STATE,
    WALL_TOP_BOT_HEIGHT,
    WALL_SIDE_WIDTH,
    FLASK_DROP_RATE,
    HEART_DROP_RATE,
    SHIELD_DROP_RATE,
    SHIELD_DURATION,
    ITEM_SIZE
} = require('../shared/constants');

const { NPC, STRATEGY_TYPES } = require('./npc');

class ServerGame {
    constructor(io) {
        this.io = io;
        this.players = {}; // socketId -> player
        this.projectiles = {}; // id -> bullet
        this.enemies = {}; // id -> enemy
        this.items = {}; // id -> item (flasks, etc.)

        // Dev mode: allows single player for testing
        // Set DEV_MODE=true environment variable to enable
        this.devMode = process.env.DEV_MODE === 'true';
        if (this.devMode) {
            console.log('DEV MODE ENABLED: Single player allowed');
        }

        // Single-player mode
        this.singlePlayerMode = false;
        this.npcs = {}; // npcId -> NPC instance
        this.npcConfigs = []; // Array of NPC configurations

        // Game state
        this.state = GAME_STATE.WAITING;
        this.leadPlayerId = null; // First player becomes lead player

        // Pause state
        this.isPaused = false;
        this.pausedBy = null; // { id, username } - Who paused the game

        // Timer
        this.gameStartTime = null;
        this.gameEndTime = null;
        this.countdownStartTime = null; // When countdown started
        this.pauseStartTime = null; // When game was paused (to adjust timer)
        this.pausedTimeAccumulator = 0; // Total paused time

        this.lastEnemySpawn = 0;

        // Entity ID counter
        this.entityIdCounter = 0;

        // Loop at 60 FPS (needed for smooth gameplay)
        setInterval(() => this.update(), 1000 / 60);

        // Send initial lobby state
        this.broadcastLobbyState();
    }

    generateId() {
        return `e_${this.entityIdCounter++}`;
    }

    getPlayerCount() {
        return Object.keys(this.players).length;
    }

    getRealPlayerCount() {
        // Count only real players, not NPCs
        return Object.keys(this.players).filter(id => !id.startsWith('npc_')).length;
    }

    getState() {
        return this.state;
    }

    playerAmountCheck() {
        const count = this.getPlayerCount();
        // In single-player mode, require 1 real player + 1-3 NPCs
        if (this.singlePlayerMode) {
            const realPlayerCount = Object.keys(this.players).filter(id => !id.startsWith('npc_')).length;
            const npcCount = Object.keys(this.npcs).length;
            return realPlayerCount === 1 && npcCount >= 1 && npcCount <= 3 && count >= 2 && count <= 4;
        }
        // In dev mode, allow 1 player. Otherwise require 2-4 players.
        if (this.devMode) {
            return count >= 1 && count <= MAX_PLAYERS;
        }
        return count >= MIN_PLAYERS && count <= MAX_PLAYERS;
    }

    getPlayerUsernames() {
        // Return array of all usernames (case-insensitive comparison)
        return Object.values(this.players).map(p => p.username.toLowerCase());
    }

    uniqueUsernameCheck(username) {
        // Validate username length
        if (!username || username.trim().length < 3 || username.trim().length > 20) {
            return { valid: false, error: 'INVALID_NAME' };
        }

        // Check if username is already taken (case-insensitive)
        const normalizedUsername = username.trim().toLowerCase();
        const existingUsernames = this.getPlayerUsernames();

        if (existingUsernames.includes(normalizedUsername)) {
            return { valid: false, error: 'NAME_TAKEN' };
        }

        return { valid: true };
    }

    setState(newState) {
        if (this.state !== newState) {
            console.log(`Game state changed: ${this.state} -> ${newState}`);
            this.state = newState;
            this.broadcastLobbyState();
        }
    }

    broadcastLobbyState() {
        const players = Object.values(this.players).map(p => ({
            id: p.id,
            username: p.username,
            isLeadPlayer: p.id === this.leadPlayerId
        }));

        this.io.emit('lobbyState', {
            state: this.state,
            players: players,
            devMode: this.devMode,
            singlePlayerMode: this.singlePlayerMode,
            npcConfigCount: this.singlePlayerMode ? this.npcConfigs.length : 0
        });
    }

    addPlayer(id, username) {
        // In single-player mode, reject new players (except NPCs)
        if (this.singlePlayerMode && !id.startsWith('npc_')) {
            // Don't throw error, just silently reject (this is called from server.js which handles errors)
            return;
        }

        // If game is in GAME_OVER state and no players, return to WAITING
        if (this.state === GAME_STATE.GAME_OVER && this.getPlayerCount() === 0) {
            this.setState(GAME_STATE.WAITING);
            this.leadPlayerId = null;
        }

        // Set first player as lead player (only real players, not NPCs)
        if (this.leadPlayerId === null && !id.startsWith('npc_')) {
            this.leadPlayerId = id;
        }

        // Calculate playable area bounds
        const bottomWallStartY = MAP_HEIGHT - WALL_TOP_BOT_HEIGHT - PLAYER_SIZE;
        const maxPlayerY = bottomWallStartY - PLAYER_SIZE;
        const playableHeight = maxPlayerY - WALL_TOP_BOT_HEIGHT;

        this.players[id] = {
            id,
            type: 'player',
            username,
            // Spawn players within playable area (inside walls)
            x: WALL_SIDE_WIDTH + Math.random() * (MAP_WIDTH - 2 * WALL_SIDE_WIDTH - PLAYER_SIZE),
            y: WALL_TOP_BOT_HEIGHT + Math.random() * playableHeight,
            rotation: 0,
            keys: {},
            lastFired: 0,
            score: 0,
            hp: 100,
            maxHp: 100,
            lastDirection: 0, // Default to right (0 radians)
            lives: 3, // Start with 3 lives
            isDead: false, // Track if player has lost all lives
            survivalTime: 0, // Track total survival time in ms
            spaceHeld: false, // Track if space bar is being held
            shieldEndTime: 0 // Timestamp when shield expires
        };

        // Update state if needed
        if (this.state === GAME_STATE.WAITING || this.state === GAME_STATE.GAME_OVER) {
            this.broadcastLobbyState();
        }

        // Notify others (only for real players, not NPCs)
        if (!id.startsWith('npc_')) {
            this.io.emit('playerJoined', { id, username });
        }
    }

    removePlayer(id) {
        const player = this.players[id];
        if (player) {
            delete this.players[id];

            // If game was paused by this player, resume it
            if (this.isPaused && this.pausedBy && this.pausedBy.id === id) {
                const pausedDuration = Date.now() - this.pauseStartTime;
                this.pausedTimeAccumulator += pausedDuration;

                if (this.gameEndTime) {
                    this.gameEndTime += pausedDuration;
                }

                this.isPaused = false;
                this.pausedBy = null;
                this.pauseStartTime = null;

                // Notify that game was resumed (auto-resumed)
                this.io.emit('gameResumed', {
                    resumedBy: { id: 'system', username: 'System' }
                });
            }

            // If lead player left, assign new lead player
            if (id === this.leadPlayerId) {
                const remainingPlayers = Object.keys(this.players);
                this.leadPlayerId = remainingPlayers.length > 0 ? remainingPlayers[0] : null;
            }

            // In single-player mode, if the only real player leaves, end the game immediately
            if (this.singlePlayerMode && !id.startsWith('npc_')) {
                const realPlayerCount = this.getRealPlayerCount();
                if (realPlayerCount === 0) {
                    // Last real player left, end game and remove all NPCs
                    if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.COUNTDOWN) {
                        // Remove all NPCs
                        for (const npcId in this.npcs) {
                            if (this.players[npcId]) {
                                delete this.players[npcId];
                            }
                        }
                        this.npcs = {};
                        
                        // End the game
                        if (this.state === GAME_STATE.PLAYING) {
                            this.endGame();
                        } else {
                            this.setState(GAME_STATE.WAITING);
                            this.countdownStartTime = null;
                        }
                    }
                    // Disable single-player mode when last player leaves
                    this.singlePlayerMode = false;
                    this.npcConfigs = [];
                    this.leadPlayerId = null;
                    this.broadcastLobbyState();
                    return;
                }
            }

            // If no players left, return to waiting state so new players can join
            if (this.getPlayerCount() === 0) {
                // Reset game state if in COUNTDOWN or PLAYING
                if (this.state === GAME_STATE.COUNTDOWN || this.state === GAME_STATE.PLAYING) {
                    this.setState(GAME_STATE.WAITING);
                    this.leadPlayerId = null;
                    // Reset countdown and game timers
                    this.countdownStartTime = null;
                    this.gameStartTime = null;
                    this.gameEndTime = null;
                }
                // Always broadcast lobby state when no players left
                this.broadcastLobbyState();
            } else {
                // If game is playing or in countdown and less than minimum players, end game and return to waiting
                // In dev mode, minimum is 1, otherwise it's MIN_PLAYERS (2)
                // In single-player mode, minimum is 1 real player
                const minPlayersForGame = this.singlePlayerMode 
                    ? 1  // Need at least 1 real player
                    : (this.devMode ? 1 : MIN_PLAYERS);
                
                const playerCountToCheck = this.singlePlayerMode 
                    ? this.getRealPlayerCount()  // Check real players in single-player mode
                    : this.getPlayerCount();     // Check all players in multiplayer mode
                
                if ((this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.COUNTDOWN) && playerCountToCheck < minPlayersForGame) {
                    // If in countdown, just reset to waiting
                    if (this.state === GAME_STATE.COUNTDOWN) {
                        this.setState(GAME_STATE.WAITING);
                        this.countdownStartTime = null;
                    } else {
                        // If playing, end the game
                        this.endGame();
                        // If no players left after ending, return to waiting
                        if (this.getPlayerCount() === 0) {
                            this.setState(GAME_STATE.WAITING);
                            this.leadPlayerId = null;
                        }
                    }
                    // Broadcast lobby state after state change
                    this.broadcastLobbyState();
                } else {
                    // Notify others (only for real players, not NPCs)
                    if (!id.startsWith('npc_')) {
                        this.io.emit('playerLeft', { id, username: player.username });
                    }
                    this.broadcastLobbyState();
                }
            }
        }
    }

    setSinglePlayerMode(enabled, npcConfigs = []) {
        // Only lead player can toggle single-player mode
        if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.COUNTDOWN) {
            return { success: false, error: 'GAME_IN_PROGRESS' };
        }

        // If enabling single-player mode, remove all non-lead players
        if (enabled && this.getRealPlayerCount() > 1) {
            // Remove all players except lead player
            const playersToRemove = [];
            for (const id in this.players) {
                if (!id.startsWith('npc_') && id !== this.leadPlayerId) {
                    playersToRemove.push(id);
                }
            }
            // Remove players and notify them
            for (const id of playersToRemove) {
                const player = this.players[id];
                if (player) {
                    // Notify player they were removed
                    const socket = this.io.sockets.sockets.get(id);
                    if (socket) {
                        socket.emit('kickedFromGame', {
                            reason: 'SINGLE_PLAYER_MODE',
                            message: 'You were removed because the host enabled single-player mode.'
                        });
                    }
                }
                this.removePlayer(id);
            }
        }

        this.singlePlayerMode = enabled;
        this.npcConfigs = npcConfigs;
        
        console.log('Single-player mode updated:', {
            enabled: enabled,
            npcConfigCount: npcConfigs.length,
            configs: npcConfigs.map(c => ({
                username: c.username,
                difficulty: c.difficulty
            }))
        });

        // If disabling, remove all NPCs
        if (!enabled) {
            for (const npcId in this.npcs) {
                this.removePlayer(npcId);
            }
            this.npcs = {};
        }
        // NPCs will be created when game starts, not in lobby

        this.broadcastLobbyState();
        return { success: true };
    }

    createNPCs() {
        // Clear existing NPCs
        for (const npcId in this.npcs) {
            this.removePlayer(npcId);
        }
        this.npcs = {};

        // Create NPCs based on configs
        for (let i = 0; i < this.npcConfigs.length; i++) {
            const config = this.npcConfigs[i];
            const npcId = `npc_${this.generateId()}`;
            const username = config.username || `NPC ${i + 1}`;
            const difficulty = config.difficulty || 'MEDIUM';
            const customConfig = config.customConfig || {};

            console.log(`Creating NPC ${i + 1}:`, {
                username,
                difficulty,
                customConfig
            });

            const npc = new NPC(npcId, username, difficulty, customConfig);
            this.npcs[npcId] = npc;

            // Add NPC as player
            this.addPlayer(npcId, username);
        }
    }

    startGame(leadPlayerId) {
        // Check if requester is lead player
        if (leadPlayerId !== this.leadPlayerId) {
            return { success: false, error: 'NOT_LEAD_PLAYER' };
        }

        // In single-player mode, create NPCs (players already removed when mode was enabled)
        if (this.singlePlayerMode) {
            // Create NPCs
            this.createNPCs();
        }

        // Check player count
        if (!this.playerAmountCheck()) {
            return { success: false, error: 'INVALID_PLAYER_COUNT' };
        }

        // Check state
        if (this.state !== GAME_STATE.WAITING && this.state !== GAME_STATE.GAME_OVER) {
            return { success: false, error: 'GAME_NOT_READY' };
        }

        // Start countdown
        this.setState(GAME_STATE.COUNTDOWN);
        this.countdownStartTime = Date.now();

        // Reset pause state
        this.isPaused = false;
        this.pausedBy = null;
        this.pauseStartTime = null;
        this.pausedTimeAccumulator = 0;

        // Reset all players immediately when countdown starts
        // This way their positions are set and won't change when countdown ends
        // Calculate playable area bounds
        const bottomWallStartY = MAP_HEIGHT - WALL_TOP_BOT_HEIGHT - PLAYER_SIZE;
        const maxPlayerY = bottomWallStartY - PLAYER_SIZE;
        const playableHeight = maxPlayerY - WALL_TOP_BOT_HEIGHT;

        for (const id in this.players) {
            const p = this.players[id];
            // Spawn players within playable area (inside walls)
            p.x = WALL_SIDE_WIDTH + Math.random() * (MAP_WIDTH - 2 * WALL_SIDE_WIDTH - PLAYER_SIZE);
            p.y = WALL_TOP_BOT_HEIGHT + Math.random() * playableHeight;
            p.score = 0;
            p.hp = p.maxHp;
            p.lives = 3; // Reset lives
            p.isDead = false; // Reset death status
            p.survivalTime = 0; // Reset survival time
            p.spaceHeld = false; // Reset input state
            p.shieldEndTime = 0;
        }

        // Clear projectiles and enemies
        this.projectiles = {};
        this.enemies = {};
        this.items = {};

        this.io.emit('gameStarted', {});
        return { success: true };
    }

    endGame() {
        if (this.state !== GAME_STATE.PLAYING) {
            return;
        }

        this.setState(GAME_STATE.GAME_OVER);

        // Find winner (highest score)
        let winner = null;
        let maxScore = -1;
        const leaderboard = [];

        for (const id in this.players) {
            const p = this.players[id];
            leaderboard.push({
                id: p.id,
                username: p.username,
                score: p.score,
                survivalTime: Math.floor((p.survivalTime || 0) / 1000) // seconds
            });

            if (p.score > maxScore || (p.score === maxScore && p.survivalTime > (winner ? winner.survivalTime : -1))) {
                maxScore = p.score;
                winner = {
                    id: p.id,
                    username: p.username,
                    score: p.score,
                    survivalTime: Math.floor((p.survivalTime || 0) / 1000)
                };
            }
        }

        // Sort leaderboard: score DESC, then survivalTime DESC
        leaderboard.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return b.survivalTime - a.survivalTime;
        });

        this.io.emit('gameEnded', {
            winner: leaderboard[0], // Top player is always the winner
            leaderboard: leaderboard
        });
    }

    pauseGame(playerId) {
        // NPCs cannot pause
        if (playerId.startsWith('npc_')) {
            return { success: false, error: 'NPC_CANNOT_PAUSE' };
        }

        // Check if player exists
        const player = this.players[playerId];
        if (!player) {
            return { success: false, error: 'PLAYER_NOT_FOUND' };
        }

        // Can pause if game is playing or in countdown
        if (this.state !== GAME_STATE.PLAYING && this.state !== GAME_STATE.COUNTDOWN) {
            return { success: false, error: 'GAME_NOT_PLAYING' };
        }

        // If already paused, do nothing
        if (this.isPaused) {
            return { success: false, error: 'ALREADY_PAUSED' };
        }

        // Pause the game
        this.isPaused = true;
        this.pausedBy = {
            id: playerId,
            username: player.username
        };
        this.pauseStartTime = Date.now();

        // Broadcast pause event
        this.io.emit('gamePaused', {
            pausedBy: this.pausedBy
        });

        console.log(`Game paused by ${player.username} (${playerId})`);
        return { success: true };
    }

    resumeGame(playerId) {
        // NPCs cannot resume
        if (playerId.startsWith('npc_')) {
            return { success: false, error: 'NPC_CANNOT_RESUME' };
        }

        // Check if player exists
        const player = this.players[playerId];
        if (!player) {
            return { success: false, error: 'PLAYER_NOT_FOUND' };
        }

        // Can only resume if game is paused
        if (!this.isPaused) {
            return { success: false, error: 'GAME_NOT_PAUSED' };
        }

        // Resume the game
        const pausedDuration = Date.now() - this.pauseStartTime;
        this.pausedTimeAccumulator += pausedDuration;

        // Adjust game end time by the paused duration
        if (this.gameEndTime) {
            this.gameEndTime += pausedDuration;
        }

        const resumedBy = {
            id: playerId,
            username: player.username
        };

        this.isPaused = false;
        this.pausedBy = null;
        this.pauseStartTime = null;

        // Broadcast resume event
        this.io.emit('gameResumed', {
            resumedBy: resumedBy
        });

        console.log(`Game resumed by ${player.username} (${playerId})`);
        return { success: true };
    }

    quitGame(playerId) {
        // NPCs cannot quit
        if (playerId.startsWith('npc_')) {
            return { success: false, error: 'NPC_CANNOT_QUIT' };
        }

        // Check if player exists
        const player = this.players[playerId];
        if (!player) {
            return { success: false, error: 'PLAYER_NOT_FOUND' };
        }

        const quitBy = {
            id: playerId,
            username: player.username
        };

        // Remove player (this also handles pause-resume if needed)
        this.removePlayer(playerId);

        // Broadcast quit event
        this.io.emit('playerQuit', {
            quitBy: quitBy
        });

        console.log(`Player ${player.username} (${playerId}) quit the game`);
        return { success: true };
    }

    handleInput(id, input) {
        const p = this.players[id];
        if (p) {
            p.keys = input.keys || {};
        }
    }

    spawnEnemy() {
        const id = this.generateId();
        // Spawn at random edge
        // Walls: top/bottom height = WALL_TOP_BOT_HEIGHT, side width = WALL_SIDE_WIDTH
        let x, y;
        const edge = Math.random();
        if (edge < 0.25) {
            // Top edge
            x = WALL_SIDE_WIDTH + Math.random() * (MAP_WIDTH - 2 * WALL_SIDE_WIDTH);
            y = WALL_TOP_BOT_HEIGHT;
        } else if (edge < 0.5) {
            // Bottom edge
            x = WALL_SIDE_WIDTH + Math.random() * (MAP_WIDTH - 2 * WALL_SIDE_WIDTH);
            y = MAP_HEIGHT - WALL_TOP_BOT_HEIGHT;
        } else if (edge < 0.75) {
            // Left edge
            x = WALL_SIDE_WIDTH;
            y = WALL_TOP_BOT_HEIGHT + Math.random() * (MAP_HEIGHT - 2 * WALL_TOP_BOT_HEIGHT);
        } else {
            // Right edge
            x = MAP_WIDTH - WALL_SIDE_WIDTH;
            y = WALL_TOP_BOT_HEIGHT + Math.random() * (MAP_HEIGHT - 2 * WALL_TOP_BOT_HEIGHT);
        }

        const subtypes = ['SKELETON1', 'SKELETON2', 'VAMPIRE'];
        const subtype = subtypes[Math.floor(Math.random() * subtypes.length)];

        let size = 48;
        let hp = 1;

        if (subtype === 'VAMPIRE') {
            size = 64;
            hp = 5; // Vampires are tougher
        } else if (subtype === 'SKELETON2') {
            hp = 2; // Slightly tougher skeleton
        }

        let adjustedX = x;
        let adjustedY = y;

        // Adjust based on which edge we spawned on
        if (x === WALL_SIDE_WIDTH) {
            // Left edge - spawn enemy just outside wall
            adjustedX = WALL_SIDE_WIDTH;
        } else if (x === MAP_WIDTH - WALL_SIDE_WIDTH) {
            // Right edge - spawn enemy just inside map edge
            adjustedX = MAP_WIDTH - WALL_SIDE_WIDTH - size;
        } else if (y === WALL_TOP_BOT_HEIGHT) {
            // Top edge - spawn enemy just outside wall
            adjustedY = WALL_TOP_BOT_HEIGHT;
        } else if (y === MAP_HEIGHT - WALL_TOP_BOT_HEIGHT) {
            // Bottom edge - spawn enemy just inside map edge
            adjustedY = MAP_HEIGHT - WALL_TOP_BOT_HEIGHT - size;
        }

        // Clamp to ensure enemy is within playable area
        adjustedX = Math.max(WALL_SIDE_WIDTH, Math.min(adjustedX, MAP_WIDTH - WALL_SIDE_WIDTH - size));
        adjustedY = Math.max(WALL_TOP_BOT_HEIGHT, Math.min(adjustedY, MAP_HEIGHT - WALL_TOP_BOT_HEIGHT - size));

        this.enemies[id] = {
            id,
            type: 'enemy',
            subtype,
            x: adjustedX,
            y: adjustedY,
            width: size,
            height: size,
            hp,
            maxHp: hp
        };
    }

    spawnItem(x, y, type) {
        const id = this.generateId();
        this.items[id] = {
            id,
            type: 'item',
            itemType: type, // e.g. 'HP_FLASK'
            x,
            y,
            width: ITEM_SIZE,
            height: ITEM_SIZE
        };
    }

    checkCollision(a, b, sizeA, sizeB) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Use actual entity sizes if available, otherwise fallback
        const radA = (a.width || sizeA) / 2;
        const radB = (b.width || sizeB) / 2;
        return dist < (radA + radB);
    }

    update() {
        const now = Date.now();
        const deltaTime = now - (this.lastUpdateTime || now);
        this.lastUpdateTime = now;

        // Update individual survival timers for alive players
        if (this.state === GAME_STATE.PLAYING && !this.isPaused) {
            for (const id in this.players) {
                const p = this.players[id];
                if (!p.isDead) {
                    p.survivalTime = (p.survivalTime || 0) + deltaTime;
                }
            }
        }

        // Handle countdown
        if (this.state === GAME_STATE.COUNTDOWN) {
            // If paused, don't update countdown elapsed time
            if (this.isPaused && this.pauseStartTime) {
                // Countdown is paused, don't update elapsed time
                // Send game state during countdown
                this.sendGameState();
                return;
            }

            // Calculate elapsed time, accounting for paused time
            let countdownElapsed = now - this.countdownStartTime;
            if (this.pausedTimeAccumulator > 0) {
                countdownElapsed -= this.pausedTimeAccumulator;
            }
            const countdownRemaining = COUNTDOWN_DURATION - countdownElapsed;

            if (countdownRemaining <= 0) {
                // Countdown finished, start the game
                this.setState(GAME_STATE.PLAYING);
                this.gameStartTime = Date.now();
                this.gameEndTime = this.gameStartTime + GAME_DURATION;

                // Players are already reset when countdown started, no need to reset again
            }

            // Send game state during countdown
            this.sendGameState();
            return;
        }

        // Only update game logic if playing and not paused
        if (this.state !== GAME_STATE.PLAYING || this.isPaused) {
            // Still send game state even when paused, so clients can show pause screen
            this.sendGameState();
            return;
        }

        // Check if game time is up
        if (this.gameEndTime && now >= this.gameEndTime) {
            this.endGame();
            return;
        }

        // Spawn Enemies (only during playing, not during countdown)
        if (this.state === GAME_STATE.PLAYING && now - this.lastEnemySpawn > ENEMY_SPAWN_RATE) {
            this.spawnEnemy();
            this.lastEnemySpawn = now;
        }

        // Update NPCs (generate AI input)
        for (const npcId in this.npcs) {
            const npc = this.npcs[npcId];
            const npcPlayer = this.players[npcId];
            if (npcPlayer && !npcPlayer.isDead && this.state === GAME_STATE.PLAYING) {
                // Generate AI input
                const aiInput = npc.generateInput(npcPlayer, this.players, this.enemies, this.items, now);
                // Apply input to player
                this.handleInput(npcId, { keys: aiInput });
            }
        }

        // Update Players
        const playerIds = Object.keys(this.players);
        for (const id of playerIds) {
            const p = this.players[id];

            // Skip dead players - they can't move or shoot
            if (p.isDead) continue;

            // During countdown, players can't move or shoot
            if (this.state === GAME_STATE.COUNTDOWN) {
                // Clear keys so players can't move during countdown
                p.keys = {};
                continue;
            }

            // Movement - track direction based on keys pressed
            // Get speed multiplier for NPCs, or use default for real players
            let speedMultiplier = 1.0;
            if (id.startsWith('npc_') && this.npcs[id]) {
                speedMultiplier = this.npcs[id].speedMultiplier || 1.0;
            }
            const currentSpeed = PLAYER_SPEED * speedMultiplier;
            
            let dx = 0;
            let dy = 0;
            let newX = p.x;
            let newY = p.y;

            if (p.keys['ArrowUp'] || p.keys['KeyW']) {
                newY -= currentSpeed;
                dy = -1;
            }
            if (p.keys['ArrowDown'] || p.keys['KeyS']) {
                newY += currentSpeed;
                dy = 1;
            }
            if (p.keys['ArrowLeft'] || p.keys['KeyA']) {
                newX -= currentSpeed;
                dx = -1;
            }
            if (p.keys['ArrowRight'] || p.keys['KeyD']) {
                newX += currentSpeed;
                dx = 1;
            }

            // Check wall collisions before updating position
            // Top wall: player's top edge must be >= wall height
            if (newY < WALL_TOP_BOT_HEIGHT) {
                newY = WALL_TOP_BOT_HEIGHT;
            }
            // Bottom wall: player's bottom edge must not go into the wall
            // Wall starts at MAP_HEIGHT - WALL_TOP_BOT_HEIGHT - PLAYER_SIZE
            // So player's top edge must be <= MAP_HEIGHT - WALL_TOP_BOT_HEIGHT - PLAYER_SIZE - PLAYER_SIZE
            // to prevent player's bottom edge from going into the wall
            const bottomWallStartY = MAP_HEIGHT - WALL_TOP_BOT_HEIGHT - PLAYER_SIZE;
            const maxPlayerY = bottomWallStartY - PLAYER_SIZE;
            if (newY > maxPlayerY) {
                newY = maxPlayerY;
            }
            // Left wall: player's left edge must be >= wall width
            if (newX < WALL_SIDE_WIDTH) {
                newX = WALL_SIDE_WIDTH;
            }
            // Right wall: player's right edge can be at map width - wall width (touching the wall)
            // but not beyond it (inside the wall)
            if (newX + PLAYER_SIZE > MAP_WIDTH - WALL_SIDE_WIDTH) {
                newX = MAP_WIDTH - WALL_SIDE_WIDTH - PLAYER_SIZE;
            }

            // Update position
            p.x = newX;
            p.y = newY;

            // Update last direction if player is moving
            if (dx !== 0 || dy !== 0) {
                p.lastDirection = Math.atan2(dy, dx);
            }

            // Shooting
            const isSpacePressed = p.keys['Space'];

            // If space is not pressed, reset the held flag
            if (!isSpacePressed) {
                p.spaceHeld = false;
            }

            // Get fire rate multiplier for NPCs, or use default for real players
            let fireRateMultiplier = 1.0;
            if (id.startsWith('npc_') && this.npcs[id]) {
                fireRateMultiplier = this.npcs[id].fireRateMultiplier || 1.0;
            }
            // Higher fireRateMultiplier = faster shooting (divide instead of multiply)
            const adjustedFireRate = FIRE_RATE / fireRateMultiplier;

            // Only fire if space is pressed AND not held AND cooldown is ready
            if (isSpacePressed && !p.spaceHeld && now - p.lastFired > adjustedFireRate) {
                // Mark space as held immediately so we don't fire again until release
                p.spaceHeld = true;

                const bulletId = this.generateId();

                // Shoot in the direction of last movement
                const angle = p.lastDirection;

                this.projectiles[bulletId] = {
                    id: bulletId,
                    type: 'bullet',
                    ownerId: id,
                    x: p.x + PLAYER_SIZE / 2,
                    y: p.y + PLAYER_SIZE / 2,
                    startX: p.x + PLAYER_SIZE / 2,
                    startY: p.y + PLAYER_SIZE / 2,
                    vx: Math.cos(angle) * BULLET_SPEED,
                    vy: Math.sin(angle) * BULLET_SPEED
                };
                p.lastFired = now;
            }
        }

        // Update Bullets
        for (const id in this.projectiles) {
            const b = this.projectiles[id];
            b.x += b.vx;
            b.y += b.vy;

            // Remove if out of bounds
            // Remove if out of bounds or hitting walls
            if (b.x < WALL_SIDE_WIDTH || b.x > MAP_WIDTH - WALL_SIDE_WIDTH ||
                b.y < WALL_TOP_BOT_HEIGHT || b.y > MAP_HEIGHT - WALL_TOP_BOT_HEIGHT) {
                delete this.projectiles[id];
                continue;
            }

            // Remove if exceeded range
            const dist = Math.sqrt((b.x - b.startX) ** 2 + (b.y - b.startY) ** 2);
            if (dist > BULLET_RANGE) {
                delete this.projectiles[id];
                continue;
            }

            // check collision with enemies
            for (const eId in this.enemies) {
                const e = this.enemies[eId];
                if (this.checkCollision(b, e, BULLET_SIZE, (e.width || ENEMY_SIZE))) {
                    // Damage enemy
                    e.hp--;

                    // Remove bullet always
                    delete this.projectiles[id];

                    if (e.hp <= 0) {
                        // Kill enemy
                        delete this.enemies[eId];
                        // Increment kill count
                        if (this.players[b.ownerId]) {
                            this.players[b.ownerId].score += 1;
                        }

                        // Drop item chance
                        // Prioritize Heart drop (rare), then Shield (uncommon), then Flask (common)
                        if (Math.random() < HEART_DROP_RATE) {
                            this.spawnItem(e.x, e.y, 'HEART');
                        } else if (Math.random() < SHIELD_DROP_RATE) {
                            this.spawnItem(e.x, e.y, 'SHIELD_POTION');
                        } else if (Math.random() < FLASK_DROP_RATE) {
                            this.spawnItem(e.x, e.y, 'HP_FLASK');
                        }
                    }
                    break; // Bullet gone
                }
            }
        }

        // Update Enemies
        for (const id in this.enemies) {
            const e = this.enemies[id];

            // Find nearest player
            let target = null;
            let minDist = Infinity;

            for (const pid of playerIds) {
                const p = this.players[pid];
                // ONLY target alive players
                if (p.isDead) continue;

                const dx = p.x - e.x;
                const dy = p.y - e.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < minDist) {
                    minDist = d;
                    target = p;
                }

                // Check collision with player (Enemy attacking Player) - ONLY if player is alive
                const enemySize = e.width || ENEMY_SIZE;
                if (!p.isDead && this.checkCollision(p, e, PLAYER_SIZE, enemySize)) {
                    const now = Date.now();

                    // Check Shield
                    if (p.shieldEndTime && now < p.shieldEndTime) {
                        // Player is shielded - no damage
                        continue;
                    }

                    // Check cooldown
                    if (!p.lastDamageTime || now - p.lastDamageTime > 1000) {
                        p.hp -= 10;
                        p.lastDamageTime = now;

                        if (p.hp <= 0) {
                            // Player died - check lives
                            p.lives -= 1;

                            if (p.lives > 0) {
                                // Respawn with remaining lives
                                p.hp = p.maxHp;
                                p.x = Math.random() * (MAP_WIDTH - PLAYER_SIZE);
                                p.y = Math.random() * (MAP_HEIGHT - PLAYER_SIZE);
                            } else {
                                // No lives left - player is dead
                                p.hp = 0;
                                p.isDead = true;

                                // Check if all players are dead
                                const allDead = Object.values(this.players).every(player => player.isDead);
                                if (allDead) {
                                    // All players eliminated - end game immediately
                                    this.endGame();
                                }
                            }
                        }
                    }
                }
            }

            if (target) {
                // Separation logic: prevent enemies from merging
                let sepX = 0;
                let sepY = 0;
                let separationCount = 0;
                const separationRadius = ENEMY_SIZE * 1.5; // Trigger separation when close

                for (const otherId in this.enemies) {
                    if (id === otherId) continue;
                    const other = this.enemies[otherId];
                    const distX = e.x - other.x;
                    const distY = e.y - other.y;
                    const distance = Math.sqrt(distX * distX + distY * distY);

                    if (distance < separationRadius && distance > 0) {
                        // Push away from neighbor
                        // Weight by inverse distance (closer = stronger push)
                        const weight = 1 / distance;
                        sepX += (distX / distance) * weight;
                        sepY += (distY / distance) * weight;
                        separationCount++;
                    }
                }

                // Normal movement towards player
                const angle = Math.atan2(target.y - e.y, target.x - e.x);
                let moveX = Math.cos(angle) * ENEMY_SPEED;
                let moveY = Math.sin(angle) * ENEMY_SPEED;

                // Apply separation force if crowded
                if (separationCount > 0) {
                    // Normalize separation vector
                    const sepLen = Math.sqrt(sepX * sepX + sepY * sepY);
                    if (sepLen > 0) {
                        sepX = (sepX / sepLen) * ENEMY_SPEED;
                        sepY = (sepY / sepLen) * ENEMY_SPEED;
                    }

                    // Blend movement: 60% separation, 40% target tracking when crowded
                    // This priority ensures they don't just collapse while chasing
                    moveX = moveX * 0.4 + sepX * 0.6;
                    moveY = moveY * 0.4 + sepY * 0.6;
                }

                e.x += moveX;
                e.y += moveY;
            }
        }

        // Update Items (Collision with players)
        for (const iId in this.items) {
            const item = this.items[iId];
            for (const pId in this.players) {
                const p = this.players[pId];
                if (p.isDead) continue;

                if (this.checkCollision(p, item, PLAYER_SIZE, ITEM_SIZE)) {
                    let pickedUp = false;

                    if (item.itemType === 'HP_FLASK') {
                        // Only pick up if HP is not full
                        if (p.hp < p.maxHp) {
                            p.hp = p.maxHp;
                            pickedUp = true;
                        }
                    } else if (item.itemType === 'HEART') {
                        // Only pick up if lives < 3
                        if (p.lives < 3) {
                            p.lives++;
                            pickedUp = true;
                        }
                    } else if (item.itemType === 'SHIELD_POTION') {
                        // Activate shield
                        p.shieldEndTime = Date.now() + SHIELD_DURATION;
                        pickedUp = true;
                    }

                    if (pickedUp) {
                        delete this.items[iId];
                        break;
                    }
                }
            }
        }

        // Send game state
        this.sendGameState();
    }

    sendGameState() {
        const now = Date.now();

        // Calculate timer (count down)
        // Timer should not count down when paused
        let timer = 0;
        let countdown = 0;

        if (this.state === GAME_STATE.COUNTDOWN && this.countdownStartTime) {
            // During countdown, show countdown timer
            // Calculate elapsed time, accounting for paused time
            let countdownElapsed = now - this.countdownStartTime;
            if (this.pausedTimeAccumulator > 0) {
                countdownElapsed -= this.pausedTimeAccumulator;
            }
            // If currently paused, subtract the current pause duration
            if (this.isPaused && this.pauseStartTime) {
                const currentPauseDuration = now - this.pauseStartTime;
                countdownElapsed -= currentPauseDuration;
            }
            const countdownRemaining = COUNTDOWN_DURATION - countdownElapsed;
            countdown = Math.max(0, Math.ceil(countdownRemaining / 1000));
        } else if (this.gameEndTime) {
            // During game, show game timer
            let remainingTime;
            if (this.isPaused && this.pauseStartTime) {
                // When paused, use the time when pause started
                remainingTime = this.gameEndTime - this.pauseStartTime;
            } else {
                // Normal countdown
                remainingTime = this.gameEndTime - now;
            }
            timer = Math.max(0, Math.floor(remainingTime / 1000));
        }

        // Build scores object
        const scores = {};
        for (const id in this.players) {
            scores[id] = this.players[id].score;
        }

        // Send state
        const entities = {
            ...this.players,
            ...this.projectiles,
            ...this.enemies,
            ...this.items
        };

        this.io.emit('gameState', {
            entities,
            timer,
            countdown,
            scores,
            isPaused: this.isPaused,
            pausedBy: this.pausedBy,
            gameState: this.state
        });
    }
}

module.exports = { ServerGame };
