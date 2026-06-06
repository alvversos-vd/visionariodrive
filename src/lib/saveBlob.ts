/**
 * BUG-MVP-004 — Entrega de arquivos cross-platform (browser + WebView Android/APK).
 *
 * Estratégia em cascata:
 *   1. Web Share API com files     → ideal para APK/WebView Android e iOS PWA
 *   2. Anchor download             → browsers desktop/mobile padrão
 *   3. window.open(blobUrl)        → último fallback (abre visualizador)
 *
 * Retorna qual caminho foi utilizado — útil para diagnóstico em campo.
 *
 * Instrumentação BUG-MVP-004/005 (passiva): emite eventos via exportTelemetry
 * para evidenciar qual caminho realmente entrega o arquivo em cada ambiente
 * (Browser / PWA / Capacitor Android). NÃO altera o comportamento.
 */
import { exportTelemetry, type ExportType } from './exportTelemetry';

export type SaveBlobPath = 'web-share' | 'anchor-download' | 'window-open' | 'failed';

function inferType(filename: string): ExportType {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.gpx')) return 'gpx';
  if (lower.endsWith('.kml')) return 'kml';
  if (lower.endsWith('.json')) return 'diag-json';
  return 'other';
}

export async function saveBlob(blob: Blob, filename: string): Promise<SaveBlobPath> {
  exportTelemetry.attempt(inferType(filename), blob, filename);

  // Capability probe
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  let canShareFiles = false;
  try {
    if (typeof File !== 'undefined' && nav.canShare) {
      const probeFile = new File([new Blob([''])], 'probe.txt', { type: 'text/plain' });
      canShareFiles = !!nav.canShare({ files: [probeFile] });
    }
  } catch {
    canShareFiles = false;
  }
  exportTelemetry.capability({
    canShare: !!nav.canShare,
    canShareFiles,
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    hasDownloadAttr: typeof document !== 'undefined' ? 'download' in document.createElement('a') : false,
  });

  // 1) Web Share API com arquivo (Android WebView moderno, iOS, Chrome mobile)
  try {
    if (typeof File !== 'undefined' && nav.canShare && nav.share) {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      if (nav.canShare({ files: [file] })) {
        exportTelemetry.pathTried('web-share', 'canShare({files}) === true');
        const t0 = performance.now();
        try {
          await nav.share({ files: [file], title: filename });
          exportTelemetry.pathResult('web-share', 'resolved', performance.now() - t0);
          exportTelemetry.finalOutcome('web-share', 'assumed');
          return 'web-share';
        } catch (err) {
          const dur = performance.now() - t0;
          if (err instanceof Error && err.name === 'AbortError') {
            exportTelemetry.pathResult('web-share', 'aborted', dur, err.message);
            exportTelemetry.finalOutcome('web-share', 'assumed');
            return 'web-share';
          }
          exportTelemetry.pathResult('web-share', 'rejected', dur, err instanceof Error ? err.message : String(err));
          // segue para fallback
        }
      }
    }
  } catch (err) {
    exportTelemetry.pathResult('web-share', 'rejected', 0, err instanceof Error ? err.message : String(err));
  }

  // 2) Anchor download (browsers padrão)
  try {
    exportTelemetry.pathTried('anchor-download', 'fallback após web-share indisponível/rejeitado');
    const t0 = performance.now();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    exportTelemetry.pathResult('anchor-download', 'resolved', performance.now() - t0);
    exportTelemetry.finalOutcome('anchor-download', 'assumed');
    return 'anchor-download';
  } catch (err) {
    exportTelemetry.pathResult('anchor-download', 'rejected', 0, err instanceof Error ? err.message : String(err));
  }

  // 3) window.open (último recurso — abre visualizador)
  try {
    exportTelemetry.pathTried('window-open', 'fallback após anchor falhar');
    const t0 = performance.now();
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    if (w) {
      exportTelemetry.pathResult('window-open', 'resolved', performance.now() - t0);
      exportTelemetry.finalOutcome('window-open', 'assumed');
      return 'window-open';
    }
    exportTelemetry.pathResult('window-open', 'rejected', performance.now() - t0, 'window.open retornou null');
  } catch (err) {
    exportTelemetry.pathResult('window-open', 'rejected', 0, err instanceof Error ? err.message : String(err));
  }

  exportTelemetry.finalOutcome('failed', 'failed');
  return 'failed';
}
