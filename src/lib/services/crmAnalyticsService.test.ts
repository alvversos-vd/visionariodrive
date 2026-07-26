/**
 * Testes do crmAnalyticsService — Sprint 8 · CRM Intelligence.
 * Serviço puro: valida funil, retenção, heatmaps, uso de features,
 * cohorts, ranking de conquistas e geração de alertas/roadmap.
 */
import { describe, it, expect } from 'vitest';
import { crmAnalyticsService } from './crmAnalyticsService';
import type { CrmProfileRow, CrmUserDataRow } from '../repositories/crmRepository';

const DAY = 86_400_000;
const NOW = new Date('2026-07-20T12:00:00Z').getTime();

function profile(id: string, daysAgo: number, extra: Partial<CrmProfileRow> = {}): CrmProfileRow {
  return {
    user_id: id,
    usuario_plano: 'FREE',
    ultimo_login: new Date(NOW).toISOString(),
    created_at: new Date(NOW - daysAgo * DAY).toISOString(),
    onboarding_completo: true,
    ...extra,
  };
}

function userData(id: string, patch: Partial<CrmUserDataRow> = {}): CrmUserDataRow {
  return {
    user_id: id,
    entries: [],
    rides: [],
    rides_v2: [],
    shifts: [],
    vehicles_v2: [],
    financial: { entries: [] },
    gamification: { achievements: [] },
    goals: { daily: 0, weekly: 0, monthly: 0 },
    created_at: new Date(NOW - 30 * DAY).toISOString(),
    updated_at: new Date(NOW).toISOString(),
    ...patch,
  };
}

describe('crmAnalyticsService.build', () => {
  it('não quebra com base vazia', () => {
    const a = crmAnalyticsService.build([], [], NOW);
    expect(a.funnel[0].users).toBe(0);
    expect(a.retention).toHaveLength(6);
    expect(a.hourHeat).toHaveLength(24);
    expect(a.weekdayHeat).toHaveLength(7);
    expect(a.alerts.some(x => x.id === 'no_data')).toBe(true);
  });

  it('constrói o funil em ordem decrescente de etapa', () => {
    const profiles = [profile('a', 10), profile('b', 10), profile('c', 10, { onboarding_completo: false })];
    const data = [
      userData('a', {
        vehicles_v2: [{ veiculo_id: 'v1' }],
        shifts: [{ startedAt: new Date(NOW - 2 * DAY).toISOString(), endedAt: new Date(NOW - 2 * DAY + 3_600_000).toISOString() }],
        rides_v2: [{ km: 10, profit: 30, captureMode: 'gps', date: new Date(NOW - 2 * DAY).toISOString() }],
      }),
      userData('b', { vehicles_v2: [{ veiculo_id: 'v2' }] }),
    ];
    const a = crmAnalyticsService.build(profiles, data, NOW);
    const byKey = Object.fromEntries(a.funnel.map(s => [s.key, s.users]));
    expect(byKey.account).toBe(3);
    expect(byKey.onboarding).toBe(2);
    expect(byKey.vehicle).toBe(2);
    expect(byKey.shift).toBe(1);
    expect(byKey.ride).toBe(1);
    expect(byKey.shift_end).toBe(1);
  });

  it('calcula engajamento médio por turno', () => {
    const data = [
      userData('a', {
        shifts: [{ startedAt: new Date(NOW - DAY).toISOString(), endedAt: new Date(NOW - DAY + 2 * 3_600_000).toISOString() }],
        rides_v2: [{ km: 20, profit: 50, date: new Date(NOW - DAY).toISOString() }],
      }),
    ];
    const a = crmAnalyticsService.build([profile('a', 5)], data, NOW);
    expect(a.engagement.shiftsStarted).toBe(1);
    expect(a.engagement.shiftsEnded).toBe(1);
    expect(a.engagement.shiftCompletionPct).toBe(100);
    expect(a.engagement.avgShiftMinutes).toBeCloseTo(120, 5);
    expect(a.engagement.avgRidesPerShift).toBe(1);
    expect(a.engagement.avgKmPerShift).toBe(20);
  });

  it('mede retenção D1 pela atividade no dia seguinte ao cadastro', () => {
    const signup = NOW - 5 * DAY;
    const profiles: CrmProfileRow[] = [{
      user_id: 'a', usuario_plano: 'FREE',
      ultimo_login: new Date(signup).toISOString(),
      created_at: new Date(signup).toISOString(),
      onboarding_completo: true,
    }];
    const data = [userData('a', { rides_v2: [{ km: 1, profit: 1, date: new Date(signup + DAY).toISOString() }] })];
    const a = crmAnalyticsService.build(profiles, data, NOW);
    const d1 = a.retention.find(r => r.day === 1)!;
    expect(d1.eligible).toBe(1);
    expect(d1.pct).toBe(100);
  });

  it('conta conquistas desbloqueadas e sinaliza as mortas', () => {
    const data = [userData('a', { gamification: { achievements: [{ id: 'first_ride', unlockedAt: new Date(NOW).toISOString() }] } })];
    const a = crmAnalyticsService.build([profile('a', 3)], data, NOW);
    const first = a.achievements.find(x => x.id === 'first_ride')!;
    expect(first.users).toBe(1);
    expect(first.pct).toBe(100);
    expect(a.achievements.some(x => x.users === 0)).toBe(true);
  });

  it('agrupa cohorts por semana ISO e expõe conversão FREE/PRO', () => {
    const profiles = [profile('a', 8), profile('b', 8, { usuario_plano: 'PRO' })];
    const a = crmAnalyticsService.build(profiles, [], NOW);
    expect(a.cohorts.length).toBeGreaterThan(0);
    expect(a.revenue.pro).toBe(1);
    expect(a.revenue.free).toBe(1);
    expect(a.revenue.conversionPct).toBe(50);
    expect(a.revenue.instrumented).toBe(false);
  });

  it('marca áreas sem telemetria remota como unknown', () => {
    const a = crmAnalyticsService.build([profile('a', 2)], [userData('a')], NOW);
    const qa = a.health.find(h => h.key === 'quick_actions')!;
    expect(qa.status).toBe('unknown');
    expect(qa.pct).toBeNull();
  });
});
