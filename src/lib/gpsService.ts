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
    const ingest = (pos: GeolocationPosition) => {
      const t = pos.timestamp || Date.now();
      if (seenTs.has(t)) return;
      seenTs.add(t);
      if (seenTs.size > 200) {
        const arr = Array.from(seenTs).slice(-100);
        seenTs.clear();
        arr.forEach(x => seenTs.add(x));
      }
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
 * Provider ativo. Para migrar para Capacitor:
 *
 *   import { Geolocation } from '@capacitor/geolocation';
 *   class CapacitorGpsProvider implements GpsProvider { ... }
 *   export const gpsService: GpsProvider = Capacitor.isNativePlatform()
 *     ? new CapacitorGpsProvider()
 *     : new WebGpsProvider();
 */
export const gpsService: GpsProvider = new WebGpsProvider();
