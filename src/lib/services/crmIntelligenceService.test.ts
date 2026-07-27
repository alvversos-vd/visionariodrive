/**
 * Testes do crmIntelligenceService — Sprint 9 · Product Intelligence.
 * Serviço puro: valida Driver Score, churn, segmentação, recomendações,
 * feature adoption semanal, product health e customer journey.
 */
import { describe, it, expect } from 'vitest';
import { crmIntelligenceService } from './crmIntelligenceService';
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
    gamification: { achievements: [], xp: { totalXp: 0 } },
    goals: { daily: 0, weekly: 0, monthly: 0 },
    created_at: new Date(NOW - 30 * DAY).toISOString(),
    updated_at: new Date(NOW).toISOString(),
    ...patch,
  };
}

describe('crmIntelligenceService.build', () => {
  it('não quebra com base vazia', () => {
    const i = crmIntelligenceService.build([], [], NOW);
    expect(i.scores).toHaveLength(0);
    expect(i.avgScore).toBe(0);
    expect(i.atRiskUsers).toBe(0);
    expect(i.productHealth.score).toBe(0);
    expect(i.journey[0].instrumented).toBe(false);
    expect(i.recommendations.some(r => r.id === 'no_data')).toBe(true);
  });

  it('dá score alto para usuário engajado e baixo para inativo', () => {
    const days = Array.from({ length: 12 }, (_, k) => new Date(NOW - k * DAY).toISOString());
    const profiles = [profile('ativo', 40), profile('sumiu', 40, { ultimo_login: new Date(NOW - 20 * DAY).toISOString() })];
    const data = [
      userData('ativo', {
        vehicles_v2: [{ veiculo_id: 'v1' }],
        goals: { daily: 200, weekly: 0, monthly: 0 },
        gamification: { achievements: [], xp: { totalXp: 1500 } },
        rides_v2: days.map(d => ({ km: 10, profit: 30, captureMode: 'gps', date: d })),
        shifts: days.map(d => ({ startedAt: d, endedAt: new Date(new Date(d).getTime() + 3_600_000).toISOString() })),
        financial: { entries: [{ date: days[0], type: 'expense', value: 50 }] },
      }),
      userData('sumiu', { updated_at: new Date(NOW - 20 * DAY).toISOString() }),
    ];
    const i = crmIntelligenceService.build(profiles, data, NOW);
    const ativo = i.scores.find(s => s.userId === 'ativo')!;
    const sumiu = i.scores.find(s => s.userId === 'sumiu')!;
    expect(ativo.score).toBeGreaterThan(80);
    expect(ativo.tier).toBe('excelente');
    expect(sumiu.score).toBeLessThan(25);
    expect(sumiu.lastActivityDays).toBeGreaterThanOrEqual(20);
  });

  it('prevê churn com motivos legíveis e sem PII', () => {
    const profiles = [profile('x', 30, { ultimo_login: new Date(NOW - 9 * DAY).toISOString() })];
    const data = [userData('x', { updated_at: new Date(NOW - 9 * DAY).toISOString() })];
    const i = crmIntelligenceService.build(profiles, data, NOW);
    const c = i.churnRisks[0];
    expect(c.riskPct).toBeGreaterThan(60);
    expect(c.alias).toMatch(/^Motorista #/);
    expect(c.reasons.join(' ')).toContain('Financeiro');
    expect(c.reasons.join(' ')).toContain('metas');
    expect(i.atRiskUsers).toBe(1);
  });

  it('segmenta por GPS, manual, Quick Actions e Financeiro', () => {
    const profiles = [profile('g', 5), profile('m', 5), profile('q', 5)];
    const data = [
      userData('g', { rides_v2: [{ km: 1, profit: 1, captureMode: 'gps', date: new Date(NOW).toISOString() }] }),
      userData('m', { rides_v2: [{ km: 1, profit: 1, captureMode: 'manual', date: new Date(NOW).toISOString() }] }),
      userData('q', { rides_v2: [{ km: 1, profit: 1, captureMode: 'quick', date: new Date(NOW).toISOString() }] }),
    ];
    const i = crmIntelligenceService.build(profiles, data, NOW);
    const seg = (k: string) => i.segments.find(s => s.key === k)!.users;
    expect(seg('usa_gps')).toBe(1);
    expect(seg('sem_gps')).toBe(2);
    expect(seg('so_manual')).toBe(1);
    expect(seg('so_quick')).toBe(1);
    expect(seg('sem_financeiro')).toBe(3);
    expect(seg('novatos')).toBe(3);
  });

  it('compara adoção da semana atual com a anterior', () => {
    const profiles = [profile('a', 30), profile('b', 30)];
    const data = [
      userData('a', { rides_v2: [{ km: 1, profit: 1, captureMode: 'quick', date: new Date(NOW - 2 * DAY).toISOString() }] }),
      userData('b', { rides_v2: [{ km: 1, profit: 1, captureMode: 'quick', date: new Date(NOW - 10 * DAY).toISOString() }] }),
    ];
    const i = crmIntelligenceService.build(profiles, data, NOW);
    const quick = i.adoption.find(a => a.key === 'quick_actions')!;
    expect(quick.currUsers).toBe(1);
    expect(quick.prevUsers).toBe(1);
    expect(quick.currPct).toBe(50);
    expect(quick.deltaPct).toBe(0);
  });

  it('declara experimentos como não instrumentados até existir versão por conta', () => {
    const i = crmIntelligenceService.build([profile('a', 3)], [userData('a')], NOW);
    expect(i.experiments.instrumented).toBe(false);
    expect(i.experiments.arms).toHaveLength(0);
  });

  it('calcula Product Health apenas com componentes instrumentados', () => {
    const profiles = [profile('a', 10)];
    const data = [userData('a', {
      rides_v2: [{ km: 5, profit: 20, captureMode: 'gps', date: new Date(NOW - DAY).toISOString() }],
      shifts: [{ startedAt: new Date(NOW - DAY).toISOString(), endedAt: new Date(NOW - DAY + 3_600_000).toISOString() }],
    })];
    const i = crmIntelligenceService.build(profiles, data, NOW);
    const crashes = i.productHealth.components.find(c => c.key === 'crashes')!;
    expect(crashes.instrumented).toBe(false);
    expect(crashes.value).toBeNull();
    expect(i.productHealth.score).toBeGreaterThan(0);
    expect(i.productHealth.score).toBeLessThanOrEqual(100);
  });

  it('monta a jornada completa em ordem decrescente', () => {
    const profiles = [profile('a', 20), profile('b', 20)];
    const data = [
      userData('a', {
        vehicles_v2: [{ veiculo_id: 'v' }],
        goals: { daily: 100, weekly: 0, monthly: 0 },
        shifts: [{ startedAt: new Date(NOW - 3 * DAY).toISOString(), endedAt: new Date(NOW - 3 * DAY + 3_600_000).toISOString() }],
        rides_v2: [{ km: 5, profit: 10, captureMode: 'gps', date: new Date(NOW - 3 * DAY).toISOString() }],
      }),
      userData('b'),
    ];
    const i = crmIntelligenceService.build(profiles, data, NOW);
    const by = Object.fromEntries(i.journey.map(s => [s.key, s.users]));
    expect(by.account).toBe(2);
    expect(by.vehicle).toBe(1);
    expect(by.shift).toBe(1);
    expect(by.ride).toBe(1);
    expect(by.goal).toBe(1);
  });
});
