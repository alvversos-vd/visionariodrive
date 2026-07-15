/**
 * Testes do crmService — Sprint 6 · Fase 1.
 * Mocka o crmRepository e valida:
 *  - agregação de KPIs (ativos, novos, PRO, onboarding %)
 *  - filtros de tempo (hoje, 7d, 30d)
 *  - agregação de rides (auto vs manual, km, lucro, distribuição horária)
 *  - série 30d com 30 buckets diários
 *  - isAdmin delega ao repository
 *  - loadSnapshot emite 'crm:changed'
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../repositories/crmRepository', () => ({
  crmRepository: {
    listProfiles: vi.fn(),
    listUserData: vi.fn(),
    isCurrentUserAdmin: vi.fn(),
  },
}));

import { crmService } from './crmService';
import { crmRepository } from '../repositories/crmRepository';
import { eventBus } from '../eventBus';

const DAY = 86_400_000;

function isoDaysAgo(days: number, hour = 12): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return new Date(d.getTime() - days * DAY).toISOString();
}

describe('crmService.loadSnapshot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('agrega KPIs de usuários por janela temporal', async () => {
    (crmRepository.listProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { user_id: 'a', usuario_plano: 'PRO', ultimo_login: isoDaysAgo(0), created_at: isoDaysAgo(0), onboarding_completo: true },
      { user_id: 'b', usuario_plano: 'FREE', ultimo_login: isoDaysAgo(3), created_at: isoDaysAgo(3), onboarding_completo: true },
      { user_id: 'c', usuario_plano: 'FREE', ultimo_login: isoDaysAgo(20), created_at: isoDaysAgo(20), onboarding_completo: false },
      { user_id: 'd', usuario_plano: 'FREE', ultimo_login: isoDaysAgo(100), created_at: isoDaysAgo(100), onboarding_completo: false },
    ]);
    (crmRepository.listUserData as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const snap = await crmService.loadSnapshot();
    expect(snap.kpis.totalUsers).toBe(4);
    expect(snap.kpis.activeToday).toBe(1);
    expect(snap.kpis.active7d).toBe(2);
    expect(snap.kpis.active30d).toBe(3);
    expect(snap.kpis.newToday).toBe(1);
    expect(snap.kpis.new7d).toBe(2);
    expect(snap.kpis.proUsers).toBe(1);
    expect(snap.kpis.freeUsers).toBe(3);
    expect(snap.kpis.onboardedPct).toBe(50);
  });

  it('agrega rides: auto vs manual, km, lucro e distribuição horária', async () => {
    (crmRepository.listProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const d1 = new Date(); d1.setHours(9, 0, 0, 0);
    const d2 = new Date(); d2.setHours(22, 0, 0, 0);
    (crmRepository.listUserData as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        user_id: 'u1',
        entries: [], shifts: [], rides: [], updated_at: new Date().toISOString(),
        rides_v2: [
          { captureMode: 'gps', km: 10, profit: 25, date: d1.toISOString() },
          { captureMode: 'manual', km: 5, profit: 12, date: d2.toISOString() },
          { captureMode: 'auto', km: 3, value: 8, date: d1.toISOString() },
        ],
      },
    ]);

    const snap = await crmService.loadSnapshot();
    expect(snap.kpis.ridesTotal).toBe(3);
    expect(snap.kpis.ridesAuto).toBe(2);
    expect(snap.kpis.ridesManual).toBe(1);
    expect(snap.kpis.totalKm).toBe(18);
    expect(snap.kpis.totalProfit).toBe(45);
    expect(snap.kpis.autoSharePct).toBeCloseTo((2 / 3) * 100, 5);
    expect(snap.hourly24h).toHaveLength(24);
    expect(snap.hourly24h[9].rides).toBe(2);
    expect(snap.hourly24h[22].rides).toBe(1);
  });

  it('produz série 30d com exatamente 30 buckets diários ordenados', async () => {
    (crmRepository.listProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { user_id: 'a', usuario_plano: 'FREE', ultimo_login: isoDaysAgo(1), created_at: isoDaysAgo(1), onboarding_completo: false },
    ]);
    (crmRepository.listUserData as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const snap = await crmService.loadSnapshot();
    expect(snap.series30d).toHaveLength(30);
    const dates = snap.series30d.map(p => p.date);
    expect([...dates].sort()).toEqual(dates);
    const totalActive = snap.series30d.reduce((s, p) => s + p.activeUsers, 0);
    expect(totalActive).toBe(1);
  });

  it('agrega turnos iniciados/encerrados hoje e média de duração', async () => {
    (crmRepository.listProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const startToday = new Date(); startToday.setHours(8, 0, 0, 0);
    const endToday = new Date(); endToday.setHours(14, 0, 0, 0);
    (crmRepository.listUserData as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        user_id: 'u1', entries: [], rides: [], rides_v2: [], updated_at: new Date().toISOString(),
        shifts: [{ startedAt: startToday.toISOString(), endedAt: endToday.toISOString() }],
      },
    ]);
    const snap = await crmService.loadSnapshot();
    expect(snap.kpis.shiftsStartedToday).toBe(1);
    expect(snap.kpis.shiftsEndedToday).toBe(1);
    expect(snap.kpis.avgShiftMinutes).toBe(360);
  });

  it('emite crm:changed após concluir', async () => {
    (crmRepository.listProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (crmRepository.listUserData as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const before = eventBus.getVersion('crm:changed');
    await crmService.loadSnapshot();
    expect(eventBus.getVersion('crm:changed')).toBe(before + 1);
  });

  it('trata rides_v2 ausente caindo em rides legado', async () => {
    (crmRepository.listProfiles as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (crmRepository.listUserData as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        user_id: 'u1', entries: [], shifts: [], updated_at: new Date().toISOString(),
        rides_v2: null,
        rides: [{ captureMode: 'manual', km: 4, profit: 10, date: new Date().toISOString() }],
      },
    ]);
    const snap = await crmService.loadSnapshot();
    expect(snap.kpis.ridesTotal).toBe(1);
    expect(snap.kpis.totalKm).toBe(4);
  });
});

describe('crmService.isAdmin', () => {
  it('delega ao repository', async () => {
    (crmRepository.isCurrentUserAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await expect(crmService.isAdmin('user-1')).resolves.toBe(true);
    expect(crmRepository.isCurrentUserAdmin).toHaveBeenCalledWith('user-1');
  });
});
