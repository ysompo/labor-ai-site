'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { CTGParams } from '@/lib/simulatorTypes';
import { generateFHRSample, generateTocoSample } from './WaveformGenerator';
import { useSimTheme } from './SimThemeProvider';

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_SIM_SPEED = 5; // clinical seconds per real second; live-adjustable via the simSpeed prop
const SAMPLES_PER_SEC   = 2;
const SAMPLE_INTERVAL_MS = 1000 / SAMPLES_PER_SEC;
const PX_PER_SAMPLE     = 1;          // 1px/sample = 2px/sec → 180s visible on 360px phone
const MAX_BUFFER        = 2400;       // ~20 min at 2 samples/sec on widest screens
const FHR_MIN           = 60;
const FHR_MAX           = 200;
const TOCO_MAX          = 100;

// ── Types ─────────────────────────────────────────────────────────────────────
interface SimState {
  fhrBuffer:       number[];
  mhrBuffer:       number[];
  tocoBuffer:      number[];
  nextSampleMs:    number;
  startWallTime:   number;
  simTimeMs:       number;
  isRunning:       boolean;
  params:          CTGParams;
  maternalHR:      number;
  currentBaseline: number;  // smoothed baseline — interpolates toward params.fhr_baseline
  speed:           number;  // clinical seconds per real second
}

interface Props {
  ctgParams:    CTGParams;
  maternalHR:   number;
  isRunning:    boolean;
  onFHRUpdate?: (fhr: number) => void;
  resetKey?:       number;
  retroactiveKey?: number;
  simSpeed?:       number;  // clinical seconds per real second (default 5)
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function CTGMonitor({
  ctgParams,
  maternalHR,
  isRunning,
  onFHRUpdate,
  resetKey,
  retroactiveKey,
  simSpeed = DEFAULT_SIM_SPEED,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const onFHRRef  = useRef(onFHRUpdate);
  onFHRRef.current = onFHRUpdate;
  // Canvas colors come from the theme via a ref so the rAF draw loop stays stable
  const { theme } = useSimTheme();
  const themeRef  = useRef(theme);
  themeRef.current = theme;

  const state = useRef<SimState>({
    fhrBuffer:       [],
    mhrBuffer:       [],
    tocoBuffer:      [],
    nextSampleMs:    0,
    startWallTime:   0,
    simTimeMs:       0,
    isRunning:       false,
    params:          ctgParams,
    maternalHR,
    currentBaseline: ctgParams.fhr_baseline,
    speed:           simSpeed,
  });

  // Sync props → ref without triggering re-renders
  useEffect(() => { state.current.params     = ctgParams;  }, [ctgParams]);
  useEffect(() => { state.current.maternalHR = maternalHR; }, [maternalHR]);

  // Live speed change: rebase the wall clock so the trace stays continuous
  // (simTimeMs is preserved; only the rate of advance changes).
  useEffect(() => {
    const s = state.current;
    if (s.speed === simSpeed) return;
    s.speed = simSpeed;
    if (s.isRunning) s.startWallTime = performance.now() - s.simTimeMs / simSpeed;
  }, [simSpeed]);

  // TOCO buffer is regenerated via retroactiveKey; prospective changes scroll in naturally.

  // Clear ALL buffers and restart waveform when resetKey changes (card advance)
  useEffect(() => {
    if (resetKey === undefined) return;
    const s = state.current;
    s.fhrBuffer  = [];
    s.mhrBuffer  = [];
    s.tocoBuffer = [];
    s.simTimeMs    = 0;
    s.nextSampleMs = 0;
    s.currentBaseline = s.params.fhr_baseline;
    if (s.isRunning) s.startWallTime = performance.now();
    draw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Retroactively regenerate existing buffer with new params (override "החלף תמונה קלינית")
  useEffect(() => {
    if (!retroactiveKey) return;
    const s = state.current;
    // Jump baseline immediately so new samples don't gradually transition
    s.currentBaseline = ctgParams.fhr_baseline;
    for (let i = 0; i < s.fhrBuffer.length; i++) {
      s.fhrBuffer[i] = generateFHRSample(ctgParams, i * SAMPLE_INTERVAL_MS);
    }
    for (let i = 0; i < s.tocoBuffer.length; i++) {
      s.tocoBuffer[i] = generateTocoSample(
        ctgParams.contraction_frequency,
        ctgParams.contraction_intensity,
        i * SAMPLE_INTERVAL_MS,
      );
    }
    draw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retroactiveKey]);

  // ── Draw ────────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use logical pixels for all coordinate math so the layout is identical
    // across Retina (DPR=2–3) and standard displays.
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.width  / dpr;
    const H   = canvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    const FHR_H  = Math.round(H * 0.67);
    const SEP    = 1;
    const TOCO_Y = FHR_H + SEP;
    const TOCO_H = H - TOCO_Y;

    const s              = state.current;
    const pxPerSample    = PX_PER_SAMPLE;
    const visibleSamples = Math.ceil(W / pxPerSample) + 2;

    // Fractional scroll offset for smooth animation
    const fractional   = s.isRunning ? (s.simTimeMs % SAMPLE_INTERVAL_MS) / SAMPLE_INTERVAL_MS : 0;
    const scrollOffset = fractional * pxPerSample;

    // Y-axis helpers
    const toFhrY  = (bpm: number) => FHR_H  * (1 - (bpm - FHR_MIN) / (FHR_MAX - FHR_MIN));
    const toTocoY = (v:   number) => TOCO_Y + TOCO_H * (1 - v / TOCO_MAX);

    // x position for a sample index in the buffer
    const sampleX = (bufLen: number, i: number) =>
      W - ((bufLen - 1 - i) * pxPerSample + scrollOffset);

    const themeCtg = themeRef.current.ctg;

    // ── Paper background ─────────────────────────────────────────────────────
    ctx.fillStyle = themeCtg.paper;
    ctx.fillRect(0, 0, W, H);

    // ── Normal zone fill 110–160 (faint yellow) ──────────────────────────────
    ctx.fillStyle = themeRef.current.name === 'dark'
      ? 'rgba(255, 240, 160, 0.07)'
      : 'rgba(255, 240, 160, 0.30)';
    ctx.fillRect(0, toFhrY(160), W, toFhrY(110) - toFhrY(160));

    // ── FHR horizontal grid lines (every 20 bpm) ─────────────────────────────
    ctx.strokeStyle = themeCtg.gridMinor;
    ctx.lineWidth   = 0.5;
    for (let bpm = FHR_MIN; bpm <= FHR_MAX; bpm += 20) {
      const y = toFhrY(bpm);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Vertical time grid lines ─────────────────────────────────────────────
    const samplesPerMin = SAMPLES_PER_SEC * 60;  // 120
    const samplesPerTen = SAMPLES_PER_SEC * 10;  // 20
    const bufLen        = s.fhrBuffer.length;

    // Minor lines every 10 s
    ctx.strokeStyle = themeCtg.gridMinor;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth   = 0.4;
    for (let i = Math.max(0, bufLen - visibleSamples); i < bufLen; i++) {
      if (i % samplesPerTen !== 0) continue;
      const x = sampleX(bufLen, i);
      if (x < 0 || x > W) continue;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FHR_H); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Major lines every 1 min
    ctx.strokeStyle = themeCtg.gridMajor;
    ctx.lineWidth   = 0.8;
    for (let i = Math.max(0, bufLen - visibleSamples); i < bufLen; i++) {
      if (i % samplesPerMin !== 0) continue;
      const x = sampleX(bufLen, i);
      if (x < 0 || x > W) continue;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FHR_H); ctx.stroke();
    }

    // ── FHR scale labels — left and right ────────────────────────────────────
    ctx.fillStyle = themeCtg.text;
    ctx.font      = '10px monospace';
    for (let bpm = FHR_MIN; bpm <= FHR_MAX; bpm += 20) {
      const y = toFhrY(bpm) - 2;
      ctx.textAlign = 'left';  ctx.fillText(String(bpm), 3,     y);
      ctx.textAlign = 'right'; ctx.fillText(String(bpm), W - 3, y);
    }

    const postpartum = s.params.postpartum === true;

    // ── MHR trace (maternal HR — green) ──────────────────────────────────────
    if (s.mhrBuffer.length > 1 && (!postpartum || s.maternalHR > 0)) {
      const start = Math.max(0, s.mhrBuffer.length - visibleSamples);
      ctx.strokeStyle = themeCtg.mhrTrace;
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      let first = true;
      for (let i = start; i < s.mhrBuffer.length; i++) {
        const x = sampleX(s.mhrBuffer.length, i);
        if (x < -pxPerSample || x > W + pxPerSample) continue;
        const y = toFhrY(s.mhrBuffer[i]);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ── FHR trace (fetal HR — purple/magenta) — hidden in postpartum mode ────
    if (s.fhrBuffer.length > 1 && !postpartum) {
      const start = Math.max(0, s.fhrBuffer.length - visibleSamples);
      ctx.strokeStyle = themeCtg.fhrTrace;
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      let first = true;
      for (let i = start; i < s.fhrBuffer.length; i++) {
        const x = sampleX(s.fhrBuffer.length, i);
        if (x < -pxPerSample || x > W + pxPerSample) continue;
        const y = toFhrY(s.fhrBuffer[i]);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ── Separator ─────────────────────────────────────────────────────────────
    ctx.fillStyle = themeCtg.gridMinor;
    ctx.fillRect(0, FHR_H, W, SEP);

    // ── TOCO background ───────────────────────────────────────────────────────
    ctx.fillStyle = themeCtg.paper;
    ctx.fillRect(0, TOCO_Y, W, TOCO_H);

    // ── TOCO horizontal grid lines ────────────────────────────────────────────
    ctx.strokeStyle = themeCtg.gridMinor;
    ctx.lineWidth   = 0.5;
    for (let v = 0; v <= TOCO_MAX; v += 20) {
      const y = toTocoY(v);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── TOCO vertical grid lines (major only) ─────────────────────────────────
    const tbufLen = s.tocoBuffer.length;
    ctx.strokeStyle = themeCtg.gridMajor;
    ctx.lineWidth   = 0.8;
    for (let i = Math.max(0, tbufLen - visibleSamples); i < tbufLen; i++) {
      if (i % samplesPerMin !== 0) continue;
      const x = sampleX(tbufLen, i);
      if (x < 0 || x > W) continue;
      ctx.beginPath(); ctx.moveTo(x, TOCO_Y); ctx.lineTo(x, H); ctx.stroke();
    }

    // ── TOCO scale labels — left and right ───────────────────────────────────
    ctx.fillStyle = themeCtg.text;
    ctx.font      = '9px monospace';
    for (let v = 20; v <= TOCO_MAX; v += 20) {
      const y = toTocoY(v) - 2;
      ctx.textAlign = 'left';  ctx.fillText(String(v), 3,     y);
      ctx.textAlign = 'right'; ctx.fillText(String(v), W - 3, y);
    }

    // ── TOCO trace (black) — hidden in postpartum mode ───────────────────────
    if (s.tocoBuffer.length > 1 && !postpartum) {
      const start = Math.max(0, s.tocoBuffer.length - visibleSamples);
      ctx.strokeStyle = themeCtg.tocoTrace;
      ctx.lineWidth   = 1.5;
      ctx.lineJoin    = 'round';
      ctx.beginPath();
      let first = true;
      for (let i = start; i < s.tocoBuffer.length; i++) {
        const x = sampleX(s.tocoBuffer.length, i);
        if (x < -pxPerSample || x > W + pxPerSample) continue;
        const y = toTocoY(s.tocoBuffer[i]);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }, []);

  // ── Animation loop ────────────────────────────────────────────────────────
  const animate = useCallback(() => {
    const s = state.current;
    if (!s.isRunning) return;

    s.simTimeMs = (performance.now() - s.startWallTime) * s.speed;

    while (s.nextSampleMs <= s.simTimeMs) {
      // Gradually move currentBaseline toward target (2 bpm/sec = 1 bpm/sample at 2Hz)
      const target = s.params.fhr_baseline;
      const diff   = target - s.currentBaseline;
      s.currentBaseline += diff > 0
        ? Math.min(diff, 1)
        : Math.max(diff, -1);

      // Generate FHR using the smoothed baseline
      const smoothedParams = s.currentBaseline === target
        ? s.params
        : { ...s.params, fhr_baseline: Math.round(s.currentBaseline) };
      const fhr  = generateFHRSample(smoothedParams, s.nextSampleMs);
      const mhr  = Math.round(s.maternalHR + (Math.random() - 0.5) * 4);
      const toco = generateTocoSample(s.params.contraction_frequency, s.params.contraction_intensity, s.nextSampleMs);

      s.fhrBuffer.push(fhr);
      s.mhrBuffer.push(mhr);
      s.tocoBuffer.push(toco);

      if (s.fhrBuffer.length  > MAX_BUFFER) s.fhrBuffer.shift();
      if (s.mhrBuffer.length  > MAX_BUFFER) s.mhrBuffer.shift();
      if (s.tocoBuffer.length > MAX_BUFFER) s.tocoBuffer.shift();

      // In postpartum mode the FHR trace is hidden — emit 0 so the parent
      // knows there is no active fetal monitoring (hides number, silences audio).
      onFHRRef.current?.(s.params.postpartum ? 0 : Math.round(fhr));
      s.nextSampleMs += SAMPLE_INTERVAL_MS;
    }

    draw();
    rafRef.current = requestAnimationFrame(animate);
  }, [draw]);

  // ── Start / stop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning && !state.current.isRunning) {
      state.current.isRunning     = true;
      state.current.startWallTime = performance.now() - state.current.simTimeMs / state.current.speed;
      rafRef.current = requestAnimationFrame(animate);
    } else if (!isRunning && state.current.isRunning) {
      state.current.isRunning = false;
      cancelAnimationFrame(rafRef.current);
      draw();
    }
  }, [isRunning, animate, draw]);

  // ── Canvas resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setSize = () => {
      const dpr     = window.devicePixelRatio || 1;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      draw();
    };

    setSize();
    // ResizeObserver not available on iOS 11 — fall back to window resize event
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(setSize);
      ro.observe(canvas);
      return () => ro.disconnect();
    } else {
      window.addEventListener('resize', setSize);
      return () => window.removeEventListener('resize', setSize);
    }
  }, [draw]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { cancelAnimationFrame(rafRef.current); };
  }, []);

  // Repaint when the theme flips (draw loop only runs while the sim is running)
  useEffect(() => { draw(); }, [theme, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ background: theme.ctg.paper }}
    />
  );
}
