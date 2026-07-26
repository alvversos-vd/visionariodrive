/**
 * Testes do crmRepository — Sprint 6 · Fase 1.
 * Mocka o client Supabase e valida:
 *  - listProfiles seleciona apenas colunas não-PII permitidas
 *  - listUserData seleciona apenas colunas agregáveis
 *  - isCurrentUserAdmin filtra por user_id + role='admin'
 *  - erros do PostgREST propagam em listProfiles/listUserData
 *  - isCurrentUserAdmin retorna false em erro (fail-closed)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const selectMock = vi.fn();
const eqMock1 = vi.fn();
const eqMock2 = vi.fn();
const maybeSingleMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { crmRepository } from './crmRepository';

beforeEach(() => {
  vi.clearAllMocks();
  selectMock.mockReset();
  eqMock1.mockReset();
  eqMock2.mockReset();
  maybeSingleMock.mockReset();
  fromMock.mockReset();
});

describe('crmRepository.listProfiles', () => {
  it('seleciona apenas colunas necessárias e retorna as linhas', async () => {
    const rows = [{ user_id: 'a', usuario_plano: 'FREE', ultimo_login: null, created_at: '2026-01-01', onboarding_completo: false }];
    selectMock.mockResolvedValue({ data: rows, error: null });
    fromMock.mockReturnValue({ select: selectMock });

    const out = await crmRepository.listProfiles();
    expect(fromMock).toHaveBeenCalledWith('profiles');
    const cols = String(selectMock.mock.calls[0][0]);
    expect(cols).toContain('user_id');
    expect(cols).toContain('usuario_plano');
    expect(cols).toContain('ultimo_login');
    expect(cols).toContain('created_at');
    expect(cols).toContain('onboarding_completo');
    expect(cols).not.toContain('email');
    expect(cols).not.toContain('stripe_customer_id');
    expect(out).toEqual(rows);
  });

  it('propaga erro do PostgREST', async () => {
    selectMock.mockResolvedValue({ data: null, error: new Error('rls denied') });
    fromMock.mockReturnValue({ select: selectMock });
    await expect(crmRepository.listProfiles()).rejects.toThrow('rls denied');
  });

  it('retorna array vazio quando data é null', async () => {
    selectMock.mockResolvedValue({ data: null, error: null });
    fromMock.mockReturnValue({ select: selectMock });
    await expect(crmRepository.listProfiles()).resolves.toEqual([]);
  });
});

describe('crmRepository.listUserData', () => {
  it('seleciona apenas colunas agregáveis (nada de PII em settings)', async () => {
    selectMock.mockResolvedValue({ data: [], error: null });
    fromMock.mockReturnValue({ select: selectMock });
    await crmRepository.listUserData();
    expect(fromMock).toHaveBeenCalledWith('user_data');
    const cols = String(selectMock.mock.calls[0][0]);
    // Sprint 8 — colunas agregáveis do CRM Intelligence (contagens, nunca PII).
    for (const c of [
      'user_id', 'entries', 'rides', 'rides_v2', 'shifts',
      'vehicles_v2', 'financial', 'gamification', 'goals', 'created_at', 'updated_at',
    ]) {
      expect(cols).toContain(c);
    }
    expect(cols).not.toContain('settings');
  });

  it('propaga erro do PostgREST', async () => {
    selectMock.mockResolvedValue({ data: null, error: new Error('boom') });
    fromMock.mockReturnValue({ select: selectMock });
    await expect(crmRepository.listUserData()).rejects.toThrow('boom');
  });
});

describe('crmRepository.isCurrentUserAdmin', () => {
  function setupChain(result: { data: unknown; error: unknown }) {
    maybeSingleMock.mockResolvedValue(result);
    eqMock2.mockReturnValue({ maybeSingle: maybeSingleMock });
    eqMock1.mockReturnValue({ eq: eqMock2 });
    selectMock.mockReturnValue({ eq: eqMock1 });
    fromMock.mockReturnValue({ select: selectMock });
  }

  it('retorna true quando existe linha admin', async () => {
    setupChain({ data: { role: 'admin' }, error: null });
    await expect(crmRepository.isCurrentUserAdmin('user-1')).resolves.toBe(true);
    expect(fromMock).toHaveBeenCalledWith('user_roles');
    expect(eqMock1).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eqMock2).toHaveBeenCalledWith('role', 'admin');
  });

  it('retorna false quando não há linha', async () => {
    setupChain({ data: null, error: null });
    await expect(crmRepository.isCurrentUserAdmin('user-2')).resolves.toBe(false);
  });

  it('fail-closed: retorna false em erro', async () => {
    setupChain({ data: null, error: new Error('rls') });
    await expect(crmRepository.isCurrentUserAdmin('user-3')).resolves.toBe(false);
  });
});
