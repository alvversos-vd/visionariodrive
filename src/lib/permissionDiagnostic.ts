/**
 * PermissionDiagnosticService
 * ---------------------------
 * Fonte ÚNICA da verdade sobre o estado operacional de permissões do app.
 *
 * Doutrina:
 *  - O produto NÃO depende de GPS. O GPS é uma camada de automação.
 *  - A fonte da verdade é sempre o estado REAL lido do dispositivo,
 *    nunca o clique do usuário em um diálogo de UI.
 *  - Em qualquer cenário onde o rastreamento automático não estiver
 *    100% válido, o app opera em modo manual — sem bloqueio.
 *
 * Observabilidade:
 *  - subscribe(fn): notifica em qualquer mudança (eventos lifecycle, focus,
 *    visibilitychange, retorno de Settings, force-manual toggle, refresh).
 */

import { getBackgroundPermissionStatus, getVisionarioPermissionsPlugin, type BackgroundPermissionStatus } from './bgPermission';
import { hasCapability } from './product/capabilities';


export type TrackingMode = 'automatic' | 'manual';

export interface PermissionDiagnostic {
  locationGranted: boolean;
  backgroundLocationGranted: boolean;
  notificationsGranted: boolean;
  notificationsRequired: boolean;
  /** `false` = leitura nativa indisponível/falhou. Nunca implica "concedida". */
  notificationsStatusKnown: boolean;
  batteryOptimizationDisabled: boolean;
  locationServicesEnabled: boolean;
  gpsReady: boolean;
  trackingMode: TrackingMode;
  forcedManual: boolean;
  platform: 'android' | 'ios' | 'web' | 'unknown';
  sdkInt: number | null;
  /** Razões pelas quais NÃO está em modo automático. Vazio = automático. */
  reasons: string[];
  checkedAt: number;
}

const FORCE_MANUAL_KEY = 'vd-tracking-force-manual-v1';
const ONBOARDING_DONE_KEY = 'vd-permission-onboarding-v1';

type NativePermPlugin = {
  isBatteryOptimizationDisabled?: () => Promise<{ disabled: boolean }>;
  requestIgnoreBatteryOptimization?: () => Promise<{ requested: boolean; disabled?: boolean }>;
};

/** Reusa a instância única/cacheada registrada em bgPermission (somente Android). SÍNCRONA: o Proxy do plugin nunca pode atravessar uma função async (thenable-leak). */
function nativePlugin(): NativePermPlugin | null {
  return getVisionarioPermissionsPlugin<NativePermPlugin>();
}


export function isForcedManual(): boolean {
  try { return localStorage.getItem(FORCE_MANUAL_KEY) === '1'; } catch { return false; }
}
export function setForcedManual(value: boolean): void {
  try {
    if (value) localStorage.setItem(FORCE_MANUAL_KEY, '1');
    else localStorage.removeItem(FORCE_MANUAL_KEY);
    notifyAll();
  } catch { /* noop */ }
}

export function isOnboardingCompleted(): boolean {
  try { return localStorage.getItem(ONBOARDING_DONE_KEY) === '1'; } catch { return false; }
}
export function markOnboardingCompleted(): void {
  try { localStorage.setItem(ONBOARDING_DONE_KEY, '1'); } catch { /* noop */ }
}
export function resetOnboarding(): void {
  try { localStorage.removeItem(ONBOARDING_DONE_KEY); } catch { /* noop */ }
}

function computeMode(d: Omit<PermissionDiagnostic, 'trackingMode' | 'reasons' | 'checkedAt' | 'forcedManual'>): { mode: TrackingMode; reasons: string[] } {
  // Sprint 10.6 — sem capacidade de GPS (START) o produto é 100% manual por
  // definição. Não é "pendência": não há razões a exibir nem permissão a pedir.
  if (!hasCapability('gps')) return { mode: 'manual', reasons: [] };
  const reasons: string[] = [];
  if (!d.locationGranted) reasons.push('Localização não autorizada');
  if (!d.backgroundLocationGranted) reasons.push('Localização em segundo plano ausente');
  if (d.notificationsRequired && !d.notificationsGranted) reasons.push('Notificações desativadas');
  if (!d.locationServicesEnabled) reasons.push('GPS do aparelho desligado');
  if (!d.gpsReady) reasons.push('GPS indisponível neste dispositivo');
  return { mode: reasons.length === 0 ? 'automatic' : 'manual', reasons };
}


let lastDiagnostic: PermissionDiagnostic | null = null;
const subscribers = new Set<(d: PermissionDiagnostic) => void>();
let listenersAttached = false;

function notifyAll() {
  if (!lastDiagnostic) return;
  for (const fn of subscribers) {
    try { fn(lastDiagnostic); } catch { /* noop */ }
  }
}

export async function refreshPermissionDiagnostic(): Promise<PermissionDiagnostic> {
  const bg: BackgroundPermissionStatus = await getBackgroundPermissionStatus();
  let batteryDisabled = true;
  if (bg.native && bg.platform === 'android') {
    try {
      const p = nativePlugin();
      const res = await p?.isBatteryOptimizationDisabled?.();
      if (res && typeof res.disabled === 'boolean') batteryDisabled = res.disabled;
    } catch { /* mantém true por default — não bloqueia automático */ }
  }

  const gpsReady = (() => {
    if (bg.platform === 'web') {
      return typeof navigator !== 'undefined' && !!navigator.geolocation;
    }
    return bg.locationServicesEnabled;
  })();

  const base = {
    locationGranted: bg.foregroundLocationGranted,
    backgroundLocationGranted: bg.backgroundLocationGranted,
    notificationsGranted: bg.notificationPermissionGranted,
    notificationsRequired: bg.notificationPermissionRequired,
    notificationsStatusKnown: bg.notificationPermissionKnown,
    batteryOptimizationDisabled: batteryDisabled,
    locationServicesEnabled: bg.locationServicesEnabled,
    gpsReady,
    platform: bg.platform,
    sdkInt: bg.sdkInt,
  };
  const { mode, reasons } = computeMode(base);
  const forcedManual = isForcedManual();
  const diagnostic: PermissionDiagnostic = {
    ...base,
    forcedManual,
    trackingMode: forcedManual ? 'manual' : mode,
    reasons: forcedManual ? ['Modo manual forçado nas configurações'] : reasons,
    checkedAt: Date.now(),
  };
  console.info('[PERMISSION-DIAGNOSTIC]', {
    platform: diagnostic.platform,
    notificationsRequired: diagnostic.notificationsRequired,
    notificationsGranted: diagnostic.notificationsGranted,
    notificationsStatusKnown: diagnostic.notificationsStatusKnown,
    gps: diagnostic.gpsReady,
    locationPermission: diagnostic.locationGranted,
    backgroundGps: diagnostic.backgroundLocationGranted,
  });
  lastDiagnostic = diagnostic;
  notifyAll();
  return diagnostic;
}

export function getCachedDiagnostic(): PermissionDiagnostic | null { return lastDiagnostic; }

function attachLifecycleListeners() {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;
  const onResume = () => { void refreshPermissionDiagnostic(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) onResume(); });
  window.addEventListener('focus', onResume);
  window.addEventListener('vd-bg-verified-changed', onResume);
  import('@capacitor/app')
    .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => { if (isActive) onResume(); }))
    .catch(() => { /* web */ });
}

export function subscribePermissionDiagnostic(fn: (d: PermissionDiagnostic) => void): () => void {
  subscribers.add(fn);
  attachLifecycleListeners();
  if (lastDiagnostic) {
    try { fn(lastDiagnostic); } catch { /* noop */ }
  } else {
    void refreshPermissionDiagnostic();
  }
  return () => { subscribers.delete(fn); };
}

export async function requestIgnoreBatteryOptimization(): Promise<boolean> {
  try {
    const p = nativePlugin();
    const res = await p?.requestIgnoreBatteryOptimization?.();
    await refreshPermissionDiagnostic();
    return !!res?.disabled;
  } catch { return false; }
}
