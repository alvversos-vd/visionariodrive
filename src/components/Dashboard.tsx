import { useEffect, useMemo, useRef, useState } from 'react';
import { rideService } from '@/lib/services/rideService';
import { EXPENSE_CATEGORIES } from '@/lib/domain/models';
import { useAuth, getDisplayName } from '@/contexts/AuthContext';
import {
  daysSinceLastOpen, markOpenedToday,
  shouldCelebrateFirstProfit, markFirstProfitCelebrated,
  shouldCelebrateRides5, markRides5Celebrated,
  getFocusMode, setFocusMode,
  shouldShowUpgradePrompt,
} from '@/lib/engagement';
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Trophy, Flame, Target, Wallet, Focus, Compass, Sparkles, Lock, BarChart3, Brain, ArrowRight, AlertTriangle, Banknote, Receipt, Route, Gauge } from 'lucide-react';
import OperationalStatusBadge from './OperationalStatusBadge';
import ShiftMode from './ShiftMode';
import InsightsCard from './InsightsCard';
// Sprint 3: única leitura autorizada — encapsula goals/settings/snapshot/turno/insights.
import { useDashboard } from '@/hooks/useDashboard';
import { shiftService } from '@/lib/services/shiftService';
import { haptics } from '@/lib/haptics';
import { useSessionMode } from './session/SessionModeContext';
import SessionDashboard from './session/SessionDashboard';
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
  const { sessionMode } = useSessionMode();


  // ÚNICA fonte financeira do Dashboard — hook encapsula Services e reage
  // a rides:changed / financial:changed / shift:changed via eventBus.
  const { goals, settings, snapshot, activeShift, shiftTotals, insights } = useDashboard(refresh);
  const { stats, today: todayMetrics, entriesCount, expensesByCategory } = snapshot;

  const expensesToday = todayMetrics.expense;
  const bonusToday = todayMetrics.bonus;
  // Compat shim: monta um "today" no mesmo shape do antigo DailyEntry ajustado,
  // sem expor o storage de entries para o componente.
  const today = todayMetrics.rawEntry
    ? {
        ...todayMetrics.rawEntry,
        totalCost: todayMetrics.totalCost,
        profit: todayMetrics.netProfit,
        profitPerHour: todayMetrics.profitPerHour,
        profitPerKm: todayMetrics.profitPerKm,
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

  // Realtime feedback when profit / minIdealKm change (silencioso — alerta único na tela cuida do resto)
  const prevProfit = useRef<number | null>(null);
  useEffect(() => {
    prevProfit.current = today?.profit ?? null;
  }, [today?.profit]);

  // Micro-wins + return reminder (run once per mount) — sem alertas redundantes
  useEffect(() => {
    const days = daysSinceLastOpen();
    markOpenedToday();
    if (today && today.profit > 0 && shouldCelebrateFirstProfit()) {
      markFirstProfitCelebrated();
      toast.success('Primeiro dia no lucro 👊');
    }
    const ridesCount = rideService.countIndividual();
    if (ridesCount >= 5 && shouldCelebrateRides5()) {
      markRides5Celebrated();
      toast.success('Você está tomando decisões melhores');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saudacaoHora = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();
  const heroSubtext = today
    ? today.profit > 0
      ? `Hoje você já fez ${fmt(today.profit)} líquidos`
      : today.profit < 0
      ? `Atenção: lucro negativo hoje`
      : `Comece bem o dia, ${displayName}`
    : `Bora começar, ${displayName}`;

  // Sessão Visionária — apenas troca de apresentação (Sprint 10).
  if (sessionMode) return <SessionDashboard refresh={refresh} />;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* HEADER — saudação humana, sem ruído */}
      <div className="px-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-[0.12em] text-muted-foreground font-display font-semibold">{saudacaoHora}</p>
          <p className="text-base font-display font-semibold text-foreground mt-0.5 leading-tight truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{heroSubtext}</p>
        </div>
        <button
          onClick={toggleFocus}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-display font-semibold border transition-all press ${
            focus
              ? 'bg-gradient-brand text-primary-foreground border-transparent shadow-glow-sm'
              : 'bg-card/60 text-muted-foreground border-border hover:text-foreground hover:border-border'
          }`}
          aria-pressed={focus}
          aria-label="Modo foco"
        >
          <Focus size={12} /> {focus ? 'Foco ativo' : 'Foco'}
        </button>
      </div>





      {/* HERO PREMIUM — Lucro real + Status turno + Meta diária */}
      {(() => {
        const startedMin = activeShift
          ? Math.max(0, Math.round((Date.now() - new Date(activeShift.inicio_turno).getTime()) / 60000))
          : 0;
        const profitNeg = !!(today && today.profit < 0);
        return (
          <div className="relative rounded-2xl p-6 bg-card border border-border/70 shadow-premium overflow-hidden animate-fade-in-up">
            {/* Linha superior — accent muito sutil só quando há sinal real */}
            {today && (
              <div className={`absolute inset-x-0 top-0 h-px ${profitNeg ? 'bg-loss/70' : 'bg-primary/70'}`} />
            )}
            {/* Brilho sutil de marca — só no estado positivo / neutro */}
            {!profitNeg && (
              <div className="absolute -top-24 -right-20 w-56 h-56 rounded-full blur-3xl opacity-[0.10] bg-primary pointer-events-none" />
            )}

            {/* Linha 1: status do turno */}
            <div className="relative flex items-center justify-between gap-3 mb-5">
              {activeShift ? (
                <span className="inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-primary/10 border border-primary/40 text-caption font-display font-semibold text-primary">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  Turno ativo · {shiftService.formatTempo(startedMin)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-secondary/60 border border-border text-caption font-display font-semibold text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                  Sem turno ativo
                </span>
              )}
              {shiftTotals && shiftTotals.corridas_total > 0 && (
                <span className="text-caption text-muted-foreground font-mono-num">
                  {shiftTotals.corridas_total} corrida{shiftTotals.corridas_total > 1 ? 's' : ''} · {fmt(shiftTotals.ganho_total)}
                </span>
              )}
            </div>

            {/* Micro-UX Sprint 4: km do turno + tempo desde última corrida */}
            {activeShift && shiftTotals && (
              <div className="relative -mt-3 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground font-mono-num">
                <span>{shiftTotals.km_total.toFixed(1)} km no turno</span>
                {activeShift.ultima_corrida_iso && (
                  <span>
                    · última corrida há{' '}
                    {shiftService.formatTempo(
                      Math.max(0, Math.round((Date.now() - new Date(activeShift.ultima_corrida_iso).getTime()) / 60000)),
                    )}
                  </span>
                )}
              </div>
            )}


            {/* Linha 2: lucro real — KPI hero */}
            <p className="relative text-micro uppercase tracking-[0.22em] text-muted-foreground font-display font-semibold">Lucro real de hoje</p>
            <p className={`relative font-mono-num font-semibold mt-2 leading-none tracking-tight text-[44px] sm:text-[52px] ${
              profitNeg ? 'text-loss' : today && today.profit > 0 ? 'text-foreground' : 'text-foreground/70'
            }`}>
              {today ? fmt(today.profit) : 'R$ 0,00'}
            </p>

            {/* Linha 3: meta */}
            {goals.daily > 0 ? (
              <div className="relative mt-6">
                <div className="flex items-center justify-between text-caption">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground font-display font-semibold uppercase tracking-wider">
                    <Target size={11} className="text-primary" />
                    Meta · <span className="text-foreground font-mono-num normal-case tracking-normal">{fmt(goals.daily)}</span>
                  </span>
                  {today && today.profit >= goals.daily ? (
                    <span className="text-primary font-display font-semibold">✓ Batida</span>
                  ) : (
                    <span className="text-foreground font-mono-num">{goalProgress.toFixed(0)}%</span>
                  )}
                </div>
                <div className="mt-2 h-1.5 bg-secondary/70 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ease-out ${today && today.profit >= goals.daily ? 'bg-gradient-brand shadow-glow-sm' : 'bg-gradient-brand'}`}
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
                {today && today.profit < goals.daily && (
                  <p className="mt-2 text-caption text-muted-foreground">
                    Faltam <span className="text-foreground font-mono-num font-semibold">{fmt(goals.daily - Math.max(0, today.profit))}</span> para a meta
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={onGoToGoals}
                className="relative mt-6 inline-flex items-center gap-1.5 text-caption font-display font-semibold text-primary hover:text-primary-glow transition-colors press"
              >
                <Target size={12} /> Definir meta diária <ArrowRight size={10} />
              </button>
            )}
          </div>
        );
      })()}

      <OperationalStatusBadge />

      <ShiftMode />

      {/* Insights (máx. 3) — Sprint 3 */}
      {entriesCount >= 3 && <InsightsCard insights={insights} />}



      {focus ? (
        <div className="space-y-3 animate-fade-in-up">
          <div className="relative rounded-2xl p-6 bg-card border border-primary/30 shadow-glow-sm text-center overflow-hidden">
            <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full blur-3xl opacity-[0.12] bg-primary pointer-events-none" />
            <p className="relative text-micro uppercase tracking-[0.22em] text-muted-foreground font-display font-semibold inline-flex items-center justify-center gap-1.5"><Compass size={12} className="text-primary"/> Mínimo ideal por km</p>
            <p className="relative text-[44px] font-mono-num font-semibold text-primary mt-2 leading-none">{fmt(minIdealKm)}</p>
            <p className="relative text-caption text-muted-foreground mt-3">Aceite corridas acima de <span className="text-foreground font-mono-num">{fmt(minIdealKm)}</span>/km</p>
          </div>
          <p className="text-center text-sm text-muted-foreground italic">
            Foco hoje, {displayName}. Decisões melhores, mais lucro.
          </p>
        </div>
      ) : (
        <>
      {/* ALERTA ÚNICO da tela */}
      {topAlert && (
        <div
          className={`rounded-xl p-3 pl-3.5 border flex items-center gap-3 animate-fade-in-up relative overflow-hidden ${
            topAlert.tone === 'loss'
              ? 'border-loss/40 bg-loss/[0.08]'
              : topAlert.tone === 'warn'
              ? 'border-warning/40 bg-warning/[0.08]'
              : 'border-primary/30 bg-primary/[0.06]'
          }`}
        >
          <span className={`absolute inset-y-0 left-0 w-[2px] ${topAlert.tone === 'loss' ? 'bg-loss' : topAlert.tone === 'warn' ? 'bg-warning' : 'bg-primary'}`} />
          {topAlert.tone === 'loss' || topAlert.tone === 'warn' ? (
            <AlertTriangle size={16} className={topAlert.tone === 'loss' ? 'text-loss shrink-0' : 'text-warning shrink-0'} />
          ) : (
            <Target size={16} className="text-primary shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-display font-semibold text-foreground leading-snug">{topAlert.title}</p>
            {topAlert.hint && <p className="text-caption text-muted-foreground leading-snug mt-0.5">{topAlert.hint}</p>}
          </div>
        </div>
      )}

      {(() => {
        // ===== Seções reordenáveis conforme objetivo (hero já está no topo) =====

        const sectionUpgrade = !isPro && today ? (
          <button
            key="upgrade"
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
        ) : null;

        const sectionMinKm = (
          <div key="minkm" className="rounded-xl p-3.5 bg-primary/[0.06] border border-primary/30 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Compass size={16} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-micro uppercase tracking-[0.14em] text-muted-foreground font-display font-semibold">Mínimo ideal por km</p>
              <p className="text-sm text-foreground leading-snug mt-0.5">
                Aceite acima de <span className="font-mono-num font-semibold text-primary">{fmt(minIdealKm)}</span>/km
              </p>
            </div>
          </div>
        );

        // Sprint 7.5 Onda 2 — meta vive somente no Hero (glow forte, barra sincronizada).
        // Removido card duplicado para eliminar redundância visual e proteger a hierarquia
        // Hero → KPIs → CTA → secundários.
        const sectionMeta: React.ReactNode = null;

        const KpiTile = ({
          label,
          value,
          icon: Icon,
          tone = 'default',
          unit,
        }: {
          label: string;
          value: string;
          icon: typeof Banknote;
          tone?: 'default' | 'loss' | 'primary';
          unit?: string;
        }) => (
          <div className={`relative rounded-xl p-4 bg-card border shadow-elevated overflow-hidden ${
            tone === 'loss' ? 'border-loss/30' : tone === 'primary' ? 'border-primary/30' : 'border-border/70'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-micro uppercase tracking-[0.14em] text-muted-foreground font-display font-semibold">{label}</p>
              <Icon size={14} className={tone === 'loss' ? 'text-loss/80' : tone === 'primary' ? 'text-primary' : 'text-muted-foreground'} />
            </div>
            <p className={`font-mono-num font-semibold text-xl leading-none tracking-tight ${
              tone === 'loss' ? 'text-loss' : tone === 'primary' ? 'text-primary' : 'text-foreground'
            }`}>
              {value}{unit && <span className="text-muted-foreground text-sm font-medium ml-1">{unit}</span>}
            </p>
          </div>
        );

        const sectionMetrics = today ? (
          <div key="metrics" className="space-y-3">
            <div className="px-1 flex items-center justify-between">
              <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">Cockpit · Hoje</p>
              {today.hoursWorked > 0 && (
                <p className="text-micro text-muted-foreground font-mono-num">{today.hoursWorked.toFixed(1)}h trabalhadas</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <KpiTile label="Ganhos" value={fmt(today.totalEarnings)} icon={Banknote} />
              <KpiTile label="Custo total" value={fmt(today.totalCost)} icon={Receipt} tone={objective === 'controlar_gastos' ? 'loss' : 'default'} />
              <KpiTile label="Km rodados" value={today.kmDriven.toFixed(0)} unit="km" icon={Route} />
              <KpiTile label="Custo / km" value={fmt(costPerKm)} icon={Gauge} tone={objective === 'controlar_gastos' ? 'loss' : 'default'} />
            </div>

            <div className={`rounded-xl p-4 border shadow-elevated relative overflow-hidden ${objective === 'evitar_prejuizo' ? 'bg-primary/[0.05] border-primary/40' : 'bg-card border-border/70'}`}>
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-[0.10] bg-primary pointer-events-none" />
              <p className="relative text-micro uppercase tracking-[0.14em] text-muted-foreground font-display font-semibold inline-flex items-center gap-1.5">
                <Target size={11} className="text-primary" /> Mínimo ideal por km
              </p>
              <p className="relative font-mono-num font-semibold text-3xl text-primary mt-2 leading-none">{fmt(minIdealKm)}</p>
              <p className="relative text-caption text-muted-foreground mt-2">
                Margem aplicada · <span className="font-mono-num">{((settings.profitMargin - 1) * 100).toFixed(0)}%</span>
              </p>
            </div>

            {expensesToday > 0 && (
              <div className="rounded-xl p-4 border border-loss/30 bg-loss/[0.06] space-y-3 relative overflow-hidden">
                <span className="absolute inset-y-0 left-0 w-[2px] bg-loss" />
                <div>
                  <p className="text-micro uppercase tracking-[0.14em] text-loss/90 font-display font-semibold inline-flex items-center gap-1.5">
                    <Wallet size={11} /> Gastos extras de hoje
                  </p>
                  <p className="font-mono-num font-semibold text-2xl text-loss mt-1 leading-none">{fmt(expensesToday)}</p>
                  <p className="text-caption text-muted-foreground mt-1.5">Já incluídos no custo total e no lucro do dia</p>
                </div>
                <div className="space-y-1.5 pt-1">
                  {EXPENSE_CATEGORIES.filter(c => (expensesByCategory[c] ?? 0) > 0).map(c => {
                    const pct = ((expensesByCategory[c] ?? 0) / expensesToday) * 100;
                    return (
                      <div key={c}>
                        <div className="flex items-center justify-between text-caption">
                          <span className="text-foreground">{c}</span>
                          <span className="font-display font-semibold text-foreground">
                            <span className="font-mono-num">{fmt((expensesByCategory[c] ?? 0))}</span>
                            <span className="text-muted-foreground ml-1.5 font-mono-num">{pct.toFixed(0)}%</span>
                          </span>
                        </div>
                        <div className="w-full bg-secondary/60 rounded-full h-1 overflow-hidden mt-1">
                          <div className="h-full bg-loss rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}



            {bonusToday > 0 && (
              <div className="rounded-xl p-3.5 border border-primary/30 bg-primary/[0.06] flex items-center justify-between gap-3 relative overflow-hidden">
                <span className="absolute inset-y-0 left-0 w-[2px] bg-primary" />
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sparkles size={14} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-micro uppercase tracking-[0.14em] text-primary font-display font-semibold">Bônus do dia</p>
                    <p className="text-caption text-muted-foreground mt-0.5">Já somado ao lucro líquido</p>
                  </div>
                </div>
                <p className="font-mono-num font-semibold text-lg text-primary">{fmt(bonusToday)}</p>
              </div>
            )}


            {today.hoursWorked > 0 && settings.estimatedHours > today.hoursWorked && (
              <div className="rounded-xl p-4 border border-border/70 bg-card shadow-elevated">
                <p className="text-micro uppercase tracking-[0.14em] text-muted-foreground font-display font-semibold inline-flex items-center gap-1.5">
                  <TrendingUp size={11} className="text-info" /> Previsão para {settings.estimatedHours}h
                </p>
                <p className="font-mono-num font-semibold text-2xl text-info mt-2 leading-none">
                  {fmt((today.totalEarnings / today.hoursWorked) * settings.estimatedHours)}
                </p>
                <p className="text-caption text-muted-foreground mt-1.5">
                  Ritmo atual · <span className="font-mono-num text-foreground">{fmt(today.totalEarnings / today.hoursWorked)}</span>/h
                </p>
              </div>
            )}
          </div>
        ) : (
          <button
            key="metrics-empty"
            onClick={onGoToInput}
            className="group w-full bg-card/40 rounded-xl p-6 border border-dashed border-border hover:border-primary/60 hover:bg-card transition-all text-center press"
          >
            <div className="mx-auto h-10 w-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <ArrowRight size={16} className="text-primary" />
            </div>
            <p className="text-caption uppercase tracking-[0.14em] text-muted-foreground font-display font-semibold mt-3">Sem cálculo hoje</p>
            <p className="text-sm font-display font-semibold text-foreground mt-1">Registrar dia de trabalho</p>
          </button>
        );

        // Ordem dos blocos (hero já está fixo no topo da tela)
        const orderMap: Record<Objective, string[]> = {
          ganhar_mais:      ['meta', 'minkm', 'metrics'],
          controlar_gastos: ['metrics', 'minkm', 'meta'],
          evitar_prejuizo:  ['minkm', 'metrics', 'meta'],
          bater_metas:      ['meta', 'minkm', 'metrics'],
          organizar_ganhos: ['metrics', 'meta', 'minkm'],
        };
        const order = (objective && orderMap[objective]) || ['minkm', 'metrics', 'meta'];

        const sectionMap: Record<string, React.ReactNode> = {
          minkm: sectionMinKm,
          meta: sectionMeta,
          metrics: sectionMetrics,
        };

        return (
          <>
            {order.map(k => sectionMap[k]).filter(Boolean)}
            {sectionUpgrade}
          </>
        );
      })()}

      {/* Performance highlights */}
      {entriesCount > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold px-1">Desempenho</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card rounded-xl p-3 border border-border/70 shadow-elevated text-center">
              <Flame size={16} className="mx-auto text-warning mb-1" />
              <p className="text-micro uppercase tracking-wider text-muted-foreground font-display">Sequência</p>
              <p className="font-mono-num font-semibold text-foreground mt-0.5">{stats.streak}<span className="text-xs text-muted-foreground ml-0.5">d</span></p>
            </div>
            <div className="bg-card rounded-xl p-3 border border-border/70 shadow-elevated text-center">
              <Trophy size={16} className="mx-auto text-warning mb-1" />
              <p className="text-micro uppercase tracking-wider text-muted-foreground font-display">Recorde</p>
              <p className="font-mono-num font-semibold text-primary text-sm mt-0.5">{fmt(stats.recordProfit)}</p>
            </div>
            <div className="bg-card rounded-xl p-3 border border-border/70 shadow-elevated text-center">
              {stats.weekChangePct !== null && stats.weekChangePct < 0 ? (
                <TrendingDown size={16} className="mx-auto text-loss mb-1" />
              ) : (
                <TrendingUp size={16} className="mx-auto text-primary mb-1" />
              )}
              <p className="text-micro uppercase tracking-wider text-muted-foreground font-display">Semana</p>
              <p className={`font-mono-num font-semibold text-sm mt-0.5 ${stats.weekProfit >= 0 ? 'text-primary' : 'text-loss'}`}>
                {fmt(stats.weekProfit)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PRO teasers — sempre visíveis (sem irritar) */}
      {!isPro && (
        <div className="space-y-2 pt-2">
          <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold px-1">Funções PRO</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: BarChart3, label: 'Relatórios' },
              { icon: Wallet, label: 'Gastos+' },
              { icon: Brain, label: 'Insights' },
            ].map(t => (
              <button
                key={t.label}
                onClick={onGoToUpgrade}
                className="bg-card rounded-xl p-3 border border-border/70 text-center relative hover:border-primary/50 transition-colors press"
              >
                <t.icon size={16} className="mx-auto text-primary mb-1.5" />
                <p className="text-micro font-display font-semibold text-foreground">{t.label}</p>
                <Lock size={9} className="absolute top-1.5 right-1.5 text-muted-foreground/70" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt de upgrade no momento certo */}
      {!isPro && shouldShowUpgradePrompt() && (
        <button
          onClick={onGoToUpgrade}
          className="w-full rounded-xl p-4 bg-card border border-primary/30 text-left flex items-center gap-3 hover:border-primary/50 transition-colors press relative overflow-hidden"
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-[0.12] bg-primary pointer-events-none" />
          <div className="relative h-10 w-10 rounded-xl bg-gradient-brand shadow-glow-sm flex items-center justify-center shrink-0">
            <Sparkles className="text-primary-foreground" size={18} />
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="font-display font-semibold text-sm text-foreground">Pronto para lucrar de verdade?</p>
            <p className="text-caption text-muted-foreground mt-0.5">Veja exatamente onde está perdendo dinheiro.</p>
          </div>
          <ArrowRight size={16} className="relative text-primary shrink-0" />
        </button>
      )}
        </>
      )}
    </div>
  );
}
