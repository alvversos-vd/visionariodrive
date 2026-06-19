/**
 * Estado global de modais bloqueantes (consent dialogs, etc).
 * Usado para esconder elementos flutuantes que não devem sobrepor
 * diálogos críticos — ex.: botão "GPS diag" durante consentimento.
 */

let openCount = 0;
const listeners = new Set<(open: boolean) => void>();

function emit() {
  const open = openCount > 0;
  listeners.forEach(l => {
    try { l(open); } catch { /* noop */ }
  });
}

export function pushBlockingModal(): () => void {
  openCount += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount = Math.max(0, openCount - 1);
    emit();
  };
}

export function isBlockingModalOpen(): boolean {
  return openCount > 0;
}

export function subscribeBlockingModal(cb: (open: boolean) => void): () => void {
  listeners.add(cb);
  cb(openCount > 0);
  return () => { listeners.delete(cb); };
}
