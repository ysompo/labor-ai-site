'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import Link from 'next/link';

const AIScenarioEditor = dynamic(() => import('@/components/tools/simulator/admin/AIScenarioEditor'), { ssr: false });
const UserManagement   = dynamic(() => import('@/components/tools/simulator/admin/UserManagement'),   { ssr: false });

type Tab = 'scenarios' | 'users';

export default function AdminSimulatorPage() {
  const [tab, setTab] = useState<Tab>('users');

  const handleApplyScenario = async (scenario: unknown) => {
    try {
      await fetch('/api/simulator/scenarios', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(scenario),
      });
      alert('התרחיש נשמר בהצלחה');
    } catch {
      alert('שגיאה בשמירת התרחיש');
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        background: '#0d0d1f',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e0a35 0%, #2d1052 100%)',
        borderBottom: '1px solid rgba(139,92,246,0.3)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{ color: '#f1f5f9', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
          🏥 ניהול סימולטור
        </h1>
        <Link href="/tools/simulator" style={{ color: '#c4b5fd', fontSize: '0.82rem', textDecoration: 'none' }}>
          ← חזור לסימולטור
        </Link>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {([['users', 'ניהול משתמשים'], ['scenarios', 'עורך תרחישים AI']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '6px 18px',
              borderRadius: 20,
              border:      tab === key ? '1.5px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)',
              background:  tab === key ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
              color:       tab === key ? '#c4b5fd' : '#9ca3af',
              fontWeight:  tab === key ? 700 : 400,
              fontSize:    '0.85rem',
              cursor:      'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 24 }}>
        {tab === 'users'     && <UserManagement />}
        {tab === 'scenarios' && <AIScenarioEditor onApplyScenario={handleApplyScenario} />}
      </div>
    </div>
  );
}
