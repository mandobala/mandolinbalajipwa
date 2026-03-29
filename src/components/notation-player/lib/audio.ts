import { SRUTHI_FREQUENCIES } from '../types';

class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private async init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.connect(this.audioCtx.destination);
      this.masterGain.gain.value = 0.5;
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  public async resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  // Must be called synchronously within a user gesture (e.g. click handler) to
  // unlock audio on iOS, which requires AudioContext creation + resume() to happen
  // in the synchronous call stack of the gesture — before any await.
  public unlock(): void {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.connect(this.audioCtx.destination);
      this.masterGain.gain.value = 0.5;
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
  }

  public async playNote(semitones: number, sruthi: string, duration: number) {
    await this.init();
    if (!this.audioCtx || !this.masterGain) return;

    const baseFreq = SRUTHI_FREQUENCIES[sruthi] || 277.18;
    const freq = baseFreq * Math.pow(2, semitones / 12);

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

    gain.gain.setValueAtTime(0.6, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  }

  public async playClick(duration: number = 0.1) {
    await this.init();
    if (!this.audioCtx || !this.masterGain) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);

    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  }

  public close() {
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

export const audioEngine = new AudioEngine();
