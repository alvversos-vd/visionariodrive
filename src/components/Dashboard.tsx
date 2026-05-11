import { useEffect, useMemo, useRef, useState } from 'react';
import { getEntries, getGoals, getSettings, getRides } from '@/lib/storage';
import { getTodayExpenses, sumExpenses, groupByCategory, EXPENSE_CATEGORIES } from '@/lib/expenses';
import { computeStats } from '@/lib/types';
import { useAuth, getDisplayName } from '@/contexts/AuthContext';
import {
  daysSinceLastOpen, markOpenedToday,
  shouldCelebrateFirstProfit, markFirstProfitCelebrated,
  shouldCelebrateRides5, markRides5Celebrated,
  getFocusMode, setFocusMode,
  shouldShowUpgradePrompt,
} from '@/lib/engagement';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Trophy, Flame, Target, Wallet, Focus, Compass, Sparkles, Lock, BarChart3, Brain, ArrowRight, AlertTriangle } from 'lucide-react';
import ShiftMode from './ShiftMode';
import { getObjectiveConfig, Objective } from '@/lib/objectives';

interface Props {
  refresh: number;
  onGoToInput: () => void;
  onGoToGoals: () => void;
  onGoToUpgrade: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Dashboard({ refresh, onGoToInput, onGoToGoals, onGoToUpgrade }: Props) {
  const { profile, isPro } = useAuth();
  const displayName = getDisplayName(profile);
  const entries = useMemo(() => getEntries(), [refresh]);
  const goals = useMemo(() => getGoals(), [refresh]);
  const settings = useMemo(() => getSettings(), [refresh]);
  const stats = useMemo(() => computeStats(entries, goals.daily), [entries, goals.daily]);
  const todayExpenses = useMemo(() => getTodayExpenses(), [refresh]);
  const expensesToday = sumExpenses(todayExpenses);
  const expensesByCat = useMemo(() => groupByCategory(todayExpenses), [todayExpenses]);

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

  // Objective-driven personalization (from onboarding)
  const objective = (profile?.objetivo_principal as Objective | null) ?? null;
  const objConfig = getObjectiveConfig(objective, {
    displayName,
    hasToday: !!today,
    profit: today?.profit ?? 0,
    totalCost: today?.totalCost ?? 0,
    costPerKm: today && today.kmDriven > 0 ? today.totalCost / today.kmDriven : 0,
    minIdealKm,
    goalDaily: goals.daily,
    goalProgress: goals.daily > 0 && today ? Math.min(100, (today.profit / goals.daily) * 100) : 0,
  });

  // ÚNICO alerta inteligente da tela (prioridade: prejuízo > custo alto > média baixa)
  type TopAlert = { tone: 'loss' | 'warn' | 'info'; title: string; hint?: string };
  let topAlert: TopAlert | null = null;
  if (today) {
    const avgPerKm = today.kmDriven > 0 ? today.totalEarnings / today.kmDriven : 0;
    if (today.profit < 0) {
      topAlert = { tone: 'loss', title: 'Lucro negativo hoje', hint: 'Revise corridas abaixo do mínimo ideal' };
    } else if (costPerKm > 0 && minIdealKm > 0 && costPerKm > minIdealKm * 0.7) {
      topAlert = { tone: 'warn', title: 'Custo por km elevado', hint: `Hoje: ${fmt(costPerKm)}/km` };
    } else if (avgPerKm > 0 && minIdealKm > 0 && avgPerKm < minIdealKm) {
      topAlert = { tone: 'warn', title: 'Média por km abaixo do ideal', hint: `Aceite acima de ${fmt(minIdealKm)}/km` };
    }
  }
  // Se não há alerta crítico, usar o destaque do objetivo (mesmo slot)
  if (!topAlert && objConfig) {
    topAlert = {
      tone: objConfig.tone === 'loss' ? 'loss' : objConfig.tone === 'profit' ? 'info' : 'info',
      title: objConfig.alert ?? objConfig.highlightHint ?? 'Foco do dia',
    };
  }

  // Smart greeting (1x per screen) — objective overrides default greeting when set
  const defaultGreeting = !today
    ? `Bora começar, ${displayName}`
    : today.profit > 0
    ? `Boa, ${displayName} 👊 você já está no lucro hoje`
    : today.profit < 0
    ? `Atenção, ${displayName} — ajuste suas corridas hoje`
    : `Bora começar, ${displayName}`;
  const greeting = objConfig?.message ?? defaultGreeting;

  const greetingTone: 'profit' | 'loss' | 'neutral' =
    today && today.profit > 0 ? 'profit' : today && today.profit < 0 ? 'loss' : 'neutral';

  // Focus mode
  const [focus, setFocus] = useState<boolean>(() => getFocusMode());
  const toggleFocus = () => {
    const next = !focus;
    setFocus(next);
    setFocusMode(next);
  };

  // Realtime feedback when profit / minIdealKm change
  const prevProfit = useRef<number | null>(null);
  const prevMin = useRef<number | null>(null);
  useEffect(() => {
    const p = today?.profit ?? null;
    const prev = prevProfit.current;
    if (prev !== null && p !== null && Math.abs(p - prev) >= 0.5) {
      if (p > prev) toast.success('Boa decisão — você aumentou seu lucro');
      else toast('Cuidado — isso reduziu seu lucro', { icon: '⚠️' });
    }
    prevProfit.current = p;
  }, [today?.profit]);

  useEffect(() => {
    const m = minIdealKm || 0;
    const prev = prevMin.current;
    if (prev !== null && m > prev + 0.01) {
      toast('Seu mínimo ideal aumentou', { icon: '📈' });
    }
    prevMin.current = m;
  }, [minIdealKm]);

  // Micro-wins + return reminder (run once per mount)
  useEffect(() => {
    const days = daysSinceLastOpen();
    markOpenedToday();
    if (days !== null && days >= 1) {
      toast('Você pode estar aceitando corridas sem saber o lucro', { icon: '👀' });
    }
    if (today && today.profit > 0 && shouldCelebrateFirstProfit()) {
      markFirstProfitCelebrated();
      toast.success('Primeiro dia no lucro 👊');
    }
    const ridesCount = getRides().length;
    if (ridesCount >= 5 && shouldCelebrateRides5()) {
      markRides5Celebrated();
      toast.success('Você está tomando decisões melhores');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="px-1 flex items-center justify-between gap-3">
        <h1 className={`font-display text-base font-bold leading-snug ${
          greetingTone === 'profit' ? 'text-profit' :
          greetingTone === 'loss' ? 'text-loss' :
          'text-foreground'
        }`}>
          {greeting}
        </h1>
        <button
          onClick={toggleFocus}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-display font-semibold border transition-colors ${
            focus ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border hover:bg-accent hover:text-accent-foreground'
          }`}
          aria-pressed={focus}
          aria-label="Modo foco"
        >
          <Focus size={13} /> {focus ? 'Modo foco ativo' : 'Modo foco'}
        </button>
      </div>

      <ShiftMode />

      {focus ? (
        <div className="space-y-3">
          <div className={`rounded-xl p-6 text-center shadow-lg ${statusConfig[status].bg}`}>
            <p className="text-xs text-primary-foreground/80 uppercase tracking-wider">Lucro real hoje</p>
            <p className={`text-5xl font-display font-bold mt-2 ${today && today.profit < 0 ? 'text-loss-foreground' : 'text-primary-foreground'}`}>
              {today ? fmt(today.profit) : 'R$ 0,00'}
            </p>
          </div>
          <div className="bg-card rounded-lg p-5 border shadow-sm text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5"><Compass size={12}/> Mínimo ideal por km</p>
            <p className="text-3xl font-display font-bold text-primary mt-1">{fmt(minIdealKm)}</p>
            <p className="text-xs text-muted-foreground mt-2">Aceite corridas acima de {fmt(minIdealKm)}/km</p>
          </div>
          <p className="text-center text-sm text-muted-foreground italic">
            Foco hoje, {displayName}. Decisões melhores, mais lucro.
          </p>
        </div>
      ) : (
        <>
      {/* Destaque do objetivo (do onboarding) — borda sutil, sem mudar layout */}
      {objConfig && (
        <div
          className={`rounded-lg p-3 border flex items-center gap-3 ${
            objConfig.tone === 'profit'
              ? 'border-profit/40 bg-profit/5'
              : objConfig.tone === 'loss'
              ? 'border-loss/40 bg-loss/5'
              : 'border-primary/30 bg-primary/5'
          }`}
        >
          {objConfig.alert ? (
            <AlertTriangle size={16} className="text-loss shrink-0" />
          ) : (
            <Target size={16} className="text-primary shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-display font-semibold text-foreground leading-snug">
              {objConfig.alert ?? objConfig.highlightHint ?? 'Foco do dia'}
            </p>
          </div>
        </div>
      )}
      <div className={`rounded-xl p-6 text-center shadow-lg ${statusConfig[status].bg}`}>
        <p className="text-3xl mb-1">{statusConfig[status].emoji}</p>
        <p className="text-sm font-medium text-primary-foreground/90">{statusConfig[status].label}</p>
        <p className={`text-4xl font-display font-bold mt-2 ${today && today.profit < 0 ? 'text-loss-foreground' : 'text-primary-foreground'}`}>
          {today ? fmt(today.profit) : 'R$ 0,00'}
        </p>
        <p className="text-xs text-primary-foreground/80 mt-1">Lucro real de hoje</p>
      </div>

      {/* Soft PRO trigger embaixo do lucro */}
      {!isPro && today && (
        <button
          onClick={onGoToUpgrade}
          className="w-full text-left rounded-lg p-3 bg-secondary/40 border border-border hover:border-primary/50 transition-colors flex items-center justify-between gap-3"
        >
          <p className="text-xs text-muted-foreground leading-snug">
            {today.profit > 0
              ? 'Você está no lucro… mas pode melhorar ainda mais'
              : today.profit < 0
              ? 'Seus custos podem estar te prejudicando'
              : 'Você pode estar deixando dinheiro na mesa'}
          </p>
          <span className="text-xs font-display font-semibold text-primary flex items-center gap-1 shrink-0">
            Ver como melhorar <ArrowRight size={12} />
          </span>
        </button>
      )}

      <div className="rounded-lg p-3 bg-primary/10 border border-primary/30 text-sm font-medium text-foreground flex items-center gap-2">
        <Compass size={16} className="text-primary shrink-0" />
        <span>Aceite corridas acima de <span className="font-display font-bold text-primary">{fmt(minIdealKm)}/km</span></span>
      </div>

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
            <div className="bg-loss/10 border border-loss/30 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-xs text-loss/90 flex items-center gap-1.5"><Wallet size={12} /> Gastos extras de hoje</p>
                <p className="text-2xl font-display font-bold text-loss">{fmt(expensesToday)}</p>
                <p className="text-xs text-muted-foreground">Já incluídos no custo total e no lucro do dia</p>
              </div>
              <div className="space-y-1 pt-1">
                {EXPENSE_CATEGORIES.filter(c => expensesByCat[c].total > 0).map(c => {
                  const pct = (expensesByCat[c].total / expensesToday) * 100;
                  return (
                    <div key={c}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-foreground">{c}</span>
                        <span className="font-semibold text-foreground">
                          {fmt(expensesByCat[c].total)}
                          <span className="text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-secondary/60 rounded-full h-1 overflow-hidden">
                        <div className="h-full bg-loss rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
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

      {/* PRO teasers — sempre visíveis (sem irritar) */}
      {!isPro && (
        <div className="space-y-2 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">Funções PRO</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: BarChart3, label: 'Relatórios' },
              { icon: Wallet, label: 'Gastos+' },
              { icon: Brain, label: 'Insights' },
            ].map(t => (
              <button
                key={t.label}
                onClick={onGoToUpgrade}
                className="bg-card rounded-lg p-2.5 border text-center relative hover:border-primary/50 transition-colors"
              >
                <t.icon size={14} className="mx-auto text-primary mb-1" />
                <p className="text-[10px] font-display font-semibold text-foreground">{t.label}</p>
                <Lock size={9} className="absolute top-1 right-1 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt de upgrade no momento certo */}
      {!isPro && shouldShowUpgradePrompt() && (
        <button
          onClick={onGoToUpgrade}
          className="w-full rounded-xl p-4 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 text-left flex items-center gap-3 hover:from-primary/15 transition-colors"
        >
          <Sparkles className="text-primary shrink-0" size={20} />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-sm text-foreground">Pronto para lucrar de verdade?</p>
            <p className="text-xs text-muted-foreground">Veja exatamente onde está perdendo dinheiro.</p>
          </div>
          <ArrowRight size={16} className="text-primary shrink-0" />
        </button>
      )}
        </>
      )}
    </div>
  );
}
