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
  private schedNextTime = 0;
  private schedTimer: ReturnType<typeof setTimeout> | null = null;
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

    // Normal heartbeat: synthetic 120ms beep at 880 Hz — no MP3 file needed.
    // Using a file caused: (1) encoder-delay click at loop/sequence boundary,
    // (2) muffled pitch when rate=0.64 at 90 BPM.  The synthetic beat always
    // plays at rate=1.0; tempo is driven by the scheduling interval (60/fhr s).
    this.normalBuffer = this.createSynthBuffer();

    // Only decel.mp3 is loaded from disk
    await this.loadBuffer('/audio/decel.mp3').then(b => { this.decelBuffer = b; });

    this.initialized = true;
  }

  private createSynthBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const dur  = 0.12; // 120 ms per beat
    const buf  = ctx.createBuffer(1, Math.round(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp(-t * 28); // fast exponential decay
      data[i] = Math.sin(2 * Math.PI * 880 * t) * env * 0.85;
    }
    return buf;
  }

  startBeeping(): void {
    this.isBeeping = true;
    this.schedNextTime = this.ctx?.currentTime ?? 0;
    this.schedTick();
  }

  stopBeeping(): void {
    this.isBeeping = false;
    if (this.schedTimer) { clearTimeout(this.schedTimer); this.schedTimer = null; }
    this.normalNode = null; // let current play finish naturally
    this.stopDecelSound();
  }

  setFHR(fhr: number): void {
    this.currentFHR = fhr;
    if (!this.isBeeping || !this.ctx || !this.initialized) return;

    // Normal beat plays at rate=1.0; tempo is driven by schedTick interval (60/fhr).
    // Do NOT update normalNode.playbackRate — that would cause overlap/gap clicks.

    // Deceleration detection: ≥30 bpm drop from rolling baseline
    const drop = this.baselineFHR - fhr;
    if (drop >= 30) {
      const level = this.classifyDecel(fhr);
      if (!this.inDecel || level !== this.decelLevel) {
        this.triggerDecel(level);
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

  private schedTick(): void {
    if (!this.ctx || !this.normalBuffer || !this.gainNormal || !this.isBeeping) {
      this.schedTimer = null;
      return;
    }
    const now   = this.ctx.currentTime;
    const ahead = 0.3;
    while (this.schedNextTime < now + ahead) {
      const t = this.schedNextTime < now ? now : this.schedNextTime;
      const node = this.ctx.createBufferSource();
      node.buffer = this.normalBuffer;
      node.playbackRate.value = 1.0; // always natural pitch
      node.connect(this.gainNormal);
      node.start(t);
      this.normalNode = node;
      // Interval drives tempo: 60/fhr seconds per beat.
      // Do NOT use buffer.duration/rate — would cause overlap/gap when rate changes.
      this.schedNextTime = t + 60 / this.currentFHR;
    }
    this.schedTimer = setTimeout(() => this.schedTick(), 50);
  }

  private classifyDecel(fhr: number): DecelLevel {
    if (fhr < 60) return 'severe';
    if (fhr < 80) return 'moderate';
    return 'mild';
  }

  private triggerDecel(level: DecelLevel): void {
    if (!this.ctx || !this.decelBuffer || !this.gainNormal || !this.gainDecel) return;

    this.inDecel = true;
    this.decelLevel = level;

    // Crossfade: duck normal, bring up decel
    const now = this.ctx.currentTime;
    this.gainNormal.gain.cancelScheduledValues(now);
    this.gainDecel.gain.cancelScheduledValues(now);
    this.gainNormal.gain.linearRampToValueAtTime(0.12, now + 0.3);
    this.gainDecel.gain.linearRampToValueAtTime(1.0,  now + 0.3);

    try { this.decelNode?.stop(); } catch { /* ok */ }

    const node = this.ctx.createBufferSource();
    node.buffer = this.decelBuffer;
    node.loop = true;

    switch (level) {
      case 'mild':
        node.playbackRate.value = 0.95;
        node.detune.value = -100; // -1 semitone
        break;
      case 'moderate':
        node.playbackRate.value = 0.80;
        node.detune.value = -300; // -3 semitones
        break;
      case 'severe':
        node.playbackRate.value = 0.65;
        node.detune.value = -600; // -6 semitones
        break;
    }

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
    this.gainDecel.gain.cancelScheduledValues(now);
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
