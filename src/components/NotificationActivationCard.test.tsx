import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refreshPermissionDiagnostic = vi.fn(async () => pendingDiagnostic);
const unsubscribe = vi.fn();
let currentUser: { id: string } | null = { id: 'user-a' };

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

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: currentUser }),
}));

vi.mock('@/lib/permissionDiagnostic', () => ({
  subscribePermissionDiagnostic: vi.fn((subscriber: (value: typeof pendingDiagnostic) => void) => {
    void refreshPermissionDiagnostic().then(subscriber);
    return unsubscribe;
  }),
  refreshPermissionDiagnostic,
}));

vi.mock('@/lib/bgPermission', () => ({
  requestNotificationPermissionIfNeeded: vi.fn(),
  openNotificationSettings: vi.fn(),
}));

import NotificationActivationCard from './NotificationActivationCard';

describe('NotificationActivationCard — ciclo do diagnóstico', () => {
  beforeEach(() => {
    currentUser = { id: 'user-a' };
    refreshPermissionDiagnostic.mockClear();
    unsubscribe.mockClear();
  });

  it('consulta uma vez na montagem e não consulta novamente em rerenders', async () => {
    const view = render(<NotificationActivationCard />);
    expect(await screen.findByText('Ative as notificações do Visionário Drive')).toBeInTheDocument();
    expect(refreshPermissionDiagnostic).toHaveBeenCalledTimes(1);

    view.rerender(<NotificationActivationCard />);
    expect(refreshPermissionDiagnostic).toHaveBeenCalledTimes(1);
  });

  it('faz nova consulta e restaura o card somente quando o usuário muda', async () => {
    const view = render(<NotificationActivationCard />);
    expect(await screen.findByText('Ative as notificações do Visionário Drive')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Agora não'));
    expect(screen.queryByText('Ative as notificações do Visionário Drive')).not.toBeInTheDocument();

    currentUser = { id: 'user-b' };
    view.rerender(<NotificationActivationCard />);

    expect(await screen.findByText('Ative as notificações do Visionário Drive')).toBeInTheDocument();
    expect(refreshPermissionDiagnostic).toHaveBeenCalledTimes(2);
  });
});