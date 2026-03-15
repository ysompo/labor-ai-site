import type { ReactNode } from 'react';

export default function SimulatorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}

      {/* Portrait-mode lock overlay — hidden in landscape via CSS */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: '#0d0d1f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          color: '#f1f5f9',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          textAlign: 'center',
          padding: 32,
        }}
        className="portrait-lock"
      >
        <div style={{ fontSize: '4rem', animation: 'spin90 1.5s ease-in-out infinite alternate' }}>
          📱
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>סובבו את המסך</div>
        <div style={{ fontSize: '0.85rem', color: '#9ca3af', maxWidth: 260, lineHeight: 1.7 }}>
          הסימולטור מיועד לשימוש במצב אופקי (Landscape).<br />
          אנא סובבו את הטאבלט.
        </div>
      </div>

      <style>{`
        /* Show only in portrait, hide in landscape */
        @media (orientation: landscape) {
          .portrait-lock { display: none !important; }
        }
        @media (orientation: portrait) {
          .portrait-lock { display: flex !important; }
        }

        @keyframes spin90 {
          from { transform: rotate(0deg); }
          to   { transform: rotate(90deg); }
        }
      `}</style>
    </>
  );
}
