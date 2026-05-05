import { useMemo } from 'react';
import { getEntries, getGoals, getSettings } from '@/lib/storage';
import { getTodayExpenses, sumExpenses } from '@/lib/expenses';
import { computeStats } from '@/lib/types';
import { TrendingUp, TrendingDown, Trophy, Flame, Target, Wallet } from 'lucide-react';

interface Props {
  refresh: number;
  onGoToInput: () => void;
  onGoToGoals: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Dashboard({ refresh, onGoToInput, onGoToGoals }: Props) {
  const entries = useMemo(() => getEntries(), [refresh]);
  const goals = useMemo(() => getGoals(), [refresh]);
  const settings = useMemo(() => getSettings(), [refresh]);
  const stats = useMemo(() => computeStats(entries, goals.daily), [entries, goals.daily]);
  const expensesToday = useMemo(() => sumExpenses(getTodayExpenses()), [refresh]);

  const baseToday = stats.todayEntry;
  // Adjust today's totals to include extra expenses
  const today = baseToday
    ? {
        ...baseToday,
        totalCost: baseToday.totalCost + expensesToday,
        profit: baseToday.profit - expensesToday,
        profitPerHour: baseToday.hoursWorked > 0
          ? (baseToday.profit - expensesToday) / baseToday.hoursWorked
          : 0,
        profitPerKm: baseToday.kmDriven > 0
          ? (baseToday.profit - expensesToday) / baseToday.kmDriven
          : 0,
      }
    : null;

  const status: 'good' | 'ok' | 'bad' | 'none' = !today
    ? 'none'
    : today.profit > 0 && (goals.daily === 0 || today.profit >= goals.daily * 0.7)
    ? 'good'
    : today.profit > 0
    ? 'ok'
    : 'bad';

  const statusConfig = {
    good: { bg: 'bg-profit', emoji: '🟢', label: 'Dia lucrativo' },
    ok: { bg: 'bg-accent', emoji: '🟡', label: 'Lucro baixo' },
    bad: { bg: 'bg-loss', emoji: '🔴', label: 'Prejuízo no dia' },
    none: { bg: 'bg-muted', emoji: '📊', label: 'Sem dados de hoje' },
  };

  const costPerKm = today && today.kmDriven > 0 ? today.totalCost / today.kmDriven : 0;
  const minIdealKm = costPerKm * settings.profitMargin;

  const goalProgress = goals.daily > 0 && today
    ? Math.min(100, (today.profit / goals.daily) * 100)
    : 0;

  const smartMessage = today
    ? today.profit < 0
      ? { text: '⚠️ Atenção: você está perdendo dinheiro hoje', tone: 'loss' }
      : goals.daily > 0 && today.profit >= goals.daily
      ? { text: '🚀 Bom trabalho hoje! Meta atingida.', tone: 'profit' }
      : today.profit > 0
      ? { text: '💡 Você pode melhorar suas escolhas para lucrar mais', tone: 'accent' }
      : null
    : null;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Hero status */}
      <div className={`rounded-xl p-6 text-center shadow-lg ${statusConfig[status].bg}`}>
        <p className="text-3xl mb-1">{statusConfig[status].emoji}</p>
        <p className="text-sm font-medium text-primary-foreground/90">{statusConfig[status].label}</p>
        <p className={`text-4xl font-display font-bold mt-2 ${today && today.profit < 0 ? 'text-loss-foreground' : 'text-primary-foreground'}`}>
          {today ? fmt(today.profit) : 'R$ 0,00'}
        </p>
        <p className="text-xs text-primary-foreground/80 mt-1">Lucro real de hoje</p>
      </div>

      {smartMessage && (
        <div className={`rounded-lg p-3 text-sm font-medium border ${
          smartMessage.tone === 'profit' ? 'bg-profit/10 border-profit/30 text-profit' :
          smartMessage.tone === 'loss' ? 'bg-loss/10 border-loss/30 text-loss' :
          'bg-accent/10 border-accent/30 text-accent-foreground'
        }`}>
          {smartMessage.text}
        </div>
      )}

      {/* Today metrics */}
      {today ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-lg p-4 border shadow-sm">
              <p className="text-xs text-muted-foreground">💰 Ganhos</p>
              <p className="text-lg font-display font-bold text-foreground">{fmt(today.totalEarnings)}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border shadow-sm">
              <p className="text-xs text-muted-foreground">💸 Custo total</p>
              <p className="text-lg font-display font-bold text-foreground">{fmt(today.totalCost)}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border shadow-sm">
              <p className="text-xs text-muted-foreground">🚗 Km rodados</p>
              <p className="text-lg font-display font-bold text-foreground">{today.kmDriven.toFixed(0)} km</p>
            </div>
            <div className="bg-card rounded-lg p-4 border shadow-sm">
              <p className="text-xs text-muted-foreground">⚙️ Custo por km</p>
              <p className="text-lg font-display font-bold text-foreground">{fmt(costPerKm)}</p>
            </div>
          </div>

          <div className="bg-card rounded-lg p-4 border shadow-sm">
            <p className="text-xs text-muted-foreground">🎯 Mínimo ideal por km</p>
            <p className="text-2xl font-display font-bold text-primary">{fmt(minIdealKm)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Margem: {((settings.profitMargin - 1) * 100).toFixed(0)}%
            </p>
          </div>

          {expensesToday > 0 && (
            <div className="bg-loss/10 border border-loss/30 rounded-lg p-4">
              <p className="text-xs text-loss/90 flex items-center gap-1.5"><Wallet size={12} /> Gastos extras de hoje</p>
              <p className="text-2xl font-display font-bold text-loss">{fmt(expensesToday)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Já incluídos no custo total e no lucro do dia
              </p>
            </div>
          )}

          {/* Previsão do dia */}
          {today.hoursWorked > 0 && settings.estimatedHours > today.hoursWorked && (
            <div className="bg-card rounded-lg p-4 border shadow-sm">
              <p className="text-xs text-muted-foreground">🔮 Previsão para {settings.estimatedHours}h</p>
              <p className="text-2xl font-display font-bold text-accent">
                {fmt((today.totalEarnings / today.hoursWorked) * settings.estimatedHours)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Baseado no ritmo atual ({fmt(today.totalEarnings / today.hoursWorked)}/h)
              </p>
            </div>
          )}

          {/* Goal progress */}
          {goals.daily > 0 && (
            <button
              onClick={onGoToGoals}
              className="w-full bg-card rounded-lg p-4 border shadow-sm text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-display font-semibold text-foreground flex items-center gap-1.5">
                  <Target size={14} /> Meta diária: {fmt(goals.daily)}
                </p>
                <p className="text-xs text-muted-foreground">{goalProgress.toFixed(0)}%</p>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    today.profit >= goals.daily ? 'bg-profit' : 'bg-primary'
                  }`}
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-muted-foreground">
                  Lucro hoje: <span className="font-semibold text-foreground">{fmt(Math.max(0, today.profit))}</span>
                </span>
                {today.profit >= goals.daily ? (
                  <span className="font-display font-bold text-profit">✓ Meta batida! +{fmt(today.profit - goals.daily)}</span>
                ) : (
                  <span className="font-display font-bold text-primary">
                    Faltam {fmt(goals.daily - Math.max(0, today.profit))}
                  </span>
                )}
              </div>
            </button>
          )}
        </>
      ) : (
        <button
          onClick={onGoToInput}
          className="w-full bg-card rounded-lg p-6 border-2 border-dashed border-border text-center hover:border-primary transition-colors"
        >
          <p className="text-sm text-muted-foreground mb-1">Nenhum cálculo registrado hoje</p>
          <p className="font-display font-bold text-primary">+ Fazer cálculo do dia</p>
        </button>
      )}

      {/* Performance highlights */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-card rounded-lg p-3 border shadow-sm text-center">
            <Flame size={16} className="mx-auto text-accent mb-0.5" />
            <p className="text-[10px] text-muted-foreground">Sequência</p>
            <p className="font-display font-bold text-foreground">{stats.streak}d</p>
          </div>
          <div className="bg-card rounded-lg p-3 border shadow-sm text-center">
            <Trophy size={16} className="mx-auto text-accent mb-0.5" />
            <p className="text-[10px] text-muted-foreground">Recorde</p>
            <p className="font-display font-bold text-profit text-sm">{fmt(stats.recordProfit)}</p>
          </div>
          <div className="bg-card rounded-lg p-3 border shadow-sm text-center">
            {stats.weekChangePct !== null && stats.weekChangePct < 0 ? (
              <TrendingDown size={16} className="mx-auto text-loss mb-0.5" />
            ) : (
              <TrendingUp size={16} className="mx-auto text-profit mb-0.5" />
            )}
            <p className="text-[10px] text-muted-foreground">Semana</p>
            <p className={`font-display font-bold text-sm ${stats.weekProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
              {fmt(stats.weekProfit)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
