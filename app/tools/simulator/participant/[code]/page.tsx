'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { CTGParams, VitalSigns, PatientInfo } from '@/lib/simulatorTypes';
import { CTG_PRESETS } from '@/lib/ctgPresets';
import PatientBanner from '@/components/tools/simulator/PatientBanner';
import VitalSignsDisplay from '@/components/tools/simulator/VitalSignsDisplay';

const CTGMonitor = dynamic(() => import('@/components/tools/simulator/CTGMonitor'), { ssr: false });

const DEFAULT_PATIENT: PatientInfo = {
  name: '—', age: 0, gravida: 0, para: 0,
  gestational_weeks: 0, gestational_days: 0,
};
const DEFAULT_CTG    = CTG_PRESETS.normal.ctg;
const DEFAULT_VITALS = CTG_PRESETS.normal.vitals;

export default function ParticipantPage({ params }: { params: Promise<{ code: string }> }) {
  const { code }      = use(params);
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const evaluatorName = searchParams.get('name') ?? '';

  const [isRunning, setIsRunning] = useState(false);
  const [simEnded, setSimEnded]   = useState(false);
  const [ctgParams, setCtgParams] = useState<CTGParams>(DEFAULT_CTG);
  const [vitals, setVitals]       = useState<VitalSigns>(DEFAULT_VITALS);
  const [patient, setPatient]     = useState<PatientInfo>(DEFAULT_PATIENT);
  const [currentFHR, setCurrentFHR] = useState(DEFAULT_CTG.fhr_baseline);
  const [simTime, setSimTime]     = useState(0);
  const [connected, setConnected] = useState(false);
  const [waiting, setWaiting]     = useState(true);
  const [notes, setNotes]         = useState('');
  const [notesPanelOpen, setNotesPanelOpen] = useState(true);

  const audioRef  = useRef<import('@/components/tools/simulator/AudioEngine').AudioEngine | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pusherRef = useRef<import('@/components/tools/simulator/PusherSync').PusherSync | null>(null);

  // Init audio
  useEffect(() => {
    import('@/components/tools/simulator/AudioEngine').then(({ AudioEngine }) => {
      audioRef.current = new AudioEngine();
    });
    return () => audioRef.current?.dispose();
  }, []);

  // Timer
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setSimTime(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  // FHR audio
  useEffect(() => { audioRef.current?.setFHR(currentFHR); }, [currentFHR]);

  // Pusher
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;

    import('@/components/tools/simulator/PusherSync').then(({ PusherSync }) => {
      const sync = new PusherSync(code);
      pusherRef.current = sync;

      const unsub = sync.subscribe(event => {
        if (event.type === 'timer-control') {
          if (event.action === 'start' || event.action === 'resume') {
            audioRef.current?.initialize();
            audioRef.current?.startBeeping();
            setIsRunning(true);
            setWaiting(false);
          } else if (event.action === 'pause' || event.action === 'stop') {
            audioRef.current?.stopBeeping();
            setIsRunning(false);
          }
        }
        if (event.type === 'card-advance') {
          const data = event.structuredData as { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo } | null;
          if (data?.ctg)    setCtgParams(data.ctg);
          if (data?.vitals) setVitals(data.vitals);
          if (data?.patient) setPatient(data.patient);
        }
        if (event.type === 'live-override') {
          const p = event.params;
          setCtgParams(prev => ({ ...prev, ...p }));
          if ((p as { spo2?: number }).spo2 !== undefined)
            setVitals(prev => ({ ...prev, spo2: (p as { spo2: number }).spo2 }));
        }
        if (event.type === 'session-end') {
          audioRef.current?.stopBeeping();
          setIsRunning(false);
          setSimEnded(true);
        }
      });

      if (pusherKey) {
        sync.connect(pusherKey, process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'eu').then(() => setConnected(true));
      } else {
        setConnected(true);
      }

      return unsub;
    });

    return () => { pusherRef.current?.disconnect(); };
  }, [code]);

  const handleFHRUpdate = useCallback((fhr: number) => setCurrentFHR(fhr), []);

  const handleGoToEvaluate = () => {
    // Store notes in sessionStorage so evaluate page can pick them up
    sessionStorage.setItem(`sim_notes_${code}`, notes);
    router.push(`/tools/simulator/evaluate/${code}?evaluator=${encodeURIComponent(evaluatorName)}`);
  };

  return (
    <div style={{
      background: '#0d0d1f',
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: 'hidden',
    }}>
      <PatientBanner patient={patient} simTimeSeconds={simTime} isRunning={false} />

      {/* Waiting overlay */}
      {waiting && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(13,13,31,0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          <div style={{ fontSize: '2rem' }}>🏥</div>
          <div style={{ color: '#c4b5fd', fontSize: '1.3rem', fontWeight: 700 }}>ממתין לסימולציה...</div>
          <div style={{ color: '#6b7280', fontSize: '0.85rem', fontFamily: 'monospace' }}>{code}</div>
          {!connected && <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>מתחבר...</div>}
          <div style={{ color: '#a78bfa', fontSize: '0.8rem', marginTop: 8 }}>
            {evaluatorName ? `מחובר כ: ${evaluatorName}` : ''}
          </div>
        </div>
      )}

      {/* Session-ended overlay */}
      {simEnded && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 60,
          background: 'rgba(13,13,31,0.88)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
          padding: 32,
        }}>
          <div style={{ fontSize: '2.5rem' }}>✅</div>
          <div style={{ color: '#c4b5fd', fontSize: '1.4rem', fontWeight: 700 }}>הסימולציה הסתיימה</div>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6 }}>
            עבור להערכת המיילדת
          </div>
          <button
            onClick={handleGoToEvaluate}
            style={{
              padding: '14px 36px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
              color: '#fff', fontWeight: 700, fontSize: '1.1rem',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            📋 פתח טופס הערכת מיילדת
          </button>
        </div>
      )}

      {/* CTG + Vitals */}
      <div style={{ flex: '0 0 370px', display: 'flex', minHeight: 0 }}>
        <div style={{ flex: '1 1 0', position: 'relative', minWidth: 0 }}>
          <CTGMonitor ctgParams={ctgParams} maternalHR={vitals.hr} isRunning={isRunning} onFHRUpdate={handleFHRUpdate} />
        </div>
        <div style={{ width: 210, flexShrink: 0, borderLeft: '1px solid rgba(139,92,246,0.15)', padding: 10 }}>
          <VitalSignsDisplay fhr={currentFHR} vitals={vitals} isRunning={isRunning} />
        </div>
      </div>

      {/* Notes panel */}
      <div style={{
        flex: 1, minHeight: 0,
        borderTop: '2px solid rgba(139,92,246,0.2)',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.02)',
      }}>
        {/* Notes header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 14px',
            borderBottom: '1px solid rgba(139,92,246,0.12)',
            cursor: 'pointer', userSelect: 'none',
          }}
          onClick={() => setNotesPanelOpen(o => !o)}
        >
          <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '0.85rem' }}>
            📝 הערות להערכה
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {evaluatorName && (
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>מעריך: {evaluatorName}</span>
            )}
            <button
              onClick={e => { e.stopPropagation(); handleGoToEvaluate(); }}
              style={{
                padding: '4px 14px', borderRadius: 6, border: 'none',
                background: 'linear-gradient(135deg, #4B2E6A, #7c3aed)',
                color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              📋 הערכה
            </button>
            <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{notesPanelOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Notes textarea */}
        {notesPanelOpen && (
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="כתבי הערות במהלך הסימולציה — ממצאי CTG, תגובות המיילדת, נקודות לדיון..."
            style={{
              flex: 1, resize: 'none', border: 'none', outline: 'none',
              background: 'transparent', color: '#e2e8f0',
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              fontSize: '0.85rem', padding: '12px 16px',
              lineHeight: 1.6, direction: 'rtl',
            }}
          />
        )}
      </div>
    </div>
  );
}
