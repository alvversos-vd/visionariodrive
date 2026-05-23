import { useEffect, useRef, useState } from 'react';
import { addGpsDistance, appendRoutePoint, getActiveShift, Shift, setShiftGpsStatus } from '@/lib/shifts';
import { gpsService, GpsFix } from '@/lib/gpsService';

export type GpsState = 'idle' | 'requesting' | 'tracking' | 'denied' | 'unavailable' | 'paused';

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

/**
 * Rastreador de turno — comportamento mobile-first:
 *  - watchPosition com alta precisão
 *  - filtros anti-jitter (precisão ruim, micro-deslocamentos, jumps)
 *  - persiste pontos da rota no storage para sobreviver a minimizar/reload
 *  - Wake Lock para reduzir kill em background no Android
 *  - reconciliação no visibilitychange
 */
export function useShiftTracker(shift: Shift | null, opts?: { onTick?: () => void }) {
  const [gps, setGps] = useState<GpsState>('idle');
  const [, setTick] = useState(0);
  const lastPoint = useRef<Point | null>(null);
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
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

  // Visibility: ao voltar do background, força refresh + reconciliação
  useEffect(() => {
    if (!shift) return;
    const onVis = () => {
      if (!document.hidden) {
        // Re-âncora o último ponto para evitar "salto" no primeiro fix pós-background
        lastPoint.current = null;
        setTick(t => t + 1);
        onTickRef.current?.();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onVis);
    };
  }, [shift?.turno_id]);

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
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }
    if (shift.status !== 'ativo') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGps('unavailable');
      setShiftGpsStatus(shift.turno_id, 'unavailable');
      return;
    }

    setGps('requesting');
    let lastFixAt = Date.now();
    const turnoId = shift.turno_id;

    // Handler único — tanto watchPosition quanto polling chamam aqui.
    // Deduplica por timestamp e aplica filtros + cálculo Haversine incremental.
    const seenTs = new Set<number>();
    const ingest = (pos: GeolocationPosition) => {
      lastFixAt = Date.now();
      setGps(prev => (prev !== 'tracking' ? 'tracking' : prev));
      setShiftGpsStatus(turnoId, 'ok');
      const ts = pos.timestamp || Date.now();
      if (seenTs.has(ts)) return;
      seenTs.add(ts);
      if (seenTs.size > 200) {
        // bound — mantém só os 100 mais recentes
        const arr = Array.from(seenTs).slice(-100);
        seenTs.clear();
        arr.forEach(t => seenTs.add(t));
      }
      const cur: Point = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        t: ts,
        acc: pos.coords.accuracy ?? 999,
        spd: pos.coords.speed ?? undefined,
        hdg: pos.coords.heading ?? undefined,
      };
      // Filtro de precisão (mais permissivo em movimento: 100m)
      if (cur.acc > 100) return;

      const prev = lastPoint.current;
      if (!prev) {
        lastPoint.current = cur;
        appendRoutePoint(turnoId, { lat: cur.lat, lng: cur.lng, t: cur.t, spd: cur.spd, hdg: cur.hdg });
        onTickRef.current?.();
        return;
      }
      const dt = Math.max(0.001, (cur.t - prev.t) / 1000);
      const meters = haversineMeters(prev, cur);
      // Anti-jitter mínimo: só ignora pontos virtualmente idênticos
      if (meters < 2) return;
      const speedKmh = (meters / dt) * 3.6;
      if (speedKmh > 250) {
        // salto impossível — re-ancora sem somar (provável teletransporte GPS)
        lastPoint.current = cur;
        return;
      }
      addGpsDistance(turnoId, meters);
      appendRoutePoint(turnoId, { lat: cur.lat, lng: cur.lng, t: cur.t, spd: cur.spd, hdg: cur.hdg });
      lastPoint.current = cur;
      onTickRef.current?.();
    };

    const onErr = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setGps('denied');
        setShiftGpsStatus(turnoId, 'denied');
      }
      // outros erros (timeout/unavailable) — não rebaixa o estado se já está tracking;
      // o watchdog cuida disso.
    };

    const id = navigator.geolocation.watchPosition(ingest, onErr, {
      enableHighAccuracy: true,
      maximumAge: 1000, // permite fix recente (mais throughput em browsers que throttlam)
      timeout: 20000,
    });
    watchId.current = id;

    // Polling suplementar: força amostra a cada 2.5s — combate throttling de
    // watchPosition em mobile (Chrome/Safari frequentemente espaçam fixes em 5-10s).
    const poll = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return; // economia em background
      navigator.geolocation.getCurrentPosition(ingest, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      });
    }, 2500);

    // Watchdog: 60s sem fix → marca indisponível (modo manual)
    const watchdog = setInterval(() => {
      if (Date.now() - lastFixAt > 60000) {
        setGps(prev => (prev === 'tracking' || prev === 'requesting' ? 'unavailable' : prev));
        setShiftGpsStatus(turnoId, 'unavailable');
      }
    }, 5000);

    return () => {
      clearInterval(watchdog);
      clearInterval(poll);
      if (watchId.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      watchId.current = null;
      lastPoint.current = null;
    };
  }, [shift?.turno_id, shift?.status]);

  return { gps };
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
