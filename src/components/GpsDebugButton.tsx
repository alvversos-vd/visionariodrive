import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { gpsTelemetry } from '@/lib/gpsTelemetry';
import { subscribeBlockingModal } from '@/lib/uiModalState';

const GPS_DEBUG_KEY = 'vd-gps-debug-enabled';

function shouldShowGpsDiag(): boolean {
  const params = new URLSearchParams(window.location.search);
  const forcedByUrl = params.get('gpsDebug') === '1';
  const forcedByStorage = localStorage.getItem(GPS_DEBUG_KEY) === '1';
  return forcedByUrl || forcedByStorage;
}

/**
 * BUG-MVP-002 — Botão flutuante de exportação do diagnóstico GPS.
 * Renderizado quando:
 *   - a URL contém `?gpsDebug=1`; ou
 *   - o atalho explícito existente ativou o diagnóstico neste aparelho.
 * Não afeta tracking, persistência nem cálculos.
 */
export default function GpsDebugButton() {
  const [enabled, setEnabled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => subscribeBlockingModal(setModalOpen), []);


  useEffect(() => {
    const detect = () => {
      try {
        const show = shouldShowGpsDiag();
        setEnabled(show);
      } catch {
        setEnabled(false);
      }
    };
    const enableFromShortcut = () => setEnabled(true);
    detect();
    window.addEventListener('vd-gps-debug-enable', enableFromShortcut);
    return () => {
      window.removeEventListener('vd-gps-debug-enable', enableFromShortcut);
    };
  }, []);

  if (!enabled || modalOpen) return null;

  return (
    <Button
      variant="outline"
      type="button"
      onClick={async () => {
        const path = await gpsTelemetry.export();
        toast(path === 'failed' ? 'Falha ao exportar diagnóstico' : `Diagnóstico exportado (${path})`);
      }}
      className="m-4 min-h-11 text-xs"
      aria-label="Exportar diagnóstico GPS"
    >
      GPS diag
    </Button>
  );
}
