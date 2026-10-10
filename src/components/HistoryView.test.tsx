import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HistoryView from './HistoryView';

const mocks = vi.hoisted(() => ({ history: vi.fn(), rides: vi.fn(), deleteEntry: vi.fn(), deleteRide: vi.fn() }));
vi.mock('@/lib/services/rideService', () => ({ rideService: { deleteEntry: mocks.deleteEntry, deleteRide: mocks.deleteRide } }));
vi.mock('@/lib/services/metricsService', () => ({ metricsService: {
  historyEntries: mocks.history, recentIndividualRides: mocks.rides,
  statsFor: () => ({ weekChangePct: null, costChangePct: null, recordProfit: 0, streak: 0 }),
} }));
vi.mock('@/lib/services/goalsService', () => ({ goalsService: { get: () => ({ daily: 0 }) } }));
vi.mock('@/lib/services/financialService', () => ({ financialService: { list: () => [] } }));
vi.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ plan: 'START' }) }));
vi.mock('./ShiftHistoryView', () => ({ default: () => null }));
vi.mock('./HistoryCharts', () => ({ default: () => null }));
vi.mock('./PeriodComparison', () => ({ default: () => null }));
vi.mock('@/lib/exportPdf', () => ({ exportHistoryPdf: vi.fn() }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.history.mockReturnValue([]);
  mocks.rides.mockReturnValue([
    { id: 'ride-a', date: '2026-10-10T12:00:00Z', value: 42, km: 5, vehicleName: 'Moto', rideType: 'Entrega', app: 'Uber' },
    { id: 'ride-b', date: '2026-10-09T12:00:00Z', value: 30, km: 4, vehicleName: 'Carro', rideType: 'Passageiro' },
  ]);
});

describe('Existing history actions', () => {
  it('preserves vehicle filtering and clearing without changing source order', () => {
    render(<HistoryView refresh={0} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Moto', exact: true }));
    expect(screen.getAllByRole('button', { name: 'Excluir corrida' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar', exact: true }));
    expect(screen.getAllByRole('button', { name: 'Excluir corrida' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir corrida' })[0]);
    expect(mocks.deleteRide).toHaveBeenCalledWith('ride-a');
  });
  it('preserves ride-type filtering', () => {
    render(<HistoryView refresh={0} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passageiro', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir corrida' }));
    expect(mocks.deleteRide).toHaveBeenCalledWith('ride-b');
  });
  it('deletes the same ride ID and refreshes only through the existing callback', () => {
    const refresh = vi.fn();
    render(<HistoryView refresh={0} onRefresh={refresh} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir corrida' })[1]);
    expect(mocks.deleteRide).toHaveBeenCalledWith('ride-b');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(mocks.deleteEntry).not.toHaveBeenCalled();
  });
});