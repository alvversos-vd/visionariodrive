import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FinancialView from './FinancialView';

const mocks = vi.hoisted(() => ({ list: vi.fn(), add: vi.fn(), remove: vi.fn(), metrics: vi.fn() }));
vi.mock('@/lib/services/financialService', () => ({ financialService: mocks }));
vi.mock('@/lib/services/metricsService', () => ({ metricsService: { rangeMetrics: mocks.metrics } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockReturnValue([]);
  mocks.metrics.mockReturnValue({ bonus: 100, income: 50, expense: 25 });
});

describe('Financeiro existing interactions', () => {
  it('keeps service-backed type filtering', () => {
    render(<FinancialView refresh={0} onChanged={vi.fn()} />);
    expect(mocks.list).toHaveBeenLastCalledWith({ type: 'bonus' });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Despesas' }), { button: 0, ctrlKey: false });
    expect(mocks.list).toHaveBeenLastCalledWith({ type: 'expense' });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Receitas' }), { button: 0, ctrlKey: false });
    expect(mocks.list).toHaveBeenLastCalledWith({ type: 'income' });
  });

  it('keeps validation and sends the unchanged financial payload when saving', () => {
    const onChanged = vi.fn();
    render(<FinancialView refresh={0} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar bônus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(mocks.add).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(mocks.add).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '123.45' } });
    fireEvent.change(screen.getByLabelText('Observação (opcional)'), { target: { value: '  Campanha  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ type: 'bonus', value: 123.45, notes: 'Campanha', origin: 'manual' }));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('removes only the supplied permanent ID and refreshes via the existing callback', () => {
    mocks.list.mockReturnValue([{ id: 'permanent-entry-id', type: 'bonus', value: 123.45, category: 'Campanha', date: '2026-10-10T12:00:00Z' }]);
    const onChanged = vi.fn();
    render(<FinancialView refresh={0} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(mocks.remove).toHaveBeenCalledWith('permanent-entry-id');
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});