'use client';

import { useState, useEffect, useRef } from 'react';
import type { PatientInfo } from '@/lib/simulatorTypes';

interface Props {
  patient: PatientInfo;
  simTimeSeconds: number; // controlled externally for multi-device sync
  isRunning: boolean;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PatientBanner({ patient, simTimeSeconds, isRunning }: Props) {
  const [elapsed, setElapsed] = useState(simTimeSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseRef     = useRef(simTimeSeconds);
  const startRef    = useRef(0);

  useEffect(() => {
    baseRef.current = simTimeSeconds;
    setElapsed(simTimeSeconds);
  }, [simTimeSeconds]);

  useEffect(() => {
    if (isRunning) {
      startRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        const delta = Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(baseRef.current + delta);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const { name, age, gravida, para, gestational_weeks, gestational_days, blood_type, allergies } = patient;

  return (
    <div
      dir="rtl"
      style={{
        background: 'linear-gradient(135deg, #1e0a35 0%, #2d1052 100%)',
        borderBottom: '1px solid rgba(139,92,246,0.3)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        minHeight: 52,
      }}
    >
      {/* Patient info — RTL */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1rem' }}>{name}</span>
        <InfoChip label="גיל" value={String(age)} />
        <InfoChip label="G" value={String(gravida)} inline />
        <InfoChip label="P" value={String(para)} inline />
        <InfoChip label="שבוע" value={`${gestational_weeks}+${gestational_days}`} />
        {blood_type && <InfoChip label="דם" value={blood_type} highlight />}
        {allergies && (
          <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600 }}>
            ⚠ {allergies}
          </span>
        )}
      </div>

      {/* Timer — LTR regardless of RTL context */}
      <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isRunning ? '#22c55e' : '#6b7280',
            boxShadow: isRunning ? '0 0 6px #22c55e' : 'none',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: isRunning ? '#f1f5f9' : '#9ca3af',
            fontFamily: 'monospace',
            fontSize: '1.4rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            minWidth: '5ch',
          }}
        >
          {formatTime(elapsed)}
        </span>
      </div>
    </div>
  );
}

function InfoChip({
  label, value, inline = false, highlight = false,
}: {
  label: string;
  value: string;
  inline?: boolean;
  highlight?: boolean;
}) {
  return (
    <span style={{ display: 'flex', gap: 3, alignItems: 'baseline', fontSize: '0.8rem' }}>
      <span style={{ color: 'rgba(167,139,250,0.8)', fontWeight: 500 }}>{label}{inline ? '' : ':'}</span>
      <span style={{ color: highlight ? '#fbbf24' : '#e2e8f0', fontWeight: 600 }}>{value}</span>
    </span>
  );
}
