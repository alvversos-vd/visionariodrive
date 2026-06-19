/**
 * Verificação REAL da permissão "Permitir o tempo todo" (ACCESS_BACKGROUND_LOCATION).
 *
 * Não existe API JS estável para checar diretamente se o usuário concedeu
 * "always" no Android — `checkPermissions()` retorna apenas `granted` (mesmo
 * com "durante o uso do app"). Usamos verificação EMPÍRICA: se o provider
 * background entrega fixes enquanto `document.hidden === true`, então o
 * sistema realmente está mantendo o GPS em background → permissão verificada.
 *
 * Reset: ao limpar consent ou ao iniciar novo turno sem fixes em hidden.
 */

const BG_VERIFIED_KEY = 'vd-bg-always-verified-v1';

export function isBgAlwaysVerified(): boolean {
  try { return localStorage.getItem(BG_VERIFIED_KEY) === '1'; } catch { return false; }
}

export function markBgAlwaysVerified(): void {
  try {
    const was = localStorage.getItem(BG_VERIFIED_KEY);
    localStorage.setItem(BG_VERIFIED_KEY, '1');
    if (was !== '1' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vd-bg-verified-changed', { detail: { verified: true } }));
    }
  } catch { /* noop */ }
}

export function clearBgAlwaysVerified(): void {
  try {
    localStorage.removeItem(BG_VERIFIED_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vd-bg-verified-changed', { detail: { verified: false } }));
    }
  } catch { /* noop */ }
}

/**
 * Abre a tela de Configurações do app no Android/iOS via plugin de background.
 * Em caso de falha, retorna `false` para a UI exibir instrução manual.
 */
export async function openAppLocationSettings(): Promise<boolean> {
  try {
    const { registerPlugin } = await import('@capacitor/core');
    const Bg = registerPlugin<{ openSettings: () => Promise<void> }>('BackgroundGeolocation');
    await Bg.openSettings();
    return true;
  } catch {
    return false;
  }
}
