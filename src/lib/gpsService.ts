/**
 * GPS Service — camada de abstração sobre o provider de geolocalização.
 *
 * Hoje implementado em cima de `navigator.geolocation` (web/PWA).
 * Quando migrarmos pra Capacitor, basta trocar este arquivo por uma
 * implementação que use `@capacitor/geolocation` + plugin de background,
 * mantendo a MESMA interface — o hook `useShiftTracker` não muda.
 *
 * Princípios:
 *  - Não acopla a UI nem a lógica de turno ao provider.
 *  - Combina `watchPosition` + polling suplementar para combater throttling
 *    de mobile browsers (Chrome/Safari espaçam fixes em background).
 *  - Deduplica fixes por timestamp.
 *  - Retorna um `stop()` idempotente.
 */

import { gpsTelemetry } from './gpsTelemetry';
import { BackgroundGpsProvider } from './gpsBackgroundProvider';

const BG_CONSENT_KEY = 'vd-bg-gps-consent-v1';



export interface GpsFix {
  lat: number;
  lng: number;
  /** epoch ms */
  t: number;
  /** metros */
  accuracy: number;
  /** m/s */
  speed?: number;
  /** graus, 0–360 */
  heading?: number;
}

export type GpsErrorKind = 'denied' | 'unavailable' | 'timeout';

export interface GpsWatchOptions {
  onFix: (fix: GpsFix) => void;
  onError?: (kind: GpsErrorKind, raw?: unknown) => void;
  /** Intervalo do polling suplementar (ms). Default: 2500. */
  pollMs?: number;
  /** Pausa polling quando documento estiver hidden (default true). */
  pausePollWhenHidden?: boolean;
}

export interface GpsWatchHandle {
  stop: () => void;
}

export interface GpsProvider {
  isAvailable(): boolean;
  /** Retorna a permissão atual quando suportado, ou `unknown`. */
  queryPermission(): Promise<PermissionState | 'unknown'>;
  watch(opts: GpsWatchOptions): GpsWatchHandle;
}

/** Implementação web — `navigator.geolocation`. */
class WebGpsProvider implements GpsProvider {
  isAvailable(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.geolocation;
  }

  async queryPermission(): Promise<PermissionState | 'unknown'> {
    const nav = navigator as Navigator & {
      permissions?: { query: (q: { name: PermissionName }) => Promise<PermissionStatus> };
    };
    if (!nav.permissions?.query) return 'unknown';
    try {
      const s = await nav.permissions.query({ name: 'geolocation' as PermissionName });
      return s.state;
    } catch {
      return 'unknown';
    }
  }

  watch({ onFix, onError, pollMs = 2500, pausePollWhenHidden = true }: GpsWatchOptions): GpsWatchHandle {
    if (!this.isAvailable()) {
      onError?.('unavailable');
      return { stop: () => {} };
    }

    const seenTs = new Set<number>();
    const ingest = (pos: GeolocationPosition, source: 'watch' | 'poll') => {
      const t = pos.timestamp || Date.now();
      if (seenTs.has(t)) {
        try { gpsTelemetry.event('fix_dropped', { reason: 'dup_ts', source, t }); } catch { /* noop */ }
        return;
      }
      seenTs.add(t);
      if (seenTs.size > 200) {
        const arr = Array.from(seenTs).slice(-100);
        seenTs.clear();
        arr.forEach(x => seenTs.add(x));
      }
      try {
        gpsTelemetry.event('raw_fix', {
          source,
          accuracy: pos.coords.accuracy ?? null,
          speed: pos.coords.speed ?? null,
          source_lag_ms: Date.now() - t,
          hidden: typeof document !== 'undefined' ? document.hidden : null,
        });
      } catch { /* noop */ }
      onFix({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        t,
        accuracy: pos.coords.accuracy ?? 999,
        speed: pos.coords.speed ?? undefined,
        heading: pos.coords.heading ?? undefined,
      });
    };


    const onErr = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) onError?.('denied', err);
      else if (err.code === err.POSITION_UNAVAILABLE) onError?.('unavailable', err);
      else if (err.code === err.TIMEOUT) onError?.('timeout', err);
    };

    const watchId = navigator.geolocation.watchPosition(p => ingest(p, 'watch'), onErr, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 20000,
    });

    const poll = setInterval(() => {
      if (pausePollWhenHidden && typeof document !== 'undefined' && document.hidden) return;
      navigator.geolocation.getCurrentPosition(p => ingest(p, 'poll'), () => {}, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      });
    }, pollMs);


    let stopped = false;
    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        clearInterval(poll);
        try { navigator.geolocation.clearWatch(watchId); } catch { /* noop */ }
      },
    };
  }
}

/**
 * Capacitor native provider (Phase 1 — preparação).
 *
 * Quando rodando dentro do app nativo (`Capacitor.isNativePlatform()`),
 * usamos `@capacitor/geolocation` que dá:
 *   - permissões reais do sistema (não o prompt do browser)
 *   - precisão maior em iOS
 *   - lifecycle nativo (foreground service Android virá em fase 2 via
 *     plugin background-geolocation, sem mudar este arquivo)
 *
 * O lazy import evita que o bundle web cresça sem necessidade — Vite
 * code-splita esse chunk e ele só carrega no app nativo.
 */
class CapacitorGpsProvider implements GpsProvider {
  isAvailable(): boolean { return true; }

  async queryPermission(): Promise<PermissionState | 'unknown'> {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const s = await Geolocation.checkPermissions();
      if (s.location === 'granted') return 'granted';
      if (s.location === 'denied') return 'denied';
      if (s.location === 'prompt' || s.location === 'prompt-with-rationale') return 'prompt';
      return 'unknown';
    } catch { return 'unknown'; }
  }

  watch({ onFix, onError }: GpsWatchOptions): GpsWatchHandle {
    let watchId: string | null = null;
    let stopped = false;

    (async () => {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== 'granted') {
          onError?.(perm.location === 'denied' ? 'denied' : 'unavailable');
          return;
        }
        if (stopped) return;
        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 20000 },
          (pos, err) => {
            if (err) { onError?.('unavailable', err); return; }
            if (!pos) return;
            onFix({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              t: pos.timestamp || Date.now(),
              accuracy: pos.coords.accuracy ?? 999,
              speed: pos.coords.speed ?? undefined,
              heading: pos.coords.heading ?? undefined,
            });
          },
        );
      } catch (e) {
        onError?.('unavailable', e);
      }
    })();

    return {
      stop: () => {
        stopped = true;
        if (watchId) {
          import('@capacitor/geolocation').then(({ Geolocation }) =>
            Geolocation.clearWatch({ id: watchId! }).catch(() => {}),
          );
          watchId = null;
        }
      },
    };
  }
}

/**
 * Provider ativo — escolhido em runtime.
 * - Web/PWA: WebGpsProvider
 * - App nativo + flag VITE_BG_GPS=1 + consentimento background:
 *   BackgroundGpsProvider (foreground service Android, notificação persistente)
 * - App nativo (sem flag / sem consentimento): CapacitorGpsProvider (foreground only)
 *
 * Feature flag obrigatória (C2 Fase 1): rollback rápido via `.env` sem mexer em nativo.
 * Seleção é re-avaliada a cada `watch()` para refletir consentimento atualizado no app.
 */
function isNativePlatform(): boolean {
  try {
    const w = typeof window !== 'undefined' ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }) : undefined;
    return !!w?.Capacitor?.isNativePlatform?.();
  } catch { return false; }
}

function platformName(): string {
  try {
    const w = typeof window !== 'undefined' ? (window as unknown as { Capacitor?: { getPlatform?: () => string } }) : undefined;
    return w?.Capacitor?.getPlatform?.() ?? 'unknown';
  } catch { return 'unknown'; }
}

function bgFlagEnabled(): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
    // Default ligado; qualquer valor diferente de '1' desliga (rollback).
    // Aceita também VITE_BG_ENABLED=1 para diagnóstico explícito da build instalada.
    return (env.VITE_BG_GPS ?? env.VITE_BG_ENABLED ?? '1') === '1';
  } catch { return true; }
}

function hasBgConsent(): boolean {
  try { return localStorage.getItem(BG_CONSENT_KEY) === '1'; } catch { return false; }
}

function envValue(name: 'VITE_BG_GPS' | 'VITE_BG_ENABLED'): string | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
    return env[name] ?? null;
  } catch { return null; }
}

let lastPicked: { key: string; provider: GpsProvider } | null = null;

function pickProvider(): GpsProvider {
  const native = isNativePlatform();
  const plat = platformName();
  const flag = bgFlagEnabled();
  const consent = native && hasBgConsent();
  const useBg = native && flag && consent;
  const consentRaw = (() => {
    try { return localStorage.getItem(BG_CONSENT_KEY); } catch { return 'unavailable'; }
  })();

  const key = `${native ? 'native' : 'web'}:${plat}:flag=${flag ? 1 : 0}:consent=${consent ? 1 : 0}`;
  if (lastPicked?.key === key) return lastPicked.provider;

  let provider: GpsProvider;
  let label: string;
  if (useBg) {
    provider = new BackgroundGpsProvider();
    label = `capacitor-bg:${plat}`;
    try { gpsTelemetry.event('bg_provider_initialized', { platform: plat }); } catch { /* noop */ }
  } else if (native) {
    provider = new CapacitorGpsProvider();
    label = `capacitor:${plat}${flag ? '' : ' (bg-flag-off)'}${consent ? '' : ' (no-bg-consent)'}`;
  } else {
    provider = new WebGpsProvider();
    label = 'web:navigator.geolocation';
  }

  // eslint-disable-next-line no-console
  console.info(`[gpsService] Provider: ${label}`);
  // eslint-disable-next-line no-console
  console.info('[gpsService] Runtime diagnostics', {
    selectedProvider: label,
    native,
    platform: plat,
    bgEnabled: flag,
    VITE_BG_GPS: envValue('VITE_BG_GPS'),
    VITE_BG_ENABLED: envValue('VITE_BG_ENABLED'),
    bgConsent: consent,
    bgConsentRaw: consentRaw,
    useBackgroundProvider: useBg,
  });
  try { gpsTelemetry.setProvider(label); } catch { /* noop */ }
  try {
    gpsTelemetry.event('bg_runtime_diagnostics', {
      selected_provider: label,
      native,
      platform: plat,
      bg_enabled: flag,
      vite_bg_gps: envValue('VITE_BG_GPS'),
      vite_bg_enabled: envValue('VITE_BG_ENABLED'),
      bg_consent: consent,
      bg_consent_raw: consentRaw,
      use_background_provider: useBg,
    });
  } catch { /* noop */ }

  lastPicked = { key, provider };
  return provider;
}

/**
 * Proxy do provider — re-resolve em cada chamada para refletir feature flag
 * e consentimento background em runtime, sem reload.
 */
export const gpsService: GpsProvider = {
  isAvailable: () => pickProvider().isAvailable(),
  queryPermission: () => pickProvider().queryPermission(),
  watch: (opts) => pickProvider().watch(opts),
};




