import Pusher from 'pusher-js';
import type { LiveOverrideParams, PushedLabRow } from '@/lib/simulatorTypes';

export type SyncEvent =
  | { type: 'card-advance';      cardNumber: number; structuredData: unknown }
  | { type: 'live-override';     params: Partial<LiveOverrideParams>; retroactive?: boolean }
  | { type: 'labs-push';         row: PushedLabRow }
  | { type: 'timer-control';     action: 'start' | 'pause' | 'resume' | 'stop'; simTimeSeconds?: number; wallClockMs?: number }
  | { type: 'session-end' }
  | { type: 'note-added';        author: string; role: string; text: string; simTime: number; isQuickTag: boolean; tagType?: string }
  | { type: 'recording-started'; device: string; simTime: number }
  | { type: 'recording-stopped'; device: string; simTime: number; clipId: string }
  | { type: 'request-state' }
  | { type: 'state-snapshot';    cardNumber: number; structuredData: unknown; isRunning: boolean; simTimeSeconds: number; wallClockMs?: number;
      pushedLabs?: PushedLabRow[];  // accumulated live-pushed lab rows — late joiners replay them
      caseStory?: string;           // opening vignette text shown to trainees
      scenarioName?: string };

type EventHandler = (event: SyncEvent) => void;

const ALL_EVENT_TYPES: SyncEvent['type'][] = [
  'card-advance',
  'live-override',
  'labs-push',
  'timer-control',
  'session-end',
  'note-added',
  'recording-started',
  'recording-stopped',
  'request-state',
  'state-snapshot',
];

export class PusherSync {
  private pusher: Pusher | null = null;
  private channel: ReturnType<Pusher['subscribe']> | null = null;
  private sessionCode: string;
  private handlers: EventHandler[] = [];
  private connected = false;
  private singleDevice = false;

  constructor(sessionCode: string) {
    this.sessionCode = sessionCode;
  }

  async connect(pusherKey?: string, cluster?: string): Promise<void> {
    let key = pusherKey ?? process.env.NEXT_PUBLIC_PUSHER_KEY;
    let cl  = cluster  ?? process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap2';

    // If key not baked into bundle (old build), fetch from server at runtime
    if (!key) {
      try {
        const cfg = await fetch('/api/pusher/config').then(r => r.json()) as { key: string; cluster: string };
        key = cfg.key || undefined;
        if (cfg.cluster) cl = cfg.cluster;
      } catch { /* ignore */ }
    }

    if (!key) {
      // Single-device mode — no Pusher
      this.singleDevice = true;
      this.connected = true;
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.pusher = new Pusher(key!, { cluster: cl });

        // Public channel — no auth required, works for unauthenticated trainees
        const channelName = `sim-${this.sessionCode}`;
        this.channel = this.pusher.subscribe(channelName);

        // Resolve after 6s regardless — channel bindings are active even if
        // subscription_succeeded is delayed (e.g. slow mobile WebSocket)
        const timeout = setTimeout(() => { this.connected = true; resolve(); }, 6000);

        this.channel.bind('pusher:subscription_succeeded', () => {
          clearTimeout(timeout);
          this.connected = true;
          resolve();
        });

        this.channel.bind('pusher:subscription_error', (err: unknown) => {
          clearTimeout(timeout);
          reject(err);
        });

        // Bind all event types
        for (const eventType of ALL_EVENT_TYPES) {
          this.channel.bind(eventType, (data: unknown) => {
            const event = { type: eventType, ...(data as object) } as SyncEvent;
            this.handlers.forEach((h) => h(event));
          });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.channel) {
      this.channel.unbind_all();
      this.pusher?.unsubscribe(`sim-${this.sessionCode}`);
      this.channel = null;
    }
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
    }
    this.connected = false;
    this.singleDevice = false;
  }

  publish(event: SyncEvent): void {
    // In single-device mode, call local handlers directly
    if (this.singleDevice) {
      this.handlers.forEach((h) => h(event));
      return;
    }

    // In connected mode, send via API and also call local handlers
    fetch('/api/pusher/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionCode: this.sessionCode, event }),
    }).catch((err) => {
      console.error('[PusherSync] publish error:', err);
    });

    // Also fire locally so the sending device updates immediately
    this.handlers.forEach((h) => h(event));
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
