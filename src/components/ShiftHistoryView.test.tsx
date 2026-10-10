import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ShiftHistoryView from './ShiftHistoryView';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/lib/services/shiftService', () => ({ shiftService: {
  list: mocks.list,
  getTotals: () => ({ lucro_total: 50, ganho_total: 70, km_total: 10, corridas_total: 2, tempo_online_minutos: 120, custo_total: 20, media_por_km: 7, media_por_corrida: 35, custo_combustivel: 10, custo_fixo_rateado: 10 }),
  formatOperationalDate: (iso: string) => iso.split('-').reverse().join('/'),
  formatTempo: (minutes: number) => `${minutes} min`,
} }));
vi.mock('@/lib/services/rideService', () => ({ rideService: { groupByShift: () => ({}) } }));
vi.mock('@/lib/services/goalsService', () => ({ goalsService: { get: () => ({ daily: 0 }) } }));
vi.mock('@/lib/vehicles', () => ({ getVehiclesV2: () => [], getVehicleById: () => undefined, TIPO_LABEL: { moto: 'Moto', carro: 'Carro', bike: 'Bike', bike_eletrica: 'Bike elétrica' }, APPS: ['Uber', '99'] }));
vi.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ plan: 'START' }) }));
vi.mock('@/lib/exportShifts', () => ({ exportShiftsCsv: vi.fn(), exportShiftsPdf: vi.fn() }));
vi.mock('@/lib/exportRoute', () => ({ exportRouteGpx: vi.fn(), exportRouteKml: vi.fn() }));
afterEach(cleanup);

describe('History operational day and existing controls', () => {
  const shift = { turno_id: 'midnight-shift', status: 'finalizado', data_operacional: '2026-10-09', inicio_turno: '2026-10-09T23:00:00Z', fim_turno: '2026-10-10T02:00:00Z', app_utilizado: 'Uber', tipo_veiculo: 'moto' };
  it('keeps a midnight-crossing shift on its operational day', () => {
    mocks.list.mockReturnValue([shift]);
    render(<ShiftHistoryView refresh={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Todos \d/ }));
    const card = screen.getByRole('button', { name: /09\/10\/2026.*Uber.*50,00/ });
    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText('09/10/2026')).toHaveLength(2);
    expect(screen.queryByText('10/10/2026')).not.toBeInTheDocument();
    expect(screen.getByText('Início')).toBeInTheDocument();
    fireEvent.click(card);
    expect(card).toHaveAttribute('aria-expanded', 'false');
  });
  it('keeps app filtering and clear-all behavior', () => {
    mocks.list.mockReturnValue([shift]);
    render(<ShiftHistoryView refresh={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Todos \d/ }));
    fireEvent.change(screen.getByLabelText('Aplicativo do turno'), { target: { value: '99' } });
    expect(screen.queryByRole('button', { name: /09\/10\/2026.*Uber.*50,00/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    expect(screen.getByRole('button', { name: /09\/10\/2026.*Uber.*50,00/ })).toBeInTheDocument();
  });
});