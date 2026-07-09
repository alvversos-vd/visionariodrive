/**
 * BackgroundGpsProvider — Capacitor Community Background Geolocation.
 *
 * Implementa a MESMA interface `GpsProvider` que `WebGpsProvider` e
 * `CapacitorGpsProvider`. Nenhum consumidor (useShiftTracker, ShiftMode,
 * cálculos, persistência, sync) precisa mudar.
 *
 * Responsabilidades:
 *  - Iniciar foreground service Android com notificação persistente.
 *  - Entregar fixes pelo mesmo callback `onFix` já consumido em produção.
 *  - Parar foreground service imediatamente em `stop()` (fim/pausa do turno).
 *  - Emitir telemetria de bateria e sumário da sessão para validação A/B.
 *
 * Não acopla nada do plugin fora deste arquivo.
 */

import { registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import type { GpsProvider, GpsWatchHandle, GpsWatchOptions } from './gpsService';
import { gpsTelemetry } from './gpsTelemetry';
import { markBgAlwaysVerified } from './bgPermission';

// Plugin nativo sem entry-point JS — registramos via Capacitor core.
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

interface BgLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  simulated?: boolean;
  speed?: number | null;
  bearing?: number | null;
  time?: number | null;
}

type BatteryManager = {
  level: number; // 0..1
  charging: boolean;
  addEventListener?: (e: string, cb: () => void) => void;
  removeEventListener?: (e: string, cb: () => void) => void;
};

async function readBatteryPct(): Promise<number | null> {
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (!nav.getBattery) return null;
    const b = await nav.getBattery();
    if (typeof b.level !== 'number') return null;
    return Math.round(b.level * 100);
  } catch {
    return null;
  }
}

export class BackgroundGpsProvider implements GpsProvider {
  isAvailable(): boolean { return true; }

  async queryPermission(): Promise<PermissionState | 'unknown'> {
    // O plugin pede permissão automaticamente em addWatcher({requestPermissions:true}).
    // Aqui retornamos 'unknown' — o estado real é resolvido no primeiro fix/erro.
    return 'unknown';
  }

  watch({ onFix, onError }: GpsWatchOptions): GpsWatchHandle {
    let watcherId: string | null = null;
    let stopped = false;
    let fixCount = 0;
    let firstFixAt: number | null = null;
    let lastFixAt: number | null = null;
    const sessionStart = Date.now();
    let batteryStart: number | null = null;
    const watcherOptions = {
      backgroundMessage: 'Toque para abrir o Visionario',
      backgroundTitle: 'Visionario está registrando seu turno',
      requestPermissions: true,
      stale: false,
      distanceFilter: 5,
    };

     
    console.info('[BackgroundGpsProvider] watch() chamado — preparando addWatcher', watcherOptions);
    try {
      gpsTelemetry.event('bg_add_watcher_called', {
        provider: 'background',
        options: watcherOptions,
        hidden: typeof document !== 'undefined' ? document.hidden : null,
      });
      gpsTelemetry.event('bg_foreground_service_start_requested', {
        provider: 'background',
        has_background_message: !!watcherOptions.backgroundMessage,
        has_background_title: !!watcherOptions.backgroundTitle,
      });
    } catch { /* noop */ }

    (async () => {
      batteryStart = await readBatteryPct();
      try {
        gpsTelemetry.event('shift_battery_snapshot', {
          phase: 'start',
          provider: 'background',
          battery_pct: batteryStart,
          t: sessionStart,
        });
      } catch { /* noop */ }
    })();

    (async () => {
      try {
        if (stopped) return;

        const id = await BackgroundGeolocation.addWatcher(
          watcherOptions,
          (location?: BgLocation, error?: { code?: string; message?: string }) => {
            if (error) {
               
              console.error('[BackgroundGpsProvider] callback error', error);
              const code = (error.code ?? '').toLowerCase();
              if (code.includes('denied') || code.includes('not authorized')) {
                onError?.('denied', error);
              } else if (code.includes('unavailable') || code.includes('disabled')) {
                onError?.('unavailable', error);
              } else {
                onError?.('unavailable', error);
              }
              try {
                gpsTelemetry.event('bg_watcher_failed', { stage: 'callback', code: error.code, msg: error.message });
                gpsTelemetry.event('error', { kind: 'bg_plugin', code: error.code, msg: error.message });
              } catch { /* noop */ }
              return;
            }
            if (!location) return;

            const t = location.time ?? Date.now();
            fixCount += 1;
            if (firstFixAt == null) firstFixAt = t;
            lastFixAt = t;

            const hidden = typeof document !== 'undefined' ? document.hidden : null;
            try {
              gpsTelemetry.event('raw_fix', {
                source: 'bg',
                accuracy: location.accuracy ?? null,
                speed: location.speed ?? null,
                source_lag_ms: Date.now() - t,
                hidden,
                simulated: !!location.simulated,
              });
            } catch { /* noop */ }

            // Verificação empírica de "Permitir o tempo todo": se recebemos um
            // fix real com a tela bloqueada/app em background, o sistema está
            // de fato mantendo o GPS — permissão "always" foi concedida.
            if (hidden === true && !location.simulated) {
              try { markBgAlwaysVerified(); } catch { /* noop */ }
            }

            onFix({
              lat: location.latitude,
              lng: location.longitude,
              t,
              accuracy: location.accuracy ?? 999,
              speed: location.speed ?? undefined,
              heading: location.bearing ?? undefined,
            });
          },
        );

        if (stopped) {
          BackgroundGeolocation.removeWatcher({ id }).catch(() => { /* noop */ });
          return;
        }

        watcherId = id;
         
        console.info('[BackgroundGpsProvider] addWatcher iniciado com sucesso', { id });
        try {
          gpsTelemetry.event('bg_watcher_added', { id });
          gpsTelemetry.event('bg_watcher_started', { id, provider: 'background' });
        } catch { /* noop */ }
      } catch (e) {
         
        console.error('[BackgroundGpsProvider] addWatcher falhou', e);
        onError?.('unavailable', e);
        try {
          gpsTelemetry.event('bg_watcher_failed', { stage: 'addWatcher', msg: String(e) });
          gpsTelemetry.event('error', { kind: 'bg_init_failed', msg: String(e) });
        } catch { /* noop */ }
      }
    })();

    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        const durationMs = Date.now() - sessionStart;

        (async () => {
          const batteryEnd = await readBatteryPct();
          try {
            gpsTelemetry.event('shift_battery_snapshot', {
              phase: 'end',
              provider: 'background',
              battery_pct: batteryEnd,
              t: Date.now(),
            });
            gpsTelemetry.event('bg_session_summary', {
              provider: 'background',
              duration_ms: durationMs,
              fixes_received: fixCount,
              first_fix_at: firstFixAt,
              last_fix_at: lastFixAt,
              battery_start_pct: batteryStart,
              battery_end_pct: batteryEnd,
              battery_delta_pct: (batteryStart != null && batteryEnd != null)
                ? batteryStart - batteryEnd
                : null,
            });
          } catch { /* noop */ }
        })();

        if (watcherId) {
          BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => { /* noop */ });
          try { gpsTelemetry.event('bg_watcher_removed', { id: watcherId }); } catch { /* noop */ }
          watcherId = null;
        }
      },
    };
  }
}
