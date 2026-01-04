# Dungeon Dom

**A fast-paced, pixel-art co-op multiplayer dungeon shooter.**

Built using purely **DOM (Document Object Model) elements** for rendering, proving that you don't need a Canvas to make chaos happen.

## 🕹️ Game Mechanics

- **Multiplayer Mayhem**: Support for 2-4 players in real-time.
- **Rules & Objective**:
- **Duration**: The game lasts exactly **2 minutes**.
- **Winning**: The player with the **most kills** wins.
- **Tie-Breaker**: In case of a tie, the player with the **longest survival time** wins.
- **Lives**: Start with **3 lives**. If you lose them all, you are eliminated and become a **spectator**.
- **Combat**: Shoot fireballs to defeat skeletons & vampires.
- **Survival**: Collect HP Flasks to heal and Hearts to gain extra lives.
- **Atmosphere**: Immerse yourself with pixel-art visuals and a complete soundscape (music, effects, and dynamic events).

## ⚠️ Browser Recommendation

> [!IMPORTANT]
> **Please test this game on Google Chrome, if possible.**
>
> According to our internal playtests, Chrome ensures the most stable performance for our intense DOM-based rendering engine.

## Tech Features

- **Zero Canvas Rendering**: entirely built using HTML `div` elements and CSS transforms for a retro feel and technical challenge.
- **Real-time Multiplayer**: Powered by **Socket.io** for low-latency state synchronization.
- **Authoritative Server**: Node.js backend manages all game logic, collision detection, and state to prevent cheating.
- **Efficient DOM Updates**: usage of `requestAnimationFrame` for smooth 60 FPS rendering without painting the whole screen.
- **Asset Management**: Custom `SoundManager` for audio pooling and optimized asset loading.

## 🚀 Setup & Development

### Prerequisites

- Node.js (v16+)
- npm

### Installation

```bash
npm install
```

### Running the Game

Starts both client and server concurrently:

```bash
npm run dev
```

- **Game URL**: `http://localhost:5173`
- **Controls**:
- **WASD / Arrows**: Move
- **Spacebar**: Shoot Fireball

## 👥 Credits

Made with ❤️, ☕, and a lot of **pixel magic** by **Maria & Oskari**.

Something fun is always brewing in the dungeon!
