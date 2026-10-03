import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  addListener: vi.fn(),
}));

vi.mock('./bgPermission', () => ({
  getBackgroundPermissionStatus: mocks.getStatus,
  getVisionarioPermissionsPlugin: () => null,
}));

vi.mock('@capacitor/app', () => ({
  App: { addListener: mocks.addListener },
}));

const STATUS = {
  native: true,
  platform: 'android' as const,
  sdkInt: 33,
  foregroundLocationGranted: false,
  fineLocationGranted: false,
  coarseLocationGranted: false,
  backgroundLocationGranted: false,
  locationServicesEnabled: true,
  notificationPermissionRequired: true,
  notificationPermissionGranted: false,
  notificationPermissionKnown: true,
  batteryOptimizationDisabled: true,
};

describe('permissionDiagnostic — lifecycle finito', () => {
  afterEach(() => vi.restoreAllMocks());

  it('não realimenta a leitura pelo resultado e consolida solicitações simultâneas', async () => {
    mocks.getStatus.mockResolvedValue(STATUS);
    const service = await import('./permissionDiagnostic');
    const subscriber = vi.fn();
    const unsubscribe = service.subscribePermissionDiagnostic(subscriber);

    await vi.waitFor(() => expect(subscriber).toHaveBeenCalledTimes(1));
    expect(mocks.getStatus).toHaveBeenCalledTimes(1);

    await Promise.all([
      service.refreshPermissionDiagnostic(),
      service.refreshPermissionDiagnostic(),
      service.refreshPermissionDiagnostic(),
    ]);
    expect(mocks.getStatus).toHaveBeenCalledTimes(2);
    expect(subscriber).toHaveBeenCalledTimes(2);

    // Publicar o novo resultado não inicia outra leitura automaticamente.
    await Promise.resolve();
    await Promise.resolve();
    expect(mocks.getStatus).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(mocks.getStatus).toHaveBeenCalledTimes(3));
    await Promise.resolve();
    expect(mocks.getStatus).toHaveBeenCalledTimes(3);
    unsubscribe();
  });
});