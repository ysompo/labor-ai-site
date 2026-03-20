'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';

// BarcodeDetector is not in the standard TS lib yet
declare const BarcodeDetector: {
  new(options: { formats: string[] }): {
    detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>;
  };
  getSupportedFormats(): Promise<string[]>;
} | undefined;

export default function JoinForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ code?: string }>;
}) {
  const searchParams = use(searchParamsPromise);
  const initialCode  = searchParams.code?.toUpperCase() ?? '';

  const router = useRouter();

  const [code, setCode]         = useState(initialCode);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [scanning, setScanning] = useState(false);
  const [username, setUsername] = useState('');
  const [hasBarcodeApi, setHasBarcodeApi] = useState(false);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number>(0);

  // Read username from sim_meta cookie
  useEffect(() => {
    try {
      const raw = document.cookie.split(';').find(c => c.trim().startsWith('sim_meta='));
      if (raw) {
        const meta = JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('=')));
        if (meta.username) setUsername(meta.username);
      }
    } catch { /* ignore */ }
  }, []);

  // Check BarcodeDetector availability
  useEffect(() => {
    if (typeof BarcodeDetector !== 'undefined') {
      BarcodeDetector.getSupportedFormats().then(formats => {
        if (formats.includes('qr_code')) setHasBarcodeApi(true);
      }).catch(() => {});
    }
  }, []);

  const stopCamera = () => {
    cancelAnimationFrame(scanLoopRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };

  const startScan = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanning(true);

      // Wait for video element
      await new Promise<void>(r => setTimeout(r, 100));
      if (!videoRef.current) { stopCamera(); return; }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector = new BarcodeDetector!({ formats: ['qr_code'] });
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          for (const r of results) {
            const raw = r.rawValue;
            const match = raw.match(/(?:code=|^)(SIM-[A-Z0-9]{4})/i);
            if (match) {
              setCode(match[1].toUpperCase());
              stopCamera();
              return;
            }
          }
        } catch { /* frame not ready */ }
        scanLoopRef.current = requestAnimationFrame(scan);
      };
      scanLoopRef.current = requestAnimationFrame(scan);
    } catch (e) {
      setError('לא ניתן לגשת למצלמה: ' + String(e));
      setScanning(false);
    }
  };

  // Clean up on unmount
  useEffect(() => () => stopCamera(), []);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed.startsWith('SIM-') || trimmed.length !== 8) {
      setError('קוד לא תקין — פורמט: SIM-XXXX');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/simulator/sessions/${trimmed}`);
      if (!res.ok) { setError('קוד סימולציה לא נמצא'); setLoading(false); return; }
    } catch { /* offline graceful */ }
    router.push(`/tools/simulator/participant/${trimmed}`);
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${code.length === 8 ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.15)'}`,
    borderRadius: 8,
    padding: '12px 14px',
    color: '#f1f5f9',
    fontSize: '1.3rem',
    fontFamily: 'monospace',
    letterSpacing: '0.12em',
    outline: 'none',
    direction: 'ltr',
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d0d1f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: 20,
      }}
      dir="rtl"
    >
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: 16,
        padding: '36px 32px',
        width: '100%',
        maxWidth: 400,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏥</div>
          <h1 style={{ color: '#f1f5f9', fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
            הצטרף לסימולציה
          </h1>
          {username && (
            <p style={{ color: '#a78bfa', fontSize: '0.82rem', margin: '6px 0 0', fontWeight: 600 }}>
              {username}
            </p>
          )}
        </div>

        {/* QR scanner area */}
        {scanning && (
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              border: '2px solid rgba(139,92,246,0.6)',
              borderRadius: 10,
              pointerEvents: 'none',
            }} />
            <button
              onClick={stopCamera}
              style={{
                position: 'absolute', top: 8, left: 8,
                background: 'rgba(0,0,0,0.6)', border: 'none',
                borderRadius: 6, color: '#fff', padding: '4px 10px',
                cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit',
              }}
            >
              ✕ בטל סריקה
            </button>
          </div>
        )}

        {/* Code input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ color: '#c4b5fd', fontSize: '0.8rem', fontWeight: 600 }}>קוד סימולציה</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="SIM-XXXX"
            maxLength={8}
            style={inputStyle}
            autoFocus={!initialCode}
          />
          {hasBarcodeApi && !scanning && (
            <button
              onClick={startScan}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 0', borderRadius: 8,
                border: '1px solid rgba(139,92,246,0.35)',
                background: 'rgba(139,92,246,0.08)', color: '#c4b5fd',
                cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              📷 סרוק QR קוד
            </button>
          )}
        </div>

        {error && (
          <div style={{ color: '#f87171', fontSize: '0.82rem', textAlign: 'center', background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '8px 12px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading}
          style={{
            background: loading ? '#374151' : 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '14px 0',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'מתחבר...' : 'הצטרף לסימולציה ▶'}
        </button>
      </div>
    </div>
  );
}
