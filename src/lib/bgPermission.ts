/**
 * Fonte única do estado operacional de background GPS no Android.
 *
 * A checagem primária é nativa (`ACCESS_BACKGROUND_LOCATION`), porque as APIs
 * Web/Capacitor Geolocation não distinguem "Durante o uso" de "Permitir o tempo todo".
 * A flag local continua como evidência empírica/fallback quando um fix chega em background.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

const BG_VERIFIED_KEY = 'vd-bg-always-verified-v1';

export interface BackgroundPermissionStatus {
  native: boolean;
  platform: 'android' | 'ios' | 'web' | 'unknown';
  sdkInt: number | null;
  foregroundLocationGranted: boolean;
  fineLocationGranted: boolean;
  coarseLocationGranted: boolean;
  backgroundLocationGranted: boolean;
  locationServicesEnabled: boolean;
  notificationPermissionRequired: boolean;
  notificationPermissionGranted: boolean;
  /**
   * `false` quando a leitura nativa da permissão de notificação falhou ou não
   * está disponível. Nunca tratamos falha técnica como "permissão concedida"
   * (fail-open): o estado permanece desconhecido e a descoberta continua ativa.
   */
  notificationPermissionKnown: boolean;
  batteryOptimizationDisabled: boolean;
}

type VisionarioPermissionsPlugin = {
  checkStatus: () => Promise<Partial<BackgroundPermissionStatus>>;
  requestNotificationPermission: () => Promise<Partial<BackgroundPermissionStatus>>;
  requestForegroundLocationPermission: () => Promise<Partial<BackgroundPermissionStatus>>;
  requestBackgroundLocationPermission: () => Promise<Partial<BackgroundPermissionStatus>>;
  openLocationPermissionSettings: () => Promise<{ opened?: boolean; destination?: string }>;
  openNotificationSettings: () => Promise<{ opened?: boolean; destination?: string }>;
};

function fallbackStatus(): BackgroundPermissionStatus {
  const w = typeof window !== 'undefined'
    ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } })
    : undefined;
  const native = !!w?.Capacitor?.isNativePlatform?.();
  const platform = (w?.Capacitor?.getPlatform?.() as BackgroundPermissionStatus['platform']) ?? (native ? 'unknown' : 'web');
  const verified = isBgAlwaysVerified();
  // Android nativo sem leitura confiável => estado DESCONHECIDO, tratado como
  // pendente de descoberta (fail-closed). Web/iOS não usam POST_NOTIFICATIONS.
  const androidUnknown = native && platform === 'android';
  return {
    native,
    platform,
    sdkInt: null,
    foregroundLocationGranted: verified,
    fineLocationGranted: verified,
    coarseLocationGranted: verified,
    backgroundLocationGranted: verified,
    locationServicesEnabled: true,
    notificationPermissionRequired: androidUnknown,
    notificationPermissionGranted: !androidUnknown,
    notificationPermissionKnown: !androidUnknown,
    batteryOptimizationDisabled: true,
  };
}


let cachedPlugin: VisionarioPermissionsPlugin | null | undefined;

/**
 * Instância ÚNICA e cacheada do plugin nativo `VisionarioPermissions`.
 * Registrada apenas no Android — evita registro duplicado e exceções
 * "not implemented on web" em PWA/desktop.
 */
export function getVisionarioPermissionsPlugin<T = VisionarioPermissionsPlugin>(): T | null {
  return plugin() as unknown as T | null;
}

/**
 * SÍNCRONA por contrato. O objeto devolvido por `registerPlugin()` é um Proxy
 * que responde a QUALQUER propriedade — inclusive `then` — o que o torna um
 * "thenable". Retorná-lo de uma função `async` faz o motor JS chamar
 * `proxy.then(resolve, reject)`, disparando no bridge o método inexistente
 * `VisionarioPermissions.then()`; a promise externa nunca se estabiliza e o
 * diagnóstico trava para sempre. A referência do plugin NUNCA pode atravessar
 * uma fronteira async/await/Promise.resolve — só o RESULTADO dos métodos pode.
 */
function plugin(): VisionarioPermissionsPlugin | null {
  if (cachedPlugin !== undefined) return cachedPlugin;
  try {
    // Plugin existe apenas no container nativo Android; em web/PWA o
    // registerPlugin geraria rejeição "not implemented on web".
    cachedPlugin = Capacitor.getPlatform() === 'android'
      ? registerPlugin<VisionarioPermissionsPlugin>('VisionarioPermissions')
      : null;
  } catch {
    cachedPlugin = null;
  }
  return cachedPlugin;
}


async function withForegroundFallback(base: BackgroundPermissionStatus): Promise<BackgroundPermissionStatus> {
  if (!base.native) return base;
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const perm = await Geolocation.checkPermissions();
    const foreground = perm.location === 'granted' || perm.coarseLocation === 'granted';
    return {
      ...base,
      foregroundLocationGranted: foreground || base.foregroundLocationGranted,
      fineLocationGranted: perm.location === 'granted' || base.fineLocationGranted,
      coarseLocationGranted: perm.coarseLocation === 'granted' || base.coarseLocationGranted,
    };
  } catch {
    return base;
  }
}

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

export async function getBackgroundPermissionStatus(): Promise<BackgroundPermissionStatus> {
  const base = fallbackStatus();
  const p = plugin();
  console.info('[BG-PERMISSION] check started', {
    native: base.native,
    platform: base.platform,
    pluginAvailable: p !== null,
  });
  if (!p || !base.native || base.platform !== 'android') {
    console.info('[BG-PERMISSION] using fallback', base);
    return withForegroundFallback(base);
  }
  try {
    const native = await p.checkStatus();
    console.info('[BG-PERMISSION] native checkStatus returned', native);
    const status: BackgroundPermissionStatus = {
      ...base,
      ...native,
      native: true,
      platform: 'android',
      // Leitura nativa bem-sucedida => estado conhecido.
      notificationPermissionKnown: typeof native.notificationPermissionGranted === 'boolean',
    };
    if (status.backgroundLocationGranted) markBgAlwaysVerified();
    else if (!status.foregroundLocationGranted) clearBgAlwaysVerified();
    console.info('[BG-PERMISSION] normalized native status', status);
    return status;
  } catch (error) {
    console.error('[BG-PERMISSION] native checkStatus failed; using fallback', error);
    return withForegroundFallback(base);
  }
}

export async function isBackgroundLocationGranted(): Promise<boolean> {
  return (await getBackgroundPermissionStatus()).backgroundLocationGranted;
}

export async function requestNotificationPermissionIfNeeded(): Promise<BackgroundPermissionStatus> {
  const before = await getBackgroundPermissionStatus();
  if (!before.native || before.platform !== 'android' || !before.notificationPermissionRequired || before.notificationPermissionGranted) {
    return before;
  }
  const p = plugin();
  if (!p) return before;
  try {
    const native = await p.requestNotificationPermission();
    return { ...before, ...native, native: true, platform: 'android' };
  } catch {
    return getBackgroundPermissionStatus();
  }
}

export async function requestForegroundLocationPermissionIfPossible(): Promise<BackgroundPermissionStatus> {
  const before = await getBackgroundPermissionStatus();
  if (before.foregroundLocationGranted) return before;
  // Caminho nativo (Android): callback resolve só após o diálogo do sistema fechar
  // e o estado de checkSelfPermission já estar propagado — fonte da verdade.
  if (before.native && before.platform === 'android') {
    const p = plugin();
    if (p?.requestForegroundLocationPermission) {
      try {
        const native = await p.requestForegroundLocationPermission();
        return { ...before, ...native, native: true, platform: 'android' };
      } catch {
        return getBackgroundPermissionStatus();
      }
    }
  }
  // Fallback: Capacitor Geolocation (iOS / web / plugin nativo indisponível)
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    await Geolocation.requestPermissions({ permissions: ['location'] });
  } catch { /* noop */ }
  return getBackgroundPermissionStatus();
}

export async function requestBackgroundLocationPermissionIfPossible(): Promise<BackgroundPermissionStatus> {
  const before = await getBackgroundPermissionStatus();
  if (!before.native || before.platform !== 'android' || before.backgroundLocationGranted) return before;
  const p = plugin();
  if (!p) return before;
  try {
    const native = await p.requestBackgroundLocationPermission();
    const status: BackgroundPermissionStatus = { ...before, ...native, native: true, platform: 'android' };
    if (status.backgroundLocationGranted) markBgAlwaysVerified();
    return status;
  } catch {
    return getBackgroundPermissionStatus();
  }
}

/**
 * Tenta abrir o ponto mais próximo possível da permissão do app.
 * Android não oferece deep-link público/estável direto para a opção "Permitir o tempo todo"
 * em todos os fabricantes, então a tela de detalhes do app é o fallback oficial.
 * Em caso de falha, retorna `false` para a UI exibir instrução manual.
 */
export async function openAppLocationSettings(): Promise<boolean> {
  try {
    const p = plugin();
    if (p) {
      await p.openLocationPermissionSettings();
      return true;
    }
    const { registerPlugin } = await import('@capacitor/core');
    const Bg = registerPlugin<{ openSettings: () => Promise<void> }>('BackgroundGeolocation');
    await Bg.openSettings();
    return true;
  } catch {
    return false;
  }
}

export async function openNotificationSettings(): Promise<boolean> {
  try {
    const p = plugin();
    if (!p) return false;
    await p.openNotificationSettings();
    return true;
  } catch {
    return false;
  }
}
