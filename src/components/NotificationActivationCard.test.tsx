import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pendingDiagnostic = {
  locationGranted: false,
  backgroundLocationGranted: false,
  notificationsGranted: false,
  notificationsRequired: true,
  notificationsStatusKnown: true,
  batteryOptimizationDisabled: true,
  locationServicesEnabled: true,
  gpsReady: true,
  trackingMode: 'manual' as const,
  forcedManual: false,
  platform: 'android' as const,
  sdkInt: 33,
  reasons: [],
  checkedAt: 1,
};

const mocks = vi.hoisted(() => ({
  refreshPermissionDiagnostic: vi.fn(),
  unsubscribe: vi.fn(),
  currentUser: { value: { id: 'user-a' } as { id: string } | null },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.currentUser.value }),
}));

vi.mock('@/lib/permissionDiagnostic', () => ({
  subscribePermissionDiagnostic: vi.fn((subscriber: (value: typeof pendingDiagnostic) => void) => {
    void mocks.refreshPermissionDiagnostic().then(subscriber);
    return mocks.unsubscribe;
  }),
  refreshPermissionDiagnostic: mocks.refreshPermissionDiagnostic,
}));

vi.mock('@/lib/bgPermission', () => ({
  requestNotificationPermissionIfNeeded: vi.fn(),
  openNotificationSettings: vi.fn(),
}));

import NotificationActivationCard from './NotificationActivationCard';

describe('NotificationActivationCard — ciclo do diagnóstico', () => {
  beforeEach(() => {
    mocks.currentUser.value = { id: 'user-a' };
    mocks.refreshPermissionDiagnostic.mockReset();
    mocks.refreshPermissionDiagnostic.mockResolvedValue(pendingDiagnostic);
    mocks.unsubscribe.mockClear();
  });

  it('consulta uma vez na montagem e não consulta novamente em rerenders', async () => {
    const view = render(<NotificationActivationCard />);
    expect(await screen.findByText('Ative as notificações do Visionário Drive')).toBeInTheDocument();
    expect(mocks.refreshPermissionDiagnostic).toHaveBeenCalledTimes(1);

    view.rerender(<NotificationActivationCard />);
    expect(mocks.refreshPermissionDiagnostic).toHaveBeenCalledTimes(1);
  });

  it('faz nova consulta e restaura o card somente quando o usuário muda', async () => {
    const view = render(<NotificationActivationCard />);
    expect(await screen.findByText('Ative as notificações do Visionário Drive')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Agora não'));
    expect(screen.queryByText('Ative as notificações do Visionário Drive')).not.toBeInTheDocument();

    mocks.currentUser.value = { id: 'user-b' };
    view.rerender(<NotificationActivationCard />);

    expect(await screen.findByText('Ative as notificações do Visionário Drive')).toBeInTheDocument();
    expect(mocks.refreshPermissionDiagnostic).toHaveBeenCalledTimes(2);
  });
});