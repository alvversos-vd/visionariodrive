/**
 * Catálogo de Conquistas — Sprint 6 · Fase 2 + Sprint 6.3 (finalização).
 *
 * DESACOPLADO da UI. Nenhum componente hardcoda conquista;
 * todos leem daqui via achievementService.
 *
 * Contexto (StatsContext) é montado pelo achievementService, lendo os
 * Services públicos (nunca Repository direto).
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface StatsContext {
  ridesTotal: number;
  totalKm: number;
  totalEarned: number;      // soma de ride.value + income financeiro
  shiftsTotal: number;
  consecutiveDays: number;  // dias consecutivos com pelo menos 1 corrida (trailing hoje)
  goalHitCount: number;     // dias em que a meta diária foi batida
  accountCreatedAt: string | null; // ISO
  tabsVisited: number;      // quantas tabs distintas o motorista abriu
  // Sprint 6.3 — expansão do Perfil Inteligente (extras não-condicionais).
  bestDailyEarned: number;      // melhor faturamento de 1 dia
  longestShiftMinutes: number;  // maior turno registrado (min)
  daysUsingApp: number;         // dias desde o cadastro
  xpEarnedToday: number;        // XP ganho hoje (reflete xpService.earnedToday)
  totalXp: number;              // XP total acumulado (snapshot)
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;             // emoji (leve, sem asset)
  rarity: Rarity;
  xp: number;
  /** Retorna true se a conquista deve estar desbloqueada dado o contexto atual. */
  condition: (ctx: StatsContext) => boolean;
  /** Progresso 0..1 opcional (para UI mostrar "faltam N"). */
  progress?: (ctx: StatsContext) => number;
}

// Data de corte para "founder" e "early_beta"
const FOUNDER_CUTOFF = new Date('2027-01-01T00:00:00Z').getTime();
const BETA_CUTOFF = new Date('2026-09-01T00:00:00Z').getTime();

function pct(cur: number, target: number): number {
  if (target <= 0) return 1;
  return Math.max(0, Math.min(1, cur / target));
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_ride', name: 'Primeira Corrida', description: 'Registre sua primeira corrida.',
    icon: '🚗', rarity: 'common', xp: 20,
    condition: c => c.ridesTotal >= 1, progress: c => pct(c.ridesTotal, 1),
  },
  {
    id: 'first_shift', name: 'Primeiro Turno', description: 'Complete seu primeiro turno.',
    icon: '⏱️', rarity: 'common', xp: 20,
    condition: c => c.shiftsTotal >= 1, progress: c => pct(c.shiftsTotal, 1),
  },
  {
    id: 'first_100', name: 'Primeiros R$100', description: 'Acumule R$100 em ganhos.',
    icon: '💵', rarity: 'common', xp: 30,
    condition: c => c.totalEarned >= 100, progress: c => pct(c.totalEarned, 100),
  },
  {
    id: 'first_1000', name: 'Primeiros R$1.000', description: 'Acumule R$1.000 em ganhos.',
    icon: '💰', rarity: 'rare', xp: 100,
    condition: c => c.totalEarned >= 1000, progress: c => pct(c.totalEarned, 1000),
  },
  {
    id: 'rides_10', name: '10 Corridas', description: 'Registre 10 corridas.',
    icon: '🔟', rarity: 'common', xp: 30,
    condition: c => c.ridesTotal >= 10, progress: c => pct(c.ridesTotal, 10),
  },
  {
    id: 'rides_50', name: '50 Corridas', description: 'Registre 50 corridas.',
    icon: '🎯', rarity: 'rare', xp: 100,
    condition: c => c.ridesTotal >= 50, progress: c => pct(c.ridesTotal, 50),
  },
  {
    id: 'rides_100', name: '100 Corridas', description: 'Registre 100 corridas.',
    icon: '💯', rarity: 'rare', xp: 200,
    condition: c => c.ridesTotal >= 100, progress: c => pct(c.ridesTotal, 100),
  },
  {
    id: 'rides_500', name: 'Elite · 500 Corridas', description: 'Registre 500 corridas.',
    icon: '🏆', rarity: 'epic', xp: 500,
    condition: c => c.ridesTotal >= 500, progress: c => pct(c.ridesTotal, 500),
  },
  {
    id: 'goal_hit', name: 'Meta Batida', description: 'Bata sua meta diária pela primeira vez.',
    icon: '🎉', rarity: 'rare', xp: 50,
    condition: c => c.goalHitCount >= 1, progress: c => pct(c.goalHitCount, 1),
  },
  {
    id: 'streak_7', name: '7 dias consecutivos', description: 'Trabalhe 7 dias seguidos.',
    icon: '🔥', rarity: 'rare', xp: 100,
    condition: c => c.consecutiveDays >= 7, progress: c => pct(c.consecutiveDays, 7),
  },
  {
    id: 'streak_30', name: 'Persistente · 30 dias', description: 'Trabalhe 30 dias seguidos.',
    icon: '🌟', rarity: 'epic', xp: 500,
    condition: c => c.consecutiveDays >= 30, progress: c => pct(c.consecutiveDays, 30),
  },
  {
    id: 'km_1000', name: '1.000 km', description: 'Percorra 1.000 km no total.',
    icon: '🛣️', rarity: 'rare', xp: 100,
    condition: c => c.totalKm >= 1000, progress: c => pct(c.totalKm, 1000),
  },
  {
    id: 'km_5000', name: '5.000 km', description: 'Percorra 5.000 km no total.',
    icon: '🚀', rarity: 'epic', xp: 400,
    condition: c => c.totalKm >= 5000, progress: c => pct(c.totalKm, 5000),
  },
  {
    id: 'visionary', name: 'Motorista Visionário', description: 'Acumule R$10.000 em ganhos.',
    icon: '👑', rarity: 'legendary', xp: 300,
    condition: c => c.totalEarned >= 10000, progress: c => pct(c.totalEarned, 10000),
  },
  {
    id: 'visionary_shifts', name: 'Visionário · 100 turnos', description: 'Complete 100 turnos.',
    icon: '🏁', rarity: 'epic', xp: 400,
    condition: c => c.shiftsTotal >= 100, progress: c => pct(c.shiftsTotal, 100),
  },
  {
    id: 'founder', name: 'Fundador', description: 'Cadastro entre os primeiros do Visionário Drive.',
    icon: '🏅', rarity: 'legendary', xp: 100,
    condition: c => {
      if (!c.accountCreatedAt) return false;
      const t = new Date(c.accountCreatedAt).getTime();
      return Number.isFinite(t) && t < FOUNDER_CUTOFF;
    },
  },
  {
    id: 'early_beta', name: 'Early Beta', description: 'Testou o app no beta fechado.',
    icon: '🧪', rarity: 'epic', xp: 50,
    condition: c => {
      if (!c.accountCreatedAt) return false;
      const t = new Date(c.accountCreatedAt).getTime();
      return Number.isFinite(t) && t < BETA_CUTOFF;
    },
  },
  {
    id: 'explorer', name: 'Explorador', description: 'Explore 5 seções do app.',
    icon: '🧭', rarity: 'common', xp: 30,
    condition: c => c.tabsVisited >= 5, progress: c => pct(c.tabsVisited, 5),
  },
];

export function getAchievement(id: string): Achievement | null {
  return ACHIEVEMENTS.find(a => a.id === id) ?? null;
}
