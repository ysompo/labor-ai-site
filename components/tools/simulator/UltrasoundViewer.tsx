'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UltrasoundImage } from '@/lib/simulatorTypes';
import { useSimTheme } from './SimThemeProvider';

// Modal image viewer for the active ultrasound image. Plain images render
// full-size with a caption; 'aop' images add an interactive canvas overlay
// for measuring the Angle of Progression against a pre-calibrated reference
// line. No scoring — purely a practice measurement tool.

interface Props {
  image: UltrasoundImage;
  onClose: () => void;
}

interface Point { x: number; y: number; }

// Canvas is sized to the image's natural pixels once loaded, so reference_line
// coordinates are in source-image pixels and the image is never stretched.
const DEFAULT_DIMS = { w: 800, h: 600 };

function angleBetween(v1: Point, v2: Point): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const det = v1.x * v2.y - v1.y * v2.x;
  return Math.round(Math.abs(Math.atan2(det, dot) * 180 / Math.PI));
}

// AOP convention: the reference line's first endpoint (x1,y1) is the vertex
// (inferior border of the pubic symphysis). The drawn line is oriented to start
// from whichever drawn point is nearer that vertex, so click order is irrelevant.
export function computeAop(
  ref: { x1: number; y1: number; x2: number; y2: number },
  p1: Point,
  p2: Point,
): number {
  const d1 = Math.hypot(p1.x - ref.x1, p1.y - ref.y1);
  const d2 = Math.hypot(p2.x - ref.x1, p2.y - ref.y1);
  const [near, far] = d1 <= d2 ? [p1, p2] : [p2, p1];
  const v1: Point = { x: ref.x2 - ref.x1, y: ref.y2 - ref.y1 };
  const v2: Point = { x: far.x - near.x, y: far.y - near.y };
  return angleBetween(v1, v2);
}

// Distance between two source-image points in cm; null when scale is missing.
export function computeDistanceCm(p1: Point, p2: Point, pixelsPerCm?: number): number | null {
  if (!pixelsPerCm || pixelsPerCm <= 0) return null;
  return Math.hypot(p2.x - p1.x, p2.y - p1.y) / pixelsPerCm;
}

export default function UltrasoundViewer({ image, onClose }: Props) {
  const { theme } = useSimTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgElRef  = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded]   = useState(false);
  const [imgError, setImgError]     = useState(false);
  const [dims, setDims]             = useState(DEFAULT_DIMS);
  const [points, setPoints]         = useState<Point[]>([]);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);

  const isAOP = image.type === 'aop';
  const isMeasure = image.type === 'measure';
  const useCanvas = isAOP || isMeasure;

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load the background image for the canvas (AOP mode only)
  useEffect(() => {
    if (!useCanvas) return;
    let cancelled = false;
    imgElRef.current = null;
    const el = new window.Image();
    el.onload = () => { if (cancelled) return; imgElRef.current = el; setDims({ w: el.naturalWidth, h: el.naturalHeight }); setImgLoaded(true); };
    el.onerror = () => { if (!cancelled) setImgError(true); };
    el.src = image.src;
    return () => { cancelled = true; };
  }, [useCanvas, image.src]);

  // Redraw canvas whenever inputs change
  useEffect(() => {
    if (!useCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lw = Math.max(2, dims.w / 200);
    ctx.clearRect(0, 0, dims.w, dims.h);
    if (imgElRef.current) {
      ctx.drawImage(imgElRef.current, 0, 0, dims.w, dims.h);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, dims.w, dims.h);
    }

    const ref = image.reference_line;
    if (ref) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(ref.x1, ref.y1);
      ctx.lineTo(ref.x2, ref.y2);
      ctx.stroke();
    }

    const drawn = points.length === 2 ? points
      : points.length === 1 && hoverPoint ? [points[0], hoverPoint]
      : null;
    if (drawn) {
      ctx.strokeStyle = points.length === 2 ? '#facc15' : 'rgba(250,204,21,0.6)';
      ctx.lineWidth = lw;
      ctx.setLineDash(points.length === 2 ? [] : [lw * 2, lw * 1.5]);
      ctx.beginPath();
      ctx.moveTo(drawn[0].x, drawn[0].y);
      ctx.lineTo(drawn[1].x, drawn[1].y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const p of points) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(p.x, p.y, lw * 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [useCanvas, image, points, hoverPoint, imgLoaded, dims]);

  const toCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  };

  const handleCanvasDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (points.length >= 2) return;
    const p = toCanvasPoint(e);
    setPoints(prev => [...prev, p]);
    setHoverPoint(null);
  };

  const handleCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (points.length !== 1 || e.pointerType !== 'mouse') return;
    setHoverPoint(toCanvasPoint(e));
  };

  const handleReset = () => { setPoints([]); setHoverPoint(null); };

  const angle = useMemo(() => {
    if (!image.reference_line) return null;
    const ref = image.reference_line;
    const second = points.length === 2 ? points[1]
      : points.length === 1 && hoverPoint ? hoverPoint
      : null;
    const first = points.length >= 1 ? points[0] : null;
    if (!first || !second) return null;
    return computeAop(ref, first, second);
  }, [image.reference_line, points, hoverPoint]);

  const distanceCm = useMemo(() => {
    if (!isMeasure) return null;
    const second = points.length === 2 ? points[1]
      : points.length === 1 && hoverPoint ? hoverPoint
      : null;
    const first = points.length >= 1 ? points[0] : null;
    if (!first || !second) return null;
    return computeDistanceCm(first, second, image.pixels_per_cm);
  }, [isMeasure, image.pixels_per_cm, points, hoverPoint]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.label}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: theme.overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        dir="rtl"
        style={{
          background: theme.surfaceRaised,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          width: '100%', maxWidth: 880,
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.borderSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ color: theme.lilac, fontWeight: 700, fontSize: '1.05rem' }}>
            🩻 {image.label}
          </div>
          <button
            onClick={onClose}
            aria-label="סגור"
            style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {useCanvas ? (
            <>
              <canvas
                ref={canvasRef}
                width={dims.w}
                height={dims.h}
                onPointerDown={handleCanvasDown}
                onPointerMove={handleCanvasMove}
                style={{ touchAction: 'manipulation', width: '100%', maxWidth: 720, height: 'auto', borderRadius: 8, border: `1px solid ${theme.border}`, cursor: points.length < 2 ? 'crosshair' : 'default' }}
              />
              {imgError && (
                <div style={{ color: theme.textDim, fontSize: '0.9rem' }}>התמונה לא נטענה</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ color: theme.textHi, fontSize: '1.3rem', fontWeight: 800 }}>
                  {isMeasure
                    ? (distanceCm !== null ? `מרחק: ${distanceCm.toFixed(1)} ס״מ` : 'לחצו שתי נקודות למדידת המרחק')
                    : (angle !== null ? `AOP: ${angle}°` : 'לחצו שתי נקודות לסימון קו העובר')}
                </div>
                <button
                  onClick={handleReset}
                  style={{
                    padding: '8px 18px', borderRadius: 8,
                    border: `1px solid ${theme.borderSoft}`,
                    background: theme.accentSoft, color: theme.text,
                    fontSize: '0.95rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ↺ איפוס
                </button>
              </div>
              {isAOP && <div style={{ color: theme.textDim, fontSize: '0.85rem', textAlign: 'center' }}>
                הקו הירוק — סימפיזה (מכויל מראש) · הקו הצהוב — קו קונטור הגולגולת (לחצו שתי נקודות) · הזווית נמדדת מנקודת ההתחלה של הקו הירוק (קצה הסימפיזה התחתון)
              </div>}
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              alt={image.label}
              style={{ width: '100%', maxWidth: 720, height: 'auto', borderRadius: 8, border: `1px solid ${theme.border}` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
