import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Shift } from '@/lib/shifts';

interface Props {
  shift: Shift;
  className?: string;
}

// Limites para quebrar a polyline em segmentos (evita linha reta absurda
// atravessando lacunas de sinal / background).
const GAP_MS = 25_000;     // > 25s sem fix = começa novo segmento
const GAP_METERS = 250;    // ou pulo > 250m entre dois pontos consecutivos

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function segmentRoute(pts: NonNullable<Shift['rota']>): Array<Array<[number, number]>> {
  const segs: Array<Array<[number, number]>> = [];
  let cur: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i === 0) { cur.push([p.lat, p.lng]); continue; }
    const prev = pts[i - 1];
    const dt = p.t - prev.t;
    const dm = haversine(prev, p);
    if (dt > GAP_MS || dm > GAP_METERS) {
      if (cur.length > 0) segs.push(cur);
      cur = [];
    }
    cur.push([p.lat, p.lng]);
  }
  if (cur.length > 0) segs.push(cur);
  return segs;
}

/**
 * Mapa ao vivo estilo "Strava" — Leaflet + OSM, multi-segmento para evitar
 * retas atravessando lacunas de GPS (background, túnel, perda de sinal).
 */
export default function ShiftLiveMap({ shift, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylinesRef = useRef<L.Polyline[]>([]);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const didFitRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    }).setView([-23.55, -46.63], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      polylinesRef.current = [];
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = shift.rota || [];
    if (pts.length === 0) return;

    const segs = segmentRoute(pts);

    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = segs.map(seg =>
      L.polyline(seg, { color: '#FF6B35', weight: 5, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }).addTo(map)
    );

    const lastPt = pts[pts.length - 1];
    const last: [number, number] = [lastPt.lat, lastPt.lng];
    if (!markerRef.current) {
      markerRef.current = L.circleMarker(last, {
        radius: 8, color: '#fff', weight: 3, fillColor: '#FF6B35', fillOpacity: 1,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(last);
    }

    if (!didFitRef.current && pts.length > 1) {
      const bounds = L.latLngBounds(pts.map(p => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
      didFitRef.current = true;
    } else {
      map.panTo(last, { animate: true, duration: 0.6 });
    }
  }, [shift.rota?.length]);

  const pts = shift.rota || [];
  const last = pts[pts.length - 1];
  const segCount = pts.length > 0 ? segmentRoute(pts).length : 0;
  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={className ?? 'w-full h-48 rounded-xl overflow-hidden border border-border'}
        aria-label="Rota em tempo real"
      />
      <div className="absolute top-2 left-2 z-30 bg-background/85 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-[10px] font-mono leading-tight border border-border shadow-sm pointer-events-none">
        <div><span className="text-muted-foreground">pts</span> <span className="font-bold text-primary">{pts.length}</span> <span className="text-muted-foreground">seg</span> <span className="font-bold">{segCount}</span></div>
        <div><span className="text-muted-foreground">km</span> <span className="font-bold">{(shift.km_gps ?? 0).toFixed(2)}</span></div>
        {last?.spd != null && (
          <div><span className="text-muted-foreground">vel</span> <span className="font-bold">{(last.spd * 3.6).toFixed(0)}</span><span className="text-muted-foreground">km/h</span></div>
        )}
      </div>
    </div>
  );
}
