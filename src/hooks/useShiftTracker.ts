import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { addGpsDistance, appendRoutePoint, flushShiftBuffers, getActiveShift, Shift, setShiftGpsStatus } from '@/lib/shifts';
import { gpsService, GpsFix } from '@/lib/gpsService';
import { gpsTelemetry } from '@/lib/gpsTelemetry';


export type GpsState =
  | 'idle'
  | 'requesting'
  | 'tracking'
  | 'background'   // app fora de foco — browser provavelmente reduzindo updates
  | 'denied'
  | 'unavailable'
  | 'paused';

interface Point {
  lat: number;
  lng: number;
  t: number;
  acc: number;
  spd?: number;
  hdg?: number;
}

function haversineMeters(a: Point, b: Point): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const THROTTLE_NOTICE_MS = 30_000;   // gap p/ avisar que o sistema reduziu o tracking
const HEARTBEAT_RESTART_MS = 15_000; // sem fix por 15s em foreground → recria watcher
const WATCHDOG_FAIL_MS = 60_000;     // 60s sem fix → marca unavailable
const THROTTLE_TOAST_COOLDOWN_MS = 5 * 60_000;

/**
 * Rastreador de turno — comportamento mobile-first:
 *  - watchPosition + polling suplementar via gpsService
 *  - filtros anti-jitter (precisão ruim, micro-deslocamentos, jumps)
 *  - persiste pontos da rota no storage para sobreviver a minimizar/reload
 *  - Wake Lock para reduzir kill em background no Android
 *  - Camada de resiliência foreground/background:
 *      • detecta hidden/visible/pagehide/focus/blur
 *      • recria watcher ao voltar
 *      • reconciliação (re-âncora último ponto, descarta saltos impossíveis)
 *      • heartbeat — se ficar sem fix em foreground, reinicia watcher
 *      • toast discreto quando o sistema reduziu o tracking em background
 */
export function useShiftTracker(shift: Shift | null, opts?: { onTick?: () => void }) {
  const [gps, setGps] = useState<GpsState>('idle');
  const [lastFixAt, setLastFixAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [restartKey, setRestartKey] = useState(0);
  const lastPoint = useRef<Point | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const lastThrottleToastRef = useRef<number>(0);
  const onTickRef = useRef(opts?.onTick);
  onTickRef.current = opts?.onTick;

  // Re-render por segundo enquanto turno ativo (não pausado) — só em foreground
  useEffect(() => {
    if (!shift || shift.status !== 'ativo') return;
    const i = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setTick(t => t + 1);
      onTickRef.current?.();
    }, 1000);
    return () => clearInterval(i);
  }, [shift?.turno_id, shift?.status]);

  // Visibility / lifecycle: marca background, força flush e reanexa watcher ao voltar
  useEffect(() => {
    if (!shift || shift.status !== 'ativo') return;

    const onHidden = () => {
      hiddenAtRef.current = Date.now();
      try { gpsTelemetry.event('visibility_change', { hidden: true }); } catch { /* noop */ }
      flushShiftBuffers(); // não perde pontos se o navegador suspender
      setGps(prev => (prev === 'tracking' || prev === 'requesting' ? 'background' : prev));
    };

    const onVisible = () => {
      const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
      hiddenAtRef.current = null;
      try {
        gpsTelemetry.event('visibility_change', { hidden: false, hidden_for_ms: hiddenFor });
        if (hiddenFor > 0) gpsTelemetry.event('background_period', { duration_ms: hiddenFor });
      } catch { /* noop */ }

      // Re-âncora — primeiro fix pós-background não deve gerar salto contábil
      lastPoint.current = null;
      setRestartKey(k => k + 1); // força re-subscribe limpo
      setTick(t => t + 1);
      onTickRef.current?.();

      if (
        hiddenFor > THROTTLE_NOTICE_MS &&
        Date.now() - lastThrottleToastRef.current > THROTTLE_TOAST_COOLDOWN_MS
      ) {

        lastThrottleToastRef.current = Date.now();
        const sec = Math.round(hiddenFor / 1000);
        toast('Tracking reduzido em segundo plano', {
          description: `O sistema pausou o GPS por ~${sec}s enquanto o app estava em segundo plano. Mantenha o app aberto para precisão máxima.`,
        });
      }
    };

    const onVis = () => (document.hidden ? onHidden() : onVisible());
    const onPageHide = () => { flushShiftBuffers(); };
    const onPageShow = () => onVisible();
    const onBlur = () => { /* alguns devices só sobem blur — flush por segurança */ flushShiftBuffers(); };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onVisible);
    };
  }, [shift?.turno_id, shift?.status]);

  // Wake Lock — tenta manter tela ligada durante turno ativo (best-effort)
  useEffect(() => {
    if (!shift || shift.status !== 'ativo') return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> } };
    if (!nav.wakeLock) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request('screen');
        if (cancelled) { lock.release().catch(() => {}); return; }
        wakeLock.current = lock;
        lock.addEventListener('release', () => { wakeLock.current = null; });
      } catch { /* sem permissão / unsupported — silencioso */ }
    };
    acquire();
    const onVis = () => { if (!document.hidden && !wakeLock.current) acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [shift?.turno_id, shift?.status]);

  // GPS watch + polling suplementar (combate throttling do browser)
  useEffect(() => {
    if (!shift) {
      setGps('idle');
      return;
    }
    if (shift.status === 'pausado') {
      setGps('paused');
      lastPoint.current = null;
      return;
    }
    if (shift.status !== 'ativo') return;
    if (!gpsService.isAvailable()) {
      setGps('unavailable');
      setShiftGpsStatus(shift.turno_id, 'unavailable');
      return;
    }

    setGps('requesting');
    let lastFixLocal = Date.now();
    let restartedByHeartbeat = false;
    const turnoId = shift.turno_id;

    const onFix = (fix: GpsFix) => {
      lastFixLocal = Date.now();
      setGps(prev => {
        const isBg = typeof document !== 'undefined' && document.hidden;
        const next: GpsState = isBg ? 'background' : 'tracking';
        return prev === next ? prev : next;
      });
      setShiftGpsStatus(turnoId, 'ok');

      if (fix.accuracy > 100) {
        try { gpsTelemetry.event('fix_dropped', { reason: 'low_accuracy', accuracy: fix.accuracy }); } catch { /* noop */ }
        return;
      }

      const cur: Point = {
        lat: fix.lat, lng: fix.lng, t: fix.t, acc: fix.accuracy,
        spd: fix.speed, hdg: fix.heading,
      };
      const prev = lastPoint.current;
      if (!prev) {
        lastPoint.current = cur;
        appendRoutePoint(turnoId, { lat: cur.lat, lng: cur.lng, t: cur.t, spd: cur.spd, hdg: cur.hdg });
        try { gpsTelemetry.event('fix_accepted', { reason: 'first_or_reanchor' }); } catch { /* noop */ }
        onTickRef.current?.();
        return;
      }
      const dt = Math.max(0.001, (cur.t - prev.t) / 1000);
      const meters = haversineMeters(prev, cur);
      if (meters < 2) {
        try { gpsTelemetry.event('fix_dropped', { reason: 'micro_move', meters, speed_kmh: (meters / dt) * 3.6 }); } catch { /* noop */ }
        return;
      }
      const speedKmh = (meters / dt) * 3.6;
      if (speedKmh > 250) {
        // salto impossível — re-ancora sem somar (reconciliação anti-duplicação)
        lastPoint.current = cur;
        try { gpsTelemetry.event('fix_dropped', { reason: 'impossible_jump', meters, speed_kmh: speedKmh }); } catch { /* noop */ }
        return;
      }
      addGpsDistance(turnoId, meters);
      appendRoutePoint(turnoId, { lat: cur.lat, lng: cur.lng, t: cur.t, spd: cur.spd, hdg: cur.hdg });
      lastPoint.current = cur;
      try { gpsTelemetry.event('fix_accepted', { meters, speed_kmh: speedKmh }); } catch { /* noop */ }
      onTickRef.current?.();
    };

    const handle = gpsService.watch({
      onFix,
      onError: (kind) => {
        if (kind === 'denied') {
          setGps('denied');
          setShiftGpsStatus(turnoId, 'denied');
        }
        try { gpsTelemetry.event('error', { kind }); } catch { /* noop */ }
      },
    });
    try { gpsTelemetry.event('watch_started', { turnoId }); } catch { /* noop */ }


    // Heartbeat/Watchdog (também propaga lastFixAt como state a cada 5s — cadência baixa
     // o suficiente para não causar renders excessivos no mobile).
    const interval = setInterval(() => {
      const since = Date.now() - lastFixLocal;
      const isBg = typeof document !== 'undefined' && document.hidden;
      setLastFixAt(lastFixLocal);

      if (since > WATCHDOG_FAIL_MS) {
        setGps(prev => (prev === 'tracking' || prev === 'requesting' || prev === 'background' ? 'unavailable' : prev));
        setShiftGpsStatus(turnoId, 'unavailable');
        try { gpsTelemetry.event('watchdog_unavailable', { since_ms: since, isBg }); } catch { /* noop */ }
        return;
      }

      // Em foreground, se ficou sem fix por >15s, tenta uma única reinicialização limpa
      if (!isBg && since > HEARTBEAT_RESTART_MS && !restartedByHeartbeat) {
        restartedByHeartbeat = true;
        try { gpsTelemetry.event('heartbeat_restart', { since_ms: since }); } catch { /* noop */ }
        setRestartKey(k => k + 1);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      handle.stop();
      try { gpsTelemetry.event('watch_stopped', { turnoId }); } catch { /* noop */ }
      lastPoint.current = null;
    };

  }, [shift?.turno_id, shift?.status, restartKey]);

  return { gps, lastFixAt };
}

export function fmtDuracao(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Tempo online em ms (descontando pausas) — calculado a partir de Date.now(). */
export function tempoOnlineMs(shift: Shift): number {
  const fim = shift.fim_turno ? new Date(shift.fim_turno).getTime() : Date.now();
  const ini = new Date(shift.inicio_turno).getTime();
  let pausado = 0;
  (shift.pausas || []).forEach(p => {
    const a = new Date(p.inicio).getTime();
    const b = p.fim ? new Date(p.fim).getTime() : Date.now();
    if (b > a) pausado += b - a;
  });
  return Math.max(0, fim - ini - pausado);
}

export { getActiveShift };
