/**
 * Sprite Sheet Utility Functions
 * 
 * This file helps use parts of sprite sheets without a separate image editor.
 * Uses CSS background-position technique.
 */

/**
 * Creates CSS styles for a sprite sheet part
 * 
 * @param {string} spriteSheetPath - Path to sprite sheet image
 * @param {number} x - X coordinate in sprite sheet (in pixels)
 * @param {number} y - Y coordinate in sprite sheet (in pixels)
 * @param {number} width - Sprite width (in pixels)
 * @param {number} height - Sprite height (in pixels)
 * @param {number} displayWidth - Display width (in pixels, can be different from sprite width)
 * @param {number} displayHeight - Display height (in pixels, can be different from sprite height)
 * @returns {Object} CSS styles as an object
 */
export function getSpriteStyle(spriteSheetPath, x, y, width, height, displayWidth = null, displayHeight = null, spriteSheetWidth = null, spriteSheetHeight = null) {
    const displayW = displayWidth || width;
    const displayH = displayHeight || height;
    
    // background-size must be the sprite sheet size for background-position to work correctly
    // If sprite sheet size is not provided, use 'auto' (doesn't work in all cases)
    let bgSize = 'auto';
    if (spriteSheetWidth && spriteSheetHeight) {
        bgSize = `${spriteSheetWidth}px ${spriteSheetHeight}px`;
    }
    
    return {
        backgroundImage: `url("${spriteSheetPath}")`,
        backgroundPosition: `-${x}px -${y}px`,
        backgroundSize: bgSize,
        backgroundRepeat: 'no-repeat',
        width: `${displayW}px`,
        height: `${displayH}px`,
        imageRendering: 'pixelated' // Keeps pixel art style sharp
    };
}

/**
 * Applies sprite styles to an element
 * 
 * @param {HTMLElement} element - DOM element to apply styles to
 * @param {string} spriteSheetPath - Path to sprite sheet image
 * @param {number} x - X coordinate in sprite sheet
 * @param {number} y - Y coordinate in sprite sheet
 * @param {number} width - Sprite width
 * @param {number} height - Sprite height
 * @param {number} displayWidth - Display width (optional)
 * @param {number} displayHeight - Display height (optional)
 */
export function applySpriteStyle(element, spriteSheetPath, x, y, width, height, displayWidth = null, displayHeight = null, spriteSheetWidth = null, spriteSheetHeight = null) {
    const styles = getSpriteStyle(spriteSheetPath, x, y, width, height, displayWidth, displayHeight, spriteSheetWidth, spriteSheetHeight);
    Object.assign(element.style, styles);
}

/**
 * Example: Using Dungeon_Tileset.png sprite sheet
 * 
 * If sprite sheet is e.g. 512x512 pixels and you want to use a 32x32 sprite
 * at position (128, 64):
 * 
 * const spritePath = '/assets/2D Pixel Dungeon Asset Pack/character and tileset/Dungeon_Tileset.png';
 * const styles = getSpriteStyle(spritePath, 128, 64, 32, 32);
 * 
 * Or directly to an element:
 * applySpriteStyle(element, spritePath, 128, 64, 32, 32);
 */

/**
 * Helper: Creates sprite sheet coordinates in grid format
 * If sprite sheet is arranged in a grid (e.g. 16x16 grid, each sprite 32x32)
 * 
 * @param {number} gridX - Grid X coordinate (0-based)
 * @param {number} gridY - Grid Y coordinate (0-based)
 * @param {number} spriteWidth - Width of one sprite
 * @param {number} spriteHeight - Height of one sprite
 * @returns {Object} {x, y} coordinates in sprite sheet
 */
export function gridToSpriteCoords(gridX, gridY, spriteWidth, spriteHeight) {
    return {
        x: gridX * spriteWidth,
        y: gridY * spriteHeight
    };
}

/**
 * Usage examples:
 * 
 * // Example 1: Sprite from top right (63x47 pixels, sheet 160x160)
 * // X = 160 - 63 = 97, Y = 0
 * const spritePath = '/assets/2D Pixel Dungeon Asset Pack/character and tileset/Dungeon_Tileset.png';
 * applySpriteStyle(element, spritePath, 97, 0, 63, 47);
 * 
 * // Example 2: If sprite sheet is 16x16 grid, each sprite 32x32
 * const coords = gridToSpriteCoords(2, 3, 32, 32); // 3rd column, 4th row
 * // coords = { x: 64, y: 96 }
 * applySpriteStyle(element, spritePath, coords.x, coords.y, 32, 32);
 */

