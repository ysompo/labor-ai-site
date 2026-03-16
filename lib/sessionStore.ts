// Sim live-state store.
// Writes to Neon Postgres (shared across all serverless instances).
// Falls back to in-memory Map when DB is unavailable.

import { isDbConfigured, sql } from '@/lib/db';

// Per-instance memory fallback
const memStore = new Map<string, { payload: unknown; updatedAt: number }>();

// Only create the table once per warm instance
let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS sim_live_state (
        session_code TEXT    PRIMARY KEY,
        payload      JSONB   NOT NULL,
        updated_ms   BIGINT  NOT NULL
      )
    `;
    tableReady = true;
  } catch { /* ignore — will retry next call */ }
}

export async function setSimState(code: string, payload: unknown): Promise<void> {
  const key = code.toUpperCase();
  const now = Date.now();
  memStore.set(key, { payload, updatedAt: now });

  if (!isDbConfigured()) return;
  try {
    await ensureTable();
    await sql`
      INSERT INTO sim_live_state (session_code, payload, updated_ms)
      VALUES (${key}, ${JSON.stringify(payload)}, ${now})
      ON CONFLICT (session_code)
      DO UPDATE SET payload = EXCLUDED.payload, updated_ms = EXCLUDED.updated_ms
    `;
  } catch { /* mem fallback already stored */ }
}

export async function getSimState(code: string): Promise<{ payload: unknown; updatedAt: number } | null> {
  const key = code.toUpperCase();
  if (isDbConfigured()) {
    try {
      const r = await sql`
        SELECT payload, updated_ms FROM sim_live_state WHERE session_code = ${key}
      `;
      if (r.rows.length > 0) {
        return { payload: r.rows[0].payload, updatedAt: Number(r.rows[0].updated_ms) };
      }
      return null; // not in DB yet
    } catch { /* fall through to mem store */ }
  }
  return memStore.get(key) ?? null;
}
