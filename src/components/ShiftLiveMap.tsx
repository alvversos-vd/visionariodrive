import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Shift } from '@/lib/shifts';

interface Props {
  shift: Shift;
  className?: string;
}

/**
 * Mapa ao vivo estilo "Strava" usando Leaflet + tiles OSM.
 * - desenha a polyline da rota acumulada
 * - segue o último ponto suavemente
 * - sem dependência de API key
 */
export default function ShiftLiveMap({ shift, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

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
      polylineRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = (shift.rota || []).map(p => [p.lat, p.lng] as [number, number]);
    if (pts.length === 0) return;
    if (!polylineRef.current) {
      polylineRef.current = L.polyline(pts, { color: '#FF6B35', weight: 5, opacity: 0.9, lineJoin: 'round' }).addTo(map);
    } else {
      polylineRef.current.setLatLngs(pts);
    }
    const last = pts[pts.length - 1];
    if (!markerRef.current) {
      markerRef.current = L.circleMarker(last, {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: '#FF6B35',
        fillOpacity: 1,
      }).addTo(map);
    } else {
      markerRef.current.setLatLng(last);
    }
    // pan suave para acompanhar
    map.panTo(last, { animate: true, duration: 0.6 });
  }, [shift.rota?.length]);

  return (
    <div
      ref={containerRef}
      className={className ?? 'w-full h-48 rounded-xl overflow-hidden border border-border'}
      aria-label="Rota em tempo real"
    />
  );
}
