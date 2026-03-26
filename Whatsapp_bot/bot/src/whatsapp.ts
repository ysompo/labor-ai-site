/**
 * WhatsApp send helpers — thin wrappers around the Baileys socket.
 * The socket is injected at startup so all modules share the same connection.
 */

import type { WASocket } from "@whiskeysockets/baileys";

let _sock: WASocket | null = null;

/**
 * Register the active Baileys socket.
 * Called once from index.ts after the connection is established.
 */
export function setSocket(sock: WASocket): void {
  _sock = sock;
}

function requireSocket(): WASocket {
  if (!_sock) throw new Error("WhatsApp socket is not initialised yet");
  return _sock;
}

/**
 * Send a plain text message to any JID (individual or group).
 */
export async function sendText(jid: string, text: string): Promise<void> {
  const sock = requireSocket();
  await sock.sendMessage(jid, { text });
}

/**
 * Send a DM to a phone number (without @s.whatsapp.net).
 * Uses onWhatsApp() to verify the number and get the correct JID before sending.
 * Throws if the number is not found on WhatsApp.
 */
export async function sendDM(phone: string, text: string): Promise<void> {
  const sock = requireSocket();
  // Strip any accidental suffix so we always pass a bare phone number
  const barePhone = phone.replace(/@.+$/, "").replace(/:\d+$/, "");
  const results = await sock.onWhatsApp(barePhone);
  const entry = results?.[0];
  if (!entry?.exists || !entry.jid) {
    throw new Error(`Phone ${barePhone} is not on WhatsApp`);
  }
  await sock.sendMessage(entry.jid, { text });
}

/**
 * Convenience alias — identical to sendText but name makes intent clear.
 */
export async function sendTextToGroup(
  groupJid: string,
  text: string
): Promise<void> {
  return sendText(groupJid, text);
}
