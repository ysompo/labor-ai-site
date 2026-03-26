/**
 * AudioEngine — uses real CTG audio samples.
 *
 * Normal heartbeat: loops /audio/ctg-normal.mp3, playback rate adjusted to FHR.
 * Decelerations: plays /audio/decel.mp3 with pitch/rate modifications:
 *   - Mild     (FHR 80–109):  playbackRate 0.95, -1 semitone
 *   - Moderate (FHR 60–79):   playbackRate 0.80, -3 semitones
 *   - Severe   (FHR < 60):    playbackRate 0.65, -6 semitones
 *
 * A decel is triggered when FHR drops ≥30 bpm below baseline.
 */

type DecelLevel = 'mild' | 'moderate' | 'severe';

const NORMAL_RATE_BASE_BPM = 140; // playbackRate=1.0 corresponds to this BPM

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private normalBuffer: AudioBuffer | null = null;
  private decelBuffer: AudioBuffer | null = null;

  private normalNode: AudioBufferSourceNode | null = null;
  private decelNode: AudioBufferSourceNode | null = null;
  private gainNormal: GainNode | null = null;
  private gainDecel: GainNode | null = null;
  private masterGain: GainNode | null = null;

  private isBeeping = false;
  private muted = false;
  private currentFHR = 140;
  private baselineFHR = 140;
  private inDecel = false;
  private decelLevel: DecelLevel | null = null;
  private decelTimeout: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  // ── Public API ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.ctx = new AudioContext();

    // Safari / iOS starts AudioContext suspended — must resume on user gesture
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = this.muted ? 0 : 1;

    this.gainNormal = this.ctx.createGain();
    this.gainNormal.gain.value = 1;
    this.gainNormal.connect(this.masterGain);

    this.gainDecel = this.ctx.createGain();
    this.gainDecel.gain.value = 0;
    this.gainDecel.connect(this.masterGain);

    await Promise.all([
      this.loadBuffer('/audio/ctg-normal.mp3').then(b => { this.normalBuffer = b; }),
      this.loadBuffer('/audio/decel.mp3').then(b => { this.decelBuffer = b; }),
    ]);

    this.initialized = true;
  }

  startBeeping(): void {
    this.isBeeping = true;
    this.startNormalLoop();
  }

  stopBeeping(): void {
    this.isBeeping = false;
    this.stopNormalLoop();
    this.stopDecelSound();
  }

  setFHR(fhr: number): void {
    this.currentFHR = fhr;
    if (!this.isBeeping || !this.ctx || !this.initialized) return;

    const rate = fhr / NORMAL_RATE_BASE_BPM;
    const now  = this.ctx.currentTime;

    // Smooth rate ramp on normal loop
    if (this.normalNode) {
      this.normalNode.playbackRate.cancelScheduledValues(now);
      this.normalNode.playbackRate.setValueAtTime(this.normalNode.playbackRate.value, now);
      this.normalNode.playbackRate.linearRampToValueAtTime(rate, now + 0.2);
    }

    // Keep decel node tracking actual FHR so beats slow correctly
    if (this.decelNode && this.inDecel) {
      this.decelNode.playbackRate.cancelScheduledValues(now);
      this.decelNode.playbackRate.setValueAtTime(this.decelNode.playbackRate.value, now);
      this.decelNode.playbackRate.linearRampToValueAtTime(rate, now + 0.2);
    }

    // Deceleration detection: ≥30 bpm drop from rolling baseline
    const drop = this.baselineFHR - fhr;
    if (drop >= 30) {
      const level = this.classifyDecel(fhr);
      if (!this.inDecel || level !== this.decelLevel) {
        this.triggerDecel(level, fhr);
      }
    } else if (this.inDecel) {
      this.endDecel();
    }

    // Slowly track baseline (only when not in decel)
    if (!this.inDecel) {
      this.baselineFHR = this.baselineFHR * 0.995 + fhr * 0.005;
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.muted ? 0 : 1,
        this.ctx.currentTime + 0.1,
      );
    }
    return this.muted;
  }

  dispose(): void {
    this.stopBeeping();
    this.ctx?.close();
    this.ctx = null;
    this.initialized = false;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async loadBuffer(url: string): Promise<AudioBuffer> {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    return this.ctx!.decodeAudioData(arrayBuffer);
  }

  private startNormalLoop(): void {
    if (!this.ctx || !this.normalBuffer || !this.gainNormal) return;
    this.stopNormalLoop();
    const node = this.ctx.createBufferSource();
    node.buffer = this.normalBuffer;
    node.loop = true;
    node.playbackRate.value = this.currentFHR / NORMAL_RATE_BASE_BPM;
    node.connect(this.gainNormal);
    node.start();
    this.normalNode = node;
  }

  private stopNormalLoop(): void {
    try { this.normalNode?.stop(); } catch { /* already stopped */ }
    this.normalNode = null;
  }

  private classifyDecel(fhr: number): DecelLevel {
    if (fhr < 60) return 'severe';
    if (fhr < 80) return 'moderate';
    return 'mild';
  }

  private triggerDecel(level: DecelLevel, fhr: number): void {
    if (!this.ctx || !this.decelBuffer || !this.gainNormal || !this.gainDecel) return;

    this.inDecel = true;
    this.decelLevel = level;

    // Crossfade: duck normal, bring up decel with boosted gain
    const now = this.ctx.currentTime;
    this.gainNormal.gain.cancelScheduledValues(now);
    this.gainNormal.gain.setValueAtTime(this.gainNormal.gain.value, now);
    this.gainDecel.gain.cancelScheduledValues(now);
    this.gainDecel.gain.setValueAtTime(this.gainDecel.gain.value, now);
    const decelGain = level === 'severe' ? 3.5 : level === 'moderate' ? 2.8 : 2.0;
    this.gainNormal.gain.linearRampToValueAtTime(0.0,       now + 0.3);
    this.gainDecel.gain.linearRampToValueAtTime(decelGain,  now + 0.3);

    try { this.decelNode?.stop(); } catch { /* ok */ }

    const node = this.ctx.createBufferSource();
    node.buffer = this.decelBuffer;
    node.loop = true;

    // Use actual FHR to set rate so beats sound correctly slow
    node.playbackRate.value = fhr / NORMAL_RATE_BASE_BPM;
    // Add detune to give a stressed, lower-pitched quality
    node.detune.value = level === 'severe' ? -600 : level === 'moderate' ? -300 : -100;

    node.connect(this.gainDecel);
    node.start();
    this.decelNode = node;
  }

  private endDecel(): void {
    if (!this.ctx || !this.gainNormal || !this.gainDecel) return;

    this.inDecel = false;
    this.decelLevel = null;

    const now = this.ctx.currentTime;
    this.gainNormal.gain.cancelScheduledValues(now);
    this.gainNormal.gain.setValueAtTime(this.gainNormal.gain.value, now);
    this.gainDecel.gain.cancelScheduledValues(now);
    this.gainDecel.gain.setValueAtTime(this.gainDecel.gain.value, now);
    this.gainNormal.gain.linearRampToValueAtTime(1.0, now + 0.5);
    this.gainDecel.gain.linearRampToValueAtTime(0.0, now + 0.5);

    if (this.decelTimeout) clearTimeout(this.decelTimeout);
    this.decelTimeout = setTimeout(() => {
      try { this.decelNode?.stop(); } catch { /* ok */ }
      this.decelNode = null;
    }, 600);
  }

  private stopDecelSound(): void {
    if (this.decelTimeout) clearTimeout(this.decelTimeout);
    try { this.decelNode?.stop(); } catch { /* ok */ }
    this.decelNode = null;
    this.inDecel = false;
    this.decelLevel = null;
    if (this.gainDecel) this.gainDecel.gain.value = 0;
    if (this.gainNormal) this.gainNormal.gain.value = 1;
  }
}
