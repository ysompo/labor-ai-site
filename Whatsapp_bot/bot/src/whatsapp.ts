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
 * Send a DM to a contact by phone/LID.
 * Looks up the contact's stored Baileys JID (set when they last messaged us),
 * so it works even with Baileys LID format numbers that onWhatsApp() rejects.
 * Falls back to constructing phone@s.whatsapp.net if no stored JID exists.
 */
export async function sendDM(phone: string, text: string): Promise<void> {
  const sock = requireSocket();
  // Lazy import to avoid circular dependency
  const { getContactByPhone } = await import("./lib/contacts");
  const contact = await getContactByPhone(phone).catch(() => null);
  const jid = contact?.jid ?? `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
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
