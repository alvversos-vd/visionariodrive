/**
 * Teste de contrato — thenable-leak do Proxy do Capacitor.
 *
 * `registerPlugin()` devolve um Proxy que responde a QUALQUER propriedade,
 * inclusive `then`. Se essa referência atravessar uma função `async`, o motor
 * JS chama `proxy.then(resolve, reject)` — no Android isso vira a chamada
 * inexistente `VisionarioPermissions.then()` e a promise externa NUNCA se
 * estabiliza, travando o diagnóstico de permissões em `null`.
 *
 * Este teste garante que o acesso ao plugin permanece SÍNCRONO e que apenas o
 * RESULTADO dos métodos (`checkStatus()`) é aguardado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const checkStatus = vi.fn(async () => ({ notificationPermissionGranted: false }));

/** Proxy fiel ao comportamento real do Capacitor: `then` é "implementado". */
function makeCapacitorLikeProxy() {
  return new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (prop === 'checkStatus') return checkStatus;
      return (..._args: unknown[]) =>
        Promise.reject(new Error(`"VisionarioPermissions.${prop}()" is not implemented on android`));
    },
  });
}

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true },
  registerPlugin: () => makeCapacitorLikeProxy(),
}));

describe('bgPermission — contrato de fronteira do plugin nativo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { window?: unknown }).window ??= globalThis;
    (window as unknown as { Capacitor: unknown }).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    };
  });

  it('getVisionarioPermissionsPlugin é SÍNCRONA e não devolve Promise', async () => {
    const { getVisionarioPermissionsPlugin } = await import('./bgPermission');
    const p = getVisionarioPermissionsPlugin();
    expect(p).not.toBeNull();
    // Se fosse `async`, o retorno seria uma Promise real (instanceof Promise).
    expect(p instanceof Promise).toBe(false);
  });

  it('nativePlugin do permissionDiagnostic também é síncrona', async () => {
    const mod = await import('./permissionDiagnostic');
    // Chamada real: se a fronteira fosse async, o refresh jamais resolveria.
    const d = await Promise.race([
      mod.refreshPermissionDiagnostic(),
      new Promise((_r, rej) => setTimeout(() => rej(new Error('thenable-leak: diagnóstico travou')), 1500)),
    ]);
    expect(d).toBeTruthy();
  });

  it('checkStatus é aguardado no RESULTADO, nunca sobre o objeto do plugin', async () => {
    const { getBackgroundPermissionStatus } = await import('./bgPermission');
    const status = await getBackgroundPermissionStatus();
    expect(checkStatus).toHaveBeenCalledTimes(1);
    expect(status.platform).toBe('android');
    // O estado real da permissão continua sendo a fonte da verdade.
    expect(status.notificationPermissionGranted).toBe(false);
    expect(status.notificationPermissionKnown).toBe(true);
  });
});
