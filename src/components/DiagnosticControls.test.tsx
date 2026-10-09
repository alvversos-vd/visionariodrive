import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GpsDebugButton from './GpsDebugButton';
import ExportDebugButton from './ExportDebugButton';

const mocks = vi.hoisted(() => ({ exportGps: vi.fn(), save: vi.fn(), snapshot: vi.fn() }));
vi.mock('@/lib/gpsTelemetry', () => ({ gpsTelemetry: { export: mocks.exportGps } }));
vi.mock('@/lib/saveBlob', () => ({ saveBlob: mocks.save }));
vi.mock('@/lib/exportTelemetry', () => ({ exportTelemetry: { snapshot: mocks.snapshot } }));
vi.mock('sonner', () => ({ toast: vi.fn() }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.clearAllMocks();
});

describe('explicit diagnostic access', () => {
  it('does not expose either control without existing explicit activation', () => {
    render(<><GpsDebugButton /><ExportDebugButton /></>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('preserves GPS URL activation and its export operation', async () => {
    window.history.replaceState({}, '', '/?gpsDebug=1');
    mocks.exportGps.mockResolvedValue('download');
    render(<GpsDebugButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar diagnóstico GPS' }));
    await waitFor(() => expect(mocks.exportGps).toHaveBeenCalledTimes(1));
  });

  it('preserves the saved GPS shortcut and live explicit activation', () => {
    const view = render(<GpsDebugButton />);
    fireEvent(window, new Event('vd-gps-debug-enable'));
    expect(screen.getByRole('button', { name: 'Exportar diagnóstico GPS' })).toBeInTheDocument();
    view.unmount();
    localStorage.setItem('vd-gps-debug-enabled', '1');
    render(<GpsDebugButton />);
    expect(screen.getByRole('button', { name: 'Exportar diagnóstico GPS' })).toBeInTheDocument();
  });

  it('preserves explicit export activation and snapshot download', async () => {
    window.history.replaceState({}, '', '/?exportDebug=1');
    mocks.snapshot.mockReturnValue({ events: [] });
    mocks.save.mockResolvedValue('download');
    render(<ExportDebugButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Diagnóstico de exportações' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar snapshot' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.snapshot).toHaveBeenCalledTimes(1);
  });
});