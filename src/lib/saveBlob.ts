/**
 * BUG-MVP-004 — Entrega de arquivos cross-platform (browser + WebView Android/APK).
 *
 * Estratégia em cascata:
 *   1. Web Share API com files     → ideal para APK/WebView Android e iOS PWA
 *   2. Anchor download             → browsers desktop/mobile padrão
 *   3. window.open(blobUrl)        → último fallback (abre visualizador)
 *
 * Retorna qual caminho foi utilizado — útil para diagnóstico em campo.
 */
export type SaveBlobPath = 'web-share' | 'anchor-download' | 'window-open' | 'failed';

export async function saveBlob(blob: Blob, filename: string): Promise<SaveBlobPath> {
  // 1) Web Share API com arquivo (Android WebView moderno, iOS, Chrome mobile)
  try {
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    if (typeof File !== 'undefined' && nav.canShare && nav.share) {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return 'web-share';
      }
    }
  } catch (err) {
    // Usuário pode ter cancelado o share — não cair em fallback nesse caso
    if (err instanceof Error && err.name === 'AbortError') return 'web-share';
    // Outras falhas → segue para fallback
  }

  // 2) Anchor download (browsers padrão)
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'anchor-download';
  } catch {
    // segue
  }

  // 3) window.open (último recurso — abre visualizador)
  try {
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    if (w) return 'window-open';
  } catch {
    // segue
  }

  return 'failed';
}
