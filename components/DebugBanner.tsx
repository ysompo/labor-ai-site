'use client';

import { useEffect, useState } from 'react';

export default function DebugBanner() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const log = (msg: string) => {
      const entry = `${new Date().toISOString().slice(11, 19)} ${msg}`;
      setLines(prev => [...prev.slice(-8), entry]);
      try { localStorage.setItem('debug_log', (localStorage.getItem('debug_log') ?? '') + '\n' + entry); } catch {}
    };

    // Basic info
    log(`url: ${location.href}`);
    log(`viewport: ${window.innerWidth}×${window.innerHeight} | dpr:${devicePixelRatio}`);
    log(`ua: ${navigator.userAgent.slice(0, 100)}`);

    // Previous session log (survives navigation)
    const prev = localStorage.getItem('debug_log');
    if (prev) log(`PREV LOG: ${prev.slice(-150)}`);

    // Catch JS navigation
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);
    history.pushState = (...args) => { log(`pushState → ${args[2]}`); return origPush(...args); };
    history.replaceState = (...args) => { log(`replaceState → ${args[2]}`); return origReplace(...args); };
    window.addEventListener('popstate', () => log(`popstate → ${location.href}`));

    // Catch JS errors
    window.addEventListener('error', e => log(`JS ERROR: ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`));
    window.addEventListener('unhandledrejection', e => log(`UNHANDLED: ${String(e.reason).slice(0, 100)}`));

    // Check for meta refresh tag
    const meta = document.querySelector('meta[http-equiv="refresh"]');
    if (meta) log(`META REFRESH: ${meta.getAttribute('content')}`);

    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  if (!lines.length) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999999,
      background: '#1e3a5f', color: '#fff', fontSize: 11,
      padding: '8px 10px', lineHeight: 1.8, fontFamily: 'monospace',
      wordBreak: 'break-all',
    }}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
      <button
        onClick={() => { localStorage.removeItem('debug_log'); setLines([]); }}
        style={{ marginTop: 4, background: '#dc2626', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}
      >
        clear log
      </button>
    </div>
  );
}
