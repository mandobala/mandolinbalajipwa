import * as id3 from '/js/id3.js';

class AudioPitchShifter {
  constructor() {
    this.audioCtx = null;
    this.gainNode = null;
    this.soundtouchNode = null;
    this.sourceNode = null;
    this.playing = false;
    this.loading = false;
    this.audioBuffer = null;
    this.startTime = 0;
    this.pausedAt = 0;
    this.audioInitialized = false;
    this.fileTags = {
      title: 'Title',
      artist: 'Artist',
      album: 'Album',
      year: 'Year',
      cover: '/favicon.svg'
    };
    this.tempo = 1.0;
    this.pitch = 1.0;
    this.semitone = 0;
    this.volume = 1.0;
    this.duration = '0:00';
    this.currentTime = '0:00';
    this.progress = 0;

    this.init();
  }

  init() {
    this.bindElements();
    this.bindEvents();
    // Don't setup audio context here - wait for user gesture
  }

  async initializeAudio() {
    if (this.audioInitialized) return;
    
    try {
      await this.setupAudioContext();
      this.audioInitialized = true;
      
      // Hide the start button and show the file input
      const startButton = document.getElementById('start-audio');
      const setupSection = document.getElementById('audio-setup-section');
      const fileInputLabel = document.getElementById('file-input-label');
      
      if (startButton) startButton.style.display = 'none';
      if (setupSection) setupSection.style.display = 'none';
      if (fileInputLabel) fileInputLabel.style.display = 'block';
      
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      this.showError('Failed to initialize audio processing. Please try again.');
    }
  }

  async setupAudioContext() {
    try {
      // Check if Web Audio API is supported
      if (!window.AudioContext && !window.webkitAudioContext) {
        throw new Error('Web Audio API is not supported in this browser');
      }

      // Check if AudioWorklet is supported
      if (!window.AudioWorkletNode) {
        throw new Error('AudioWorklet is not supported in this browser. Please use a modern browser like Chrome 66+, Firefox 76+, or Safari 14.1+');
      }

      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume the context if it's suspended (required for user gesture)
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.connect(this.audioCtx.destination);
      
      // Check if audioWorklet is available on the AudioContext
      if (!this.audioCtx.audioWorklet) {
        throw new Error('AudioWorklet not available on AudioContext. This might be due to browser security restrictions.');
      }
      
      // Register the AudioWorklet
      await this.audioCtx.audioWorklet.addModule('/js/soundtouch-worklet.js');
      this.soundtouchNode = new AudioWorkletNode(this.audioCtx, 'soundtouch-processor');
      this.soundtouchNode.connect(this.gainNode);
      
      // Set initial parameters
      this.updateParameters();
      console.log('AudioWorklet initialized successfully');
      
    } catch (error) {
      console.error('Failed to setup AudioWorklet:', error);
      this.showError(error.message + ' Audio pitch shifting features will not be available.');
    }
  }

  bindElements() {
    this.fileInput = document.getElementById('file-input');
    this.playPauseBtn = document.getElementById('play-pause');
    this.resetBtn = document.getElementById('reset');
    this.volumeSlider = document.getElementById('volume');
    this.semitoneSlider = document.getElementById('semitone');
    this.pitchSlider = document.getElementById('pitch');
    this.tempoSlider = document.getElementById('tempo');
    this.progressFill = document.getElementById('progress-fill');
    this.currentTimeEl = document.getElementById('current-time');
    this.durationEl = document.getElementById('duration');
    this.albumCover = document.getElementById('album-cover');
    this.songTitle = document.getElementById('song-title');
    this.songArtist = document.getElementById('song-artist');
    this.songAlbum = document.getElementById('song-album');
    this.volumeValue = document.getElementById('volume-value');
    this.semitoneValue = document.getElementById('semitone-value');
    this.pitchValue = document.getElementById('pitch-value');
    this.tempoValue = document.getElementById('tempo-value');
  }

  bindEvents() {
    // Start audio button
    const startButton = document.getElementById('start-audio');
    if (startButton) {
      startButton.addEventListener('click', () => this.initializeAudio());
    }

    this.fileInput.addEventListener('change', (e) => this.loadFile(e.target.files[0]));
    this.playPauseBtn.addEventListener('click', () => this.togglePlay());
    this.resetBtn.addEventListener('click', () => this.reset());
    this.volumeSlider.addEventListener('input', (e) => this.changeVolume(e.target.value));
    this.semitoneSlider.addEventListener('input', (e) => this.changeSemitone(e.target.value));
    this.pitchSlider.addEventListener('input', (e) => this.changePitch(e.target.value));
    this.tempoSlider.addEventListener('input', (e) => this.changeTempo(e.target.value));

    // Progress bar click
    document.querySelector('.progress-bar').addEventListener('click', (e) => {
      const rect = e.target.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      this.seek(percent);
    });
  }

  async loadFile(file) {
    if (!file) return;
    this.loading = true;
    this.updateUI();

    // Load metadata
    try {
      const tags = await id3.fromFile(file);
      this.fileTags = {
        title: tags.title || 'Title',
        artist: tags.artist || 'Artist',
        album: tags.album || 'Album',
        year: tags.year || 'Year',
        cover: tags.images && tags.images[0] ? URL.createObjectURL(new Blob([tags.images[0].data])) : '/favicon.svg'
      };
    } catch (error) {
      console.log('ID3 error:', error);
    }

    this.updateMetadata();

    // Load audio
    const reader = new FileReader();
    reader.onload = (e) => this.decodeAudio(e.target.result);
    reader.readAsArrayBuffer(file);
  }

  async decodeAudio(buffer) {
    try {
      this.audioBuffer = await this.audioCtx.decodeAudioData(buffer);
      this.duration = this.formatTime(this.audioBuffer.duration);
      this.loading = false;
      this.updateUI();
    } catch (error) {
      console.error('Failed to decode audio:', error);
      this.loading = false;
      this.updateUI();
    }
  }

  togglePlay() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (!this.audioBuffer) {
      this.showError('No audio file loaded.');
      return;
    }
    
    if (!this.soundtouchNode) {
      this.showError('Audio processing not available. Please refresh the page and try again.');
      return;
    }
    
    // Stop any existing playback
    this.stop();
    
    // Create new source node
    this.sourceNode = this.audioCtx.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    
    // Connect: source -> soundtouch -> gain -> destination
    this.sourceNode.connect(this.soundtouchNode);
    
    // Start playback
    const offset = this.pausedAt;
    this.startTime = this.audioCtx.currentTime - offset;
    this.sourceNode.start(0, offset);
    
    this.playing = true;
    this.updateUI();
    
    // Start progress tracking
    this.trackProgress();
  }

  pause() {
    if (!this.playing) return;
    
    this.pausedAt = this.audioCtx.currentTime - this.startTime;
    this.stop();
  }

  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {
        // Source might already be stopped
      }
      this.sourceNode = null;
    }
    this.playing = false;
    this.updateUI();
  }

  reset() {
    this.pause();
    this.pausedAt = 0;
    this.currentTime = '0:00';
    this.progress = 0;
    this.updateProgress();
  }

  seek(percent) {
    const wasPlaying = this.playing;
    this.pause();
    this.pausedAt = percent * this.audioBuffer.duration;
    this.currentTime = this.formatTime(this.pausedAt);
    this.progress = percent * 100;
    this.updateProgress();
    if (wasPlaying) {
      this.play();
    }
  }

  trackProgress() {
    if (!this.playing) return;
    
    const elapsed = this.audioCtx.currentTime - this.startTime;
    const percent = Math.min(elapsed / this.audioBuffer.duration, 1);
    
    this.currentTime = this.formatTime(elapsed);
    this.progress = percent * 100;
    this.updateProgress();
    
    if (percent >= 1) {
      this.pause();
      this.pausedAt = 0;
    } else {
      requestAnimationFrame(() => this.trackProgress());
    }
  }

  changeVolume(value) {
    this.volume = parseFloat(value);
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
    this.volumeValue.textContent = Math.round(this.volume * 100) + '%';
  }

  changeSemitone(value) {
    this.semitone = parseInt(value);
    if (this.soundtouchNode && this.soundtouchNode.parameters) {
      this.soundtouchNode.parameters.get('pitchSemitones').value = this.semitone;
    }
    this.semitoneValue.textContent = (this.semitone >= 0 ? '+' : '') + this.semitone + ' semitones';
  }

  changePitch(value) {
    this.pitch = parseFloat(value);
    if (this.soundtouchNode && this.soundtouchNode.parameters) {
      this.soundtouchNode.parameters.get('pitch').value = this.pitch;
    }
    const percent = Math.abs(100 - Math.round(this.pitch * 100));
    this.pitchValue.textContent = (this.pitch >= 1 ? '+' : '-') + percent + '%';
  }

  changeTempo(value) {
    this.tempo = parseFloat(value);
    if (this.soundtouchNode && this.soundtouchNode.parameters) {
      this.soundtouchNode.parameters.get('tempo').value = this.tempo;
    }
    const percent = Math.abs(100 - Math.round(this.tempo * 100));
    this.tempoValue.textContent = (this.tempo >= 1 ? '+' : '-') + percent + '%';
  }

  updateParameters() {
    if (this.soundtouchNode && this.soundtouchNode.parameters) {
      this.soundtouchNode.parameters.get('pitch').value = this.pitch;
      this.soundtouchNode.parameters.get('pitchSemitones').value = this.semitone;
      this.soundtouchNode.parameters.get('tempo').value = this.tempo;
    }
  }

  updateUI() {
    this.playPauseBtn.textContent = this.playing ? 'Pause' : 'Play';
    this.playPauseBtn.disabled = this.loading || !this.audioBuffer;
    this.resetBtn.disabled = this.loading || !this.audioBuffer;
  }

  updateProgress() {
    this.progressFill.style.width = this.progress + '%';
    this.currentTimeEl.textContent = this.currentTime;
    this.durationEl.textContent = this.duration;
  }

  updateMetadata() {
    this.albumCover.src = this.fileTags.cover;
    this.songTitle.textContent = this.fileTags.title;
    this.songArtist.textContent = this.fileTags.artist;
    this.songAlbum.textContent = `${this.fileTags.album} (${this.fileTags.year})`;
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  showError(message) {
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff4444;
      color: white;
      padding: 15px 20px;
      border-radius: 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 80%;
      text-align: center;
    `;
    errorDiv.textContent = message;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 5px;
      right: 10px;
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
    `;
    closeBtn.onclick = () => errorDiv.remove();
    errorDiv.appendChild(closeBtn);
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 10000);
  }
}

// Initialize
new AudioPitchShifter();