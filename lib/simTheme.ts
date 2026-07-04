// Theme tokens + type scale for the delivery-room simulator.
// Two modes: 'light' (default — matches the CTG paper / EHR sheet look)
// and 'dark' (the original navy design, kept pixel-identical).

export type SimThemeMode = 'light' | 'dark';

export interface SimTheme {
  name: SimThemeMode;
  bg: string;             // page background
  surface: string;        // panels/cards
  surfaceRaised: string;  // modals, elevated cards
  border: string;
  borderSoft: string;
  textHi: string;         // headings / highest contrast
  text: string;           // body
  textDim: string;        // secondary/muted
  brand: string;          // brand purple (gradient start)
  accent: string;         // interactive purple (gradient end)
  accentSoft: string;     // tinted backgrounds
  label: string;          // section labels
  lilac: string;          // decorative purple text
  chipBg: string;
  inputBg: string;
  danger: string;         // abnormal labs / errors
  success: string;
  overlay: string;        // modal backdrop
  ctg: {
    paper: string;
    gridMajor: string;
    gridMinor: string;
    fhrTrace: string;
    mhrTrace: string;
    tocoTrace: string;
    text: string;
  };
}

export const LIGHT_THEME: SimTheme = {
  name: 'light',
  bg: '#f6f4ef',
  surface: '#ffffff',
  surfaceRaised: '#fdfcf8',
  border: '#d8d3c8',
  borderSoft: 'rgba(75,46,106,0.18)',
  textHi: '#1e1b2e',
  text: '#332f45',
  textDim: '#6b6580',
  brand: '#4B2E6A',
  accent: '#6d28d9',
  accentSoft: 'rgba(109,40,217,0.08)',
  label: '#6d28d9',
  lilac: '#5b21b6',
  chipBg: 'rgba(109,40,217,0.10)',
  inputBg: '#ffffff',
  danger: '#dc2626',
  success: '#15803d',
  overlay: 'rgba(30,27,46,0.55)',
  ctg: {
    // identical to the original CTG paper — light mode must not change the trace look
    paper: '#ffffff',
    gridMajor: 'rgba(255, 140, 165, 0.80)',
    gridMinor: '#ffb3c6',
    fhrTrace: '#CC00CC',
    mhrTrace: '#22c55e',
    tocoTrace: '#000000',
    text: '#00aa00',
  },
};

export const DARK_THEME: SimTheme = {
  name: 'dark',
  bg: '#0d0d1f',
  surface: '#12122a',
  surfaceRaised: '#1a1a2e',
  border: 'rgba(139,92,246,0.3)',
  borderSoft: 'rgba(139,92,246,0.25)',
  textHi: '#f1f5f9',
  text: '#d1d5db',
  textDim: '#9ca3af',
  brand: '#4B2E6A',
  accent: '#7c3aed',
  accentSoft: 'rgba(124,58,237,0.12)',
  label: '#a78bfa',
  lilac: '#c4b5fd',
  chipBg: 'rgba(124,58,237,0.15)',
  inputBg: 'rgba(255,255,255,0.06)',
  danger: '#f87171',
  success: '#86efac',
  overlay: 'rgba(0,0,0,0.7)',
  ctg: {
    // dark-paper variant: dimmed grid, brightened traces
    paper: '#101322',
    gridMajor: 'rgba(255, 140, 165, 0.35)',
    gridMinor: 'rgba(255, 179, 198, 0.22)',
    fhrTrace: '#e879f9',
    mhrTrace: '#34d399',
    tocoTrace: '#e2e8f0',
    text: '#4ade80',
  },
};

export const THEMES: Record<SimThemeMode, SimTheme> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
};

export const SIM_THEME_STORAGE_KEY = 'sim_theme_mode';

// Type scale — iPad landscape read at arm's length / across the room
export const SIM_TYPE = {
  pageTitle:    '1.5rem',
  cardTitle:    '1.35rem',
  heading:      '1.15rem',
  body:         '1.1rem',   // line-height 1.75
  bodyLg:       '1.25rem',  // vignette text, line-height 1.9
  sectionLabel: '0.95rem',
  small:        '0.9rem',
  chip:         '1rem',
  tableHead:    '0.95rem',
  tableCell:    '1.05rem',
  button:       '1.05rem',
} as const;
