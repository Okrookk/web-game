import io from 'socket.io-client';
import { Game } from './game.js';
import { SoundManager } from './sound-manager.js';

const soundManager = new SoundManager();

console.log('Client initializing...');

// Basic Socket.io connection
// Auto-detect server URL: use environment variable in production, localhost in dev
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (window.location.protocol === 'https:' ? window.location.origin : 'http://localhost:3000');
const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
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
let isLeadPlayer = false;
let currentPlayerId = null;
let pendingJoin = null; // Store join attempt if game is in progress

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

        // Store join attempt in case we need to retry
        pendingJoin = username;
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
        // Don't clear pendingJoin - we'll retry when game ends
    } else {
        // For other errors, clear pending join and show alert
        pendingJoin = null;
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
    const minPlayers = devMode ? 1 : 2;
    const maxPlayers = 4;

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

    // Update player count
    playerCount.textContent = lobby.players.length;

    // Update waiting message based on game state
    if (lobby.state === 'GAME_OVER') {
        waitingMessage.textContent = 'Game ended. Waiting for players to join...';
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
    const hasEnoughPlayers = devMode
        ? lobby.players.length >= 1 && lobby.players.length <= maxPlayers
        : lobby.players.length >= 2 && lobby.players.length <= maxPlayers;

    console.log('Start button check:', {
        isCurrentPlayerLead,
        isLeadPlayer,
        state: lobby.state,
        hasEnoughPlayers,
        playerCount: lobby.players.length,
        devMode
    });

    // Allow starting game in WAITING or GAME_OVER state (GAME_OVER means we can start a new game)
    if (isCurrentPlayerLead && (lobby.state === 'WAITING' || lobby.state === 'GAME_OVER') && hasEnoughPlayers) {
        startGameBtn.style.display = 'block';
    } else {
        startGameBtn.style.display = 'none';
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

quitBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to quit the game?')) {
        socket.emit('quitGame', {});
    }
});

quitFromPauseBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to quit the game?')) {
        socket.emit('quitGame', {});
    }
});

// Pause/Resume/Quit event listeners
socket.on('gamePaused', (data) => {
    console.log('Game paused by:', data.pausedBy);
    pauseScreen.style.display = 'block';
    // Hide countdown screen when paused
    const countdownScreen = document.getElementById('countdown-screen');
    if (countdownScreen) {
        countdownScreen.style.display = 'none';
    }
    if (data.pausedBy) {
        pauseMessage.textContent = `Game paused by ${data.pausedBy.username}`;
    } else {
        pauseMessage.textContent = 'Game is paused';
    }
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
        if (state.pausedBy) {
            pauseMessage.textContent = `Game paused by ${state.pausedBy.username}`;
        } else {
            pauseMessage.textContent = 'Game is paused';
        }
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
