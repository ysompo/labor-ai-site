/**
 * Labi — WhatsApp bot entry point.
 *
 * Connects to WhatsApp via Baileys, prints a QR code on first run,
 * persists the session in ./auth_info/ (no QR needed after first scan),
 * and routes every incoming message to the handler.
 */

import "dotenv/config";
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import type { ConnectionState } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { handleMessage } from "./handler";
import { setSocket } from "./whatsapp";

const logger = pino({ level: "silent" });

async function start(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: ["Labi Bot", "Chrome", "1.0.0"],
  });

  // Share the socket with the send helpers
  setSocket(sock);

  // ── Connection events ──────────────────────────────────────────────────────
  sock.ev.on("connection.update", (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\nScan this QR code with your WhatsApp app:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("Labi is online");
    }

    if (connection === "close") {
      const statusCode =
        (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      console.log(
        `Connection closed (code ${statusCode}). ${shouldReconnect ? "Reconnecting..." : "Logged out — delete auth_info/ and restart to re-scan QR."}`
      );

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
    if (type !== "notify") return;

    for (const msg of messages) {
      // Process each message independently — don't let one failure block others
      handleMessage(sock, msg).catch((err) => {
        console.error(
          "Unhandled error in handleMessage:",
          err instanceof Error ? err.message : err
        );
      });
    }
  });
}

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
