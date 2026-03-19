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

  if (params.special === 'bradycardia') {
    // Sustained below-90 with minimal variability
    return clampFHR(params.fhr_baseline + (Math.random() - 0.5) * 4, 60, 92);
  }

  // === BASE + VARIABILITY ===
  let fhr = params.special === 'tachycardia'
    ? Math.max(162, params.fhr_baseline)
    : params.fhr_baseline;

  const amp = VARIABILITY_AMP[params.fhr_variability] ?? 10;
  // Band-limited noise using multiple sine waves at different frequencies
  fhr += amp * (
    Math.sin(t * 0.003) * 0.40 +
    Math.sin(t * 0.007) * 0.30 +
    Math.sin(t * 0.013) * 0.20 +
    (Math.random() - 0.5) * 0.30
  );

  // === ACCELERATIONS ===
  if (params.accelerations === 'present') {
    // Periodic bumps every ~150 sec, lasting ~20 sec, +18–26 bpm
    const period = 150_000;
    const phase = t % period;
    if (phase < 20_000) {
      const bump = 18 + Math.random() * 8;
      fhr += bump * Math.sin((phase / 20_000) * Math.PI);
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
      return applyVariableDecel(phase, 20);

    case 'variable_moderate':
      return applyVariableDecel(phase, depth);

    case 'variable_severe': {
      // Fixed ~2.5-min period so decels occur every 2–3 min regardless of contraction freq
      const severePeriodMs = 150_000;
      const severePhase = (timeMs % severePeriodMs) / severePeriodMs;
      return applyVariableDecel(severePhase, Math.max(depth, 60));
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

// Sharp V-shape variable deceleration
function applyVariableDecel(phase: number, depth: number): number {
  if (phase < 0.28 || phase > 0.58) return 0;
  const local = (phase - 0.28) / 0.30; // 0–1 within window
  // V-shape: linearly down to nadir at local=0.4, then linear recovery
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
  const peakAmp   = { mild: 29, moderate: 49, strong: 68 }[intensity] ?? 49;

  // sigmaMs = 15 000 ms → FWHM ≈ 35 s, visible base ≈ 60–90 s at ±2–3σ
  // This matches clinical contractions regardless of frequency.
  const sigmaMs   = 15_000;
  const sigmaFrac = sigmaMs / periodMs;

  const gaussian = peakAmp * Math.exp(-((phase - 0.5) ** 2) / (2 * sigmaFrac ** 2));

  // Noise is high at baseline but suppressed during the contraction peak
  // so the bell shape stays smooth (like real TOCO traces).
  const noiseScale = 1 - Math.min(0.85, gaussian / peakAmp);
  const noise = (Math.random() - 0.5) * 4 * noiseScale;

  return Math.round(Math.max(0, gaussian + baseline + noise));
}
