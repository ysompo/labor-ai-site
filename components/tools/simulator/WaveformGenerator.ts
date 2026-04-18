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
    : params.special === 'bradycardia'
    ? Math.min(100, params.fhr_baseline)
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
    // 3 independent slots per 150-second window, each with its own seed
    // so accelerations vary in timing, amplitude, duration, and occurrence
    const basePeriod = 150_000;
    const cycleNum   = Math.floor(t / basePeriod);
    const phase      = t % basePeriod;

    for (let slot = 0; slot < 3; slot++) {
      const s1 = (Math.sin(cycleNum * 17.3 + slot * 5.7 + 1.1) + 1) * 0.5;
      const s2 = (Math.sin(cycleNum * 9.1  + slot * 3.3 + 2.4) + 1) * 0.5;
      const s3 = (Math.sin(cycleNum * 23.7 + slot * 7.1 + 0.6) + 1) * 0.5;

      if (s3 < 0.35) continue; // ~35% chance this slot is skipped

      const slotWidth = basePeriod / 3;
      const offset = slotWidth * slot + slotWidth * (0.05 + s1 * 0.75); // spread across window
      const slotEnd = slotWidth * (slot + 1);
      const dur    = Math.min(10_000 + s2 * 20_000, slotEnd - offset);  // 10–30 s, capped to slot
      const amp    = 10    + s1 * 18;                                   // 10–28 bpm

      if (phase >= offset && phase < offset + dur) {
        const local = (phase - offset) / dur;
        fhr += amp * Math.sin(local * Math.PI);
      }
    }
  }

  // === DECELERATIONS ===
  fhr += computeDeceleration(params.decelerations, params, t);

  return clampFHR(fhr);
}

function computeDeceleration(type: DecelerationType, params: CTGParams, timeMs: number): number {
  if (type === 'none') return 0;

  const periodMs = (10 * 60_000) / params.contraction_frequency;
  const phase    = (timeMs % periodMs) / periodMs; // 0–1
  const depth    = params.deceleration_depth ?? 30;

  // Per-cycle seeds: vary depth, width, timing, and skip some cycles
  const cycleNum = Math.floor(timeMs / periodMs);
  const seedA = (Math.sin(cycleNum * 13.7 + 1.2) + 1) * 0.5; // depth factor
  const seedB = (Math.sin(cycleNum * 8.3  + 3.1) + 1) * 0.5; // width / timing
  const seedC = (Math.sin(cycleNum * 19.1 + 0.8) + 1) * 0.5; // skip roll

  switch (type) {
    case 'early': {
      if (seedC < 0.15) return 0; // skip ~15% of cycles
      const actualDepth  = depth * (0.40 + seedA * 0.60);       // 40–100% of depth
      const center       = 0.44 + seedB * 0.12;                 // 44–56% of cycle
      const sigma        = 0.07 + seedB * 0.06;                 // width variation
      return -actualDepth * Math.exp(-((phase - center) ** 2) / (2 * sigma ** 2));
    }

    case 'variable_mild':
      return applyVariableDecel(phase, 20, timeMs, periodMs, seedA, seedB, seedC, 0.20);

    case 'variable_moderate':
      return applyVariableDecel(phase, depth, timeMs, periodMs, seedA, seedB, seedC, 0.15);

    case 'variable_severe': {
      const severePeriodMs = 150_000;
      const sevCycle = Math.floor(timeMs / severePeriodMs);
      const sA = (Math.sin(sevCycle * 13.7 + 1.2) + 1) * 0.5;
      const sB = (Math.sin(sevCycle * 8.3  + 3.1) + 1) * 0.5;
      const sC = (Math.sin(sevCycle * 19.1 + 0.8) + 1) * 0.5;
      const severePhase = (timeMs % severePeriodMs) / severePeriodMs;
      return applyVariableDecel(severePhase, Math.max(depth, 60), timeMs, severePeriodMs, sA, sB, sC, 0.10);
    }

    case 'late': {
      if (seedC < 0.15) return 0; // skip ~15% of cycles
      const actualDepth  = depth * (0.65 + seedA * 0.60);
      const onset        = 0.50 + seedB * 0.10;                 // 50–60% of cycle
      const winWidth     = 0.28 + seedB * 0.10;                 // total duration
      const end          = onset + winWidth;
      if (phase < onset || phase > end) return 0;
      const local        = (phase - onset) / winWidth;
      const descentFrac  = 0.28;
      const nadirFrac    = 0.22 + seedA * 0.12;                 // flat nadir 22–34%
      const recovStart   = descentFrac + nadirFrac;
      if (local < descentFrac)
        return -actualDepth * (local / descentFrac);
      if (local < recovStart)
        return -actualDepth;
      return -actualDepth * (1 - (local - recovStart) / (1 - recovStart));
    }

    case 'prolonged': {
      const longPeriod = periodMs * 4;
      const longCycle  = Math.floor(timeMs / longPeriod);
      const lA = (Math.sin(longCycle * 13.7 + 1.2) + 1) * 0.5;
      const lB = (Math.sin(longCycle * 8.3  + 3.1) + 1) * 0.5;
      const longPhase  = (timeMs % longPeriod) / longPeriod;
      const actualDepth = 55 + lA * 20;                         // 55–75 bpm drop
      const dropEnd     = 0.08 + lB * 0.08;                     // 8–16% of long cycle
      const recEnd      = dropEnd + 0.08 + lB * 0.06;
      if (longPhase < dropEnd) return -actualDepth;
      if (longPhase < recEnd)  return -actualDepth * (1 - (longPhase - dropEnd) / (recEnd - dropEnd));
      return 0;
    }

    default:
      return 0;
  }
}

// Variable deceleration: descent → flat nadir → recovery
function applyVariableDecel(
  phase: number, depth: number, timeMs: number, periodMs: number,
  seedA: number, seedB: number, seedC: number, skipProb: number,
): number {
  if (seedC < skipProb) return 0; // skip this cycle

  const actualDepth  = depth * (0.40 + seedA * 0.60);          // 40–100% of depth
  const jitter       = (seedB - 0.5) * 0.16;                   // ±8% timing shift
  const winStart     = 0.26 + jitter;
  const winWidth     = 0.28 + seedB * 0.18;                    // 28–46% of cycle (wider)
  const winEnd       = winStart + winWidth;
  const descentFrac  = 0.25 + seedA * 0.15;                    // 25–40% of window: descent
  const nadirFrac    = 0.20 + seedB * 0.15;                    // 20–35% of window: flat nadir
  const recoveryStart = descentFrac + nadirFrac;

  if (phase < winStart || phase > winEnd) return 0;
  const local = (phase - winStart) / winWidth;

  if (local < descentFrac) {
    // Descent
    return -actualDepth * (local / descentFrac);
  } else if (local < recoveryStart) {
    // Flat nadir — stays at lowest point
    return -actualDepth;
  } else {
    // Recovery
    const recovFrac = 1 - recoveryStart;
    return -actualDepth * (1 - (local - recoveryStart) / recovFrac);
  }
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
