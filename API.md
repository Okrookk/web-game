# API Documentation - Multiplayer DOM Shooter

This document defines all Socket.io events between client and server.

---

## Connection Setup

Client connects to Socket.io server:

```javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000'); // Development
// Tai: const socket = io(); // Jos proxy on konfiguroitu
```

---

## Client → Server Events

These events are sent from client to server.

### `join`

Player attempts to join the game.

**Sent when:**
- Player clicks "Join Game" button

**Data:**
```javascript
{
  username: string  // Player's chosen name (3-20 characters)
}
```

**Example:**
```javascript
socket.emit('join', { username: 'Player1' });
```

**Responses:**
- `joined` - Successful join
- `joinError` - Join failed (e.g. name already taken)

---

### `input`

Sends player inputs (movement, shooting).

**Sent when:**
- Player presses/releases a key (keydown/keyup)

**Data:**
```javascript
{
  keys: {
    [keyCode: string]: boolean  // E.g. { 'KeyW': true, 'KeyA': true, 'Space': false }
  },
  angle?: number,     // Shooting direction in radians (0 = right, Math.PI/2 = down)
  mouseX?: number,    // Mouse X coordinate (if needed)
  mouseY?: number    // Mouse Y coordinate (if needed)
}
```

**Example:**
```javascript
// Movement
socket.emit('input', { 
  keys: { 'KeyW': true, 'KeyD': true }  // Moving up and right
});

// Shooting
socket.emit('input', { 
  keys: { 'Space': true },
  angle: Math.PI / 4  // Shooting at 45 degrees right and down
});
```

**Note:** Server sends `gameState` event every time input is processed (60 FPS).

---

### `startGame`

Lead player starts the game.

**Sent when:**
- Lead player clicks "Start Game" button in lobby
- Only lead player can send this

**Data:**
```javascript
{}  // Empty object
```

**Example:**
```javascript
socket.emit('startGame', {});
```

**Responses:**
- `gameStarting` - Countdown begins (if used)
- `gameStarted` - Game starts
- `error` - If not lead player or too few players

---

### `pauseGame`

Pauses the game.

**Sent when:**
- Player clicks "Pause" button

**Data:**
```javascript
{}  // Empty object
```

**Example:**
```javascript
socket.emit('pauseGame', {});
```

**Responses:**
- `gamePaused` - Sent to all players (including the one who paused)

---

### `resumeGame`

Resumes a paused game.

**Sent when:**
- Player clicks "Resume" button

**Data:**
```javascript
{}  // Empty object
```

**Example:**
```javascript
socket.emit('resumeGame', {});
```

**Responses:**
- `gameResumed` - Sent to all players (including the one who resumed)

---

### `quitGame`

Player quits the game.

**Sent when:**
- Player clicks "Quit" button

**Data:**
```javascript
{}  // Empty object
```

**Example:**
```javascript
socket.emit('quitGame', {});
```

**Responses:**
- `playerQuit` - Sent to all other players
- Player is removed from the game

---

### `chatMessage` (BONUS)

Sends a chat message.

**Sent when:**
- Player sends a chat message

**Data:**
```javascript
{
  message: string  // Chat message (max 200 characters)
}
```

**Example:**
```javascript
socket.emit('chatMessage', { message: 'Hello everyone!' });
```

**Responses:**
- `chatMessage` - Sent to all players (including sender)

---

## Server → Client Events

These events are sent from server to client.

### `connect`

Socket.io connection established.

**Sent when:**
- Client connects to server

**Data:**
```javascript
// No data, but socket.id is available
```

**Example:**
```javascript
socket.on('connect', () => {
  console.log('Connected! Socket ID:', socket.id);
});
```

---

### `disconnect`

Socket.io connection lost.

**Sent when:**
- Connection is lost (network issue, server shutdown, etc.)

**Data:**
```javascript
// No data
```

**Example:**
```javascript
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

---

### `joined`

Successful join to the game.

**Sent when:**
- Player successfully joined the game

**Data:**
```javascript
{
  id: string,              // Socket ID (e.g. "abc123")
  username: string,        // Player's name
  isLeadPlayer: boolean    // Is this player the lead player (host)
}
```

**Example:**
```javascript
socket.on('joined', (data) => {
  console.log('Joined as:', data.username);
  console.log('Am I lead player?', data.isLeadPlayer);
  // Hide join-screen, show lobby
});
```

---

### `joinError`

Join failed.

**Sent when:**
- Username is already taken
- Username is too short/long
- Username is empty
- Too many players (over 4)

**Data:**
```javascript
{
  code: string,     // Error code: 'NAME_TAKEN', 'INVALID_NAME', 'GAME_FULL'
  message: string   // Human-readable error message
}
```

**Example:**
```javascript
socket.on('joinError', (error) => {
  if (error.code === 'NAME_TAKEN') {
    alert('Name is already taken! Please choose another name.');
  } else if (error.code === 'INVALID_NAME') {
    alert('Name is too short or too long! (3-20 characters)');
  } else if (error.code === 'GAME_FULL') {
    alert('Game is full! (Max 4 players)');
  }
});
```

---

### `lobbyState`

Lobby state update.

**Sent when:**
- Player joins/leaves
- Lobby state changes

**Data:**
```javascript
{
  state: 'WAITING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER',
  players: [
    {
      id: string,
      username: string,
      isLeadPlayer: boolean
    }
  ],
  countdown?: number  // Countdown in seconds (if state === 'COUNTDOWN')
}
```

**Example:**
```javascript
socket.on('lobbyState', (lobby) => {
  console.log('Lobby state:', lobby.state);
  console.log('Players:', lobby.players);
  
  // Update player list in UI
  updatePlayerList(lobby.players);
  
  // Show "Start Game" button only for lead player
  if (lobby.state === 'WAITING' && amILeadPlayer) {
    showStartButton();
  }
});
```

---

### `gameStarting`

Game is starting (countdown).

**Sent when:**
- Lead player started the game
- Countdown begins (if used)

**Data:**
```javascript
{
  countdown: number  // Seconds until game starts (e.g. 3, 2, 1)
}
```

**Example:**
```javascript
socket.on('gameStarting', (data) => {
  console.log('Game starting in', data.countdown, 'seconds');
  showCountdown(data.countdown);
});
```

---

### `gameStarted`

Game has started.

**Sent when:**
- Game begins (countdown ended or game started directly)

**Data:**
```javascript
{}  // Empty object
```

**Example:**
```javascript
socket.on('gameStarted', () => {
  console.log('Game started!');
  hideLobby();
  showGame();
  // Start game loop
});
```

---

### `gameState`

Game state (sent at 60 FPS).

**Sent when:**
- Every game loop iteration (60 times per second)

**Data:**
```javascript
{
  entities: {
    [entityId: string]: {
      id: string,
      type: 'player' | 'bullet' | 'enemy',
      x: number,           // X coordinate
      y: number,           // Y coordinate
      rotation?: number,    // Rotation in radians (player only)
      username?: string,   // Player's name (player only)
      score?: number,      // Score (player only)
      hp?: number,         // Health points (player only)
      vx?: number,         // Velocity X (bullet only)
      vy?: number,         // Velocity Y (bullet only)
      ownerId?: string     // Creator player (bullet only)
    }
  },
  timer: number,           // Seconds remaining (count down) OR elapsed time (count up)
  scores: {                // All players' scores
    [playerId: string]: number
  },
  isPaused: boolean        // Is the game paused
}
```

**Example:**
```javascript
socket.on('gameState', (state) => {
  // Update game entities (players, bullets, enemies)
  updateEntities(state.entities);
  
  // Update timer
  updateTimer(state.timer);
  
  // Update scores
  updateScores(state.scores);
  
  // Show/hide pause indicator
  if (state.isPaused) {
    showPauseOverlay();
  } else {
    hidePauseOverlay();
  }
});
```

**Note:** This event is sent 60 times per second, so it's performance-critical!

---

### `gamePaused`

Game was paused.

**Sent when:**
- Someone paused the game

**Data:**
```javascript
{
  pausedBy: {
    id: string,
    username: string
  }
}
```

**Example:**
```javascript
socket.on('gamePaused', (data) => {
  console.log('Game paused by:', data.pausedBy.username);
  showPauseMenu(data.pausedBy.username);
});
```

---

### `gameResumed`

Game was resumed.

**Sent when:**
- Someone resumed the game

**Data:**
```javascript
{
  resumedBy: {
    id: string,
    username: string
  }
}
```

**Example:**
```javascript
socket.on('gameResumed', (data) => {
  console.log('Game resumed by:', data.resumedBy.username);
  hidePauseMenu();
});
```

---

### `playerQuit`

Player quit the game.

**Sent when:**
- Player quit the game (quitGame)

**Data:**
```javascript
{
  quitBy: {
    id: string,
    username: string
  }
}
```

**Example:**
```javascript
socket.on('playerQuit', (data) => {
  console.log('Player quit:', data.quitBy.username);
  showNotification(`${data.quitBy.username} quit the game`);
  // Update player list
});
```

---

### `playerJoined`

New player joined the game.

**Sent when:**
- New player joined the game (in lobby state)

**Data:**
```javascript
{
  id: string,
  username: string
}
```

**Example:**
```javascript
socket.on('playerJoined', (data) => {
  console.log('Player joined:', data.username);
  showNotification(`${data.username} joined the game`);
  // Update player list
});
```

---

### `playerLeft`

Player left (disconnect).

**Sent when:**
- Player disconnected

**Data:**
```javascript
{
  id: string,
  username: string
}
```

**Example:**
```javascript
socket.on('playerLeft', (data) => {
  console.log('Player left:', data.username);
  showNotification(`${data.username} left`);
  // Update player list
});
```

---

### `gameEnded`

Game ended.

**Sent when:**
- Timer ended (if count down)
- Someone won (if there's a win condition)
- All players left

**Data:**
```javascript
{
  winner: {
    id: string,
    username: string,
    score: number
  },
  leaderboard: [
    {
      id: string,
      username: string,
      score: number
    }
  ]  // Sorted from highest to lowest score
}
```

**Example:**
```javascript
socket.on('gameEnded', (data) => {
  console.log('Winner:', data.winner.username, 'with', data.winner.score, 'points');
  
  // Show winner and leaderboard
  showGameOverScreen(data.winner, data.leaderboard);
});
```

---

### `chatMessage` (BONUS)

Chat message.

**Sent when:**
- Someone sent a chat message

**Data:**
```javascript
{
  id: string,        // Sender's socket ID
  username: string,  // Sender's name
  message: string    // Message
}
```

**Example:**
```javascript
socket.on('chatMessage', (data) => {
  console.log(`${data.username}: ${data.message}`);
  addChatMessage(data.username, data.message);
});
```

---

### `error`

An error occurred.

**Sent when:**
- An error occurred (e.g. tried to start game but not lead player)

**Data:**
```javascript
{
  code: string,     // Error code (e.g. 'NOT_LEAD_PLAYER', 'GAME_NOT_READY')
  message: string  // Human-readable error message
}
```

**Example:**
```javascript
socket.on('error', (error) => {
  console.error('Error:', error.code, error.message);
  alert(error.message);
});
```

---

## Data Types

### Player Entity

```javascript
{
  id: string,           // Socket ID
  type: 'player',
  username: string,     // Player's name
  x: number,           // X coordinate (0 - MAP_WIDTH)
  y: number,           // Y coordinate (0 - MAP_HEIGHT)
  rotation: number,     // Rotation in radians (0 = right)
  score: number,       // Score
  hp: number           // Health points (100 = full)
}
```

### Bullet Entity

```javascript
{
  id: string,          // Entity ID (e.g. "e_123")
  type: 'bullet',
  x: number,          // X coordinate
  y: number,          // Y coordinate
  vx: number,         // Velocity X (pixels per frame)
  vy: number,         // Velocity Y (pixels per frame)
  ownerId: string     // Creator player (socket ID)
}
```

### Enemy Entity

```javascript
{
  id: string,         // Entity ID (e.g. "e_456")
  type: 'enemy',
  x: number,          // X coordinate
  y: number,          // Y coordinate
  hp: number          // Health points (usually 1)
}
```

---

## Example: Complete Client Implementation

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Connection
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});

// Joining
function joinGame(username) {
  socket.emit('join', { username });
}

socket.on('joined', (data) => {
  console.log('Joined as:', data.username);
  console.log('Am I lead player?', data.isLeadPlayer);
  // Hide join-screen, show lobby
});

socket.on('joinError', (error) => {
  alert(error.message);
});

// Lobby
socket.on('lobbyState', (lobby) => {
  updateLobbyUI(lobby);
});

// Game start
function startGame() {
  socket.emit('startGame', {});
}

socket.on('gameStarting', (data) => {
  showCountdown(data.countdown);
});

socket.on('gameStarted', () => {
  startGameLoop();
});

// Input
function sendInput(keys, angle) {
  socket.emit('input', { keys, angle });
}

// Game state
socket.on('gameState', (state) => {
  renderGame(state);
  updateTimer(state.timer);
  updateScores(state.scores);
  if (state.isPaused) showPauseOverlay();
});

// Pause/Resume/Quit
function pauseGame() {
  socket.emit('pauseGame', {});
}

function resumeGame() {
  socket.emit('resumeGame', {});
}

function quitGame() {
  socket.emit('quitGame', {});
}

socket.on('gamePaused', (data) => {
  showPauseMenu(data.pausedBy.username);
});

socket.on('gameResumed', (data) => {
  hidePauseMenu();
});

socket.on('playerQuit', (data) => {
  showNotification(`${data.quitBy.username} quit`);
});

// Notifications
socket.on('playerJoined', (data) => {
  showNotification(`${data.username} joined`);
});

socket.on('playerLeft', (data) => {
  showNotification(`${data.username} left`);
});

// Game end
socket.on('gameEnded', (data) => {
  showGameOverScreen(data.winner, data.leaderboard);
});

// Errors
socket.on('error', (error) => {
  console.error('Error:', error);
  alert(error.message);
});
```

---

## Important Reminders

1. **Server is authoritative** - All game logic happens on the server
2. **gameState is sent at 60 FPS** - Optimize rendering!
3. **Unique names** - Server validates that names are unique
4. **Lead player** - Only lead player can start the game
5. **Pause/Resume** - All players see who paused/resumed
6. **Timer** - All players see the same timer (synchronized from server)
7. **Scores** - All players see everyone's scores in real-time

---

## Changes

If you modify events, update this document immediately! This is the shared truth between Dev A and Dev B.

**Last updated:** 2024-12-19

