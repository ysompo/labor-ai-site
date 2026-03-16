// In-memory session state store.
// Persists within a single serverless function instance.
// Used as a fallback when Pusher WebSocket is unavailable.

const store = new Map<string, { payload: unknown; updatedAt: number }>();

export function setSimState(code: string, payload: unknown) {
  store.set(code.toUpperCase(), { payload, updatedAt: Date.now() });
}

export function getSimState(code: string) {
  return store.get(code.toUpperCase()) ?? null;
}
