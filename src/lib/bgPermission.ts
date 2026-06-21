/**
 * Fonte única do estado operacional de background GPS no Android.
 *
 * A checagem primária é nativa (`ACCESS_BACKGROUND_LOCATION`), porque as APIs
 * Web/Capacitor Geolocation não distinguem "Durante o uso" de "Permitir o tempo todo".
 * A flag local continua como evidência empírica/fallback quando um fix chega em background.
 */

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
}

type VisionarioPermissionsPlugin = {
  checkStatus: () => Promise<Partial<BackgroundPermissionStatus>>;
  requestNotificationPermission: () => Promise<Partial<BackgroundPermissionStatus>>;
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
  return {
    native,
    platform,
    sdkInt: null,
    foregroundLocationGranted: verified,
    fineLocationGranted: verified,
    coarseLocationGranted: verified,
    backgroundLocationGranted: verified,
    locationServicesEnabled: true,
    notificationPermissionRequired: false,
    notificationPermissionGranted: true,
  };
}

async function plugin(): Promise<VisionarioPermissionsPlugin | null> {
  try {
    const { registerPlugin } = await import('@capacitor/core');
    return registerPlugin<VisionarioPermissionsPlugin>('VisionarioPermissions');
  } catch {
    return null;
  }
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
  const p = await plugin();
  if (!p || !base.native || base.platform !== 'android') return withForegroundFallback(base);
  try {
    const native = await p.checkStatus();
    const status: BackgroundPermissionStatus = { ...base, ...native, native: true, platform: 'android' };
    if (status.backgroundLocationGranted) markBgAlwaysVerified();
    else if (!status.foregroundLocationGranted) clearBgAlwaysVerified();
    return status;
  } catch {
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
  const p = await plugin();
  if (!p) return before;
  try {
    const native = await p.requestNotificationPermission();
    return { ...before, ...native, native: true, platform: 'android' };
  } catch {
    return getBackgroundPermissionStatus();
  }
}

export async function requestBackgroundLocationPermissionIfPossible(): Promise<BackgroundPermissionStatus> {
  const before = await getBackgroundPermissionStatus();
  if (!before.native || before.platform !== 'android' || before.backgroundLocationGranted) return before;
  const p = await plugin();
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
    const p = await plugin();
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
    const p = await plugin();
    if (!p) return false;
    await p.openNotificationSettings();
    return true;
  } catch {
    return false;
  }
}
