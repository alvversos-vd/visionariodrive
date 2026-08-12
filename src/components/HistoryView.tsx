import { useMemo, useState } from 'react';
import { rideService } from '@/lib/services/rideService';
import { goalsService } from '@/lib/services/goalsService';
import { metricsService, type AdjustedDailyEntry } from '@/lib/services/metricsService';
// Sprint 4: HistoryView consome apenas Services — zero repository direto.
import type { RideModel, FinancialEntry } from '@/lib/domain/models';
import { financialService } from '@/lib/services/financialService';
import { Trash2, TrendingUp, TrendingDown, Trophy, Calendar, FileDown, Filter, Receipt, Sparkles, BarChart3 } from 'lucide-react';
import { exportHistoryPdf } from '@/lib/exportPdf';
import { exportTelemetry } from '@/lib/exportTelemetry';
import { toast } from 'sonner';
import HistoryCharts from './HistoryCharts';
import PeriodComparison from './PeriodComparison';
import ShiftHistoryView from './ShiftHistoryView';
import { EmptyState } from '@/components/ui/empty-state';
import { useCapabilities } from '@/hooks/useCapabilities';
import { Lock } from 'lucide-react';

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function weekday(iso: string) {
  return WEEKDAYS_SHORT[new Date(iso).getDay()];
}

interface Props {
  refresh: number;
  onRefresh: () => void;
}

const ALL = '__all__';

interface FilterBarProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

function FilterChips({ label, value, options, onChange }: FilterBarProps) {
  if (options.length === 0) return null;
  const all = [ALL, ...options];
  return (
    <div className="space-y-1.5">
      <p className="text-micro font-display font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {all.map(opt => {
          const active = value === opt;
          const lbl = opt === ALL ? 'Todos' : opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1 rounded-full text-xs font-display font-semibold transition-colors border ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function HistoryView({ refresh, onRefresh }: Props) {
  // Sprint 10.6.x — visualização liberada para START; exportação continua PRO.
  const isPro = useCapabilities().plan === 'PRO';
  // Todos os DailyEntry já ajustados com despesas do dia — vem do MetricsService.
  const allEntries: AdjustedDailyEntry[] = useMemo(() => { void refresh; return metricsService.historyEntries(); }, [refresh]);
  const allRides: RideModel[] = useMemo(() => { void refresh; return metricsService.recentIndividualRides(9999); }, [refresh]);
  const goals = useMemo(() => { void refresh; return goalsService.get(); }, [refresh]);
  const bonusEntries = useMemo(() => { void refresh; return financialService.list({ type: 'bonus' }); }, [refresh]);

  const [vehicleFilter, setVehicleFilter] = useState<string>(ALL);
  const [rideTypeFilter, setRideTypeFilter] = useState<string>(ALL);

  // Build option lists from data actually present
  const vehicleOptions = useMemo(() => {
    const set = new Set<string>();
    allEntries.forEach(e => e.vehicle && set.add(e.vehicle));
    allRides.forEach(r => r.vehicleName && set.add(r.vehicleName));
    return Array.from(set).sort();
  }, [allEntries, allRides]);

  const rideTypeOptions = useMemo(() => {
    const set = new Set<string>();
    allEntries.forEach(e => e.rideType && set.add(e.rideType));
    allRides.forEach(r => r.rideType && set.add(r.rideType));
    return Array.from(set).sort();
  }, [allEntries, allRides]);

  const matchesEntry = (item: { vehicle?: string; rideType?: string }) => {
    if (vehicleFilter !== ALL && item.vehicle !== vehicleFilter) return false;
    if (rideTypeFilter !== ALL && item.rideType !== rideTypeFilter) return false;
    return true;
  };
  const matchesRide = (r: RideModel) => {
    if (vehicleFilter !== ALL && r.vehicleName !== vehicleFilter) return false;
    if (rideTypeFilter !== ALL && r.rideType !== rideTypeFilter) return false;
    return true;
  };

  // When a filter is active, expense-only entries are dropped (they have no
  // vehicle/rideType attribution) — this is intentional and surfaced via the
  // "limpar filtros" hint.
  const entries = useMemo(
    () => allEntries.filter(e => (e.expenseOnly ? !(vehicleFilter !== ALL || rideTypeFilter !== ALL) : matchesEntry(e))),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesEntry inline usa filtros já nas deps
    [allEntries, vehicleFilter, rideTypeFilter],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesRide inline usa filtros já nas deps
  const rides = useMemo(() => allRides.filter(matchesRide), [allRides, vehicleFilter, rideTypeFilter]);

  const stats = useMemo(() => metricsService.statsFor(entries, goals.daily), [entries, goals.daily]);

  // Breakdown by vehicle and ride type for the current filter scope
  const breakdown = useMemo(() => {
    const build = (key: 'vehicle' | 'rideType') => {
      const map = new Map<string, { count: number; earnings: number; cost: number; profit: number; km: number }>();
      entries.forEach(e => {
        if (e.expenseOnly) return; // sintéticos não entram em breakdown por categoria
        const k = (e[key] || '—') as string;
        const cur = map.get(k) || { count: 0, earnings: 0, cost: 0, profit: 0, km: 0 };
        cur.count += 1;
        cur.earnings += e.totalEarnings;
        cur.cost += e.totalCost;
        cur.profit += e.profit;
        cur.km += e.kmDriven;
        map.set(k, cur);
      });
      return Array.from(map.entries())
        .map(([name, v]) => ({
          name,
          ...v,
          avgProfit: v.count ? v.profit / v.count : 0,
          profitPerKm: v.km > 0 ? v.profit / v.km : 0,
        }))
        .sort((a, b) => b.profit - a.profit);
    };
    return { byVehicle: build('vehicle'), byRideType: build('rideType') };
  }, [entries]);

  // Days worked in the last 7 / 30 days (filtered)
  const { daysLast7, daysLast30, totalDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const set7 = new Set<string>();
    const set30 = new Set<string>();
    const setAll = new Set<string>();
    entries.forEach(e => {
      const d = new Date(e.date);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      setAll.add(key);
      const diff = (today.getTime() - d.getTime()) / 86400000;
      if (diff >= 0 && diff < 7) set7.add(key);
      if (diff >= 0 && diff < 30) set30.add(key);
    });
    return { daysLast7: set7.size, daysLast30: set30.size, totalDays: setAll.size };
  }, [entries]);

  const handleDeleteEntry = (id: string) => {
    rideService.deleteEntry(id);
    onRefresh();
  };

  const handleDeleteRide = (id: string) => {
    rideService.deleteRide(id);
    onRefresh();
  };

  if (allEntries.length === 0 && allRides.length === 0) {
    return (
      <div className="text-center py-16 px-6 animate-slide-up">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
          <BarChart3 size={28} className="text-primary" />
        </div>
        <p className="font-display font-semibold text-foreground text-base">Seu histórico começa aqui</p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
          Registre sua primeira corrida ou inicie um turno para acompanhar sua evolução por dia, semana e mês.
        </p>
      </div>
    );
  }

  const insights: { icon: string; text: string }[] = [];
  if (stats.weekChangePct !== null) {
    const up = stats.weekChangePct >= 0;
    insights.push({
      icon: up ? '📈' : '📉',
      text: `Você ${up ? 'lucrou' : 'caiu'} ${Math.abs(stats.weekChangePct).toFixed(0)}% comparado à semana passada.`,
    });
  }
  if (stats.costChangePct !== null && Math.abs(stats.costChangePct) >= 5) {
    insights.push({
      icon: stats.costChangePct > 0 ? '⚠️' : '✅',
      text: `Seu custo ${stats.costChangePct > 0 ? 'aumentou' : 'reduziu'} ${Math.abs(stats.costChangePct).toFixed(0)}%.`,
    });
  }
  if (stats.bestDayOfWeek && entries.length >= 3) {
    insights.push({ icon: '🔥', text: `Você lucra mais às ${stats.bestDayOfWeek.day}s.` });
  }

  const hasFilter = vehicleFilter !== ALL || rideTypeFilter !== ALL;

  return (
    <div className="space-y-4 animate-slide-up">
      <ShiftHistoryView refresh={refresh} />
      {isPro ? (
        <button
          onClick={async () => {
            const SCOPE = 'HistoryView.exportPdfButton';
            exportTelemetry.step(SCOPE, 'click', { entriesCount: entries.length });
            try {
              const path = await exportHistoryPdf(entries);
              exportTelemetry.step(SCOPE, 'export_resolved', { path });
              if (path === 'failed') {
                toast.error('Não foi possível salvar o PDF neste dispositivo');
              } else {
                toast.success('Relatório PDF gerado com sucesso');
              }
            } catch (e) {
              exportTelemetry.error(SCOPE, 'export_threw', e);
              const msg = e instanceof Error ? e.message : String(e);
              toast.error(`Erro ao gerar PDF: ${msg}`);
            }
          }}
          disabled={entries.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <FileDown size={16} /> Exportar relatório PDF
        </button>
      ) : (
        <div className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 py-3 text-caption text-muted-foreground">
          <Lock size={14} /> Exportar relatório PDF é um recurso PRO
        </div>
      )}

      {/* Filters */}
      {(vehicleOptions.length > 0 || rideTypeOptions.length > 0) && (
        <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-display font-semibold text-foreground text-sm flex items-center gap-1.5">
              <Filter size={14} /> Filtros
            </p>
            {hasFilter && (
              <button
                onClick={() => { setVehicleFilter(ALL); setRideTypeFilter(ALL); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpar
              </button>
            )}
          </div>
          <FilterChips label="Veículo" value={vehicleFilter} options={vehicleOptions} onChange={setVehicleFilter} />
          <FilterChips label="Tipo de corrida" value={rideTypeFilter} options={rideTypeOptions} onChange={setRideTypeFilter} />
        </div>
      )}

      {/* Empty filter state */}
      {hasFilter && entries.length === 0 && rides.length === 0 && (
        <EmptyState
          icon={<span className="text-2xl">🔍</span>}
          title="Nenhum dado para esse filtro"
          description={
            (vehicleFilter !== ALL ? `Veículo: ${vehicleFilter}. ` : '') +
            (rideTypeFilter !== ALL ? `Tipo: ${rideTypeFilter}.` : '')
          }
          action={
            <button
              onClick={() => { setVehicleFilter(ALL); setRideTypeFilter(ALL); }}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-display font-semibold px-4 py-2 rounded-md hover:bg-primary/90 transition-colors text-sm press"
            >
              Limpar filtros
            </button>
          }
        />
      )}

      {!(hasFilter && entries.length === 0 && rides.length === 0) && (
      <>

      {/* Sprint 7.5 Onda 3 — dias trabalhados no formato compacto card-premium */}
      <div className="card-premium p-3 grid grid-cols-3 divide-x divide-border/60">
        <MiniStat label="7 dias" value={daysLast7} suffix="dias" />
        <MiniStat label="30 dias" value={daysLast30} suffix="dias" />
        <MiniStat label="Total" value={totalDays} suffix="dias" />
      </div>

      {/* Week summary */}
      {entries.length > 0 && (
        <div className="bg-card rounded-lg p-4 border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display font-semibold text-foreground flex items-center gap-1.5">
              <Calendar size={14} /> Últimos 7 dias
            </p>
            {stats.weekChangePct !== null && (
              <span
                className={`text-xs font-semibold flex items-center gap-0.5 ${
                  stats.weekChangePct >= 0 ? 'text-profit' : 'text-loss'
                }`}
              >
                {stats.weekChangePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {stats.weekChangePct >= 0 ? '+' : ''}{stats.weekChangePct.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-micro text-muted-foreground">Ganho</p>
              <p className="font-display font-bold text-sm text-foreground">{fmt(stats.weekTotal)}</p>
            </div>
            <div>
              <p className="text-micro text-muted-foreground">Lucro</p>
              <p className={`font-display font-bold text-sm ${stats.weekProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {fmt(stats.weekProfit)}
              </p>
            </div>
            <div>
              <p className="text-micro text-muted-foreground">Média/dia</p>
              <p className={`font-display font-bold text-sm ${stats.weekAvgProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {fmt(stats.weekAvgProfit)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comparison */}
      <PeriodComparison entries={entries} />

      {/* Charts */}
      <HistoryCharts entries={entries} />

      {/* Records */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg p-4 border shadow-sm text-center">
          <Trophy size={18} className="mx-auto text-accent mb-1" />
          <p className="text-xs text-muted-foreground">Recorde de lucro</p>
          <p className="font-display font-bold text-profit">{fmt(stats.recordProfit)}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-sm text-center">
          <p className="text-lg">🔥</p>
          <p className="text-xs text-muted-foreground">Sequência metas</p>
          <p className="font-display font-bold text-foreground">{stats.streak} dia{stats.streak !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-accent/10 border border-accent/40 rounded-lg p-4 space-y-2">
          <p className="text-xs font-display font-semibold text-foreground uppercase tracking-wide">💡 Insights</p>
          {insights.map((i, idx) => (
            <p key={idx} className="text-sm text-foreground">{i.icon} {i.text}</p>
          ))}
        </div>
      )}

      {/* Breakdown by category */}
      {entries.length > 0 && (breakdown.byVehicle.length > 1 || breakdown.byRideType.length > 1 || hasFilter) && (
        <div className="bg-card rounded-lg p-4 border shadow-sm space-y-4">
          <p className="font-display font-semibold text-foreground text-sm">📊 Resumo por categoria</p>

          {breakdown.byVehicle.length > 0 && (
            <div className="space-y-2">
              <p className="text-micro font-display font-semibold text-muted-foreground uppercase tracking-wider">Por veículo</p>
              {breakdown.byVehicle.map(b => (
                <div key={'v' + b.name} className="rounded-md bg-secondary/50 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-display font-semibold text-foreground">🏍️ {b.name}</span>
                    <span className="text-micro text-muted-foreground">{b.count} dia{b.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div>
                      <p className="text-micro text-muted-foreground uppercase">Ganho</p>
                      <p className="text-xs font-display font-bold text-foreground">{fmt(b.earnings)}</p>
                    </div>
                    <div>
                      <p className="text-micro text-muted-foreground uppercase">Custo</p>
                      <p className="text-xs font-display font-bold text-loss">{fmt(b.cost)}</p>
                    </div>
                    <div>
                      <p className="text-micro text-muted-foreground uppercase">Lucro</p>
                      <p className={`text-xs font-display font-bold ${b.profit >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(b.profit)}</p>
                    </div>
                    <div>
                      <p className="text-micro text-muted-foreground uppercase">Méd/dia</p>
                      <p className={`text-xs font-display font-bold ${b.avgProfit >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(b.avgProfit)}</p>
                    </div>
                  </div>
                  <p className="text-micro text-muted-foreground mt-1 text-right">
                    Lucro/km: <span className={b.profitPerKm >= 0 ? 'text-profit' : 'text-loss'}>{fmt(b.profitPerKm)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {breakdown.byRideType.length > 0 && (
            <div className="space-y-2">
              <p className="text-micro font-display font-semibold text-muted-foreground uppercase tracking-wider">Por tipo de corrida</p>
              {breakdown.byRideType.map(b => (
                <div key={'t' + b.name} className="rounded-md bg-secondary/50 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-display font-semibold text-foreground">📦 {b.name}</span>
                    <span className="text-micro text-muted-foreground">{b.count} dia{b.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div>
                      <p className="text-micro text-muted-foreground uppercase">Ganho</p>
                      <p className="text-xs font-display font-bold text-foreground">{fmt(b.earnings)}</p>
                    </div>
                    <div>
                      <p className="text-micro text-muted-foreground uppercase">Custo</p>
                      <p className="text-xs font-display font-bold text-loss">{fmt(b.cost)}</p>
                    </div>
                    <div>
                      <p className="text-micro text-muted-foreground uppercase">Lucro</p>
                      <p className={`text-xs font-display font-bold ${b.profit >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(b.profit)}</p>
                    </div>
                    <div>
                      <p className="text-micro text-muted-foreground uppercase">Méd/dia</p>
                      <p className={`text-xs font-display font-bold ${b.avgProfit >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(b.avgProfit)}</p>
                    </div>
                  </div>
                  <p className="text-micro text-muted-foreground mt-1 text-right">
                    Lucro/km: <span className={b.profitPerKm >= 0 ? 'text-profit' : 'text-loss'}>{fmt(b.profitPerKm)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sprint 7.5 Onda 3 — timeline diária: um card premium por dia */}
      <div className="space-y-2">
        <p className="text-caption font-display font-semibold text-muted-foreground uppercase tracking-wide px-1">
          Histórico diário {hasFilter && `· ${entries.length} de ${allEntries.length}`}
        </p>
        {entries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">Nenhum registro com esse filtro.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="card-premium p-4 animate-fade-in-up relative">
              {!entry.expenseOnly && (
                <button
                  onClick={() => handleDeleteEntry(entry.id)}
                  className="absolute top-2 right-2 p-1.5 text-muted-foreground/60 hover:text-destructive transition-colors press rounded-md"
                  aria-label="Excluir registro"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <div className="flex items-start justify-between gap-3 pr-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-micro font-display font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/25 px-1.5 py-0.5 rounded">
                      {weekday(entry.date)}
                    </span>
                    <span className="text-caption font-mono-num text-muted-foreground">{fmtDate(entry.date)}</span>
                  </div>
                  {entry.expenseOnly ? (
                    <p className="text-caption text-muted-foreground mt-2 flex items-center gap-1.5">
                      <Receipt size={12} className="text-loss" /> Gastos avulsos · edite em "Financeiro"
                    </p>
                  ) : (
                    (entry.vehicle || entry.rideType) && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {entry.vehicle && (
                          <span className="text-micro font-display font-semibold surface-inset text-foreground/80 px-1.5 py-0.5 rounded">{entry.vehicle}</span>
                        )}
                        {entry.rideType && (
                          <span className="text-micro font-display font-semibold surface-inset text-foreground/80 px-1.5 py-0.5 rounded">{entry.rideType}</span>
                        )}
                      </div>
                    )
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`kpi-display text-[22px] tracking-tight ${entry.profit >= 0 ? 'text-foreground' : 'text-loss'}`}>
                    {fmt(entry.profit)}
                  </p>
                  <p className="text-micro text-muted-foreground mt-0.5 uppercase tracking-wider">Lucro</p>
                </div>
              </div>

              {!entry.expenseOnly && (
                <div className="mt-3 pt-3 divider-hairline grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-micro uppercase tracking-wider text-muted-foreground">Ganho</p>
                    <p className="text-caption font-mono-num font-semibold text-foreground mt-0.5">{fmt(entry.totalEarnings)}</p>
                  </div>
                  <div>
                    <p className="text-micro uppercase tracking-wider text-muted-foreground">Custo</p>
                    <p className="text-caption font-mono-num font-semibold text-loss mt-0.5">{fmt(entry.totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-micro uppercase tracking-wider text-muted-foreground">Km</p>
                    <p className="text-caption font-mono-num font-semibold text-foreground mt-0.5">{entry.kmDriven.toFixed(0)}</p>
                  </div>
                </div>
              )}

              {!entry.expenseOnly && entry.expensesExtra > 0 && (
                <p className="text-micro text-muted-foreground mt-2 flex items-center gap-1">
                  <Receipt size={10} /> inclui {fmt(entry.expensesExtra)} de gastos avulsos
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bônus & receitas extras — complemento da timeline via FinancialService */}
      {bonusEntries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Bônus recebidos
          </p>
          {bonusEntries.map((b: FinancialEntry) => (
            <div key={b.id} className="bg-card rounded-lg p-4 border shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles size={14} className="text-primary shrink-0" />
                  <span className="text-micro font-semibold uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                    {weekday(b.date)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{fmtDate(b.date)}</span>
                  <span className="text-base font-display font-bold text-profit font-mono-num">+{fmt(b.value)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {b.category}{b.app && <> · {b.app}</>}{b.notes && <> · {b.notes}</>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Saved rides */}
      {allRides.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Corridas analisadas {hasFilter && `· ${rides.length} de ${allRides.length}`}
          </p>
          {rides.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Nenhuma corrida com esse filtro.</p>
          ) : (
            rides.map((ride: RideModel) => {
              const a = ride.analysis;
              const ridePerKm = a?.ridePerKm ?? (ride.km > 0 ? ride.value / ride.km : 0);
              const profit = a?.profit ?? 0;
              const verdict = a?.verdict ?? 'ok';
              const verdictColor =
                verdict === 'good' ? 'text-profit' :
                verdict === 'ok' ? 'text-accent' : 'text-loss';
              const verdictEmoji = verdict === 'good' ? '🟢' : verdict === 'ok' ? '🟡' : '🔴';
              return (
                <div key={ride.id} className="bg-card rounded-lg p-4 border shadow-sm flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base">{verdictEmoji}</span>
                      <span className="text-micro font-semibold uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                        {weekday(ride.date)}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">{fmtDate(ride.date)}</span>
                      <span className={`text-sm font-display font-bold ${verdictColor}`}>
                        {fmt(ride.value)} / {ride.km.toFixed(1)} km
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Lucro estimado: {fmt(profit)} · {fmt(ridePerKm)}/km
                    </p>
                    {(ride.vehicleName || ride.rideType) && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {ride.vehicleName && (
                          <span className="text-micro bg-secondary text-foreground px-1.5 py-0.5 rounded">🏍️ {ride.vehicleName}</span>
                        )}
                        {ride.rideType && (
                          <span className="text-micro bg-secondary text-foreground px-1.5 py-0.5 rounded">📦 {ride.rideType}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteRide(ride.id)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Excluir corrida"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}

function MiniStat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0 text-center">
      <p className="text-micro uppercase tracking-wider text-muted-foreground font-display font-semibold">{label}</p>
      <p className="mt-1 font-mono-num font-semibold text-foreground">
        {value}
        {suffix && <span className="text-caption font-normal text-muted-foreground ml-1">{suffix}</span>}
      </p>
    </div>
  );
}


