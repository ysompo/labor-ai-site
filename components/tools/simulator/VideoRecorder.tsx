'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  sessionCode: string;
  deviceRole: string;
  simTimeSeconds: number;
  onClipReady: (blob: Blob, startTime: number, endTime: number) => void;
}

type RecordingState = 'idle' | 'consent' | 'recording' | 'uploading';

export default function VideoRecorder({ sessionCode, deviceRole, simTimeSeconds, onClipReady }: Props) {
  const [state, setState] = useState<RecordingState>('consent'); // auto-open consent on mount
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const startSimTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      stopStream();
    };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleRecordClick = () => {
    setState('consent');
    setError(null);
  };

  const handleConfirm = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15 },
        },
        audio: true,
      });

      streamRef.current = stream;
      const mimeType =
        MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
        MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' :
        MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        setState('uploading');
        const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
        const endSimTime = simTimeSeconds;
        onClipReady(blob, startSimTimeRef.current, endSimTime);
        stopStream();
        setState('idle');
        setElapsed(0);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      startSimTimeRef.current = simTimeSeconds;

      setState('recording');
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      setError('לא ניתן לגשת למצלמה/מיקרופון');
      setState('idle');
    }
  };

  const handleStop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (state === 'consent') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          dir="rtl"
          style={{
            background: '#1a1a2e',
            border: '1px solid rgba(139,92,246,0.4)',
            borderRadius: 16,
            padding: 24,
            maxWidth: 340,
            width: '100%',
            color: '#f1f5f9',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🎥</div>
          <p style={{ margin: '0 0 20px', fontSize: '0.9rem', lineHeight: 1.6, color: '#d1d5db' }}>
            סימולציה זו מוקלטת למטרות הדרכה. אשר?
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleConfirm}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              אשר
            </button>
            <button
              onClick={() => setState('idle')}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: '1px solid rgba(156,163,175,0.3)',
                background: 'rgba(255,255,255,0.04)',
                color: '#9ca3af',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div
        dir="rtl"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 8,
          padding: '6px 12px',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#ef4444',
            flexShrink: 0,
            animation: 'pulse 1.2s ease-in-out infinite',
            boxShadow: '0 0 8px #ef4444',
          }}
        />
        <span style={{ color: '#fca5a5', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700 }}>
          {formatElapsed(elapsed)}
        </span>
        <button
          onClick={handleStop}
          style={{
            background: 'rgba(239,68,68,0.2)',
            border: '1px solid rgba(239,68,68,0.5)',
            borderRadius: 6,
            color: '#fca5a5',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '3px 10px',
            fontFamily: 'inherit',
          }}
        >
          עצור
        </button>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      </div>
    );
  }

  if (state === 'uploading') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#a78bfa',
          fontSize: '0.82rem',
          padding: '6px 12px',
        }}
      >
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
        מעלה...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // idle state — should not normally be visible since we open consent on mount
  return error ? (
    <div style={{ color: '#f87171', fontSize: '0.75rem', padding: '6px 10px' }}>{error}</div>
  ) : null;
}
