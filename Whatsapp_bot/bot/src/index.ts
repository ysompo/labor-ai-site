import "dotenv/config";
import http from "http";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import type { ConnectionState } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { handleMessage } from "./handler";
import { setSocket } from "./whatsapp";
import { runAvailabilityReminders } from "./lib/reminder-job";
import { useKVAuthState } from "./lib/kv-auth-state";

const logger = pino({ level: "silent" });

// ── QR HTTP server (for Railway — visit /qr to scan) ─────────────────────────
let latestQr: string | null = null;

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url ?? "/", `http://localhost`);
  const qrSecret = process.env.QR_SECRET;

  if (reqUrl.pathname === "/qr") {
    // Require QR_SECRET query param if the env var is set
    if (qrSecret && reqUrl.searchParams.get("secret") !== qrSecret) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (!latestQr) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><p>No QR code available — Labi may already be connected.</p></body></html>");
      return;
    }
    // Return QR as a simple HTML page with the raw QR string for scanning
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html>
<head><title>Labi QR</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
  <h2>Scan with WhatsApp Business → Linked Devices</h2>
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQr)}" />
  <p style="color:gray">Refreshes automatically every 20s</p>
  <script>setTimeout(()=>location.reload(), 20000)</script>
</body>
</html>`);
  } else if (reqUrl.pathname === "/health") {
    res.writeHead(200);
    res.end("ok");
  } else {
    res.writeHead(200);
    res.end("Labi is running");
  }
});

server.listen(process.env.PORT ?? 3000, () => {
  console.log(`[labi] HTTP server listening on port ${process.env.PORT ?? 3000}`);
});

// ── WhatsApp connection ───────────────────────────────────────────────────────

async function start(): Promise<void> {
  const { state, saveCreds } = await useKVAuthState();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ["Labi Bot", "Chrome", "1.0.0"],
  });

  setSocket(sock);

  sock.ev.on("connection.update", (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQr = qr;
      console.log("[labi] QR code ready — visit /qr to scan");
    }

    if (connection === "open") {
      latestQr = null;
      console.log("Labi is online");
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        `Connection closed (code ${statusCode}). ${shouldReconnect ? "Reconnecting..." : "Logged out — delete auth_info/ and restart."}`
      );

      if (shouldReconnect) {
        setTimeout(() => start(), 3000);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
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

// Graceful shutdown — let Baileys flush credentials before Railway kills the process
process.on("SIGTERM", () => {
  console.log("[labi] SIGTERM received, shutting down gracefully...");
  setTimeout(() => process.exit(0), 2000); // 2s to flush pending writes
});
process.on("SIGINT", () => process.exit(0));

// ── Background reminder job (every 30 minutes) ────────────────────────────────
setInterval(() => {
  runAvailabilityReminders().catch(err =>
    console.error("[labi] reminder-job error:", err instanceof Error ? err.message : err)
  );
}, 30 * 60 * 1000);
