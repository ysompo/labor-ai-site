import type { CTGParams, DecelerationType } from '@/lib/simulatorTypes';

const FHR_MIN = 60;
const FHR_MAX = 200;

const VARIABILITY_AMP: Record<string, number> = {
  normal:    10,  // 6–25 bpm range
  reduced:    4,  // 2–5 bpm range (clearly distinct from normal)
  minimal:    1,  // <2 bpm
  absent:   0.4,  // near-flat: trace exists but barely moves (~0.5 bpm)
  saltatory: 25,  // >25 bpm (kept for legacy scenario data)
};

/**
 * Generates a realistic FHR (fetal heart rate) sample at the given simulation
 * time (ms). Returns a BPM value clamped to physiological range [60, 200].
 */
export function generateFHRSample(params: CTGParams, timeMs: number): number {
  const t = timeMs;

  // === SPECIAL PATTERNS ===
  if (params.special === 'sinusoidal') {
    // Regular ~3 cycles/min sine wave, amplitude ±12 bpm
    const freq = 0.000314; // rad/ms ≈ 3 cycles/min
    return clampFHR(params.fhr_baseline + 12 * Math.sin(freq * t));
  }

  // === BASE + VARIABILITY ===
  let fhr = params.special === 'tachycardia'
    ? Math.max(162, params.fhr_baseline)
    : params.fhr_baseline;

  const amp = VARIABILITY_AMP[params.fhr_variability] ?? 10;
  // Band-limited noise — 5 sine components with irrational-ratio frequencies
  // and phase offsets so patterns don't repeat visibly; larger random term.
  fhr += amp * (
    Math.sin(t * 0.00211 + 1.3) * 0.22 +
    Math.sin(t * 0.00537 + 2.5) * 0.20 +
    Math.sin(t * 0.00913 + 0.7) * 0.17 +
    Math.sin(t * 0.01531 + 3.2) * 0.14 +
    Math.sin(t * 0.02389 + 1.8) * 0.11 +
    (Math.random() - 0.5) * 0.64
  );

  // === ACCELERATIONS ===
  if (params.accelerations === 'present') {
    // Randomised timing per cycle (seed from cycle number → not perfectly periodic)
    const basePeriod = 150_000;
    const cycleNum   = Math.floor(t / basePeriod);
    const seed       = (Math.sin(cycleNum * 17.3 + 1.1) + 1) * 0.5; // 0–1
    const offset     = basePeriod * (0.10 + seed * 0.55);            // 10–65% into cycle
    const phase      = t % basePeriod;
    const dur        = 15_000 + seed * 12_000;                       // 15–27 s
    if (phase >= offset && phase < offset + dur) {
      const local = (phase - offset) / dur;
      fhr += (15 + seed * 15) * Math.sin(local * Math.PI);           // 15–30 bpm
    }
  }

  // === DECELERATIONS ===
  fhr += computeDeceleration(params.decelerations, params, t);

  return clampFHR(fhr);
}

function computeDeceleration(type: DecelerationType, params: CTGParams, timeMs: number): number {
  if (type === 'none') return 0;

  const periodMs = (10 * 60_000) / params.contraction_frequency;
  const phase = (timeMs % periodMs) / periodMs; // 0–1
  const depth = params.deceleration_depth ?? 30;

  switch (type) {
    case 'early': {
      // Smooth mirror of contraction — symmetric bell curve centered at 0.5
      return -depth * Math.exp(-((phase - 0.5) ** 2) / (2 * 0.1 ** 2));
    }

    case 'variable_mild':
      return applyVariableDecel(phase, 20, timeMs, periodMs);

    case 'variable_moderate':
      return applyVariableDecel(phase, depth, timeMs, periodMs);

    case 'variable_severe': {
      const severePeriodMs = 150_000;
      const severePhase = (timeMs % severePeriodMs) / severePeriodMs;
      return applyVariableDecel(severePhase, Math.max(depth, 60), timeMs, severePeriodMs);
    }

    case 'late': {
      // Delayed onset — starts after contraction peak (phase 0.55), recovers by 0.88
      if (phase < 0.55 || phase > 0.88) return 0;
      const local = (phase - 0.55) / 0.33;
      return -depth * Math.sin(local * Math.PI);
    }

    case 'prolonged': {
      // Long-lasting drop every 4 contraction cycles
      const longPeriod = periodMs * 4;
      const longPhase = (timeMs % longPeriod) / longPeriod;
      if (longPhase < 0.12) return -65;
      if (longPhase < 0.22) return -65 * (1 - (longPhase - 0.12) / 0.10);
      return 0;
    }

    default:
      return 0;
  }
}

// Sharp V-shape variable deceleration with per-cycle timing jitter
function applyVariableDecel(phase: number, depth: number, timeMs: number, periodMs: number): number {
  const cycleNum  = Math.floor(timeMs / periodMs);
  const seed      = (Math.sin(cycleNum * 11.3) + 1) * 0.5; // 0–1 per cycle
  const jitter    = (seed - 0.5) * 0.10;  // ±5% of period shift
  const winStart  = 0.28 + jitter;
  const winEnd    = 0.58 + jitter;
  if (phase < winStart || phase > winEnd) return 0;
  const local = (phase - winStart) / (winEnd - winStart);
  const nadir = local < 0.4 ? local / 0.4 : 1 - (local - 0.4) / 0.6;
  return -depth * nadir;
}

function clampFHR(value: number, min = FHR_MIN, max = FHR_MAX): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

/**
 * Generates a uterine contraction (toco) pressure sample.
 * Returns a value 0–100 mmHg using a Gaussian bell curve for each contraction.
 */
export function generateTocoSample(
  frequency: number,
  intensity: 'mild' | 'moderate' | 'strong',
  timeMs: number
): number {
  // Resting uterine tone — flat low baseline with minor noise
  const baseline = 8 + (Math.random() - 0.5) * 2;

  if (frequency === 0) return Math.round(Math.max(0, baseline));

  const periodMs  = (10 * 60_000) / frequency;
  const phase     = (timeMs % periodMs) / periodMs; // 0–1 within one cycle
  const peakAmp   = { mild: 15, moderate: 25, strong: 35 }[intensity] ?? 25; // halved

  // sigmaMs = 3 750 ms → narrower contraction width
  const sigmaMs   = 3_750;
  const sigmaFrac = sigmaMs / periodMs;

  // Per-cycle randomness: vary peak position and amplitude so contractions aren't identical
  const cycleNum  = Math.floor(timeMs / periodMs);
  const seed1     = (Math.sin(cycleNum * 13.7) + 1) * 0.5;      // 0–1
  const seed2     = (Math.sin(cycleNum * 7.3 + 1.1) + 1) * 0.5; // 0–1
  const peakPos   = 0.42 + seed1 * 0.16;   // 42–58% of cycle
  const ampFactor = 0.85 + seed2 * 0.30;   // ±15% amplitude variation

  const gaussian = peakAmp * ampFactor * Math.exp(-((phase - peakPos) ** 2) / (2 * sigmaFrac ** 2));

  const noiseScale = 1 - Math.min(0.85, gaussian / (peakAmp * ampFactor));
  const noise = (Math.random() - 0.5) * 4 * noiseScale;

  return Math.round(Math.max(0, gaussian + baseline + noise));
}
