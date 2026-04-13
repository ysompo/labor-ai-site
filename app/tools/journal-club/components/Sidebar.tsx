'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

interface SidebarProps {
  currentPage?: 'journals' | 'add' | 'history' | 'bookmarks' | 'settings';
}

export default function Sidebar({ currentPage }: SidebarProps) {
  const darkRef = useRef(false);
  const fsRef = useRef('md');

  useEffect(() => {
    // Initialize from localStorage
    const saved = localStorage.getItem('jc-dark-mode');
    const dark = saved ? JSON.parse(saved) : false;
    darkRef.current = dark;

    const savedFS = localStorage.getItem('jc-font-size') || 'md';
    fsRef.current = savedFS;

    // Apply to DOM
    const html = document.documentElement;
    if (dark) html.classList.add('dark');
    html.className = html.className.replace(/fs-\w+/g, '');
    html.classList.add(`fs-${savedFS}`);
  }, []);

  const toggleDark = () => {
    const newDark = !darkRef.current;
    darkRef.current = newDark;
    localStorage.setItem('jc-dark-mode', JSON.stringify(newDark));
    const html = document.documentElement;
    if (newDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    // Force re-render
    window.location.reload();
  };

  const handleFontSize = (size: 'sm' | 'md' | 'lg' | 'xl') => {
    fsRef.current = size;
    localStorage.setItem('jc-font-size', size);
    // eslint-disable-next-line react-hooks/immutability
    document.documentElement.className = document.documentElement.className.replace(/fs-\w+/g, '');
    document.documentElement.classList.add(`fs-${size}`);
  };

  const navItems = [
    { href: '/tools/journal-club/journals', label: 'Journals', icon: 'library_books', page: 'journals' as const },
    { href: '/tools/journal-club/history', label: 'History', icon: 'history', page: 'history' as const },
    { href: '/tools/journal-club/bookmarks', label: 'Bookmarks', icon: 'bookmark', page: 'bookmarks' as const },
  ];

  return (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '256px',
        height: '100%',
        padding: '24px 12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        zIndex: 40,
        fontSize: 'inherit',
      }}
    >
      {/* Back button */}
      <div style={{ paddingLeft: '12px', marginBottom: '8px' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600', marginBottom: '12px' }}>
          ← Back to Home
        </Link>
      </div>

      {/* Logo */}
      <div style={{ paddingLeft: '12px', marginBottom: '8px' }}>
        <Link href="/tools/journal-club" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: '#005977',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontFamily: 'Noto Serif',
              fontWeight: 'bold',
              fontSize: '14px',
            }}>
              JC
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#005977' }}>Journal Club</h3>
              <p style={{ margin: 0, fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>HUJI · PDF Library</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map(item => (
          <Link
            key={item.page}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              textDecoration: 'none',
              color: currentPage === item.page ? '#005977' : '#64748b',
              background: currentPage === item.page ? 'rgba(0, 89, 119, 0.1)' : 'transparent',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              if (currentPage !== item.page) {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== item.page) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <span style={{ fontSize: '20px' }}>📚</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom controls */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Dark mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
            <span>{darkRef.current ? '🌙' : '☀️'}</span>
            <span>{darkRef.current ? 'Dark' : 'Light'}</span>
          </div>
          <button
            onClick={toggleDark}
            style={{
              position: 'relative',
              width: '40px',
              height: '20px',
              borderRadius: '10px',
              background: darkRef.current ? '#005977' : '#cbd5e1',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: darkRef.current ? '20px' : '2px',
                width: '16px',
                height: '16px',
                background: 'white',
                borderRadius: '50%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                transition: 'all 0.2s',
              }}
            />
          </button>
        </div>

        {/* Font size */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
            <span>📝</span>
            <span>Text size</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
              <button
                key={size}
                onClick={() => handleFontSize(size)}
                style={{
                  width: size === 'lg' || size === 'xl' ? '28px' : '24px',
                  height: '24px',
                  borderRadius: '4px',
                  fontSize: size === 'sm' ? '10px' : size === 'md' ? '13px' : size === 'lg' ? '16px' : '18px',
                  fontWeight: 'bold',
                  color: fsRef.current === size ? '#005977' : '#9ca3af',
                  background: fsRef.current === size ? 'rgba(0, 89, 119, 0.1)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (fsRef.current !== size) {
                    e.currentTarget.style.color = '#005977';
                    e.currentTarget.style.background = 'rgba(0, 89, 119, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (fsRef.current !== size) {
                    e.currentTarget.style.color = '#9ca3af';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                A
              </button>
            ))}
          </div>
        </div>

        {/* Settings link */}
        <Link
          href="/tools/journal-club/settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            textDecoration: 'none',
            color: currentPage === 'settings' ? '#005977' : '#64748b',
            background: currentPage === 'settings' ? 'rgba(0, 89, 119, 0.1)' : 'transparent',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (currentPage !== 'settings') {
              e.currentTarget.style.background = '#f1f5f9';
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== 'settings') {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span style={{ fontSize: '20px' }}>⚙️</span>
          <span>Settings</span>
        </Link>

        {/* Logout button */}
        <form
          action="/api/auth/logout"
          method="POST"
          style={{ marginTop: 'auto' }}
        >
          <button
            type="submit"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: '20px' }}>🚪</span>
            <span>Logout</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
