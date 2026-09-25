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

const CANVAS_W = 800;
const CANVAS_H = 600;

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

export default function UltrasoundViewer({ image, onClose }: Props) {
  const { theme } = useSimTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgElRef  = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded]   = useState(false);
  const [imgError, setImgError]     = useState(false);
  const [points, setPoints]         = useState<Point[]>([]);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);

  const isAOP = image.type === 'aop';

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load the background image for the canvas (AOP mode only)
  useEffect(() => {
    if (!isAOP) return;
    let cancelled = false;
    imgElRef.current = null;
    const el = new window.Image();
    el.onload = () => { if (cancelled) return; imgElRef.current = el; setImgLoaded(true); };
    el.onerror = () => { if (!cancelled) setImgError(true); };
    el.src = image.src;
    return () => { cancelled = true; };
  }, [isAOP, image.src]);

  // Redraw canvas whenever inputs change
  useEffect(() => {
    if (!isAOP) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (imgElRef.current) {
      ctx.drawImage(imgElRef.current, 0, 0, CANVAS_W, CANVAS_H);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    const ref = image.reference_line;
    if (ref) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
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
      ctx.lineWidth = 4;
      ctx.setLineDash(points.length === 2 ? [] : [8, 6]);
      ctx.beginPath();
      ctx.moveTo(drawn[0].x, drawn[0].y);
      ctx.lineTo(drawn[1].x, drawn[1].y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const p of points) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [isAOP, image, points, hoverPoint, imgLoaded]);

  const toCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top)  * (CANVAS_H / rect.height),
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
          {isAOP ? (
            <>
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                onPointerDown={handleCanvasDown}
                onPointerMove={handleCanvasMove}
                style={{ touchAction: 'manipulation', width: '100%', maxWidth: 720, height: 'auto', borderRadius: 8, border: `1px solid ${theme.border}`, cursor: points.length < 2 ? 'crosshair' : 'default' }}
              />
              {imgError && (
                <div style={{ color: theme.textDim, fontSize: '0.9rem' }}>התמונה לא נטענה</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ color: theme.textHi, fontSize: '1.3rem', fontWeight: 800 }}>
                  {angle !== null ? `AOP: ${angle}°` : 'לחצו שתי נקודות לסימון קו העובר'}
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
              <div style={{ color: theme.textDim, fontSize: '0.85rem', textAlign: 'center' }}>
                הקו הירוק — סימפיזה (מכויל מראש) · הקו הצהוב — קו קונטור הגולגולת (לחצו שתי נקודות) · הזווית נמדדת מנקודת ההתחלה של הקו הירוק (קצה הסימפיזה התחתון)
              </div>
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
