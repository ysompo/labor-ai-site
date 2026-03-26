"use strict";
/**
 * WhatsApp send helpers — thin wrappers around the Baileys socket.
 * The socket is injected at startup so all modules share the same connection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSocket = setSocket;
exports.sendText = sendText;
exports.sendTextToGroup = sendTextToGroup;
let _sock = null;
/**
 * Register the active Baileys socket.
 * Called once from index.ts after the connection is established.
 */
function setSocket(sock) {
    _sock = sock;
}
function requireSocket() {
    if (!_sock)
        throw new Error("WhatsApp socket is not initialised yet");
    return _sock;
}
/**
 * Send a plain text message to any JID (individual or group).
 */
async function sendText(jid, text) {
    const sock = requireSocket();
    await sock.sendMessage(jid, { text });
}
/**
 * Convenience alias — identical to sendText but name makes intent clear.
 */
async function sendTextToGroup(groupJid, text) {
    return sendText(groupJid, text);
}
//# sourceMappingURL=whatsapp.js.map