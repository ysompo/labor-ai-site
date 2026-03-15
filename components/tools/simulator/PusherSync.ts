import Pusher from 'pusher-js';
import type { LiveOverrideParams } from '@/lib/simulatorTypes';

export type SyncEvent =
  | { type: 'card-advance';      cardNumber: number; structuredData: unknown }
  | { type: 'live-override';     params: Partial<LiveOverrideParams> }
  | { type: 'timer-control';     action: 'start' | 'pause' | 'resume' | 'stop' }
  | { type: 'session-end' }
  | { type: 'note-added';        author: string; role: string; text: string; simTime: number; isQuickTag: boolean; tagType?: string }
  | { type: 'recording-started'; device: string; simTime: number }
  | { type: 'recording-stopped'; device: string; simTime: number; clipId: string };

type EventHandler = (event: SyncEvent) => void;

const ALL_EVENT_TYPES: SyncEvent['type'][] = [
  'card-advance',
  'live-override',
  'timer-control',
  'session-end',
  'note-added',
  'recording-started',
  'recording-stopped',
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

  connect(pusherKey?: string, cluster?: string): Promise<void> {
    const key = pusherKey ?? process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cl = cluster ?? process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap2';

    if (!key) {
      // Single-device mode — no Pusher
      this.singleDevice = true;
      this.connected = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.pusher = new Pusher(key, {
          cluster: cl,
          authEndpoint: '/api/pusher/auth',
        });

        const channelName = `presence-sim-${this.sessionCode}`;
        this.channel = this.pusher.subscribe(channelName);

        this.channel.bind('pusher:subscription_succeeded', () => {
          this.connected = true;
          resolve();
        });

        this.channel.bind('pusher:subscription_error', (err: unknown) => {
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
      this.pusher?.unsubscribe(`presence-sim-${this.sessionCode}`);
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
