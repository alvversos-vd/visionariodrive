import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OperationalStatusBadge from './OperationalStatusBadge';

const mocks = vi.hoisted(() => ({ gps: false, subscribe: vi.fn(), refresh: vi.fn() }));
vi.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ gps: mocks.gps }) }));
vi.mock('@/lib/permissionDiagnostic', () => ({
  subscribePermissionDiagnostic: mocks.subscribe,
  refreshPermissionDiagnostic: mocks.refresh,
}));
afterEach(() => { cleanup(); mocks.gps = false; vi.clearAllMocks(); });

describe('operational badge plan presentation', () => {
  it('START renders no GPS badge and makes no diagnostic request', () => {
    const { container } = render(<OperationalStatusBadge />);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('PRO retains manual status and the existing configuration event', () => {
    mocks.gps = true;
    mocks.subscribe.mockImplementation(callback => {
      callback({ trackingMode: 'manual', reasons: ['Localização não autorizada'] });
      return () => {};
    });
    const listener = vi.fn();
    window.addEventListener('vd-open-permission-onboarding', listener);
    render(<OperationalStatusBadge />);
    expect(screen.getByText('Localização não autorizada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configurar automação' }));
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('vd-open-permission-onboarding', listener);
  });
});