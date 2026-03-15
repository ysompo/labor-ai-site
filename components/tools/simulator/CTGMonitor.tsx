'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { CTGParams, LiveOverrideParams } from '@/lib/simulatorTypes';
import { generateFHRSample, generateTocoSample } from './WaveformGenerator';

// ── Constants ────────────────────────────────────────────────────────────────
const SAMPLES_PER_SEC = 2;          // 2 samples/sec → 0.5s resolution
const SAMPLE_INTERVAL_MS = 1000 / SAMPLES_PER_SEC;
const VISIBLE_SECONDS = 300;        // 5-minute scrolling window
const VISIBLE_SAMPLES = VISIBLE_SECONDS * SAMPLES_PER_SEC;
const MAX_BUFFER = VISIBLE_SAMPLES + 10;
const FHR_MIN = 60;
const FHR_MAX = 200;
const TOCO_MAX = 100;

// ── Types ─────────────────────────────────────────────────────────────────────
interface SimState {
  fhrBuffer: number[];
  mhrBuffer: number[];
  tocoBuffer: number[];
  nextSampleMs: number;
  startWallTime: number;
  simTimeMs: number;
  isRunning: boolean;
  params: CTGParams;
  maternalHR: number;
  override: Partial<LiveOverrideParams> | null;
}

interface Props {
  ctgParams: CTGParams;
  maternalHR: number;
  override?: Partial<LiveOverrideParams> | null;
  isRunning: boolean;
  /** Called ~2×/sec with the latest generated FHR value */
  onFHRUpdate?: (fhr: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function effectiveParams(s: SimState): CTGParams {
  if (!s.override) return s.params;
  return {
    ...s.params,
    ...(s.override.fhr_baseline  !== undefined && { fhr_baseline:  s.override.fhr_baseline }),
    ...(s.override.fhr_variability !== undefined && { fhr_variability: s.override.fhr_variability }),
    ...(s.override.decelerations   !== undefined && { decelerations:   s.override.decelerations }),
  };
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function CTGMonitor({
  ctgParams,
  maternalHR,
  override = null,
  isRunning,
  onFHRUpdate,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const onFHRRef  = useRef(onFHRUpdate);
  onFHRRef.current = onFHRUpdate;

  const state = useRef<SimState>({
    fhrBuffer: [],
    mhrBuffer: [],
    tocoBuffer: [],
    nextSampleMs: 0,
    startWallTime: 0,
    simTimeMs: 0,
    isRunning: false,
    params: ctgParams,
    maternalHR,
    override,
  });

  // Sync props → ref without triggering re-renders
  useEffect(() => { state.current.params     = ctgParams;      }, [ctgParams]);
  useEffect(() => { state.current.maternalHR = maternalHR;     }, [maternalHR]);
  useEffect(() => { state.current.override   = override ?? null; }, [override]);

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const FHR_H  = Math.round(H * 0.70);
    const GAP    = 3;
    const TOCO_Y = FHR_H + GAP;
    const TOCO_H = H - TOCO_Y;

    const s = state.current;
    const pxPerSample = W / VISIBLE_SAMPLES;

    // Fractional scroll offset for smooth animation
    const fractional = s.isRunning
      ? (s.simTimeMs % SAMPLE_INTERVAL_MS) / SAMPLE_INTERVAL_MS
      : 0;
    const scrollOffset = fractional * pxPerSample;

    // Y-axis helpers
    const toFhrY  = (bpm: number) => FHR_H * (1 - (bpm - FHR_MIN) / (FHR_MAX - FHR_MIN));
    const toTocoY = (v:   number) => TOCO_Y + TOCO_H * (1 - v / TOCO_MAX);

    // ── Background ──────────────────────────────────────────────────────────
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // ── FHR Channel ─────────────────────────────────────────────────────────

    // Danger zone fill (above 160 and below 110)
    ctx.fillStyle = 'rgba(234,179,8,0.05)';
    ctx.fillRect(0, 0,            W, toFhrY(160));              // >160
    ctx.fillRect(0, toFhrY(110),  W, FHR_H - toFhrY(110));     // <110

    // Normal zone fill (110–160) — very faint green tint
    ctx.fillStyle = 'rgba(34,197,94,0.03)';
    ctx.fillRect(0, toFhrY(160), W, toFhrY(110) - toFhrY(160));

    // Grid lines every 20 bpm
    ctx.strokeStyle = 'rgba(80,80,130,0.6)';
    ctx.lineWidth = 1;
    for (let bpm = FHR_MIN; bpm <= FHR_MAX; bpm += 20) {
      const y = toFhrY(bpm);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Dashed threshold lines at 110 and 160
    ctx.save();
    ctx.strokeStyle = 'rgba(234,179,8,0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([7, 5]);
    [110, 160].forEach(bpm => {
      ctx.beginPath();
      ctx.moveTo(0, toFhrY(bpm));
      ctx.lineTo(W, toFhrY(bpm));
      ctx.stroke();
    });
    ctx.restore();

    // BPM axis labels
    ctx.fillStyle = 'rgba(74,222,128,0.55)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    for (let bpm = 80; bpm < 200; bpm += 20) {
      ctx.fillText(String(bpm), 4, toFhrY(bpm) - 3);
    }

    // ── MHR trace (maternal HR, faint yellow) ───────────────────────────────
    if (s.mhrBuffer.length > 1) {
      ctx.strokeStyle = 'rgba(234,179,8,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < s.mhrBuffer.length; i++) {
        const x = W - ((s.mhrBuffer.length - 1 - i) * pxPerSample + scrollOffset);
        if (x < -pxPerSample) continue;
        const y = toFhrY(s.mhrBuffer[i]);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ── FHR trace (fetal HR, bright green) ──────────────────────────────────
    if (s.fhrBuffer.length > 1) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < s.fhrBuffer.length; i++) {
        const x = W - ((s.fhrBuffer.length - 1 - i) * pxPerSample + scrollOffset);
        if (x < -pxPerSample) continue;
        const y = toFhrY(s.fhrBuffer[i]);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ── Separator ────────────────────────────────────────────────────────────
    ctx.fillStyle = '#0d0d1f';
    ctx.fillRect(0, FHR_H, W, GAP);

    // ── Toco Channel ─────────────────────────────────────────────────────────
    ctx.fillStyle = '#111128';
    ctx.fillRect(0, TOCO_Y, W, TOCO_H);

    // Toco grid
    ctx.strokeStyle = 'rgba(80,80,130,0.4)';
    ctx.lineWidth = 1;
    for (let v = 0; v <= 100; v += 20) {
      const y = toTocoY(v);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Toco labels
    ctx.fillStyle = 'rgba(156,163,175,0.5)';
    ctx.font = '9px monospace';
    for (let v = 20; v <= 80; v += 20) {
      ctx.fillText(String(v), 4, toTocoY(v) - 2);
    }

    // Toco trace (white)
    if (s.tocoBuffer.length > 1) {
      ctx.strokeStyle = 'rgba(241,245,249,0.85)';
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let first = true;
      for (let i = 0; i < s.tocoBuffer.length; i++) {
        const x = W - ((s.tocoBuffer.length - 1 - i) * pxPerSample + scrollOffset);
        if (x < -pxPerSample) continue;
        const y = toTocoY(s.tocoBuffer[i]);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, []);

  // ── Animation loop ───────────────────────────────────────────────────────
  const animate = useCallback(() => {
    const s = state.current;
    if (!s.isRunning) return;

    s.simTimeMs = performance.now() - s.startWallTime;
    const ep = effectiveParams(s);

    // Generate new samples to catch up to current sim time
    while (s.nextSampleMs <= s.simTimeMs) {
      const fhr  = generateFHRSample(ep, s.nextSampleMs);
      const mhr  = Math.round(s.maternalHR + (Math.random() - 0.5) * 4);
      const toco = generateTocoSample(s.params.contraction_frequency, s.params.contraction_intensity, s.nextSampleMs);

      s.fhrBuffer.push(fhr);
      s.mhrBuffer.push(mhr);
      s.tocoBuffer.push(toco);

      if (s.fhrBuffer.length > MAX_BUFFER) {
        s.fhrBuffer.shift();
        s.mhrBuffer.shift();
        s.tocoBuffer.shift();
      }

      onFHRRef.current?.(fhr);
      s.nextSampleMs += SAMPLE_INTERVAL_MS;
    }

    draw();
    rafRef.current = requestAnimationFrame(animate);
  }, [draw]);

  // ── Start / stop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning && !state.current.isRunning) {
      state.current.isRunning    = true;
      state.current.startWallTime = performance.now() - state.current.simTimeMs;
      rafRef.current = requestAnimationFrame(animate);
    } else if (!isRunning && state.current.isRunning) {
      state.current.isRunning = false;
      cancelAnimationFrame(rafRef.current);
      draw();
    }
  }, [isRunning, animate, draw]);

  // ── Canvas resize ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setSize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    };

    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ background: '#1a1a2e' }}
    />
  );
}
