import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { saveBlob } from '@/lib/saveBlob';
import { exportTelemetry } from '@/lib/exportTelemetry';
import { Button } from '@/components/ui/button';

/**
 * BUG-MVP-004/005 — Botão flutuante de diagnóstico de exportações.
 * Renderizado apenas quando a URL contém `?exportDebug=1`.
 *
 * Permite:
 *   - Exportar snapshot completo da telemetria (env + eventos)
 *   - Disparar exports de teste (1KB / 500KB / 5MB PDF dummy) para
 *     comparar comportamento em Browser / PWA / Capacitor Android.
 *
 * 100% passivo em relação ao tracking, persistência e cálculos.
 */
function makeDummyBlob(sizeBytes: number, mime: string): Blob {
  const chunk = 'A'.repeat(1024);
  const parts: string[] = [];
  let remaining = sizeBytes;
  while (remaining > 0) {
    const take = Math.min(remaining, chunk.length);
    parts.push(chunk.slice(0, take));
    remaining -= take;
  }
  return new Blob(parts, { type: mime });
}

export default function ExportDebugButton() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setEnabled(params.get('exportDebug') === '1');
    } catch {
      setEnabled(false);
    }
  }, []);

  if (!enabled) return null;

  const runTest = async (label: string, blob: Blob, ext: string) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = await saveBlob(blob, `export-test-${label}-${stamp}.${ext}`);
    toast(path === 'failed' ? `Teste ${label}: falhou` : `Teste ${label}: ${path}`);
  };

  const exportSnapshot = async () => {
    const snap = exportTelemetry.snapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = await saveBlob(blob, `export-diag-${stamp}.json`);
    toast(path === 'failed' ? 'Falha ao exportar diagnóstico' : `Diagnóstico (${path})`);
  };

  return (
    <div className="flex flex-col items-start gap-2 p-4">
      {open && (
        <div className="flex flex-col gap-1 p-2 rounded-lg bg-card border border-border shadow-xl text-xs">
          <Button className="min-h-11" onClick={exportSnapshot}>
            Exportar snapshot
          </Button>
          <Button variant="secondary" className="min-h-11" onClick={() => runTest('1kb', makeDummyBlob(1024, 'application/pdf'), 'pdf')}>
            Teste PDF 1KB
          </Button>
          <Button variant="secondary" className="min-h-11" onClick={() => runTest('500kb', makeDummyBlob(500 * 1024, 'application/pdf'), 'pdf')}>
            Teste PDF 500KB
          </Button>
          <Button variant="secondary" className="min-h-11" onClick={() => runTest('5mb', makeDummyBlob(5 * 1024 * 1024, 'application/pdf'), 'pdf')}>
            Teste PDF 5MB
          </Button>
          <Button variant="secondary" className="min-h-11" onClick={() => runTest('gpx', new Blob(['<gpx/>'], { type: 'application/gpx+xml' }), 'gpx')}>
            Teste GPX
          </Button>
          <Button variant="secondary" className="min-h-11" onClick={() => runTest('kml', new Blob(['<kml/>'], { type: 'application/vnd.google-earth.kml+xml' }), 'kml')}>
            Teste KML
          </Button>
        </div>
      )}
      <Button
        variant="outline"
        type="button"
        onClick={() => setOpen(o => !o)}
        className="min-h-11 text-xs"
        aria-label="Diagnóstico de exportações"
      >
        Export diag
      </Button>
    </div>
  );
}
