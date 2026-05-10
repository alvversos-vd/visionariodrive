// Personalização baseada no objetivo principal do usuário (do onboarding).
// A estrutura do app não muda — apenas mensagem de topo, destaque visual
// e prioridade de uma métrica em cards.

export type Objective =
  | 'ganhar_mais'
  | 'controlar_gastos'
  | 'evitar_prejuizo'
  | 'bater_metas'
  | 'organizar_ganhos';

export type HighlightKey =
  | 'lucro'
  | 'custo_total'
  | 'minimo_km'
  | 'meta'
  | 'historico';

interface Ctx {
  displayName: string;
  hasToday: boolean;
  profit: number;
  totalCost: number;
  costPerKm: number;
  minIdealKm: number;
  goalDaily: number;
  goalProgress: number; // 0–100
}

export interface ObjectiveConfig {
  message: string;
  highlight: HighlightKey;
  // Dica curta exibida no card destacado (curta, 1 linha)
  highlightHint?: string;
  // Tom do destaque
  tone: 'profit' | 'loss' | 'neutral' | 'primary';
  alert?: string;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function getObjectiveConfig(
  objective: Objective | null | undefined,
  ctx: Ctx,
): ObjectiveConfig | null {
  if (!objective) return null;
  const { displayName, hasToday, profit, totalCost, costPerKm, minIdealKm, goalDaily, goalProgress } = ctx;

  switch (objective) {
    case 'ganhar_mais': {
      const message = !hasToday
        ? `Hoje é dia de aumentar seu lucro 👊`
        : profit > 0
        ? `Boa, ${displayName} — mantenha o ritmo pra lucrar mais`
        : `Hoje é dia de aumentar seu lucro 👊`;
      return {
        message,
        highlight: 'lucro',
        highlightHint: 'Foco no lucro do dia',
        tone: profit >= 0 ? 'profit' : 'loss',
      };
    }
    case 'controlar_gastos': {
      const high = costPerKm > 0 && minIdealKm > 0 && costPerKm > minIdealKm * 0.7;
      return {
        message: high
          ? `Seus gastos impactam diretamente seu lucro`
          : `Controle os custos e aumente o que sobra`,
        highlight: 'custo_total',
        highlightHint: hasToday ? `Custo/km: ${fmt(costPerKm)}` : 'Acompanhe seu custo do dia',
        tone: 'loss',
        alert: high ? 'Custo por km elevado hoje' : undefined,
      };
    }
    case 'evitar_prejuizo': {
      return {
        message: profit < 0
          ? `Atenção, ${displayName} — nem toda corrida vale a pena`
          : `Evite corridas que te fazem perder dinheiro`,
        highlight: 'minimo_km',
        highlightHint: minIdealKm > 0 ? `Aceite acima de ${fmt(minIdealKm)}/km` : 'Defina seu mínimo por km',
        tone: 'primary',
        alert: profit < 0 ? 'Lucro negativo no dia' : undefined,
      };
    }
    case 'bater_metas': {
      const faltam = Math.max(0, goalDaily - Math.max(0, profit));
      return {
        message: goalDaily <= 0
          ? `Defina sua meta pra começar a bater 👊`
          : profit >= goalDaily
          ? `Meta batida hoje 👊`
          : `Faltam ${fmt(faltam)} pra sua meta 👊`,
        highlight: 'meta',
        highlightHint: goalDaily > 0 ? `${goalProgress.toFixed(0)}% da meta` : undefined,
        tone: profit >= goalDaily && goalDaily > 0 ? 'profit' : 'primary',
      };
    }
    case 'organizar_ganhos': {
      return {
        message: `Veja sua evolução real, ${displayName}`,
        highlight: 'historico',
        highlightHint: 'Acompanhe seu histórico financeiro',
        tone: 'neutral',
      };
    }
    default:
      return null;
  }
}
