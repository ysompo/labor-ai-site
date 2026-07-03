'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { THEMES, SIM_THEME_STORAGE_KEY } from '@/lib/simTheme';
import type { SimTheme, SimThemeMode } from '@/lib/simTheme';

interface SimThemeContextValue {
  theme: SimTheme;
  mode: SimThemeMode;
  toggle: () => void;
}

// localStorage is the source of truth; light is the default.
const listeners = new Set<() => void>();

function subscribeToMode(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function readMode(): SimThemeMode {
  try {
    return localStorage.getItem(SIM_THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light'; // private-mode Safari
  }
}

function writeMode(next: SimThemeMode): void {
  try { localStorage.setItem(SIM_THEME_STORAGE_KEY, next); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

// Default context lets components render outside the provider (light theme, no-op toggle)
const SimThemeContext = createContext<SimThemeContextValue>({
  theme: THEMES.light,
  mode: 'light',
  toggle: () => {},
});

export function useSimTheme(): SimThemeContextValue {
  return useContext(SimThemeContext);
}

export default function SimThemeProvider({ children }: { children: ReactNode }) {
  // SSR renders light; the client snapshot (saved preference) applies on hydration.
  const mode = useSyncExternalStore(subscribeToMode, readMode, () => 'light' as SimThemeMode);

  const toggle = useCallback(() => {
    writeMode(readMode() === 'light' ? 'dark' : 'light');
  }, []);

  const value = useMemo(() => ({ theme: THEMES[mode], mode, toggle }), [mode, toggle]);

  return (
    <SimThemeContext.Provider value={value}>
      {children}
    </SimThemeContext.Provider>
  );
}

/** Small round ☀️/🌙 button — drop into any header bar. */
export function ThemeToggleButton({ style }: { style?: React.CSSProperties }) {
  const { theme, mode, toggle } = useSimTheme();
  return (
    <button
      onClick={toggle}
      title={mode === 'light' ? 'מצב כהה' : 'מצב בהיר'}
      aria-label={mode === 'light' ? 'מצב כהה' : 'מצב בהיר'}
      style={{
        width: 38, height: 38, borderRadius: '50%',
        border: `1px solid ${theme.borderSoft}`,
        background: theme.accentSoft, color: theme.text,
        fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >
      {mode === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
