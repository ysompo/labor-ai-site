/**
 * WhatsApp send helpers — thin wrappers around the Baileys socket.
 * The socket is injected at startup so all modules share the same connection.
 */
import type { WASocket } from "@whiskeysockets/baileys";
/**
 * Register the active Baileys socket.
 * Called once from index.ts after the connection is established.
 */
export declare function setSocket(sock: WASocket): void;
/**
 * Send a plain text message to any JID (individual or group).
 */
export declare function sendText(jid: string, text: string): Promise<void>;
/**
 * Convenience alias — identical to sendText but name makes intent clear.
 */
export declare function sendTextToGroup(groupJid: string, text: string): Promise<void>;
//# sourceMappingURL=whatsapp.d.ts.map