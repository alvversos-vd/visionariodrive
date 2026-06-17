import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { gpsTelemetry } from '@/lib/gpsTelemetry';

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
    try {
      const isNative = Capacitor.isNativePlatform();
      const params = new URLSearchParams(window.location.search);
      setEnabled(isNative || params.get('gpsDebug') === '1');
    } catch {
      setEnabled(false);
    }
  }, []);

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        const path = await gpsTelemetry.export();
        toast(path === 'failed' ? 'Falha ao exportar diagnóstico' : `Diagnóstico exportado (${path})`);
      }}
      className="fixed bottom-4 right-4 z-[9999] px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg opacity-80 hover:opacity-100"
      aria-label="Exportar diagnóstico GPS"
    >
      GPS diag
    </button>
  );
}
