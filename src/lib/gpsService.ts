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

    const watchId = navigator.geolocation.watchPosition(ingest, onErr, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 20000,
    });

    const poll = setInterval(() => {
      if (pausePollWhenHidden && typeof document !== 'undefined' && document.hidden) return;
      navigator.geolocation.getCurrentPosition(ingest, () => {}, {
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
 * - Web/PWA: WebGpsProvider (atual, estável, sem regressão)
 * - App nativo (após `npx cap add ios|android` e build em device):
 *   CapacitorGpsProvider com permissões reais do sistema e tracking
 *   foreground/background nativo.
 *
 * A interface GpsProvider é a MESMA — `useShiftTracker` não muda.
 */
function pickProvider(): GpsProvider {
  try {
    const w = typeof window !== 'undefined' ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }) : undefined;
    if (w?.Capacitor?.isNativePlatform?.()) {
      const platform = w.Capacitor.getPlatform?.() ?? 'native';
      // eslint-disable-next-line no-console
      console.info(`[gpsService] Using NATIVE provider (Capacitor / ${platform})`);
      return new CapacitorGpsProvider();
    }
  } catch { /* fallback web */ }
  // eslint-disable-next-line no-console
  console.info('[gpsService] Using WEB provider (navigator.geolocation)');
  return new WebGpsProvider();
}

export const gpsService: GpsProvider = pickProvider();


