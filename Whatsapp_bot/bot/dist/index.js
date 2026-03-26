"use strict";
/**
 * Labi — WhatsApp bot entry point.
 *
 * Connects to WhatsApp via Baileys, prints a QR code on first run,
 * persists the session in ./auth_info/ (no QR needed after first scan),
 * and routes every incoming message to the handler.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const pino_1 = __importDefault(require("pino"));
const handler_js_1 = require("./handler.js");
const whatsapp_js_1 = require("./whatsapp.js");
const logger = (0, pino_1.default)({ level: "silent" });
async function start() {
    const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)("./auth_info");
    const sock = (0, baileys_1.default)({
        auth: state,
        logger,
        printQRInTerminal: false, // We handle QR ourselves with qrcode-terminal
        browser: ["Labi Bot", "Chrome", "1.0.0"],
    });
    // Share the socket with the send helpers
    (0, whatsapp_js_1.setSocket)(sock);
    // ── Connection events ──────────────────────────────────────────────────────
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log("\nScan this QR code with your WhatsApp app:\n");
            qrcode_terminal_1.default.generate(qr, { small: true });
        }
        if (connection === "open") {
            console.log("Labi is online");
        }
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== baileys_1.DisconnectReason.loggedOut;
            console.log(`Connection closed (code ${statusCode}). ${shouldReconnect ? "Reconnecting..." : "Logged out — delete auth_info/ and restart to re-scan QR."}`);
            if (shouldReconnect) {
                // Brief delay before reconnecting to avoid hammering the server
                setTimeout(() => start(), 3000);
            }
        }
    });
    // ── Persist auth credentials whenever they change ─────────────────────────
    sock.ev.on("creds.update", saveCreds);
    // ── Incoming messages ─────────────────────────────────────────────────────
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        // "notify" = new messages pushed to us; "append" = historical/loaded
        if (type !== "notify")
            return;
        for (const msg of messages) {
            // Process each message independently — don't let one failure block others
            (0, handler_js_1.handleMessage)(sock, msg).catch((err) => {
                console.error("Unhandled error in handleMessage:", err instanceof Error ? err.message : err);
            });
        }
    });
}
start().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map