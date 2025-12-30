import constants from '../shared/constants.json';
import { applySpriteStyle, gridToSpriteCoords } from './sprite-utils.js';
const { ASSETS, MAP_WIDTH, MAP_HEIGHT, PLAYER_SIZE } = constants;

export class Renderer {
    constructor(container) {
        this.container = container;
        this.elements = new Map(); // id -> HTMLElement

        // Create a world container for camera transform
        this.world = document.createElement('div');
        this.world.id = 'game-world';
        this.world.style.position = 'absolute';
        this.world.style.width = `${MAP_WIDTH}px`;
        this.world.style.height = `${MAP_HEIGHT}px`;
        this.container.appendChild(this.world);

        // Create background using sprite from sprite sheet
        // Sprite: 63x47, coordinates (97, 0), sprite sheet: 160x160
        // 
        // Problem: background-repeat repeats the entire sprite sheet, not just the sprite.
        // Solution: Create background using multiple small div elements,
        // each displaying one sprite using applySpriteStyle.

        const spritePath = '/assets/2D Pixel Dungeon Asset Pack/character and tileset/Dungeon_Tileset.png';
        const spriteSheetWidth = 160;
        const spriteSheetHeight = 160;
        const spriteWidth = 63;
        const spriteHeight = 47;
        const spriteX = 97;
        const spriteY = 0;

        // Create wrapper element for background
        // Background should end at the same height as side walls (MAP_HEIGHT - PLAYER_SIZE)
        // to match where bottom wall starts
        const backgroundHeight = MAP_HEIGHT - PLAYER_SIZE;
        this.backgroundElement = document.createElement('div');
        this.backgroundElement.style.position = 'absolute';
        this.backgroundElement.style.top = '0';
        this.backgroundElement.style.left = '0';
        this.backgroundElement.style.width = `${MAP_WIDTH}px`;
        this.backgroundElement.style.height = `${backgroundHeight}px`;
        this.backgroundElement.style.zIndex = '-1';
        this.backgroundElement.style.overflow = 'hidden';

        // Create background tiles using multiple small elements
        // Calculate how many tiles are needed
        const tilesX = Math.ceil(MAP_WIDTH / spriteWidth);
        const tilesY = Math.ceil(backgroundHeight / spriteHeight);

        // Create tiles
        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                const tile = document.createElement('div');
                tile.style.position = 'absolute';
                tile.style.left = `${x * spriteWidth}px`;
                tile.style.top = `${y * spriteHeight}px`;
                tile.style.width = `${spriteWidth}px`;
                tile.style.height = `${spriteHeight}px`;

                // Use applySpriteStyle to display the sprite
                applySpriteStyle(
                    tile,
                    spritePath,
                    spriteX,
                    spriteY,
                    spriteWidth,
                    spriteHeight,
                    spriteWidth,
                    spriteHeight,
                    spriteSheetWidth,
                    spriteSheetHeight
                );

                this.backgroundElement.appendChild(tile);
            }
        }

        // Insert background before other elements
        this.world.appendChild(this.backgroundElement);

        // Create walls using wall textures
        this.createWalls();

        // Score element
        this.scoreBoard = document.getElementById('score-board');
        this.fpsCounter = document.getElementById('fps-counter');
        this.hudHpFill = document.getElementById('hud-hp-bar-fill');
        this.hudHpText = document.getElementById('hud-hp-text');
        this.livesDisplay = document.getElementById('lives-display');
        this.deathScreen = document.getElementById('death-screen');
        this.hud = document.getElementById('hud');
        this.timerDisplay = document.getElementById('timer');

        // FPS Logic
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
    }

    createWalls() {
        // Wall texture paths
        const wallTopBotPath = '/assets/2D Pixel Dungeon Asset Pack/character and tileset/walltopbot.png';
        const wallSidePath = '/assets/2D Pixel Dungeon Asset Pack/character and tileset/wallside.png';

        // Wall dimensions
        const wallTopBotWidth = 466;
        const wallTopBotHeight = 49;
        const wallSideWidth = 50;
        const wallSideHeight = 503;

        // Create top wall
        // Position it so it covers the wall area where players cannot move
        const topWall = document.createElement('div');
        topWall.style.position = 'absolute';
        topWall.style.top = '0';
        topWall.style.left = '0';
        topWall.style.width = `${MAP_WIDTH}px`;
        topWall.style.height = `${wallTopBotHeight}px`;
        topWall.style.backgroundImage = `url("${wallTopBotPath}")`;
        topWall.style.backgroundRepeat = 'repeat-x';
        topWall.style.backgroundSize = 'auto';
        topWall.style.zIndex = '1'; // Above background, below game entities
        this.world.appendChild(topWall);

        // Create bottom wall
        // Position it so player can move up to it (player stops at MAP_HEIGHT - WALL_TOP_BOT_HEIGHT - PLAYER_SIZE)
        // Wall positioned visually where it looks good
        const bottomWallStartY = MAP_HEIGHT - wallTopBotHeight - PLAYER_SIZE;
        const bottomWall = document.createElement('div');
        bottomWall.style.position = 'absolute';
        bottomWall.style.top = `${bottomWallStartY}px`;
        bottomWall.style.left = '0';
        bottomWall.style.width = `${MAP_WIDTH}px`;
        bottomWall.style.height = `${wallTopBotHeight}px`;
        bottomWall.style.backgroundImage = `url("${wallTopBotPath}")`;
        bottomWall.style.backgroundRepeat = 'repeat-x';
        bottomWall.style.backgroundSize = 'auto';
        bottomWall.style.zIndex = '1';
        this.world.appendChild(bottomWall);

        // Create left wall
        // Position it so it covers the wall area where players cannot move
        // Height should match bottom wall's bottom edge
        // Bottom wall ends at: bottomWallStartY + wallTopBotHeight = MAP_HEIGHT - wallTopBotHeight - PLAYER_SIZE + wallTopBotHeight = MAP_HEIGHT - PLAYER_SIZE
        const sideWallHeight = MAP_HEIGHT - PLAYER_SIZE;
        const leftWall = document.createElement('div');
        leftWall.style.position = 'absolute';
        leftWall.style.top = '0';
        leftWall.style.left = '0';
        leftWall.style.width = `${wallSideWidth}px`;
        leftWall.style.height = `${sideWallHeight}px`;
        leftWall.style.backgroundImage = `url("${wallSidePath}")`;
        leftWall.style.backgroundRepeat = 'repeat-y';
        leftWall.style.backgroundSize = 'auto';
        leftWall.style.zIndex = '1';
        this.world.appendChild(leftWall);

        // Create right wall
        // Position it at the right edge, covering the wall area
        // Height should match bottom wall's bottom edge
        const rightWall = document.createElement('div');
        rightWall.style.position = 'absolute';
        rightWall.style.top = '0';
        rightWall.style.left = `${MAP_WIDTH - wallSideWidth}px`;
        rightWall.style.width = `${wallSideWidth}px`;
        rightWall.style.height = `${sideWallHeight}px`;
        rightWall.style.backgroundImage = `url("${wallSidePath}")`;
        rightWall.style.backgroundRepeat = 'repeat-y';
        rightWall.style.backgroundSize = 'auto';
        rightWall.style.zIndex = '1';
        this.world.appendChild(rightWall);
    }

    render(gameState, playerId) {
        const now = performance.now();

        // FPS Calculation
        this.frameCount++;
        if (now - this.lastFpsUpdate >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
            if (this.fpsCounter) this.fpsCounter.innerText = `FPS: ${fps}`;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }

        // Track which IDs we've seen this frame to handle removals
        const seenIds = new Set();
        let myPlayer = null;

        if (!gameState || !gameState.entities) return;

        for (const [id, entity] of Object.entries(gameState.entities)) {
            if (!entity) continue;
            seenIds.add(id);

            // Identify local player
            if (id === playerId) {
                myPlayer = entity;
            }

            let el = this.elements.get(id);

            // Create if not exists
            if (!el) {
                el = document.createElement('div');
                el.classList.add('game-entity');
                el.classList.add(entity.type); // e.g., 'player', 'bullet', 'enemy'

                // Add specific styles or content based on type
                if (entity.type === 'player') {
                    el.style.width = '32px';
                    el.style.height = '32px';
                    // Initial set, will be updated in loop for animation
                    el.style.backgroundImage = `url("/${ASSETS.PLAYER_IDLE[0]}")`;
                    el.style.backgroundSize = 'contain';
                    el.style.backgroundRepeat = 'no-repeat';
                    el.style.imageRendering = 'pixelated'; // Keep pixel art sharp
                    el.style.zIndex = '2'; // Above walls (walls are z-index: 1)

                    // Optional: add name tag
                    const nameTag = document.createElement('div');
                    nameTag.innerText = entity.username || 'Player';
                    nameTag.style.position = 'absolute';
                    nameTag.style.top = '-20px';
                    nameTag.style.left = '50%';
                    nameTag.style.transform = 'translateX(-50%)';
                    nameTag.style.color = 'white';
                    nameTag.style.fontSize = '12px';
                    nameTag.style.whiteSpace = 'nowrap';
                    nameTag.style.zIndex = '3'; // Above player element
                    nameTag.style.pointerEvents = 'none'; // Don't block clicks
                    el.appendChild(nameTag);
                } else if (entity.type === 'bullet') {
                    el.style.width = '24px';
                    el.style.height = '24px';
                    el.style.backgroundImage = 'url("/assets/custom/fireball.png")';
                    el.style.backgroundSize = 'contain';
                    el.style.backgroundRepeat = 'no-repeat';
                    el.style.imageRendering = 'pixelated';
                } else if (entity.type === 'enemy') {
                    // Use server-provided size, or fallback to default 32
                    const size = entity.width || 32;
                    el.style.width = `${size}px`;
                    el.style.height = `${size}px`;
                    el.style.zIndex = '2'; // Above walls (walls are z-index: 1)

                    // Use subtype if available, else default to SKELETON1
                    const subtype = entity.subtype || 'SKELETON1';
                    const assetPath = ASSETS.ENEMIES[subtype] || ASSETS.ENEMIES['SKELETON1'];

                    el.style.backgroundImage = `url("/${assetPath}")`;
                    // 'auto 100%' scales the sprite sheet so the frame height matches the div height (size)
                    // The frame width is assumed to be equal to frame height (square sprites)
                    el.style.backgroundSize = 'auto 100%';
                    el.style.backgroundRepeat = 'no-repeat';
                    el.style.imageRendering = 'pixelated';

                    // Add HP Bar
                    const hpBg = document.createElement('div');
                    hpBg.classList.add('world-hp-bar-bg');
                    hpBg.style.zIndex = '3'; // Above enemy element
                    hpBg.style.pointerEvents = 'none'; // Don't block clicks
                    const hpFill = document.createElement('div');
                    hpFill.classList.add('world-hp-bar-fill');
                    hpBg.appendChild(hpFill);
                    el.appendChild(hpBg);
                } else if (entity.type === 'item') {
                    el.style.width = `${entity.width}px`;
                    el.style.height = `${entity.height}px`;
                    el.style.zIndex = '1';
                }

                this.world.appendChild(el);
                this.elements.set(id, el);
            }

            // Update Animation
            const time = Date.now();
            if (entity.type === 'player') {
                // Ensure player element has correct z-index
                el.style.zIndex = '2'; // Above walls (walls are z-index: 1)

                if (entity.isDead) {
                    // Show skull and hide normal sprite
                    el.style.backgroundImage = 'url("/assets/custom/skull.png")';
                    el.style.backgroundSize = 'contain';
                    el.style.backgroundRepeat = 'no-repeat';
                    el.style.backgroundColor = 'transparent';
                    el.innerHTML = ''; // Clear text emoji

                    // Add back name tag if it was removed or if we need to restore it
                    if (!el.querySelector('.name-tag')) {
                        const nameTag = document.createElement('div');
                        nameTag.classList.add('name-tag');
                        nameTag.innerText = entity.username || 'Player';
                        nameTag.style.position = 'absolute';
                        nameTag.style.top = '-20px';
                        nameTag.style.left = '50%';
                        nameTag.style.transform = 'translateX(-50%)';
                        nameTag.style.color = 'white';
                        nameTag.style.fontSize = '12px';
                        nameTag.style.whiteSpace = 'nowrap';
                        nameTag.style.zIndex = '3'; // Above player element
                        nameTag.style.pointerEvents = 'none'; // Don't block clicks
                        el.appendChild(nameTag);
                    }
                } else {
                    // Normal animation
                    const frameRate = 200;
                    const frameIndex = Math.floor(time / frameRate) % ASSETS.PLAYER_IDLE.length;
                    el.style.backgroundImage = `url("/${ASSETS.PLAYER_IDLE[frameIndex]}")`;
                    el.innerHTML = ''; // Clear skull if it was there

                    // Add back name tag
                    if (!el.querySelector('.name-tag')) {
                        const nameTag = document.createElement('div');
                        nameTag.classList.add('name-tag');
                        nameTag.innerText = entity.username || 'Player';
                        nameTag.style.position = 'absolute';
                        nameTag.style.top = '-20px';
                        nameTag.style.left = '50%';
                        nameTag.style.transform = 'translateX(-50%)';
                        nameTag.style.color = 'white';
                        nameTag.style.fontSize = '12px';
                        nameTag.style.whiteSpace = 'nowrap';
                        nameTag.style.zIndex = '3'; // Above player element
                        nameTag.style.pointerEvents = 'none'; // Don't block clicks
                        el.appendChild(nameTag);
                    }
                }
            } else if (entity.type === 'enemy') {
                // Animate enemies
                const frameRate = 200;
                const frameCount = 4; // Assuming 4 frames
                const frame = Math.floor(time / frameRate) % frameCount;

                // Important: Since we scaled the height to 'size' (e.g. 48px), and aspect ratio is 1:1,
                // the width of one frame is also 'size'.
                const size = entity.width || 32;
                el.style.backgroundPosition = `-${frame * size}px 0`;

                // Update HP Bar Fill
                const hpBg = el.querySelector('.world-hp-bar-bg');
                const hpFill = el.querySelector('.world-hp-bar-fill');
                if (hpBg && hpFill) {
                    // Ensure HP bar has correct z-index
                    hpBg.style.zIndex = '3'; // Above enemy element
                    hpBg.style.pointerEvents = 'none'; // Don't block clicks
                    const pct = Math.max(0, (entity.hp / (entity.maxHp || 1)) * 100);
                    hpFill.style.width = `${pct}%`;
                }
            } else if (entity.type === 'item') {
                el.style.width = `${entity.width}px`;
                el.style.height = `${entity.height}px`;
                el.style.zIndex = '1';

                if (entity.itemType === 'HP_FLASK') {
                    const frames = ASSETS.ITEMS.HP_FLASK;
                    if (frames && frames.length > 0) {
                        const frameRate = 200;
                        const frameIndex = Math.floor(time / frameRate) % frames.length;
                        el.style.backgroundImage = `url("/${frames[frameIndex]}")`;
                        el.style.backgroundSize = 'contain';
                        el.style.backgroundRepeat = 'no-repeat';
                        el.style.imageRendering = 'pixelated';
                    }
                } else if (entity.itemType === 'HEART') {
                    const frames = ASSETS.ITEMS.HEART;
                    if (frames && frames.length > 0) {
                        // Single frame for now
                        el.style.backgroundImage = `url("/${frames[0]}")`;
                        el.style.backgroundSize = 'contain';
                        el.style.backgroundRepeat = 'no-repeat';
                        el.style.imageRendering = 'pixelated';
                    }
                }
            }

            // Update position efficiently
            // Using translate3d for GPU acceleration
            const x = entity.x;
            const y = entity.y;
            const rot = entity.rotation || 0;

            // For sprites that flip, we might want to check direction?
            // For now, simple translation.
            el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}rad)`;
        }

        // Cleanup removed entities
        for (const [id, el] of this.elements) {
            if (!seenIds.has(id)) {
                el.remove();
                this.elements.delete(id);
            }
        }

        // Update Camera - Show entire game area so all players are visible
        // Calculate scale to fit entire map on screen
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        
        // Calculate scale to fit map (with some padding)
        const scaleX = winWidth / MAP_WIDTH;
        const scaleY = winHeight / MAP_HEIGHT;
        const scale = Math.min(scaleX, scaleY) * 0.95; // 95% to add some padding
        
        // Center the map on screen
        const scaledWidth = MAP_WIDTH * scale;
        const scaledHeight = MAP_HEIGHT * scale;
        const offsetX = (winWidth - scaledWidth) / 2;
        const offsetY = (winHeight - scaledHeight) / 2;
        
        // Apply transform to show entire map
        this.world.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;
        this.world.style.transformOrigin = 'top left';

        // Update Score - show all players' scores
        if (this.scoreBoard && gameState.scores) {
            // Build score display using the scores object from server
            // This ensures only active players in the current game are shown
            const playerScores = Object.entries(gameState.scores)
                .map(([id, score]) => {
                    const player = gameState.entities[id];
                    return {
                        id: id,
                        username: player ? player.username : 'Unknown',
                        score: score || 0,
                        isMe: id === playerId,
                        isDead: player ? !!player.isDead : false
                    };
                })
                .sort((a, b) => b.score - a.score); // Sort by score descending

            let scoreHTML = '<div style="font-size: 14px;">';
            playerScores.forEach(p => {
                const deadMarker = p.isDead ? '<img src="/assets/custom/skull.png" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;image-rendering:pixelated;"> ' : '';
                if (p.isMe) {
                    // Highlight logged player's score
                    scoreHTML += `<div style="font-weight: bold; color: #ffd700; font-size: 16px; margin-bottom: 5px;">${deadMarker}YOU: ${p.score} kills</div>`;
                } else {
                    scoreHTML += `<div style="margin-bottom: 3px;">${deadMarker}${p.username}: ${p.score} kills</div>`;
                }
            });
            scoreHTML += '</div>';
            this.scoreBoard.innerHTML = scoreHTML;
        }

        // Update HUD elements if myPlayer exists
        if (myPlayer) {
            // Update HUD HP
            if (this.hudHpFill) {
                const maxHp = myPlayer.maxHp || 100;
                const hp = Math.max(0, myPlayer.hp);
                const pct = (hp / maxHp) * 100;
                this.hudHpFill.style.width = `${pct}%`;

                if (this.hudHpText) {
                    this.hudHpText.innerText = `${Math.ceil(hp)} / ${maxHp}`;
                }
            }

            // Update Lives Display
            if (this.livesDisplay) {
                // Clear existing content
                this.livesDisplay.innerHTML = '';
                
                // Create "Lives: " text node
                const livesLabel = document.createTextNode('Lives: ');
                this.livesDisplay.appendChild(livesLabel);

                // Add heart icons
                const lives = myPlayer.lives || 0;
                if (lives > 0) {
                    for (let i = 0; i < lives; i++) {
                        const heartImg = document.createElement('img');
                        heartImg.src = '/assets/custom/heart.png';
                        heartImg.alt = 'Heart';
                        heartImg.style.width = '24px';
                        heartImg.style.height = '24px';
                        heartImg.style.verticalAlign = 'middle';
                        heartImg.style.marginRight = '2px';
                        heartImg.style.imageRendering = 'pixelated';
                        heartImg.style.display = 'inline-block';
                        this.livesDisplay.appendChild(heartImg);
                    }
                } else {
                    const skullImg = document.createElement('img');
                    skullImg.src = '/assets/custom/skull.png';
                    skullImg.alt = 'Skull';
                    skullImg.style.width = '24px';
                    skullImg.style.height = '24px';
                    skullImg.style.verticalAlign = 'middle';
                    skullImg.style.imageRendering = 'pixelated';
                    skullImg.style.display = 'inline-block';
                    this.livesDisplay.appendChild(skullImg);
                }
            }

            // Update HUD Timer - survival time for local player
            if (this.timerDisplay) {
                const totalSeconds = Math.floor((myPlayer.survivalTime || 0) / 1000);
                const mins = Math.floor(totalSeconds / 60);
                const secs = totalSeconds % 60;
                this.timerDisplay.innerText = `Survival: ${mins}:${secs.toString().padStart(2, '0')}`;
            }

            // Show/Hide Death Screen - only during active gameplay
            if (this.deathScreen && this.hud) {
                // Only show death screen if HUD is visible (game is active)
                const isGameActive = this.hud.style.display !== 'none';
                if (myPlayer.isDead && isGameActive) {
                    this.deathScreen.style.display = 'flex';
                } else {
                    this.deathScreen.style.display = 'none';
                }
            }
        }
    }
}
