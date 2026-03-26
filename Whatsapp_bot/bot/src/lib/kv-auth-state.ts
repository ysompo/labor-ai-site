/**
 * kv-auth-state.ts
 *
 * Baileys auth state backed by Vercel KV instead of the local filesystem.
 * Survives Railway container restarts without needing a persistent volume.
 *
 * Key schema:
 *   auth:creds              → AuthenticationCreds (JSON with Buffer support)
 *   auth:key-{type}-{id}    → individual signal key
 */

import { kv } from "@vercel/kv";
import {
  initAuthCreds,
  BufferJSON,
  proto,
  type AuthenticationCreds,
  type SignalDataTypeMap,
  type AuthenticationState,
} from "@whiskeysockets/baileys";

// ── KV helpers ────────────────────────────────────────────────────────────────

const PREFIX = "auth:";

async function readData<T>(key: string): Promise<T | null> {
  const raw = await kv.get<string>(`${PREFIX}${key}`);
  if (!raw) return null;
  try {
    // kv may return already-parsed object or a string — handle both
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    return JSON.parse(str, BufferJSON.reviver) as T;
  } catch {
    return null;
  }
}

async function writeData(key: string, data: unknown): Promise<void> {
  const str = JSON.stringify(data, BufferJSON.replacer);
  await kv.set(`${PREFIX}${key}`, str);
}

async function removeData(key: string): Promise<void> {
  await kv.del(`${PREFIX}${key}`);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function useKVAuthState(): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const creds: AuthenticationCreds =
    (await readData<AuthenticationCreds>("creds")) ?? initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(
        type: T,
        ids: string[]
      ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        await Promise.all(
          ids.map(async (id) => {
            let value = await readData<SignalDataTypeMap[T]>(`key-${type}-${id}`);
            if (value) {
              // Deserialize AppStateSyncKeyData back to protobuf object
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(
                  value
                ) as unknown as SignalDataTypeMap[T];
              }
              result[id] = value;
            }
          })
        );
        return result;
      },

      set: async (data: Partial<{ [T in keyof SignalDataTypeMap]: { [id: string]: SignalDataTypeMap[T] | null } }>): Promise<void> => {
        const tasks: Promise<void>[] = [];
        for (const type of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
          const typeData = data[type];
          if (!typeData) continue;
          for (const id of Object.keys(typeData)) {
            const value = typeData[id];
            const key = `key-${String(type)}-${id}`;
            tasks.push(value != null ? writeData(key, value) : removeData(key));
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  const saveCreds = async (): Promise<void> => {
    await writeData("creds", state.creds);
  };

  return { state, saveCreds };
}
