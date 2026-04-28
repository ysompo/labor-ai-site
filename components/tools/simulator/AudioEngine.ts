/**
 * AudioEngine — scheduled beat playback with sequential buffer tracking.
 *
 * Tempo is controlled by the interval between scheduled beats (rate=1.0 always).
 * During decelerations a slight pitch drop is applied on top of the slower tempo.
 * The buffer position advances sequentially each beat so audio flows naturally.
 * A short fade-in/out on each beat eliminates gap clicks.
 *
 * Baseline FHR seeded from first setFHR() call received.
 */

const SCHEDULE_AHEAD        = 0.15;        // seconds to look ahead when scheduling
const SCHEDULER_TICK_MS     = 25;          // how often the scheduler runs (ms)
const FADE_TIME             = 0.01;        // 10ms fade-in and fade-out per beat
const GAP                   = 0.02;        // 20ms silence between beats (masked by fades)
const RECORDING_BPM         = 152;         // native BPM of the ctg-normal.mp3 recording
const RECORDING_BEAT_INTERVAL = 60 / RECORDING_BPM; // ~0.3947s — one beat in the recording

export class AudioEngine {
  constructor(private files: { normal?: string } = {}) {}

  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private gainNode: GainNode | null = null;

  private isBeeping = false;
  private pendingStart = false; // startBeeping() called before initialize() finished
  private muted = false;
  private currentFHR = 140;
  private baselineFHR = 140;
  private baselineSeeded = false;
  private initialized = false;

  private nextBeatTime  = 0;
  private bufferPos     = 0; // sequential position through the recording
  private schedulerTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.ctx = new AudioContext();

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = this.muted ? 0 : 1;
    this.gainNode.connect(this.ctx.destination);

    const url = this.files.normal ?? '/audio/ctg-normal.mp3';
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(arrayBuffer);

    this.initialized = true;
    if (this.pendingStart) {
      this.pendingStart = false;
      this.startBeeping();
    }
  }

  startBeeping(): void {
    if (!this.ctx || !this.initialized) {
      this.pendingStart = true; // will auto-start when initialize() completes
      return;
    }
    this.isBeeping = true;
    this.bufferPos    = 0;
    this.nextBeatTime = this.ctx.currentTime;
    this.runScheduler();
  }

  stopBeeping(): void {
    this.isBeeping = false;
    this.pendingStart = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  setFHR(fhr: number): void {
    if (fhr <= 0 || !isFinite(fhr)) return;
    this.currentFHR = fhr;

    if (!this.baselineSeeded) {
      this.baselineFHR = fhr;
      this.baselineSeeded = true;
    }

    if (!this.isInDecel(fhr)) {
      this.baselineFHR = this.baselineFHR * 0.995 + fhr * 0.005;
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.linearRampToValueAtTime(
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
    this.baselineSeeded = false;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private isInDecel(fhr: number): boolean {
    return (this.baselineFHR - fhr) >= 30;
  }

  private runScheduler(): void {
    if (!this.isBeeping || !this.ctx) return;

    const now = this.ctx.currentTime;
    while (this.nextBeatTime < now + SCHEDULE_AHEAD) {
      // ±5 bpm jitter for natural beat-to-beat variability
      const jitter = (Math.random() - 0.5) * 10;
      const fhr = Math.max(30, this.currentFHR + jitter);
      const interval    = 60 / fhr;
      // Cap beat duration to the recording's native beat length so we never overlap into the next beat
      const beatDuration = Math.min(
        RECORDING_BEAT_INTERVAL - GAP,
        Math.max(FADE_TIME * 3, interval - GAP),
      );

      this.scheduleBeat(this.nextBeatTime, beatDuration);

      // Advance buffer by the recording's native beat interval, not by the desired FHR interval.
      // This keeps the read position phase-locked to actual beat boundaries in the recording.
      this.bufferPos += RECORDING_BEAT_INTERVAL;
      if (this.buffer && this.bufferPos + RECORDING_BEAT_INTERVAL > this.buffer.duration) {
        this.bufferPos = 0; // wrap around
      }

      this.nextBeatTime += interval;
    }

    this.schedulerTimer = setTimeout(() => this.runScheduler(), SCHEDULER_TICK_MS);
  }

  private scheduleBeat(time: number, duration: number): void {
    if (!this.ctx || !this.buffer || !this.gainNode) return;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(1, time + FADE_TIME);
    env.gain.setValueAtTime(1, time + duration - FADE_TIME);
    env.gain.linearRampToValueAtTime(0, time + duration);
    env.connect(this.gainNode);

    // During decel: slight pitch drop (0.80) adds a tonal cue on top of the tempo slowdown
    const inDecel = this.isInDecel(this.currentFHR);
    const drop    = Math.max(0, this.baselineFHR - this.currentFHR);
    const pitch   = inDecel ? Math.max(0.75, 1 - (drop / this.baselineFHR) * 0.8) : 1.0;

    const node = this.ctx.createBufferSource();
    node.buffer = this.buffer;
    node.playbackRate.value = pitch;
    node.connect(env);
    node.onended = () => env.disconnect(); // prevent GainNode accumulation in audio graph
    node.start(time, this.bufferPos, duration);
  }
}
