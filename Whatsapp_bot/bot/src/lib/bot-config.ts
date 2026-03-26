/**
 * bot-config.ts
 * Stores mutable bot settings in Vercel KV.
 * Currently: bot display name (default "לאבי").
 */

import { kv } from "@vercel/kv";

const BOT_NAME_KEY = "bot:name";
const DEFAULT_NAME = "לאבי";

let cachedName: string | null = null; // in-process cache to avoid KV round-trips

export async function getBotName(): Promise<string> {
  if (cachedName) return cachedName;
  const stored = await kv.get<string>(BOT_NAME_KEY);
  cachedName = stored ?? DEFAULT_NAME;
  return cachedName;
}

export async function setBotName(name: string): Promise<void> {
  await kv.set(BOT_NAME_KEY, name);
  cachedName = name; // update in-process cache immediately
}
