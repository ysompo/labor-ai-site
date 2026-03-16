'use client';

import { useEffect, useState } from 'react';

export default function DebugBanner() {
  const [info, setInfo] = useState('');

  useEffect(() => {
    setInfo(
      `viewport: ${window.innerWidth}×${window.innerHeight} | ` +
      `screen: ${screen.width}×${screen.height} | ` +
      `dpr: ${window.devicePixelRatio} | ` +
      `ua: ${navigator.userAgent}`
    );
  }, []);

  if (!info) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999,
      background: '#1e3a5f', color: '#fff', fontSize: 11,
      padding: '6px 10px', wordBreak: 'break-all', lineHeight: 1.5,
    }}>
      🔍 DEBUG: {info}
    </div>
  );
}
