export class SoundManager {
    constructor() {
        this.sounds = {};
        this.currentMusic = null;
        this.isMusicMuted = false;
        this.isEffectsMuted = false;

        // Define sound paths
        this.soundAssets = {
            'general': '/assets/sounds/general.mp3',
            'fireball': '/assets/sounds/fireball.mp3',
            'death': '/assets/sounds/death.mp3',
            'gameover': '/assets/sounds/gameover.mp3',
            'pickup': '/assets/sounds/pickup.mp3',
            'menu': '/assets/sounds/menu.mp3'
        };

        this.loadSounds();
    }

    loadSounds() {
        for (const [key, path] of Object.entries(this.soundAssets)) {
            const audio = new Audio(path);

            // Configure specific sounds
            if (key === 'general') {
                audio.loop = true;
                audio.volume = 0.15; // Lower volume for background music
            } else if (key === 'fireball') {
                audio.volume = 0.4;
            } else if (key === 'pickup') {
                audio.volume = 0.8;
            } else if (key === 'menu') {
                audio.volume = 0.5;
            } else {
                audio.volume = 0.6;
            }

            this.sounds[key] = audio;
        }
    }

    play(name) {
        // Effects mute check
        if (this.isEffectsMuted || !this.sounds[name]) return;

        // Don't play music via play(), use playMusic()
        if (name === 'general') return;

        // Clone node for overlapping sound effects
        const sound = this.sounds[name].cloneNode();
        sound.volume = this.sounds[name].volume;
        sound.play().catch(e => console.log('Audio play failed:', e));
    }

    playMusic(name) {
        // Music mute check
        if (this.isMusicMuted || !this.sounds[name]) return;

        // Stop current music if playing
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
        }

        const music = this.sounds[name];
        music.play().catch(e => console.log('Music play failed:', e));
        this.currentMusic = music;
    }

    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
            this.currentMusic = null;
        }
    }

    toggleMusicMute() {
        this.isMusicMuted = !this.isMusicMuted;

        if (this.isMusicMuted) {
            this.stopMusic();
        } else {
            // Restart music if we are in a state where it should be playing
            // For now, assuming 'general' is the main track to resume if enabled
            this.playMusic('general');
        }
    }

    toggleEffectsMute() {
        this.isEffectsMuted = !this.isEffectsMuted;
    }
}
