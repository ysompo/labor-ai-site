'use client';

// no hooks needed — elapsed is derived directly from prop
import type { PatientInfo } from '@/lib/simulatorTypes';
import { useSimTheme } from './SimThemeProvider';

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
  const { theme } = useSimTheme();
  // simTimeSeconds is authoritative and already advancing at the correct simulation
  // speed on both instructor and participant devices — display it directly.
  const elapsed = simTimeSeconds;

  const { name, age, gravida, para, gestational_weeks, gestational_days, blood_type, allergies } = patient;

  return (
    <div
      dir="rtl"
      style={{
        // Brand-purple banner in both themes — white text stays readable
        background: theme.name === 'dark'
          ? 'linear-gradient(135deg, #1e0a35 0%, #2d1052 100%)'
          : 'linear-gradient(135deg, #4B2E6A 0%, #5b21b6 100%)',
        borderBottom: `1px solid ${theme.borderSoft}`,
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
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.15rem' }}>{name}</span>
        <InfoChip label="גיל" value={String(age)} />
        <InfoChip label="G" value={String(gravida)} inline />
        <InfoChip label="P" value={String(para)} inline />
        <InfoChip label="שבוע" value={`${gestational_weeks}+${gestational_days}`} />
        {blood_type && <InfoChip label="דם" value={blood_type} highlight />}
        {allergies && (
          <span style={{ color: '#fbbf24', fontSize: '0.9rem', fontWeight: 600 }}>
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
    <span style={{ display: 'flex', gap: 3, alignItems: 'baseline', fontSize: '0.95rem' }}>
      <span style={{ color: 'rgba(196,181,253,0.9)', fontWeight: 500 }}>{label}{inline ? '' : ':'}</span>
      <span style={{ color: highlight ? '#fbbf24' : '#f1f5f9', fontWeight: 600 }}>{value}</span>
    </span>
  );
}
