import { Renderer } from './renderer.js';

export class Game {
    constructor(socket, username, soundManager) {
        this.socket = socket;
        this.username = username;
        this.soundManager = soundManager;
        this.container = document.getElementById('game-container');
        this.renderer = new Renderer(this.container);

        this.gameState = {
            entities: {}
        };

        this.isRunning = false;

        // Store event handlers so we can remove them later
        this.gameStateHandler = (state) => {
            // Detect events before updating state
            this.detectSoundEvents(this.gameState, state);

            // In a real implementation, we would interpolate
            // For now, simple state replacement or strict lockstep
            this.gameState = state;
        };

        this.initInput();

        // Listen for updates
        this.socket.on('gameState', this.gameStateHandler);

        // Start local simulation/prediction loop if needed, for now just render loop
        this.startGameLoop();
    }

    cleanup() {
        // Stop the game loop
        this.isRunning = false;

        // Remove socket event listeners
        if (this.socket && this.gameStateHandler) {
            this.socket.off('gameState', this.gameStateHandler);
        }

        // Remove input event listeners
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
        }
        if (this.keyupHandler) {
            window.removeEventListener('keyup', this.keyupHandler);
        }

        // Clear renderer elements
        if (this.renderer && this.renderer.elements) {
            for (const [id, el] of this.renderer.elements) {
                el.remove();
            }
            this.renderer.elements.clear();
        }

        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    initInput() {
        this.keys = {};

        // Store handlers so we can remove them later
        this.keydownHandler = (e) => {
            if (!this.keys[e.code]) {
                this.keys[e.code] = true;
                this.socket.emit('input', { keys: this.keys });

                // Play shooting sound immediately on client for feedback
                // Assuming space is shoot
                if (e.code === 'Space') {
                    this.soundManager.play('fireball');
                }
            }
        };

        this.keyupHandler = (e) => {
            if (this.keys[e.code]) {
                delete this.keys[e.code];
                this.socket.emit('input', { keys: this.keys });
            }
        };

        window.addEventListener('keydown', this.keydownHandler);
        window.addEventListener('keyup', this.keyupHandler);
    }

    startGameLoop() {
        this.isRunning = true;
        requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        this.renderer.render(this.gameState, this.socket.id);

        requestAnimationFrame((t) => this.loop(t));
    }

    detectSoundEvents(oldState, newState) {
        if (!oldState.entities || !newState.entities) return;

        // Find local player
        const myId = this.socket.id;
        const oldMe = oldState.entities[myId];
        const newMe = newState.entities[myId];

        if (oldMe && newMe) {
            // Check for Death
            if (!oldMe.isDead && newMe.isDead) {
                this.soundManager.play('death');
            }

            // Check for Pickup (HP or Lives increase) - only if alive
            if (!oldMe.isDead && !newMe.isDead) {
                if (newMe.hp > oldMe.hp) {
                    this.soundManager.play('pickup');
                } else if (newMe.lives > oldMe.lives) {
                    this.soundManager.play('pickup');
                }
            }
        }

        // Check for other player deaths
        for (const [id, newEntity] of Object.entries(newState.entities)) {
            if (newEntity.type === 'player' && id !== myId) {
                const oldEntity = oldState.entities[id];
                if (oldEntity && !oldEntity.isDead && newEntity.isDead) {
                    this.soundManager.play('death');
                }
            }
        }
    }
}
