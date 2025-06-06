export class AudioManager {
  constructor() {
    this.audioContext = null;
    this.sounds = {};
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await this.loadSounds();
    this.isInitialized = true;
  }

  async loadSounds() {
    const soundFiles = {
      engine: '/audio/engine.flac',
      tires: '/audio/tires.flac',
      skidding: '/audio/skidding.flac',
      collision: '/audio/collision.flac',
      suspension: '/audio/suspension.flac'
    };

    for (const [name, path] of Object.entries(soundFiles)) {
      try {
        const response = await fetch(path);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.sounds[name] = {
          buffer: audioBuffer,
          source: null,
          gain: this.audioContext.createGain()
        };
        this.sounds[name].gain.connect(this.audioContext.destination);
      } catch (error) {
        console.error(`Error loading sound ${name}:`, error);
      }
    }
  }

  playSound(name, loop = false) {
    if (!this.isInitialized || !this.sounds[name]) return;
    
    // Stop existing sound if playing
    if (this.sounds[name].source) {
      this.sounds[name].source.stop();
    }

    // Create and configure new source
    const source = this.audioContext.createBufferSource();
    source.buffer = this.sounds[name].buffer;
    source.loop = loop;
    source.connect(this.sounds[name].gain);
    source.start();
    
    this.sounds[name].source = source;
    return source;
  }

  update(carState) {
    if (!this.isInitialized) return;

    // Engine sound
    if (!this.sounds.engine.source || !this.sounds.engine.source.playing) {
      this.playSound('engine', true);
    }
    this.sounds.engine.gain.gain.value = 0.3 + (carState.speed * 0.7);

    // Tire sound
    if (carState.speed > 0.1) {
      if (!this.sounds.tires.source || !this.sounds.tires.source.playing) {
        this.playSound('tires', true);
      }
      this.sounds.tires.gain.gain.value = Math.min(carState.speed * 0.5, 1);
    }

    // Skidding sound
    if (carState.isSkidding) {
      if (!this.sounds.skidding.source || !this.sounds.skidding.source.playing) {
        this.playSound('skidding', true);
      }
    } else if (this.sounds.skidding.source) {
      this.sounds.skidding.source.stop();
    }

    // Suspension sound
    if (carState.isSuspensionActive) {
      this.playSound('suspension');
    }

    // Collision sound
    if (carState.hasCollision) {
      this.playSound('collision');
    }
  }
}