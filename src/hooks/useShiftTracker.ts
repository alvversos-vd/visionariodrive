import { useEffect, useRef, useState } from 'react';
import { addGpsDistance, getActiveShift, Shift } from '@/lib/shifts';

export type GpsState = 'idle' | 'requesting' | 'tracking' | 'denied' | 'unavailable' | 'paused';

interface Point {
  lat: number;
  lng: number;
  t: number;
  acc: number;
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
 * Hook que rastreia GPS enquanto há um turno ativo e re-renderiza por segundo.
 * Aplica filtros anti-bug: precisão ruim, micro-deslocamentos, jumps de velocidade, throttle.
 */
export function useShiftTracker(shift: Shift | null, opts?: { onTick?: () => void }) {
  const [gps, setGps] = useState<GpsState>('idle');
  const [, setTick] = useState(0);
  const lastPoint = useRef<Point | null>(null);
  const watchId = useRef<number | null>(null);
  const onTickRef = useRef(opts?.onTick);
  onTickRef.current = opts?.onTick;

  // Re-render por segundo enquanto turno ativo (não pausado)
  useEffect(() => {
    if (!shift || shift.status !== 'ativo') return;
    const i = setInterval(() => {
      setTick(t => t + 1);
      onTickRef.current?.();
    }, 1000);
    return () => clearInterval(i);
  }, [shift?.turno_id, shift?.status]);

  // GPS watch
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
      return;
    }

    setGps('requesting');
    const id = navigator.geolocation.watchPosition(
      pos => {
        setGps('tracking');
        const cur: Point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: pos.timestamp || Date.now(),
          acc: pos.coords.accuracy ?? 999,
        };
        // Filtro: precisão ruim
        if (cur.acc > 50) return;
        const prev = lastPoint.current;
        if (!prev) {
          lastPoint.current = cur;
          return;
        }
        const dt = (cur.t - prev.t) / 1000;
        if (dt < 3) return; // throttle
        const meters = haversineMeters(prev, cur);
        if (meters < 10) return; // ignora ruído (parado)
        const speedKmh = (meters / dt) * 3.6;
        if (speedKmh > 200) {
          // jump impossível — ignora e re-ancora
          lastPoint.current = cur;
          return;
        }
        addGpsDistance(shift.turno_id, meters);
        lastPoint.current = cur;
        onTickRef.current?.();
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) setGps('denied');
        else setGps('unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    watchId.current = id;

    return () => {
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

// re-export to avoid unused warning when imported elsewhere
export { getActiveShift };
