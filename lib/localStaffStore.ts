// Client-side localStorage roster for simulator staff.
// Used as the real store when the server DB is not configured.
// When DB IS configured, the API is source-of-truth and this is bypassed.

const LS_KEY = 'sim_roster_v1';

export interface LocalStaff {
  id: number;
  name: string;
  role: string;
  email: string;
  active: boolean;
}

export function lsLoad(): LocalStaff[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}

function lsSave(staff: LocalStaff[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(staff));
}

export function lsAdd(member: Omit<LocalStaff, 'id'>): LocalStaff {
  const all  = lsLoad();
  const item: LocalStaff = { ...member, id: Date.now() };
  lsSave([...all, item]);
  return item;
}

export function lsUpdate(id: number, patch: Partial<LocalStaff>): void {
  lsSave(lsLoad().map(s => s.id === id ? { ...s, ...patch } : s));
}

export function lsDelete(id: number): void {
  lsSave(lsLoad().filter(s => s.id !== id));
}
