const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
// const { createViteServer } = require('./vite-dev-server');

// Actually, effectively handling dev vs prod:
// In dev, we run `vite` (frontend) and `nodemon server` (backend).
// The `vite` dev server proxies /socket.io to this server.
// This server just needs to listen.

const { ServerGame } = require('./game');
const { MAX_PLAYERS } = require('../shared/constants');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

const game = new ServerGame(io);

const PORT = process.env.PORT || 3000;

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../dist')));
    
    // Serve index.html for all routes (SPA routing)
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../dist/index.html'));
    });
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (data) => {
        console.log(`User ${socket.id} joined as ${data.username}`);
        
        // Validate username
        const validation = game.uniqueUsernameCheck(data.username);
        
        if (!validation.valid) {
            // Send error to client
            const errorMessages = {
                'NAME_TAKEN': 'Name is already taken! Please choose another name.',
                'INVALID_NAME': 'Name must be between 3 and 20 characters.',
                'GAME_IN_PROGRESS': 'Game is currently in progress. Please wait for the game to end.'
            };
            
            socket.emit('joinError', {
                code: validation.error,
                message: errorMessages[validation.error] || 'Invalid username'
            });
            return;
        }

        // Check if game is currently playing - players can't join mid-game
        const { GAME_STATE } = require('../shared/constants');
        if (game.getState() === GAME_STATE.PLAYING) {
            socket.emit('joinError', {
                code: 'GAME_IN_PROGRESS',
                message: 'Game is currently in progress. Please wait for the game to end.'
            });
            return;
        }

        // Check if game is full
        if (game.getPlayerCount() >= MAX_PLAYERS) {
            socket.emit('joinError', {
                code: 'GAME_FULL',
                message: 'Game is full! (Max 4 players)'
            });
            return;
        }

        // Add player if validation passed
        game.addPlayer(socket.id, data.username);
        
        // Tell the user they successfully joined
        const isLeadPlayer = socket.id === game.leadPlayerId;
        socket.emit('joined', {
            id: socket.id,
            username: data.username,
            isLeadPlayer: isLeadPlayer
        });
    });

    socket.on('startGame', () => {
        const result = game.startGame(socket.id);
        if (!result.success) {
            socket.emit('error', {
                code: result.error,
                message: getErrorMessage(result.error)
            });
        }
    });

    socket.on('input', (data) => {
        game.handleInput(socket.id, data);
    });

    socket.on('pauseGame', () => {
        const result = game.pauseGame(socket.id);
        if (!result.success) {
            socket.emit('error', {
                code: result.error,
                message: getPauseErrorMessage(result.error)
            });
        }
    });

    socket.on('resumeGame', () => {
        const result = game.resumeGame(socket.id);
        if (!result.success) {
            socket.emit('error', {
                code: result.error,
                message: getPauseErrorMessage(result.error)
            });
        }
    });

    socket.on('quitGame', () => {
        const result = game.quitGame(socket.id);
        if (!result.success) {
            socket.emit('error', {
                code: result.error,
                message: getPauseErrorMessage(result.error)
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        game.removePlayer(socket.id);
    });
});

function getErrorMessage(code) {
    const devMode = process.env.DEV_MODE === 'true';
    const minPlayers = devMode ? 1 : 2;
    const messages = {
        'NOT_LEAD_PLAYER': 'Only the lead player can start the game',
        'INVALID_PLAYER_COUNT': devMode 
            ? `Need ${minPlayers}-4 players to start the game (DEV MODE: ${minPlayers} minimum)`
            : 'Need 2-4 players to start the game',
        'GAME_NOT_READY': 'Game is not ready to start'
    };
    return messages[code] || 'Unknown error';
}

function getPauseErrorMessage(code) {
    const messages = {
        'PLAYER_NOT_FOUND': 'Player not found',
        'GAME_NOT_PLAYING': 'Game is not currently playing',
        'ALREADY_PAUSED': 'Game is already paused',
        'GAME_NOT_PAUSED': 'Game is not paused'
    };
    return messages[code] || 'Unknown error';
}

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
