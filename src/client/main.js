import io from 'socket.io-client';
import { Game } from './game.js';
import { SoundManager } from './sound-manager.js';

const soundManager = new SoundManager();

// Global button click sound
document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        soundManager.play('menu');
    }
});

console.log('Client initializing...');

// Basic Socket.io connection
// Auto-detect server URL: use environment variable in production, localhost in dev
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (window.location.protocol === 'https:' ? window.location.origin : 'http://localhost:3000');
const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    // Optimize for production - reduce reconnection attempts
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    // Use WebSocket first for better performance
    upgrade: true,
    rememberUpgrade: true
});
let gameInstance;

const joinScreen = document.getElementById('join-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const hud = document.getElementById('hud');
const pauseScreen = document.getElementById('pause-screen');
const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username-input');
const playerList = document.getElementById('player-list');
const playerCount = document.getElementById('player-count');
const waitingMessage = document.getElementById('waiting-message');
const startGameBtn = document.getElementById('start-game-btn');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const quitBtn = document.getElementById('quit-btn');
const quitFromPauseBtn = document.getElementById('quit-from-pause-btn');
const pauseMessage = document.getElementById('pause-message');
const singlePlayerSection = document.getElementById('single-player-section');
const singlePlayerToggle = document.getElementById('single-player-toggle');
const npcConfig = document.getElementById('npc-config');
const npcCountSelect = document.getElementById('npc-count-select');
const npcList = document.getElementById('npc-list');
let isLeadPlayer = false;
let currentPlayerId = null;
let singlePlayerMode = false;
let npcConfigs = [];

// Audio Settings Controls
const toggleMusicBtn = document.getElementById('toggle-music-btn');
const toggleEffectsBtn = document.getElementById('toggle-effects-btn');
const pauseToggleMusicBtn = document.getElementById('pause-toggle-music');
const pauseToggleEffectsBtn = document.getElementById('pause-toggle-effects');

function updateAudioButtons() {
    // Music Buttons
    const musicText = soundManager.isMusicMuted ? "Unmute Music" : "Mute Music";
    if (toggleMusicBtn) toggleMusicBtn.textContent = musicText;
    if (pauseToggleMusicBtn) pauseToggleMusicBtn.textContent = musicText;

    // Effects Buttons
    const effectsText = soundManager.isEffectsMuted ? "Unmute Effects" : "Mute Effects";
    if (toggleEffectsBtn) toggleEffectsBtn.textContent = effectsText;
    if (pauseToggleEffectsBtn) pauseToggleEffectsBtn.textContent = effectsText;
}

// Initialize button state
updateAudioButtons();

// Lobby Handlers
if (toggleMusicBtn) {
    toggleMusicBtn.addEventListener('click', () => {
        soundManager.toggleMusicMute();
        updateAudioButtons();
    });
}

if (toggleEffectsBtn) {
    toggleEffectsBtn.addEventListener('click', () => {
        soundManager.toggleEffectsMute();
        updateAudioButtons();
    });
}

// Pause Screen Handlers
if (pauseToggleMusicBtn) {
    pauseToggleMusicBtn.addEventListener('click', () => {
        soundManager.toggleMusicMute();
        updateAudioButtons();
    });
}

if (pauseToggleEffectsBtn) {
    pauseToggleEffectsBtn.addEventListener('click', () => {
        soundManager.toggleEffectsMute();
        updateAudioButtons();
    });
}

joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        console.log(`Joining as ${username}`);
        joinBtn.disabled = true;
        joinBtn.innerText = "Entering Realm...";
        socket.emit('join', { username });

        // Start background music
        soundManager.playMusic('general');
    }
});

socket.on('connect_error', (err) => {
    console.error('Connection failed:', err);
    joinBtn.disabled = false;
    joinBtn.innerText = "Join Failed (Retry)";
    alert(`Connection failed: ${err.message}`);
});

socket.on('joined', (data) => {
    console.log('Successfully joined game!', data);
    joinBtn.disabled = false;
    joinBtn.innerText = "Join Game";
    isLeadPlayer = data.isLeadPlayer;
    currentPlayerId = data.id; // Store player ID
    joinScreen.style.display = 'none';
    lobbyScreen.style.display = 'block';
    // Don't create Game instance yet - wait for gameStarted event
});

socket.on('joinError', (error) => {
    console.error('Join error:', error);
    // Reset button
    joinBtn.disabled = false;
    joinBtn.innerText = "Join Game";

    // If game is in progress, show special message and wait
    if (error.code === 'GAME_IN_PROGRESS') {
        joinBtn.innerText = "Waiting for game to end...";
        joinBtn.disabled = true;
    } else {
        alert(error.message || 'Failed to join game');
        // Focus back to input
        usernameInput.focus();
        usernameInput.select();
    }
});

socket.on('lobbyState', (lobby) => {
    // If game has ended, don't update lobby UI to avoid overwriting leaderboard
    if (window.gameEnded) return;

    console.log('Lobby state:', lobby);

    const devMode = lobby.devMode || false;
    const maxPlayers = 4;
    singlePlayerMode = lobby.singlePlayerMode || false;

    // Find current player and check if they are lead player
    // Use currentPlayerId if available, otherwise fall back to socket.id
    const playerIdToCheck = currentPlayerId || socket.id;
    let currentPlayer = lobby.players.find(p => p.id === playerIdToCheck);

    // If not found with currentPlayerId, try socket.id
    if (!currentPlayer) {
        currentPlayer = lobby.players.find(p => p.id === socket.id);
        // Update currentPlayerId if found
        if (currentPlayer) {
            currentPlayerId = currentPlayer.id;
        }
    }

    const isCurrentPlayerLead = currentPlayer ? currentPlayer.isLeadPlayer : false;

    // Update isLeadPlayer variable
    if (currentPlayer) {
        isLeadPlayer = isCurrentPlayerLead;
    }

    // Show/hide single-player section based on lead player status
    if (singlePlayerSection) {
        singlePlayerSection.style.display = isCurrentPlayerLead ? 'block' : 'none';
    }

    // Update single-player toggle state (only if visible)
    if (singlePlayerToggle && isCurrentPlayerLead) {
        singlePlayerToggle.checked = singlePlayerMode;
        if (npcConfig) {
            npcConfig.style.display = singlePlayerMode ? 'block' : 'none';
        }
    }

    // Update player list
    playerList.innerHTML = '';
    lobby.players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.textContent = player.username;
        if (player.isLeadPlayer) {
            playerItem.textContent += ' (Host)';
            playerItem.style.fontWeight = 'bold';
        }
        playerList.appendChild(playerItem);
    });
    
    // In single-player mode, show NPC count from config
    if (singlePlayerMode && lobby.npcConfigCount > 0) {
        for (let i = 0; i < lobby.npcConfigCount; i++) {
            const npcItem = document.createElement('div');
            npcItem.className = 'player-item';
            npcItem.textContent = `NPC ${i + 1} [NPC]`;
            npcItem.style.color = '#bcaaa4';
            npcItem.style.fontStyle = 'italic';
            playerList.appendChild(npcItem);
        }
    }

    // Update player count (include NPCs in single-player mode)
    const totalCount = singlePlayerMode && lobby.npcConfigCount > 0 
        ? lobby.players.length + lobby.npcConfigCount 
        : lobby.players.length;
    playerCount.textContent = totalCount;

    // Update waiting message based on game state
    if (lobby.state === 'GAME_OVER') {
        waitingMessage.textContent = 'Game ended. Waiting for players to join...';
    } else if (singlePlayerMode) {
        const realPlayerCount = lobby.players.length;
        const npcCount = lobby.npcConfigCount || 0;
        if (realPlayerCount === 0) {
            waitingMessage.textContent = 'Waiting for host to join...';
        } else if (npcCount === 0) {
            waitingMessage.textContent = 'Configure NPCs and start game';
        } else {
            waitingMessage.textContent = `Ready! (1 player + ${npcCount} NPCs)`;
        }
    } else if (devMode) {
        // Dev mode: allow single player
        if (lobby.players.length < 1) {
            waitingMessage.textContent = 'Waiting for player to join... (DEV MODE: 1+ players)';
        } else if (lobby.players.length >= 1 && lobby.players.length < maxPlayers) {
            waitingMessage.textContent = `Ready! (${lobby.players.length}/${maxPlayers} players) [DEV MODE]`;
        } else {
            waitingMessage.textContent = 'Game is full! [DEV MODE]';
        }
    } else {
        // Normal mode: require 2-4 players
        if (lobby.players.length < 2) {
            waitingMessage.textContent = 'Waiting for more players to join... (Need 2-4 players)';
        } else if (lobby.players.length >= 2 && lobby.players.length < 4) {
            waitingMessage.textContent = `Ready! (${lobby.players.length}/4 players)`;
        } else {
            waitingMessage.textContent = 'Game is full!';
        }
    }

    // Show start button for lead player when enough players and in WAITING state
    let hasEnoughPlayers;
    if (singlePlayerMode) {
        const realPlayerCount = lobby.players.length;
        const npcCount = lobby.npcConfigCount || npcConfigs.length || 0;
        // In single-player mode, need 1 real player and 1-3 NPCs configured
        hasEnoughPlayers = realPlayerCount === 1 && npcCount >= 1 && npcCount <= 3;
    } else {
        hasEnoughPlayers = devMode
            ? lobby.players.length >= 1 && lobby.players.length <= maxPlayers
            : lobby.players.length >= 2 && lobby.players.length <= maxPlayers;
    }

    console.log('Start button check:', {
        isCurrentPlayerLead,
        isLeadPlayer,
        state: lobby.state,
        hasEnoughPlayers,
        playerCount: lobby.players.length,
        devMode,
        singlePlayerMode
    });

    // Allow starting game in WAITING or GAME_OVER state (GAME_OVER means we can start a new game)
    if (isCurrentPlayerLead && (lobby.state === 'WAITING' || lobby.state === 'GAME_OVER') && hasEnoughPlayers) {
        startGameBtn.style.display = 'block';
    } else {
        startGameBtn.style.display = 'none';
    }

    // Update NPC config UI if single-player mode
    if (singlePlayerMode && isCurrentPlayerLead) {
        updateNPCConfigUI();
    }
});

socket.on('gameStarted', () => {
    console.log('Game started!');
    lobbyScreen.style.display = 'none';
    hud.style.display = 'flex';
    pauseScreen.style.display = 'none';
    // Show countdown screen
    const countdownScreen = document.getElementById('countdown-screen');
    if (countdownScreen) {
        countdownScreen.style.display = 'block';
    }
    // Reset start button
    startGameBtn.disabled = false;
    startGameBtn.textContent = 'Start Game';
    // Now create Game instance
    gameInstance = new Game(socket, usernameInput.value, soundManager);
});

socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});

// Single-player mode toggle
if (singlePlayerToggle) {
    singlePlayerToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        if (enabled) {
            // Initialize NPC configs
            const npcCount = parseInt(npcCountSelect.value) || 3;
            npcConfigs = [];
            for (let i = 0; i < npcCount; i++) {
                npcConfigs.push({
                    username: `NPC ${i + 1}`,
                    difficulty: 'MEDIUM',
                    customConfig: {}
                });
            }
            updateNPCConfigUI();
        }
        socket.emit('setSinglePlayerMode', {
            enabled: enabled,
            npcConfigs: npcConfigs
        });
    });
}

// NPC count selector
if (npcCountSelect) {
    npcCountSelect.addEventListener('change', (e) => {
        const count = parseInt(e.target.value);
        // Adjust npcConfigs array
        while (npcConfigs.length < count) {
            npcConfigs.push({
                username: `NPC ${npcConfigs.length + 1}`,
                difficulty: 'MEDIUM',
                customConfig: {}
            });
        }
        while (npcConfigs.length > count) {
            npcConfigs.pop();
        }
        updateNPCConfigUI();
        // Immediately update server with new NPC count
        updateNPCConfigs();
    });
}

// Update NPC configuration UI
function updateNPCConfigUI() {
    if (!npcList) return;
    
    npcList.innerHTML = '';
    
    npcConfigs.forEach((config, index) => {
        const npcDiv = document.createElement('div');
        npcDiv.style.marginBottom = '15px';
        npcDiv.style.padding = '10px';
        npcDiv.style.background = 'rgba(0,0,0,0.3)';
        npcDiv.style.borderRadius = '4px';
        npcDiv.style.border = '1px solid #5d4037';
        
        const customConfig = config.customConfig || {};
        const speedMultiplier = customConfig.speedMultiplier !== undefined ? customConfig.speedMultiplier : 1.0;
        const fireRateMultiplier = customConfig.fireRateMultiplier !== undefined ? customConfig.fireRateMultiplier : 1.0;
        const bulletRange = customConfig.bulletRange !== undefined ? customConfig.bulletRange : 500;
        
        npcDiv.innerHTML = `
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">NPC ${index + 1}:</label>
                <input type="text" class="npc-username" value="${config.username}" placeholder="NPC Name" style="padding: 5px; font-size: 1rem; font-family: 'MedievalSharp', cursive; background: #d7ccc8; color: #3e2723; border: 2px solid #5d4037; border-radius: 4px; width: 100%; margin-bottom: 5px;">
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display: block; margin-bottom: 5px;">Difficulty:</label>
                <select class="npc-difficulty" style="padding: 5px; font-size: 1rem; font-family: 'MedievalSharp', cursive; background: #d7ccc8; color: #3e2723; border: 2px solid #5d4037; border-radius: 4px; width: 100%;">
                    <option value="EASY" ${config.difficulty === 'EASY' ? 'selected' : ''}>Easy</option>
                    <option value="MEDIUM" ${config.difficulty === 'MEDIUM' ? 'selected' : ''}>Medium</option>
                    <option value="HARD" ${config.difficulty === 'HARD' ? 'selected' : ''}>Hard</option>
                </select>
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display: block; margin-bottom: 5px;">Speed Multiplier: <span class="npc-speed-value">${speedMultiplier.toFixed(1)}</span></label>
                <input type="range" class="npc-speed" min="0.1" max="2.0" step="0.1" value="${speedMultiplier}" style="width: 100%;">
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display: block; margin-bottom: 5px;">Fire Rate Multiplier: <span class="npc-fire-rate-value">${fireRateMultiplier.toFixed(1)}</span></label>
                <input type="range" class="npc-fire-rate" min="0.1" max="5.0" step="0.1" value="${fireRateMultiplier}" style="width: 100%;">
            </div>
            <div style="margin-bottom: 5px;">
                <label style="display: block; margin-bottom: 5px;">Bullet Range: <span class="npc-bullet-range-value">${bulletRange}</span></label>
                <input type="range" class="npc-bullet-range" min="200" max="800" step="50" value="${bulletRange}" style="width: 100%;">
            </div>
        `;
        
        // Add event listeners
        const usernameInput = npcDiv.querySelector('.npc-username');
        const difficultySelect = npcDiv.querySelector('.npc-difficulty');
        const speedSlider = npcDiv.querySelector('.npc-speed');
        const speedValue = npcDiv.querySelector('.npc-speed-value');
        const fireRateSlider = npcDiv.querySelector('.npc-fire-rate');
        const fireRateValue = npcDiv.querySelector('.npc-fire-rate-value');
        const bulletRangeSlider = npcDiv.querySelector('.npc-bullet-range');
        const bulletRangeValue = npcDiv.querySelector('.npc-bullet-range-value');
        
        if (!config.customConfig) {
            config.customConfig = {};
        }
        
        usernameInput.addEventListener('input', (e) => {
            config.username = e.target.value || `NPC ${index + 1}`;
            updateNPCConfigs();
        });
        
        difficultySelect.addEventListener('change', (e) => {
            config.difficulty = e.target.value;
            updateNPCConfigs();
        });
        
        speedSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            speedValue.textContent = value.toFixed(1);
            config.customConfig.speedMultiplier = value;
            updateNPCConfigs();
        });
        
        fireRateSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            fireRateValue.textContent = value.toFixed(1);
            config.customConfig.fireRateMultiplier = value;
            updateNPCConfigs();
        });
        
        bulletRangeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            bulletRangeValue.textContent = value;
            config.customConfig.bulletRange = value;
            updateNPCConfigs();
        });
        
        npcList.appendChild(npcDiv);
    });
}

let npcConfigUpdateTimeout = null;
function updateNPCConfigs() {
    // Debounce updates to avoid too many server calls
    if (npcConfigUpdateTimeout) {
        clearTimeout(npcConfigUpdateTimeout);
    }
    
    npcConfigUpdateTimeout = setTimeout(() => {
        // Always send update if single-player mode is enabled (check from toggle state)
        const isSinglePlayerEnabled = singlePlayerToggle && singlePlayerToggle.checked;
        if (isSinglePlayerEnabled && isLeadPlayer) {
            console.log('Updating NPC configs:', npcConfigs);
            socket.emit('setSinglePlayerMode', {
                enabled: true,
                npcConfigs: npcConfigs
            });
        }
    }, 300); // Wait 300ms after last change before sending
}

// Start game button handler
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', {});
    startGameBtn.disabled = true;
    startGameBtn.textContent = 'Starting...';
});

// Pause/Resume/Quit handlers
pauseBtn.addEventListener('click', () => {
    socket.emit('pauseGame', {});
});

resumeBtn.addEventListener('click', () => {
    socket.emit('resumeGame', {});
    pauseScreen.style.display = 'none';
});

function handleQuit() {
    if (confirm('Are you sure you want to quit the game?')) {
        socket.emit('quitGame', {});
    }
}

quitBtn.addEventListener('click', handleQuit);
quitFromPauseBtn.addEventListener('click', handleQuit);

// Pause/Resume/Quit event listeners
function updatePauseMessage(pausedBy) {
    if (pausedBy) {
        pauseMessage.textContent = `Game paused by ${pausedBy.username}`;
    } else {
        pauseMessage.textContent = 'Game is paused';
    }
}

socket.on('gamePaused', (data) => {
    console.log('Game paused by:', data.pausedBy);
    pauseScreen.style.display = 'block';
    // Hide countdown screen when paused
    const countdownScreen = document.getElementById('countdown-screen');
    if (countdownScreen) {
        countdownScreen.style.display = 'none';
    }
    updatePauseMessage(data.pausedBy);
});

socket.on('gameResumed', (data) => {
    console.log('Game resumed by:', data.resumedBy);
    pauseScreen.style.display = 'none';
    // Show countdown screen again if countdown is still active
    // This will be handled by the gameState event listener
});

socket.on('playerQuit', (data) => {
    console.log('Player quit:', data.quitBy);
    // If current player quit, go back to join screen
    if (data.quitBy && data.quitBy.id === currentPlayerId) {
        // Stop and cleanup game instance
        if (gameInstance) {
            gameInstance.cleanup();
            gameInstance = null;
        }

        // Hide countdown screen
        const countdownScreen = document.getElementById('countdown-screen');
        if (countdownScreen) {
            countdownScreen.style.display = 'none';
        }

        // Reset UI
        hud.style.display = 'none';
        pauseScreen.style.display = 'none';
        lobbyScreen.style.display = 'none';
        joinScreen.style.display = 'block';

        // Reset start button
        startGameBtn.disabled = false;
        startGameBtn.textContent = 'Start Game';

        // Reset username input for rejoining
        usernameInput.value = '';
        usernameInput.focus();

        // Reset player state
        isLeadPlayer = false;
        currentPlayerId = null;
    }
});

socket.on('kickedFromGame', (data) => {
    console.log('Kicked from game:', data);
    
    // Stop and cleanup game instance
    if (gameInstance) {
        gameInstance.cleanup();
        gameInstance = null;
    }

    // Hide all screens
    const countdownScreen = document.getElementById('countdown-screen');
    if (countdownScreen) {
        countdownScreen.style.display = 'none';
    }
    hud.style.display = 'none';
    pauseScreen.style.display = 'none';
    lobbyScreen.style.display = 'none';
    joinScreen.style.display = 'block';

    // Reset start button
    startGameBtn.disabled = false;
    startGameBtn.textContent = 'Join Game';

    // Reset username input for rejoining
    usernameInput.value = '';
    usernameInput.focus();

    // Reset player state
    isLeadPlayer = false;
    currentPlayerId = null;

    // Show message to user
    alert(data.message || 'You were removed from the game.');
});

socket.on('gameEnded', (data) => {
    console.log('Game ended:', data);
    soundManager.play('gameover');

    // Set a flag to prevent lobbyState from overwriting this screen
    window.gameEnded = true;

    // Hide all game UI
    hud.style.display = 'none';
    pauseScreen.style.display = 'none';
    lobbyScreen.style.display = 'none'; // Hide lobby explicitly

    // Hide death screen explicitly
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
        deathScreen.style.display = 'none';
    }

    // Cleanup game instance
    if (gameInstance) {
        gameInstance.cleanup();
        gameInstance = null;
    }

    // Show dedicated game over screen
    const gameOverScreen = document.getElementById('game-over-screen');
    const leaderboardContent = document.getElementById('leaderboard-content');

    if (gameOverScreen && leaderboardContent) {
        gameOverScreen.style.display = 'block';

        // Build rich leaderboard display
        let leaderboardHTML = '<h2 style="color: #ffd700; font-size: 3rem; margin-bottom: 2rem; text-shadow: 2px 2px 4px #000;">GAME OVER!</h2>';

        // Always show the winner (they were already sorted by the server using survival time as tie-breaker)
        if (data.winner) {
            const winMins = Math.floor(data.winner.survivalTime / 60);
            const winSecs = data.winner.survivalTime % 60;
            const winTimeStr = `${winMins}:${winSecs.toString().padStart(2, '0')}`;

            leaderboardHTML += `<div style="font-size: 2rem; margin-bottom: 2rem; color: #ffd700; font-weight: bold;">
                🏆 Winner: ${data.winner.username} 🏆
                <div style="font-size: 1.2rem; margin-top: 0.5rem; color: #e0c097; opacity: 0.9;">
                    ${data.winner.score} kills • ⏱️ ${winTimeStr}
                </div>
            </div>`;
        }

        leaderboardHTML += `<div style="font-size: 1.5rem; margin-bottom: 1rem; border-bottom: 2px solid #5d4037; padding-bottom: 0.5rem; color: #ffd700;">Final Standing</div>`;
        leaderboardHTML += '<div style="background: rgba(0,0,0,0.4); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">';

        if (data.leaderboard && data.leaderboard.length > 0) {
            data.leaderboard.forEach((player, index) => {
                // Medals represent the rank, which is always valid
                const medal = (index === 0) ? '🥇' : (index === 1) ? '🥈' : (index === 2) ? '🥉' : `${index + 1}.`;

                const mins = Math.floor(player.survivalTime / 60);
                const secs = player.survivalTime % 60;
                const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

                leaderboardHTML += `<div style="padding: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 1.2rem; display: flex; justify-content: space-between; align-items: center; ${index === 0 ? 'font-weight: bold; color: #ffd700;' : 'color: #e0c097;'}">
                    <span>${medal} ${player.username}</span>
                    <span style="display: flex; gap: 1.5rem; align-items: center;">
                        <span style="font-size: 1rem; opacity: 0.8; color: #bcaaa4;">⏱️ ${timeStr} </span>
                        <span>${player.score} kills</span>
                    </span>
                </div>`;
            });
        }

        leaderboardHTML += '</div>';
        leaderboardHTML += '<div style="margin-top: 2rem; font-size: 1.3rem; color: #ffd700; animation: blink 1.5s step-start infinite;">Refresh the page to play again</div>';

        leaderboardContent.innerHTML = leaderboardHTML;
    }
});

// Add blink animation
if (!document.getElementById('custom-animations')) {
    const style = document.createElement('style');
    style.id = 'custom-animations';
    style.textContent = `
        @keyframes blink { 
            50% { opacity: 0; } 
        }
    `;
    document.head.appendChild(style);
}

// Listen for gameState to check if paused
// Only process if we're in the game (hud is visible)
socket.on('gameState', (state) => {
    // Only process if we're actually in the game
    if (hud.style.display === 'none' || !gameInstance) {
        return;
    }

    // Update pause screen visibility based on isPaused
    if (state.isPaused && hud.style.display !== 'none') {
        pauseScreen.style.display = 'block';
        updatePauseMessage(state.pausedBy);
    } else if (!state.isPaused) {
        pauseScreen.style.display = 'none';
    }

    // Handle countdown (hide if paused)
    const countdownScreen = document.getElementById('countdown-screen');
    const countdownNumber = document.getElementById('countdown-number');
    if (state.gameState === 'COUNTDOWN' && state.countdown !== undefined && !state.isPaused) {
        countdownScreen.style.display = 'block';
        countdownNumber.textContent = state.countdown || '0';
    } else {
        countdownScreen.style.display = 'none';
    }
});

socket.on('error', (error) => {
    console.error('Server error:', error);
    alert(error.message || 'An error occurred');
});
