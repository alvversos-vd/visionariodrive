import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Onboarding from './Onboarding';

const mocks = vi.hoisted(() => ({
  mark: vi.fn(), update: vi.fn(), refresh: vi.fn(), add: vi.fn(), hasAny: vi.fn(),
  lastApp: vi.fn(), saveGoal: vi.fn(), toast: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-driver' }, profile: { nome_usuario: 'Motorista' }, refreshProfile: mocks.refresh }) }));
vi.mock('@/lib/services/profileService', () => ({ profileService: { markOnboarded: mocks.mark, update: mocks.update } }));
vi.mock('@/lib/services/vehicleService', () => ({ vehicleService: { hasAny: mocks.hasAny, add: mocks.add, setLastApp: mocks.lastApp } }));
vi.mock('@/lib/services/goalsService', () => ({ goalsService: { get: () => ({ weekly: 500 }), save: mocks.saveGoal } }));
vi.mock('@/hooks/use-toast', () => ({ toast: mocks.toast }));

afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); mocks.hasAny.mockReturnValue(false); });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('existing onboarding flow', () => {
  it('retains selections when navigating back and saves through the existing services only on completion', async () => {
    const finish = vi.fn();
    render(<Onboarding onFinish={finish} />);
    click('Começar'); click('Carro'); click('Voltar');
    expect(screen.getByRole('button', { name: 'Carro' })).toHaveAttribute('aria-pressed', 'true');
    click('Carro');
    fireEvent.change(screen.getByLabelText('Outra meta (R$)'), { target: { value: '275' } });
    click('OK'); click('Uber'); click('Controlar gastos');
    expect(mocks.mark).not.toHaveBeenCalled();
    click('Concluir e entrar');
    await waitFor(() => expect(finish).toHaveBeenCalledOnce());
    expect(mocks.mark).toHaveBeenCalledExactlyOnceWith('test-driver', {
      tipo_veiculo_principal: 'carro', meta_lucro_diaria: 275, app_principal: 'Uber', objetivo_principal: 'controlar_gastos',
    });
    expect(mocks.saveGoal).toHaveBeenCalledWith({ weekly: 500, daily: 275 });
    expect(mocks.lastApp).toHaveBeenCalledWith('Uber');
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('keeps every personalization field optional', async () => {
    render(<Onboarding onFinish={vi.fn()} />);
    click('Começar');
    for (let i = 0; i < 4; i++) click('Pular por enquanto');
    click('Concluir e entrar');
    await waitFor(() => expect(mocks.mark).toHaveBeenCalledOnce());
    expect(mocks.mark).toHaveBeenCalledWith('test-driver', {
      tipo_veiculo_principal: null, meta_lucro_diaria: null, app_principal: null, objetivo_principal: null,
    });
    expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.saveGoal).not.toHaveBeenCalled();
  });

  it('does not complete or submit twice while saving is in progress', async () => {
    let resolveSave: (() => void) | undefined;
    mocks.update.mockImplementation(() => new Promise<void>(resolve => { resolveSave = resolve; }));
    const finish = vi.fn();
    render(<Onboarding onFinish={finish} />);
    click('Pular tudo');
    fireEvent.click(screen.getByRole('button', { name: 'Concluindo…' }));
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(finish).not.toHaveBeenCalled();
    resolveSave?.();
    await waitFor(() => expect(finish).toHaveBeenCalledOnce());
  });

  it('allows retry after a skip request fails instead of leaving the submission locked', async () => {
    mocks.update.mockRejectedValueOnce(new Error('Sem conexão'));
    const finish = vi.fn();
    render(<Onboarding onFinish={finish} />);
    click('Pular tudo');
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(finish).not.toHaveBeenCalled();
    click('Pular tudo');
    await waitFor(() => expect(finish).toHaveBeenCalledOnce());
  });
});