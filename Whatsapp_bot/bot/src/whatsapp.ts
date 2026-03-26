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
 * Convenience alias — identical to sendText but name makes intent clear.
 */
export async function sendTextToGroup(
  groupJid: string,
  text: string
): Promise<void> {
  return sendText(groupJid, text);
}
