/**
 * BUG-MVP-002 — Instrumentação passiva de GPS.
 *
 * Observador puro: NÃO altera lógica de tracking, filtros, persistência,
 * cadência do watcher, cálculos de distância nem cálculos financeiros.
 *
 * - Ring buffer em memória (máx 5.000 eventos, ~500KB)
 * - Counters por minuto (received, accepted, dropped por razão, gaps, etc.)
 * - Export JSON via saveBlob (mesma estratégia cross-platform do BUG-004/005)
 *
 * Ativação: query param `?gpsDebug=1` (lido pelos consumidores de UI).
 * Este módulo é puramente passivo — não tem efeito colateral se ninguém
 * chamar export().
 */

import { saveBlob } from './saveBlob';

const MAX_EVENTS = 5000;
const STORAGE_KEY = 'vd-gps-telemetry-v1';
const PERSIST_DEBOUNCE_MS = 1500;

export type TelemetryEventName =
  | 'provider_selected'
  | 'watch_started'
  | 'watch_stopped'
  | 'raw_fix'
  | 'fix_accepted'
  | 'fix_dropped'
  | 'visibility_change'
  | 'heartbeat_restart'
  | 'watchdog_unavailable'
  | 'background_period'
  | 'error'
  // Background GPS (C2 Fase 1)
  | 'bg_runtime_diagnostics'
  | 'bg_provider_initialized'
  | 'bg_add_watcher_called'
  | 'bg_watcher_added'
  | 'bg_watcher_started'
  | 'bg_watcher_failed'
  | 'bg_watcher_removed'
  | 'bg_foreground_service_start_requested'
  | 'bg_permission_granted'
  | 'bg_permission_denied'
  | 'bg_consent_accepted'
  | 'bg_consent_declined'
  | 'bg_restart_bounce_requested'
  | 'bg_session_summary'
  | 'shift_battery_snapshot';

export interface TelemetryEvent {
  t: number;
  name: TelemetryEventName;
  data?: Record<string, unknown>;
}

interface MinuteBucket {
  minute: number;
  received: number;
  accepted: number;
  dropped: Record<string, number>;
  gaps_over_10s: number;
  gaps_over_30s: number;
  longest_gap_ms: number;
  bg_periods: number;
  accuracy_samples: number[];
  speed_samples: number[];
}

const buffer: TelemetryEvent[] = [];
const minutes = new Map<number, MinuteBucket>();
let startedAt: number | null = null;
let providerName: string = 'unknown';
let lastFixAt: number | null = null;
let sessionId: string | null = null;
let hydrated = false;
let lifecycleFlushInstalled = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

interface PersistedTelemetryState {
  version: 1;
  sessionId: string | null;
  startedAt: number | null;
  providerName: string;
  lastFixAt: number | null;
  events: TelemetryEvent[];
  minutes: MinuteBucket[];
}

function bucket(t: number): MinuteBucket {
  const m = Math.floor(t / 60_000);
  let b = minutes.get(m);
  if (!b) {
    b = {
      minute: m,
      received: 0,
      accepted: 0,
      dropped: {},
      gaps_over_10s: 0,
      gaps_over_30s: 0,
      longest_gap_ms: 0,
      bg_periods: 0,
      accuracy_samples: [],
      speed_samples: [],
    };
    minutes.set(m, b);
  }
  return b;
}

function percentile(arr: number[], p: number): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function push(ev: TelemetryEvent) {
  buffer.push(ev);
  if (buffer.length > MAX_EVENTS) buffer.splice(0, buffer.length - MAX_EVENTS);
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeBucket(raw: Partial<MinuteBucket>): MinuteBucket | null {
  if (typeof raw.minute !== 'number') return null;
  return {
    minute: raw.minute,
    received: typeof raw.received === 'number' ? raw.received : 0,
    accepted: typeof raw.accepted === 'number' ? raw.accepted : 0,
    dropped: raw.dropped && typeof raw.dropped === 'object' ? raw.dropped : {},
    gaps_over_10s: typeof raw.gaps_over_10s === 'number' ? raw.gaps_over_10s : 0,
    gaps_over_30s: typeof raw.gaps_over_30s === 'number' ? raw.gaps_over_30s : 0,
    longest_gap_ms: typeof raw.longest_gap_ms === 'number' ? raw.longest_gap_ms : 0,
    bg_periods: typeof raw.bg_periods === 'number' ? raw.bg_periods : 0,
    accuracy_samples: Array.isArray(raw.accuracy_samples) ? raw.accuracy_samples.filter(v => typeof v === 'number') : [],
    speed_samples: Array.isArray(raw.speed_samples) ? raw.speed_samples.filter(v => typeof v === 'number') : [],
  };
}

function readPersistedState(): PersistedTelemetryState | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedTelemetryState>;
    if (!Array.isArray(parsed.events)) return null;
    return {
      version: 1,
      sessionId: parsed.sessionId ?? null,
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
      providerName: typeof parsed.providerName === 'string' ? parsed.providerName : 'unknown',
      lastFixAt: typeof parsed.lastFixAt === 'number' ? parsed.lastFixAt : null,
      events: parsed.events.slice(-MAX_EVENTS),
      minutes: Array.isArray(parsed.minutes)
        ? parsed.minutes.map(normalizeBucket).filter((b): b is MinuteBucket => !!b)
        : [],
    };
  } catch {
    return null;
  }
}

function hydrateFromStorage() {
  if (hydrated) return;
  hydrated = true;
  const persisted = readPersistedState();
  if (!persisted || persisted.events.length === 0) return;
  sessionId = persisted.sessionId;
  startedAt = persisted.startedAt;
  providerName = persisted.providerName;
  lastFixAt = persisted.lastFixAt;
  buffer.length = 0;
  buffer.push(...persisted.events);
  minutes.clear();
  persisted.minutes.forEach(b => minutes.set(b.minute, b));
}

function persistNow() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!canUseStorage()) return;
  try {
    const state: PersistedTelemetryState = {
      version: 1,
      sessionId,
      startedAt,
      providerName,
      lastFixAt,
      events: buffer.slice(-MAX_EVENTS),
      minutes: [...minutes.values()],
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage cheio/indisponível — mantém buffer em memória */ }
}

function schedulePersist(immediate = false) {
  if (immediate) {
    persistNow();
    return;
  }
  if (persistTimer || !canUseStorage()) return;
  persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
}

function ensureLifecycleFlush() {
  if (lifecycleFlushInstalled || typeof window === 'undefined') return;
  lifecycleFlushInstalled = true;
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) persistNow();
    });
    window.addEventListener('pagehide', persistNow);
    window.addEventListener('beforeunload', persistNow);
  } catch { /* noop */ }
}

export const gpsTelemetry = {
  startSession(id: string) {
    hydrateFromStorage();
    ensureLifecycleFlush();
    const nextId = String(id);
    if (sessionId && sessionId !== nextId) this.reset();
    if (!sessionId) sessionId = nextId;
    if (!startedAt) startedAt = Date.now();
    schedulePersist(true);
  },

  setProvider(name: string) {
    hydrateFromStorage();
    ensureLifecycleFlush();
    providerName = name;
    if (!startedAt) startedAt = Date.now();
    push({ t: Date.now(), name: 'provider_selected', data: { provider: name } });
    schedulePersist(true);
  },

  event(name: TelemetryEventName, data?: Record<string, unknown>) {
    hydrateFromStorage();
    ensureLifecycleFlush();
    if (!startedAt) startedAt = Date.now();
    const t = Date.now();
    push({ t, name, data });
    const b = bucket(t);

    if (name === 'raw_fix') {
      b.received += 1;
      if (lastFixAt != null) {
        const gap = t - lastFixAt;
        if (gap > b.longest_gap_ms) b.longest_gap_ms = gap;
        if (gap > 10_000) b.gaps_over_10s += 1;
        if (gap > 30_000) b.gaps_over_30s += 1;
      }
      lastFixAt = t;
      const acc = data?.accuracy;
      const spd = data?.speed;
      if (typeof acc === 'number') b.accuracy_samples.push(acc);
      if (typeof spd === 'number') b.speed_samples.push(spd);
    } else if (name === 'fix_accepted') {
      b.accepted += 1;
    } else if (name === 'fix_dropped') {
      const reason = String(data?.reason ?? 'unknown');
      b.dropped[reason] = (b.dropped[reason] ?? 0) + 1;
    } else if (name === 'background_period') {
      b.bg_periods += 1;
    }
    schedulePersist(name === 'watch_stopped' || name === 'bg_session_summary');
  },

  reset() {
    buffer.length = 0;
    minutes.clear();
    startedAt = null;
    lastFixAt = null;
    providerName = 'unknown';
    sessionId = null;
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    try { if (canUseStorage()) window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  },

  snapshot() {
    hydrateFromStorage();
    persistNow();
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    const w = typeof window !== 'undefined' ? (window as unknown as { Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean } }) : undefined;
    const platform = w?.Capacitor?.isNativePlatform?.()
      ? `native:${w.Capacitor.getPlatform?.() ?? 'unknown'}`
      : 'web';

    const minuteList = [...minutes.values()]
      .sort((a, b) => a.minute - b.minute)
      .map(b => ({
        minute_epoch: b.minute * 60_000,
        received: b.received,
        accepted: b.accepted,
        dropped: b.dropped,
        gaps_over_10s: b.gaps_over_10s,
        gaps_over_30s: b.gaps_over_30s,
        longest_gap_ms: b.longest_gap_ms,
        bg_periods: b.bg_periods,
        accuracy_p50: percentile(b.accuracy_samples, 50),
        accuracy_p90: percentile(b.accuracy_samples, 90),
        accuracy_p99: percentile(b.accuracy_samples, 99),
        speed_p50: percentile(b.speed_samples, 50),
        speed_p99: percentile(b.speed_samples, 99),
        fixes_per_minute: b.received,
      }));

    return {
      meta: {
        appName: 'visionario-drive',
        appVersion: (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_APP_VERSION ?? '0.0.0',
        buildCommit: (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_BUILD_COMMIT ?? null,
        platform,
        userAgent: ua,
        provider: providerName,
        telemetrySessionId: sessionId,
        telemetryStorageKey: STORAGE_KEY,
        startedAt: startedAt ? new Date(startedAt).toISOString() : null,
        endedAt: new Date().toISOString(),
        eventCount: buffer.length,
        bufferLimit: MAX_EVENTS,
      },
      perMinute: minuteList,
      events: buffer,
    };
  },

  async export(): Promise<'native-share' | 'web-share' | 'anchor-download' | 'window-open' | 'failed'> {
    const snap = this.snapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = await saveBlob(blob, `gps-diag-${stamp}.json`);
    // eslint-disable-next-line no-console
    console.info('[gpsTelemetry] export delivery path:', path, '| size:', blob.size, 'bytes');
    return path;
  },
};
