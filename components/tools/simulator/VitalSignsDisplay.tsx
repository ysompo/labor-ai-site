'use client';

import { useState, useEffect, useRef } from 'react';
import type { VitalSigns } from '@/lib/simulatorTypes';

interface Props {
  fhr: number;
  vitals: VitalSigns;
  isRunning: boolean;
  compact?: boolean;
}

interface DisplayVitals {
  hr: number;
  bp_systolic: number;
  bp_diastolic: number;
  spo2: number;
  temp: number;
}

function jitter(base: number, range: number): number {
  return Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;
}

function fhrColor(fhr: number): string {
  if (fhr === 0) return '#6b7280';                // grey – no fetal monitoring
  if (fhr < 110 || fhr > 160) return '#ef4444';  // red – alarm
  return '#22c55e';                               // green – normal
}

function bpColor(sys: number, dia: number): string {
  if (sys > 160 || sys < 90 || dia > 110) return '#ef4444';
  return '#f1f5f9';
}

function spo2Color(spo2: number): string {
  if (spo2 < 90) return '#ef4444';
  if (spo2 < 95) return '#eab308';
  return '#06b6d4';
}

function tempColor(temp: number): string {
  return temp > 38.0 ? '#ef4444' : '#f1f5f9';
}

function hrColor(hr: number): string {
  if (hr < 50 || hr > 120) return '#ef4444';
  return '#eab308';
}

export default function VitalSignsDisplay({ fhr, vitals, isRunning, compact = false }: Props) {
  // fhr comes straight from the CTGMonitor callback prop — no state copy needed
  const [display, setDisplay] = useState<DisplayVitals>({
    hr:           vitals.hr,
    bp_systolic:  vitals.bp_systolic,
    bp_diastolic: vitals.bp_diastolic,
    spo2:         vitals.spo2,
    temp:         vitals.temp,
  });

  // Sync base vitals when the card changes — derived-state-during-render
  // pattern (avoids a cascading setState-in-effect).
  const [prevVitals, setPrevVitals] = useState(vitals);
  if (vitals !== prevVitals) {
    setPrevVitals(vitals);
    setDisplay({
      hr:           vitals.hr,
      bp_systolic:  vitals.bp_systolic,
      bp_diastolic: vitals.bp_diastolic,
      spo2:         vitals.spo2,
      temp:         vitals.temp,
    });
  }

  // Random jitter every 2–3 seconds while running
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      setDisplay({
        hr:           Math.round(jitter(vitals.hr, 4)),
        bp_systolic:  Math.round(jitter(vitals.bp_systolic, 3)),
        bp_diastolic: Math.round(jitter(vitals.bp_diastolic, 2)),
        spo2:         Math.round(jitter(vitals.spo2, 1)),
        temp:         jitter(vitals.temp, 0.1),
      });
      timerRef.current = setTimeout(tick, 2000 + Math.random() * 1000);
    };

    timerRef.current = setTimeout(tick, 1000 + Math.random() * 1000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, vitals]);

  const isFhrAlarm   = fhr !== 0 && (fhr < 110 || fhr > 160);
  const isBpAlarm    = display.bp_systolic > 160 || display.bp_systolic < 90 || display.bp_diastolic > 110;
  const isSpo2Alarm  = display.spo2 < 95;

  // Compact horizontal bar for portrait/narrow screens
  // The vitals panel keeps its own dark bedside-monitor background in both
  // themes — the color-coded numbers are designed for a dark surface.
  if (compact) {
    return (
      <div dir="ltr" style={{ display: 'flex', gap: 6, alignItems: 'stretch', height: '100%', background: '#10122b', borderRadius: 8, padding: 4 }}>
        <CompactCell label="FHR" unit="bpm" alarm={isFhrAlarm}>
          <span style={{ color: fhrColor(fhr), fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>
            {fhr === 0 ? '---' : fhr}
          </span>
        </CompactCell>
        <CompactCell label="MHR" unit="bpm">
          <span style={{ color: hrColor(display.hr), fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>{display.hr}</span>
        </CompactCell>
        <CompactCell label="BP" unit="mmHg" alarm={isBpAlarm}>
          <span style={{ color: bpColor(display.bp_systolic, display.bp_diastolic), fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>
            {display.bp_systolic}<span style={{ fontSize: '0.8rem', opacity: 0.8 }}>/{display.bp_diastolic}</span>
          </span>
        </CompactCell>
        <CompactCell label="SpO₂" unit="%" alarm={isSpo2Alarm}>
          <span style={{ color: spo2Color(display.spo2), fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>{display.spo2}</span>
        </CompactCell>
        <CompactCell label="Temp" unit="°C">
          <span style={{ color: tempColor(display.temp), fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>{display.temp.toFixed(1)}</span>
        </CompactCell>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 h-full" dir="ltr" style={{ background: '#10122b', borderRadius: 8, padding: 4 }}>

      {/* FHR */}
      <VitalRow
        label="FHR"
        unit="bpm"
        alarm={isFhrAlarm}
      >
        <span style={{ color: fhrColor(fhr), fontSize: '1.9rem', fontWeight: 700, lineHeight: 1 }}>
          {fhr === 0 ? '---' : fhr}
        </span>
      </VitalRow>

      {/* MHR */}
      <VitalRow label="MHR" unit="bpm">
        <span style={{ color: hrColor(display.hr), fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
          {display.hr}
        </span>
      </VitalRow>

      {/* BP */}
      <VitalRow label="BP" unit="mmHg" alarm={isBpAlarm}>
        <span style={{ color: bpColor(display.bp_systolic, display.bp_diastolic), fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
          {display.bp_systolic}
          <span style={{ fontSize: '1rem', opacity: 0.8 }}>/{display.bp_diastolic}</span>
        </span>
      </VitalRow>

      {/* SpO2 */}
      <VitalRow label="SpO₂" unit="%" alarm={isSpo2Alarm}>
        <span style={{ color: spo2Color(display.spo2), fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
          {display.spo2}
        </span>
      </VitalRow>

      {/* Temp */}
      <VitalRow label="Temp" unit="°C">
        <span style={{ color: tempColor(display.temp), fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>
          {display.temp.toFixed(1)}
        </span>
      </VitalRow>
    </div>
  );
}

function CompactCell({
  label,
  unit,
  alarm = false,
  children,
}: {
  label: string;
  unit: string;
  alarm?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', padding: '4px 6px', borderRadius: 6, minWidth: 0,
        background: alarm ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${alarm ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      <div style={{ color: 'rgba(156,163,175,0.8)', fontSize: '0.6rem', fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        {children}
        <span style={{ color: 'rgba(107,114,128,0.7)', fontSize: '0.62rem' }}>{unit}</span>
      </div>
    </div>
  );
}

function VitalRow({
  label,
  unit,
  alarm = false,
  children,
}: {
  label: string;
  unit: string;
  alarm?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex-1 flex flex-col justify-center px-3 rounded"
      style={{
        background: alarm ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${alarm ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`,
        minHeight: 0,
      }}
    >
      <div style={{ color: 'rgba(156,163,175,0.8)', fontSize: '0.65rem', fontFamily: 'monospace', letterSpacing: '0.1em', marginBottom: 2 }}>
        {label}
      </div>
      <div className="flex items-end gap-1">
        {children}
        <span style={{ color: 'rgba(107,114,128,0.7)', fontSize: '0.7rem', paddingBottom: 3 }}>{unit}</span>
      </div>
    </div>
  );
}
