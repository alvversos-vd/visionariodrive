/**
 * Garante que falha técnica na leitura nativa NUNCA vira "permissão concedida".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const KNOWN_ANDROID = {
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

vi.mock('./bgPermission', () => ({
  getBackgroundPermissionStatus: vi.fn(),
  getVisionarioPermissionsPlugin: vi.fn(() => null),
}));

import { getBackgroundPermissionStatus } from './bgPermission';
import { refreshPermissionDiagnostic } from './permissionDiagnostic';

describe('permissionDiagnostic — notificações', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => localStorage.clear());

  it('Android 13+ sem POST_NOTIFICATIONS => pendente', async () => {
    vi.mocked(getBackgroundPermissionStatus).mockResolvedValue(KNOWN_ANDROID);
    const d = await refreshPermissionDiagnostic();
    expect(d.notificationsRequired).toBe(true);
    expect(d.notificationsGranted).toBe(false);
    expect(d.notificationsStatusKnown).toBe(true);
  });

  it('leitura nativa indisponível => desconhecido, jamais concedido', async () => {
    vi.mocked(getBackgroundPermissionStatus).mockResolvedValue({
      ...KNOWN_ANDROID,
      notificationPermissionKnown: false,
    });
    const d = await refreshPermissionDiagnostic();
    expect(d.notificationsStatusKnown).toBe(false);
    expect(d.notificationsGranted).toBe(false);
    expect(d.notificationsRequired).toBe(true);
  });

  it('permissão concedida => card não elegível', async () => {
    vi.mocked(getBackgroundPermissionStatus).mockResolvedValue({
      ...KNOWN_ANDROID,
      notificationPermissionGranted: true,
    });
    const d = await refreshPermissionDiagnostic();
    expect(d.notificationsGranted).toBe(true);
  });
});
