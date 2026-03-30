'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { use } from 'react';
import type { CTGParams, VitalSigns, PatientInfo, CardLabs } from '@/lib/simulatorTypes';
import type { LabRow } from '@/components/tools/simulator/EHRLabsPanel';
import { CTG_PRESETS } from '@/lib/ctgPresets';
import { SEEDED_SCENARIOS } from '@/lib/simulatorScenarios';
import PatientBanner from '@/components/tools/simulator/PatientBanner';
import VitalSignsDisplay from '@/components/tools/simulator/VitalSignsDisplay';

const CTGMonitor   = dynamic(() => import('@/components/tools/simulator/CTGMonitor'),   { ssr: false });
const EHRLabsPanel = dynamic(() => import('@/components/tools/simulator/EHRLabsPanel'), { ssr: false });

const DEFAULT_PATIENT: PatientInfo = {
  name: '—', age: 0, gravida: 0, para: 0,
  gestational_weeks: 0, gestational_days: 0,
};
const DEFAULT_CTG    = CTG_PRESETS.normal.ctg;
const DEFAULT_VITALS = CTG_PRESETS.normal.vitals;

function makeLabRow(labs: CardLabs, abnormal: string[]): LabRow {
  return {
    id: `card_${Date.now()}`,
    timestamp: new Date().toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
    material: 'דם',
    labs,
    abnormal_fields: abnormal,
  };
}

// Plain 'use client' page — same pattern as live/[code]/page.tsx (no RSC boundary)
export default function TraineePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  const [isRunning, setIsRunning]     = useState(false);
  const [simEnded, setSimEnded]       = useState(false);
  const [ctgParams, setCtgParams]     = useState<CTGParams>(DEFAULT_CTG);
  const [vitals, setVitals]           = useState<VitalSigns>(DEFAULT_VITALS);
  const [patient, setPatient]         = useState<PatientInfo>(DEFAULT_PATIENT);
  const [labRows, setLabRows]         = useState<LabRow[]>([]);
  const [description, setDescription] = useState('');
  const [cardTitle, setCardTitle]     = useState('');
  const [cardNumber, setCardNumber]   = useState(0);
  const [currentFHR, setCurrentFHR]   = useState(DEFAULT_CTG.fhr_baseline);
  const [ctgResetKey, setCtgResetKey]             = useState(0);
  const [ctgRetroactiveKey, setCtgRetroactiveKey] = useState(0);
  const [simTime, setSimTime]         = useState(0);
  const [mounted, setMounted]         = useState(false);
  const [isPortrait, setIsPortrait]   = useState(false);
  const [isMuted, setIsMuted]         = useState(false);
  const [dbgStatus, setDbgStatus]     = useState('idle');
  const [dbgPoll, setDbgPoll]         = useState('idle');
  const [dbgPollN, setDbgPollN]       = useState(0);
  const [dbgEvents, setDbgEvents]     = useState(0);
  const [dbgLast, setDbgLast]         = useState('');

  const audioRef         = useRef<import('@/components/tools/simulator/AudioEngine').AudioEngine | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const pusherRef        = useRef<import('@/components/tools/simulator/PusherSync').PusherSync | null>(null);
  const stateInitialized = useRef(false);

  useEffect(() => {
    setMounted(true);
    const update = () => setIsPortrait(window.innerWidth < window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    import('@/components/tools/simulator/AudioEngine').then(({ AudioEngine }) => {
      audioRef.current = new AudioEngine();
      audioRef.current.initialize().catch(() => {});
    });
    return () => audioRef.current?.dispose();
  }, []);

  useEffect(() => {
    let lastUpdatedAt: number | null = null;
    const poll = async () => {
      setDbgPollN(n => n + 1);
      try {
        const res  = await fetch(`/api/sim-state/${code}`);
        if (!res.ok) { setDbgPoll(`e${res.status}`); return; }
        const data = await res.json() as { payload: unknown; updatedAt: number | null; dbOk?: boolean };
        const dbTag = data.dbOk ? 'db' : 'mem';
        if (!data.payload) { setDbgPoll(`${dbTag}:null`); return; }
        if (data.updatedAt === lastUpdatedAt) { setDbgPoll(`${dbTag}:same`); return; }
        lastUpdatedAt = data.updatedAt;
        const snap = data.payload as {
          type?: string; cardNumber?: number;
          structuredData?: { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo;
            labs?: CardLabs; abnormal_fields?: string[];
            clinical_description?: string; card_title?: string; } | null;
          isRunning?: boolean; simTimeSeconds?: number;
        };
        if (snap.type !== 'state-snapshot') { setDbgPoll(`${dbTag}:t:${snap.type}`); return; }
        setDbgPoll(`${dbTag}:got`);
        const d = snap.structuredData;
        if (d?.ctg)    setCtgParams(d.ctg);
        if (d?.vitals) setVitals(d.vitals);
        if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
        if (d?.labs)   setLabRows([makeLabRow(d.labs, d.abnormal_fields ?? [])]);
        if (d?.clinical_description !== undefined) setDescription(d.clinical_description);
        if (d?.card_title !== undefined)           setCardTitle(d.card_title);
        if ((snap.cardNumber ?? 0) > 0)            setCardNumber(snap.cardNumber!);
        if (snap.simTimeSeconds !== undefined) {
          // Compensate for how long ago the snapshot was written
          const latencySimSecs = (snap as { wallClockMs?: number }).wallClockMs
            ? Math.round((Date.now() - (snap as { wallClockMs: number }).wallClockMs) * 5 / 1000)
            : 0;
          setSimTime(snap.simTimeSeconds + latencySimSecs);
          stateInitialized.current = true;
        }
        if (snap.isRunning) {
          setIsRunning(true);
          audioRef.current?.initialize().then(() => audioRef.current?.startBeeping()).catch(() => {});
        }
      } catch { setDbgPoll('err'); }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Reliable initial-state load: if scenario ID is in the URL (?s=N), load
  // card 1 directly from SEEDED_SCENARIOS — no API call, no DB needed.
  // Falls back to sessions + scenarios API if ?s is absent (e.g. old links).
  // Note: we read window.location.search directly for old Safari/iPad compat.
  useEffect(() => {
    let cancelled = false;

    // Fast path: scenario ID embedded in URL by instructor QR modal
    const sParam = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('s')
      : null;
    const scenarioId = sParam ? parseInt(sParam) : 0;
    if (scenarioId > 0) {
      const seeded = SEEDED_SCENARIOS[scenarioId - 1]; // 0-indexed
      const card1 = seeded?.cards.find(c => c.card_number === 1);
      if (card1 && !stateInitialized.current) {
        const d = card1.structured_data;
        if (d?.ctg)    setCtgParams(d.ctg);
        if (d?.vitals) setVitals(d.vitals);
        if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
        if (d?.labs)   setLabRows([makeLabRow(d.labs, d.abnormal_fields ?? [])]);
        if (card1.clinical_description) setDescription(card1.clinical_description);
        setCardTitle(card1.title);
        setCardNumber(1);
      }
      return; // done — Pusher/polling will advance to current card
    }

    // Slow path: fetch session then scenarios API (requires DB or Pusher)
    (async () => {
      try {
        const sRes = await fetch(`/api/simulator/sessions/${code}`);
        if (!sRes.ok || cancelled) return;
        const sData = await sRes.json() as { session?: { scenario_id?: number } };
        const sid = sData.session?.scenario_id;
        if (!sid || cancelled) return;

        const scRes = await fetch('/api/simulator/scenarios');
        if (!scRes.ok || cancelled) return;
        const scData = await scRes.json() as { scenarios?: Array<{
          id: number; cards: Array<{
            card_number: number; title: string; clinical_description: string;
            structured_data: { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo;
              labs?: CardLabs; abnormal_fields?: string[]; } | null;
          }>;
        }> };
        const scenario = scData.scenarios?.find(sc => sc.id === sid);
        const card1 = scenario?.cards.find(c => c.card_number === 1);
        if (!card1 || cancelled || stateInitialized.current) return;
        const d = card1.structured_data;
        if (d?.ctg)    setCtgParams(d.ctg);
        if (d?.vitals) setVitals(d.vitals);
        if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
        if (d?.labs)   setLabRows([makeLabRow(d.labs, d.abnormal_fields ?? [])]);
        if (card1.clinical_description) setDescription(card1.clinical_description);
        setCardTitle(card1.title);
        setCardNumber(1);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => setSimTime(t => t + 5), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning]);

  useEffect(() => { audioRef.current?.setFHR(currentFHR); }, [currentFHR]);

  useEffect(() => {
    let requestRetryId: ReturnType<typeof setInterval> | null = null;
    import('@/components/tools/simulator/PusherSync').then(({ PusherSync }) => {
      const sync = new PusherSync(code);
      pusherRef.current = sync;
      const unsub = sync.subscribe(event => {
        setDbgEvents(n => n + 1);
        setDbgLast(event.type);
        if (event.type === 'timer-control') {
          if (event.action === 'start' || event.action === 'resume') {
            // Sync clock to instructor's time, compensating for network latency
            if (event.simTimeSeconds !== undefined) {
              const latencySimSecs = event.wallClockMs
                ? Math.round((Date.now() - event.wallClockMs) * 5 / 1000)
                : 0;
              setSimTime(event.simTimeSeconds + latencySimSecs);
              stateInitialized.current = true;
            }
            setIsRunning(true);
            audioRef.current?.initialize().then(() => audioRef.current?.startBeeping()).catch(() => {});
          } else if (event.action === 'pause' || event.action === 'stop') {
            if (event.simTimeSeconds !== undefined) setSimTime(event.simTimeSeconds);
            audioRef.current?.stopBeeping();
            setIsRunning(false);
          }
        }
        if (event.type === 'card-advance') {
          const d = event.structuredData as { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo;
            labs?: CardLabs; abnormal_fields?: string[]; clinical_description?: string; card_title?: string; } | null;
          if (d?.ctg)    setCtgParams(d.ctg);
          if (d?.vitals) setVitals(d.vitals);
          if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
          if (d?.labs)   setLabRows(prev => [...prev, makeLabRow(d.labs!, d.abnormal_fields ?? [])]);
          if (d?.clinical_description !== undefined) setDescription(d.clinical_description);
          if (d?.card_title !== undefined)           setCardTitle(d.card_title);
          setCardNumber(event.cardNumber);
        }
        if (event.type === 'live-override') {
          if (event.retroactive) setCtgRetroactiveKey(k => k + 1);
          const p = event.params as {
            fhr_baseline?: number; fhr_variability?: string; accelerations?: string;
            decelerations?: string; contraction_frequency?: number; contraction_intensity?: string;
            special?: string; hr?: number; bp_systolic?: number; bp_diastolic?: number;
            spo2?: number; temp?: number;
          };
          setCtgParams(prev => ({
            ...prev,
            ...(p.fhr_baseline         !== undefined && { fhr_baseline:          p.fhr_baseline }),
            ...(p.fhr_variability      !== undefined && { fhr_variability:       p.fhr_variability as CTGParams['fhr_variability'] }),
            ...(p.accelerations        !== undefined && { accelerations:         p.accelerations as CTGParams['accelerations'] }),
            ...(p.decelerations        !== undefined && { decelerations:         p.decelerations as CTGParams['decelerations'] }),
            ...(p.contraction_frequency !== undefined && { contraction_frequency: p.contraction_frequency }),
            ...(p.contraction_intensity !== undefined && { contraction_intensity: p.contraction_intensity as CTGParams['contraction_intensity'] }),
            ...(p.special              !== undefined && { special:               p.special as CTGParams['special'] }),
          }));
          const vitalsUpdate: Partial<VitalSigns> = {};
          if (p.hr           !== undefined) vitalsUpdate.hr           = p.hr;
          if (p.bp_systolic  !== undefined) vitalsUpdate.bp_systolic  = p.bp_systolic;
          if (p.bp_diastolic !== undefined) vitalsUpdate.bp_diastolic = p.bp_diastolic;
          if (p.spo2         !== undefined) vitalsUpdate.spo2         = p.spo2;
          if (p.temp         !== undefined) vitalsUpdate.temp         = p.temp;
          if (Object.keys(vitalsUpdate).length > 0) setVitals(prev => ({ ...prev, ...vitalsUpdate }));
        }
        if (event.type === 'session-end') {
          audioRef.current?.stopBeeping();
          setIsRunning(false);
          setSimEnded(true);
        }
        if (event.type === 'state-snapshot') {
          const d = event.structuredData as { ctg?: CTGParams; vitals?: VitalSigns; patient?: PatientInfo;
            labs?: CardLabs; abnormal_fields?: string[]; clinical_description?: string; card_title?: string; } | null;
          if (d?.ctg)    setCtgParams(d.ctg);
          if (d?.vitals) setVitals(d.vitals);
          if (d?.patient) setPatient(prev => ({ ...prev, ...d.patient }));
          if (d?.labs)   setLabRows([makeLabRow(d.labs, d.abnormal_fields ?? [])]);
          if (d?.clinical_description !== undefined) setDescription(d.clinical_description);
          if (d?.card_title !== undefined)           setCardTitle(d.card_title);
          if (event.cardNumber > 0)    setCardNumber(event.cardNumber);
          // Always resync clock from authoritative instructor snapshot,
          // correcting for network latency using the embedded wall-clock stamp.
          {
            const latencySimSecs = event.wallClockMs
              ? Math.round((Date.now() - event.wallClockMs) * 5 / 1000)
              : 0;
            setSimTime(event.simTimeSeconds + latencySimSecs);
            stateInitialized.current = true;
          }
          if (event.isRunning) {
            setIsRunning(true);
            audioRef.current?.initialize().then(() => audioRef.current?.startBeeping()).catch(() => {});
          }
        }
      });
      sync.connect(
        process.env.NEXT_PUBLIC_PUSHER_KEY,
        process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap2',
      ).then(() => {
        setDbgStatus('ok');
        // Send request-state once immediately, then retry every 8s until we have data
        const sendRequest = () => sync.publish({ type: 'request-state' });
        setTimeout(sendRequest, 800);
        requestRetryId = setInterval(() => {
          if (stateInitialized.current) { clearInterval(requestRetryId!); requestRetryId = null; return; }
          sendRequest();
        }, 8000);
      }).catch((e) => {
        setDbgStatus(`err:${String(e).slice(0, 20)}`);
      });
    });
    return () => {
      if (requestRetryId !== null) clearInterval(requestRetryId);
      pusherRef.current?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleFHRUpdate = useCallback((fhr: number) => setCurrentFHR(fhr), []);

  const handleToggleMute = useCallback(() => {
    audioRef.current?.toggleMute();
    setIsMuted(m => !m);
  }, []);

  return (
    <div style={{
      background: '#0d0d1f', height: '100vh',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: 'hidden',
    }}>
      <PatientBanner patient={patient} simTimeSeconds={simTime} isRunning={isRunning} />

      {process.env.NODE_ENV !== 'production' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
          background: '#0a0a1a', borderTop: '1px solid #222',
          padding: '3px 10px', fontSize: '0.65rem', fontFamily: 'monospace',
          color: dbgPoll.includes('got') ? '#22c55e' : '#f59e0b',
          display: 'flex', gap: 14, flexWrap: 'wrap',
        }}>
          <span>JS:{mounted ? 'YES' : 'NO'}</span>
          <span>P:{dbgStatus}</span>
          <span>DB:{dbgPoll}({dbgPollN})</span>
          <span>Ev:{dbgEvents}{dbgLast ? '/'+dbgLast : ''}</span>
          <span>{code}</span>
        </div>
      )}

      {simEnded && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(13,13,31,0.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
          <div style={{ fontSize: '2.5rem' }}>✅</div>
          <div style={{ color: '#c4b5fd', fontSize: '1.4rem', fontWeight: 700 }}>הסימולציה הסתיימה</div>
          <div style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6 }}>תודה על השתתפותך</div>
        </div>
      )}

      {/* CTG + vitals — landscape: side-by-side; portrait: CTG on top, compact vitals below */}
      <div style={{
        flex: isPortrait ? '0 0 auto' : '0 0 370px',
        display: 'flex',
        flexDirection: isPortrait ? 'column' : 'row',
        minHeight: 0,
      }}>
        <div style={{ flex: '1 1 0', position: 'relative', minWidth: 0, height: isPortrait ? 280 : undefined }}>
          <CTGMonitor ctgParams={ctgParams} maternalHR={vitals.hr} isRunning={isRunning} onFHRUpdate={handleFHRUpdate} resetKey={ctgResetKey} retroactiveKey={ctgRetroactiveKey} />
          <button
            onClick={handleToggleMute}
            title={isMuted ? 'בטל השתקה' : 'השתק קול CTG'}
            style={{
              position: 'absolute', top: 8, right: 8,
              background: isMuted ? 'rgba(239,68,68,0.85)' : 'rgba(0,0,0,0.55)',
              border: `1px solid ${isMuted ? '#ef4444' : 'rgba(255,255,255,0.2)'}`,
              borderRadius: 6, color: '#fff', fontSize: '1.1rem',
              width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 10,
            }}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
        <div style={{
          width: isPortrait ? '100%' : 210,
          height: isPortrait ? 62 : undefined,
          flexShrink: 0,
          borderLeft: isPortrait ? 'none' : '1px solid rgba(139,92,246,0.15)',
          borderTop: isPortrait ? '1px solid rgba(139,92,246,0.15)' : 'none',
          padding: isPortrait ? '6px 8px' : 10,
        }}>
          <VitalSignsDisplay fhr={currentFHR} vitals={vitals} isRunning={isRunning} compact={isPortrait} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, borderTop: '2px solid rgba(139,92,246,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {cardNumber > 0 && (
            <span style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 6, padding: '2px 8px', color: '#c4b5fd', fontSize: '0.75rem', fontWeight: 700 }}>
              כרטיס {cardNumber}
            </span>
          )}
          {cardTitle && <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem' }} dir="rtl">{cardTitle}</span>}
          {!cardNumber && <span style={{ color: '#4b5563', fontSize: '0.82rem' }}>ממתין לנתונים קליניים...</span>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }} dir="rtl">
          {description && (
            <div>
              <div style={{ color: '#7c3aed', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>תיאור קליני</div>
              <div style={{ color: '#d1d5db', fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{description}</div>
            </div>
          )}
          {labRows.length > 0 && (
            <div>
              <div style={{ color: '#7c3aed', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>תוצאות מעבדה</div>
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <EHRLabsPanel rows={labRows} />
              </div>
              {labRows[labRows.length - 1]?.labs.other?.blood_type && (
                <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#fbbf24' }}>
                  סוג דם: {labRows[labRows.length - 1].labs.other!.blood_type}
                </div>
              )}
            </div>
          )}
          {patient.history && (
            <div>
              <div style={{ color: '#7c3aed', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>רקע רפואי</div>
              <div style={{ color: '#9ca3af', fontSize: '0.82rem', lineHeight: 1.6 }}>{patient.history}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

