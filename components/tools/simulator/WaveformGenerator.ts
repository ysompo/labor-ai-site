import type { CTGParams, DecelerationType } from '@/lib/simulatorTypes';

const FHR_MIN = 60;
const FHR_MAX = 200;

const VARIABILITY_AMP: Record<string, number> = {
  normal:    10,  // 6–25 bpm range
  reduced:    4,  // 2–5 bpm range (clearly distinct from normal)
  minimal:  1.6,  // <2 bpm
  absent:   1.0,  // undetectable variability — but a real trace still wanders slightly
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

  // Absent/minimal variability: a real tracing is never a ruler line — the
  // baseline still wanders slowly (±2.5 bpm over several minutes).
  if (params.fhr_variability === 'absent' || params.fhr_variability === 'minimal') {
    fhr += 1.5 * Math.sin(t * 0.000021 + 0.9) + 1.0 * Math.sin(t * 0.0000077 + 2.2);
  }

  // === ACCELERATIONS ===
  // Never draw accelerations during bradycardia — clinically incompatible,
  // regardless of what the scenario data or a live override says.
  const inBradycardia = params.special === 'bradycardia' || fhrBase(params) < 110;
  if (params.accelerations === 'present' && !inBradycardia) {
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
        // Asymmetric envelope: brisk rise (25–45% of duration), rounded top,
        // slower decay back to baseline — real accels are not symmetric bumps.
        const local    = (phase - offset) / dur;
        const riseFrac = 0.25 + s2 * 0.2;
        const envelope = local < riseFrac
          ? Math.sin((Math.PI / 2) * (local / riseFrac))
          : Math.cos((Math.PI / 2) * ((local - riseFrac) / (1 - riseFrac))) ** 1.3;
        fhr += amp * envelope;
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

  // Where this cycle's contraction actually peaks (same seed math as the toco
  // generator) — early decels mirror it, late decels lag behind it.
  const s2c      = (Math.sin(cycleNum * 7.3 + 1.1) + 1) * 0.5;
  const durMs    = Math.min(60_000 + s2c * 30_000, periodMs * 0.85);
  const peakFrac = (0.02 + s2c * 0.11) + (durMs * 0.4) / periodMs;

  switch (type) {
    case 'early': {
      if (seedC < 0.15) return 0; // skip ~15% of cycles
      const actualDepth  = depth * (0.40 + seedA * 0.60);         // 40–100% of depth
      const center       = peakFrac + (seedB - 0.5) * 0.04;       // nadir mirrors contraction peak
      const sigma        = Math.max(0.06, (durMs * 0.22) / periodMs); // width tracks contraction
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
      const onset        = peakFrac + 0.08 + seedB * 0.08;      // begins after the contraction peak
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

// Effective baseline after special-pattern adjustment (used for the
// accelerations-during-bradycardia guard).
function fhrBase(params: CTGParams): number {
  if (params.special === 'bradycardia') return Math.min(100, params.fhr_baseline);
  if (params.special === 'tachycardia') return Math.max(162, params.fhr_baseline);
  return params.fhr_baseline;
}

// Returns an unrounded value — rounding sub-bpm movement away is what turned
// "absent variability" into a ruler-flat line. Consumers round for display.
function clampFHR(value: number, min = FHR_MIN, max = FHR_MAX): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generates a uterine contraction (toco) pressure sample (0–100 mmHg).
 *
 * Realism notes:
 * - Contractions last 60–90 s with a brisk rise and a slower fall (asymmetric
 *   two-sided Gaussian) — not narrow symmetric bells.
 * - Adjacent cycles genuinely overlap (contributions from the previous and
 *   next cycle are summed), so at high frequencies contractions nearly merge.
 * - Tachysystole (≥6 contractions/10 min) also shows an elevated resting tone
 *   (incomplete uterine relaxation) so it is unmistakable on the trace.
 * - Per-cycle seeds vary amplitude, duration, timing and shape; ~15% of
 *   cycles get a small "coupling" bump on the falling limb.
 */
export function generateTocoSample(
  frequency: number,
  intensity: 'mild' | 'moderate' | 'strong',
  timeMs: number
): number {
  // Resting uterine tone — elevated during tachysystole (incomplete relaxation)
  const restingTone = frequency >= 6 ? 18 + (frequency - 6) * 3 : 8;
  const baseline = restingTone + (Math.random() - 0.5) * 2;

  if (frequency === 0) return Math.round(Math.max(0, baseline));

  const periodMs = (10 * 60_000) / frequency;
  const peakAmp  = { mild: 15, moderate: 25, strong: 35 }[intensity] ?? 25;

  // Sum contributions of the current cycle and its neighbours so long
  // contractions can spill across cycle boundaries and merge visibly.
  const cycleNum = Math.floor(timeMs / periodMs);
  let pressure = 0;
  for (let c = cycleNum - 1; c <= cycleNum + 1; c++) {
    pressure += contractionContribution(c, timeMs, periodMs, peakAmp);
  }

  const noiseScale = 1 - Math.min(0.85, pressure / peakAmp);
  const noise = (Math.random() - 0.5) * 4 * Math.max(0, noiseScale);

  return Math.round(Math.max(0, Math.min(100, pressure + baseline + noise)));
}

// Pressure contribution of one contraction cycle at an absolute time.
function contractionContribution(
  cycleNum: number,
  timeMs: number,
  periodMs: number,
  peakAmp: number,
): number {
  if (cycleNum < 0) return 0;

  // Per-cycle seeds — deterministic so the trace is stable frame to frame
  const s1 = (Math.sin(cycleNum * 13.7) + 1) * 0.5;       // amplitude
  const s2 = (Math.sin(cycleNum * 7.3 + 1.1) + 1) * 0.5;  // duration + timing
  const s3 = (Math.sin(cycleNum * 19.1 + 2.7) + 1) * 0.5; // coupling roll

  // Realistic duration: 60–90 s (±20% via seed), capped at 85% of the period
  // so a short rest interval always remains visible between peaks.
  const durMs = Math.min(60_000 + s2 * 30_000, periodMs * 0.85);

  // Peak lands ~40% into the contraction; contraction start jitters within the cycle
  const startMs = cycleNum * periodMs + periodMs * (0.02 + s2 * 0.11);
  const peakMs  = startMs + durMs * 0.4;

  // Asymmetric two-sided Gaussian: brisk rise, slower fall
  const sigmaUp   = durMs * 0.16;
  const sigmaDown = durMs * 0.26;
  const dt    = timeMs - peakMs;
  const sigma = dt < 0 ? sigmaUp : sigmaDown;
  const ampFactor = 0.85 + s1 * 0.30; // ±15%

  let p = peakAmp * ampFactor * Math.exp(-(dt ** 2) / (2 * sigma ** 2));

  // Occasional coupling: a smaller secondary bump on the falling limb (~15% of cycles)
  if (s3 < 0.15) {
    const dt2 = timeMs - (peakMs + durMs * 0.55);
    p += peakAmp * ampFactor * 0.4 * Math.exp(-(dt2 ** 2) / (2 * (durMs * 0.12) ** 2));
  }

  return p;
}
