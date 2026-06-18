import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { gpsTelemetry } from '@/lib/gpsTelemetry';

const GPS_DEBUG_KEY = 'vd-gps-debug-enabled';

function shouldShowGpsDiag(): boolean {
  const params = new URLSearchParams(window.location.search);
  const forcedByUrl = params.get('gpsDebug') === '1';
  const forcedByStorage = localStorage.getItem(GPS_DEBUG_KEY) === '1';
  const capacitorPlatform = Capacitor.getPlatform?.();
  const capacitorNative = Capacitor.isNativePlatform?.() === true || (capacitorPlatform != null && capacitorPlatform !== 'web');
  const bridge = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  const bridgePlatform = bridge?.getPlatform?.();
  const bridgeNative = bridge?.isNativePlatform?.() === true || (bridgePlatform != null && bridgePlatform !== 'web');
  const ua = navigator.userAgent;
  const androidWebView = /Android/i.test(ua) && (/(; wv\)|\bwv\b|Version\/\d+\.\d+)/i.test(ua));
  return forcedByUrl || forcedByStorage || capacitorNative || bridgeNative || androidWebView;
}

/**
 * BUG-MVP-002 — Botão flutuante de exportação do diagnóstico GPS.
 * Renderizado quando:
 *   - a URL contém `?gpsDebug=1`; ou
 *   - o app está rodando em plataforma nativa (Capacitor APK/IPA).
 * Não afeta tracking, persistência nem cálculos.
 */
export default function GpsDebugButton() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let attempts = 0;
    let timer: number | undefined;
    const detect = () => {
      try {
        const show = shouldShowGpsDiag();
        setEnabled(show);
        if (!show && attempts < 10) {
          attempts += 1;
          timer = window.setTimeout(detect, 500);
        }
      } catch {
        setEnabled(false);
      }
    };
    const enableFromShortcut = () => setEnabled(true);
    detect();
    window.addEventListener('vd-gps-debug-enable', enableFromShortcut);
    return () => {
      if (timer != null) window.clearTimeout(timer);
      window.removeEventListener('vd-gps-debug-enable', enableFromShortcut);
    };
  }, []);

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        const path = await gpsTelemetry.export();
        toast(path === 'failed' ? 'Falha ao exportar diagnóstico' : `Diagnóstico exportado (${path})`);
      }}
      className="fixed bottom-4 right-4 z-40 px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg opacity-80 hover:opacity-100"
      aria-label="Exportar diagnóstico GPS"
    >
      GPS diag
    </button>
  );
}
