'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface ToolsNavbarProps {
  currentModule?: 'simulator' | 'research';
  theme?: 'light' | 'dark';
  direction?: 'ltr' | 'rtl';
}

export default function ToolsNavbar({ currentModule, theme = 'light', direction = 'ltr' }: ToolsNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  // Hide on login pages
  if (pathname.includes('/login')) return null;

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const isDark = theme === 'dark';
  const isRtl = direction === 'rtl';

  const navItems = [
    { id: 'simulator', label: 'Simulator', icon: '⚙️', href: '/tools/simulator' },
    { id: 'research', label: 'Research', icon: '🔬', href: '/tools/research' },
  ];

  const bgColor = isDark ? 'rgba(13,13,31,0.92)' : '#ffffff';
  const borderColor = isDark ? 'rgba(139,92,246,0.15)' : 'rgba(75,46,106,0.15)';
  const textColor = isDark ? '#9ca3af' : '#4B2E6A';
  const accentColor = isDark ? '#a78bfa' : '#7c3aed';

  return (
    <nav
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        height: 44,
        background: bgColor,
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        gap: 16,
        fontFamily: "'Segoe UI', 'Inter', system-ui, sans-serif",
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Left side: Home + Module indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link
          href="/"
          style={{
            color: textColor,
            fontSize: '0.85rem',
            fontWeight: 700,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
          title="Back to home"
        >
          ← {isRtl ? 'דף בית' : 'Home'}
        </Link>

        {currentModule && (
          <>
            <div style={{ width: 1, height: 16, background: borderColor }} />
            <div style={{ fontSize: '0.75rem', color: textColor, fontWeight: 500 }}>
              {navItems.find(i => i.id === currentModule)?.label}
            </div>
          </>
        )}
      </div>

      {/* Right side: Module switcher + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Quick module switcher — only show other modules, not the current one */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {navItems.filter(item => item.id !== currentModule).map(item => (
            <Link
              key={item.id}
              href={item.href}
              title={item.label}
              style={{
                color: currentModule === item.id ? accentColor : textColor,
                fontSize: '1rem',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 6,
                background: currentModule === item.id ? `rgba(124,58,237,${isDark ? '0.15' : '0.1'})` : 'transparent',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (currentModule !== item.id) {
                  e.currentTarget.style.background = isDark ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.06)';
                }
              }}
              onMouseLeave={e => {
                if (currentModule !== item.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {item.icon}
            </Link>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: borderColor }} />

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            background: 'none',
            border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'}`,
            color: '#dc2626',
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '4px 10px',
            borderRadius: 6,
            cursor: loggingOut ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
            opacity: loggingOut ? 0.5 : 1,
          }}
          onMouseEnter={e => {
            if (!loggingOut) {
              e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none';
          }}
        >
          {loggingOut ? '…' : (isRtl ? 'יציאה' : 'Logout')}
        </button>
      </div>
    </nav>
  );
}
