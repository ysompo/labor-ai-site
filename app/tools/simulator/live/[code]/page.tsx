'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { use } from 'react';
import type { CTGParams, VitalSigns, PatientInfo } from '@/lib/simulatorTypes';
import { CTG_PRESETS } from '@/lib/ctgPresets';
import type { LabRow } from '@/components/tools/simulator/EHRLabsPanel';
import PatientBanner from '@/components/tools/simulator/PatientBanner';
import VitalSignsDisplay from '@/components/tools/simulator/VitalSignsDisplay';

const CTGMonitor  = dynamic(() => import('@/components/tools/simulator/CTGMonitor'),  { ssr: false });
const EHRLabsPanel = dynamic(() => import('@/components/tools/simulator/EHRLabsPanel'), { ssr: false });

// Default patient shown before simulation connects
const DEFAULT_PATIENT: PatientInfo = {
  name: '—', age: 0, gravida: 0, para: 0,
  gestational_weeks: 0, gestational_days: 0,
};

const DEFAULT_CTG   = CTG_PRESETS.normal.ctg;
const DEFAULT_VITALS = CTG_PRESETS.normal.vitals;

export default function TraineeDisplayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  const [isRunning, setIsRunning]     = useState(false);
  const [ctgParams, setCtgParams]     = useState<CTGParams>(DEFAULT_CTG);
  const [vitals, setVitals]           = useState<VitalSigns>(DEFAULT_VITALS);
  const [patient, setPatient]         = useState<PatientInfo>(DEFAULT_PATIENT);
  const [currentFHR, setCurrentFHR]   = useState(DEFAULT_CTG.fhr_baseline);
  const [labRows, setLabRows]         = useState<LabRow[]>([]);
  const [simTime, setSimTime]         = useState(0);
  const [connected, setConnected]     = useState(false);
  const [waiting, setWaiting]         = useState(true);

  const audioRef = useRef<import('@/components/tools/simulator/AudioEngine').AudioEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // Pusher / event handling
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
          const data = event.structuredData as { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo; labs?: unknown; abnormal_fields?: string[] } | null;
          if (data?.ctg)    setCtgParams(data.ctg);
          if (data?.vitals) setVitals(data.vitals);
          if (data?.patient) setPatient(data.patient);
          if (data?.labs) {
            const row: LabRow = {
              id:               `card_${event.cardNumber}_${Date.now()}`,
              timestamp:        new Date().toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
              material:         'דם',
              labs:             data.labs as LabRow['labs'],
              abnormal_fields:  data.abnormal_fields ?? [],
            };
            setLabRows(prev => [...prev, row]);
          }
        }
        if (event.type === 'live-override') {
          const p = event.params;
          setCtgParams(prev => ({ ...prev, ...p }));
          if ((p as { spo2?: number }).spo2 !== undefined) setVitals(prev => ({ ...prev, spo2: (p as { spo2: number }).spo2 }));
        }
        if (event.type === 'session-end') {
          audioRef.current?.stopBeeping();
          setIsRunning(false);
        }
      });

      if (pusherKey) {
        sync.connect(pusherKey, process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'eu').then(() => setConnected(true));
      } else {
        setConnected(true); // single-device fallback
      }

      return unsub;
    });

    return () => { pusherRef.current?.disconnect(); };
  }, [code]);

  const handleFHRUpdate = useCallback((fhr: number) => setCurrentFHR(fhr), []);

  return (
    <div
      style={{
        background: '#0d0d1f',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Patient banner — no timer shown (display role) */}
      <PatientBanner patient={patient} simTimeSeconds={simTime} isRunning={false} />

      {/* Waiting overlay */}
      {waiting && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(13,13,31,0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: '2rem' }}>🏥</div>
          <div style={{ color: '#c4b5fd', fontSize: '1.3rem', fontWeight: 700 }}>ממתין לסימולציה...</div>
          <div style={{ color: '#6b7280', fontSize: '0.85rem', fontFamily: 'monospace' }}>{code}</div>
          {!connected && <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>מתחבר...</div>}
        </div>
      )}

      {/* Middle: CTG + Vitals */}
      <div style={{ flex: '0 0 370px', display: 'flex', minHeight: 0 }}>
        <div style={{ flex: '1 1 0', position: 'relative', minWidth: 0 }}>
          <CTGMonitor ctgParams={ctgParams} maternalHR={vitals.hr} isRunning={isRunning} onFHRUpdate={handleFHRUpdate} />
        </div>
        <div style={{
          width: 210, flexShrink: 0,
          borderLeft: '1px solid rgba(139,92,246,0.15)',
          padding: 10,
        }}>
          <VitalSignsDisplay fhr={currentFHR} vitals={vitals} isRunning={isRunning} />
        </div>
      </div>

      {/* EHR Labs */}
      <div style={{ flex: 1, minHeight: 0, borderTop: '2px solid rgba(139,92,246,0.2)' }}>
        <EHRLabsPanel rows={labRows} />
      </div>
    </div>
  );
}
