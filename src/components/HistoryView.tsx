import { useMemo, useState } from 'react';
import { getEntries, deleteEntry, getGoals, getRides, deleteRide } from '@/lib/storage';
import { computeStats, DailyEntry, RideEntry } from '@/lib/types';
import { getExpenses } from '@/lib/expenses';
import { mergeExpensesIntoEntries, AdjustedDailyEntry } from '@/lib/historyAggregation';
import { Trash2, TrendingUp, TrendingDown, Trophy, Calendar, FileDown, Filter, Receipt } from 'lucide-react';
import { exportHistoryPdf } from '@/lib/exportPdf';
import { toast } from 'sonner';
import HistoryCharts from './HistoryCharts';
import PeriodComparison from './PeriodComparison';
import ShiftHistoryView from './ShiftHistoryView';

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
      <p className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
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
  const rawEntries = useMemo(() => getEntries(), [refresh]);
  const allRides = useMemo(() => getRides(), [refresh]);
  const goals = useMemo(() => getGoals(), [refresh]);
  const expenses = useMemo(() => getExpenses(), [refresh]);

  const [vehicleFilter, setVehicleFilter] = useState<string>(ALL);
  const [rideTypeFilter, setRideTypeFilter] = useState<string>(ALL);

  // Merge expenses (read-side) into the canonical list used everywhere.
  // No mutation of storage / DailyEntry / sync.
  const allEntries: AdjustedDailyEntry[] = useMemo(
    () => mergeExpensesIntoEntries(rawEntries, expenses),
    [rawEntries, expenses],
  );

  // Build option lists from data actually present
  const vehicleOptions = useMemo(() => {
    const set = new Set<string>();
    allEntries.forEach(e => e.vehicle && set.add(e.vehicle));
    allRides.forEach(r => r.vehicle && set.add(r.vehicle));
    return Array.from(set).sort();
  }, [allEntries, allRides]);

  const rideTypeOptions = useMemo(() => {
    const set = new Set<string>();
    allEntries.forEach(e => e.rideType && set.add(e.rideType));
    allRides.forEach(r => r.rideType && set.add(r.rideType));
    return Array.from(set).sort();
  }, [allEntries, allRides]);

  const matches = (item: { vehicle?: string; rideType?: string }) => {
    if (vehicleFilter !== ALL && item.vehicle !== vehicleFilter) return false;
    if (rideTypeFilter !== ALL && item.rideType !== rideTypeFilter) return false;
    return true;
  };

  // When a filter is active, expense-only entries are dropped (they have no
  // vehicle/rideType attribution) — this is intentional and surfaced via the
  // "limpar filtros" hint.
  const entries = useMemo(
    () => allEntries.filter(e => (e.expenseOnly ? !(vehicleFilter !== ALL || rideTypeFilter !== ALL) : matches(e))),
    [allEntries, vehicleFilter, rideTypeFilter],
  );
  const rides = useMemo(() => allRides.filter(matches), [allRides, vehicleFilter, rideTypeFilter]);

  const stats = useMemo(() => computeStats(entries, goals.daily), [entries, goals.daily]);

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
    deleteEntry(id);
    onRefresh();
  };

  const handleDeleteRide = (id: string) => {
    deleteRide(id);
    onRefresh();
  };

  if (allEntries.length === 0 && allRides.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground animate-slide-up">
        <p className="text-4xl mb-3">📊</p>
        <p className="font-display font-semibold">Nenhum registro ainda</p>
        <p className="text-sm">Faça seu primeiro cálculo para ver o histórico.</p>
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
      <button
        onClick={() => {
          try {
            exportHistoryPdf(entries);
            toast.success('Relatório PDF gerado com sucesso');
          } catch (e) {
            toast.error('Erro ao gerar PDF');
          }
        }}
        disabled={entries.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <FileDown size={16} /> Exportar relatório PDF
      </button>

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
        <div className="bg-card rounded-lg p-8 border shadow-sm text-center space-y-3">
          <p className="text-4xl">🔍</p>
          <p className="font-display font-semibold text-foreground">Nenhum dado para esse filtro</p>
          <p className="text-sm text-muted-foreground">
            Não há registros com{vehicleFilter !== ALL && <> veículo <span className="text-foreground font-semibold">{vehicleFilter}</span></>}
            {vehicleFilter !== ALL && rideTypeFilter !== ALL && ' e'}
            {rideTypeFilter !== ALL && <> tipo <span className="text-foreground font-semibold">{rideTypeFilter}</span></>}.
          </p>
          <button
            onClick={() => { setVehicleFilter(ALL); setRideTypeFilter(ALL); }}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-display font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {!(hasFilter && entries.length === 0 && rides.length === 0) && (
      <>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card rounded-lg p-3 border shadow-sm text-center">
          <p className="text-[10px] text-muted-foreground uppercase">7 dias</p>
          <p className="font-display font-bold text-foreground">{daysLast7} <span className="text-xs font-normal text-muted-foreground">dias</span></p>
        </div>
        <div className="bg-card rounded-lg p-3 border shadow-sm text-center">
          <p className="text-[10px] text-muted-foreground uppercase">30 dias</p>
          <p className="font-display font-bold text-foreground">{daysLast30} <span className="text-xs font-normal text-muted-foreground">dias</span></p>
        </div>
        <div className="bg-card rounded-lg p-3 border shadow-sm text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          <p className="font-display font-bold text-foreground">{totalDays} <span className="text-xs font-normal text-muted-foreground">dias</span></p>
        </div>
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
              <p className="text-[10px] text-muted-foreground">Ganho</p>
              <p className="font-display font-bold text-sm text-foreground">{fmt(stats.weekTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Lucro</p>
              <p className={`font-display font-bold text-sm ${stats.weekProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {fmt(stats.weekProfit)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Média/dia</p>
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
              <p className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Por veículo</p>
              {breakdown.byVehicle.map(b => (
                <div key={'v' + b.name} className="rounded-md bg-secondary/50 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-display font-semibold text-foreground">🏍️ {b.name}</span>
                    <span className="text-[10px] text-muted-foreground">{b.count} dia{b.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">Ganho</p>
                      <p className="text-xs font-display font-bold text-foreground">{fmt(b.earnings)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">Custo</p>
                      <p className="text-xs font-display font-bold text-loss">{fmt(b.cost)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">Lucro</p>
                      <p className={`text-xs font-display font-bold ${b.profit >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(b.profit)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">Méd/dia</p>
                      <p className={`text-xs font-display font-bold ${b.avgProfit >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(b.avgProfit)}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">
                    Lucro/km: <span className={b.profitPerKm >= 0 ? 'text-profit' : 'text-loss'}>{fmt(b.profitPerKm)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {breakdown.byRideType.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-display font-semibold text-muted-foreground uppercase tracking-wider">Por tipo de corrida</p>
              {breakdown.byRideType.map(b => (
                <div key={'t' + b.name} className="rounded-md bg-secondary/50 p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-display font-semibold text-foreground">📦 {b.name}</span>
                    <span className="text-[10px] text-muted-foreground">{b.count} dia{b.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">Ganho</p>
                      <p className="text-xs font-display font-bold text-foreground">{fmt(b.earnings)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">Custo</p>
                      <p className="text-xs font-display font-bold text-loss">{fmt(b.cost)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">Lucro</p>
                      <p className={`text-xs font-display font-bold ${b.profit >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(b.profit)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">Méd/dia</p>
                      <p className={`text-xs font-display font-bold ${b.avgProfit >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(b.avgProfit)}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">
                    Lucro/km: <span className={b.profitPerKm >= 0 ? 'text-profit' : 'text-loss'}>{fmt(b.profitPerKm)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Daily entry list */}
      <div className="space-y-2">
        <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide px-1">
          Histórico diário {hasFilter && `· ${entries.length} de ${allEntries.length}`}
        </p>
        {entries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">Nenhum registro com esse filtro.</p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="bg-card rounded-lg p-4 border shadow-sm flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                    {weekday(entry.date)}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{fmtDate(entry.date)}</span>
                  <span className={`text-base font-display font-bold ${entry.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {fmt(entry.profit)}
                  </span>
                </div>
                {entry.expenseOnly ? (
                  <>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Receipt size={11} /> Gastos avulsos sem turno registrado · {fmt(entry.expensesExtra)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                      Edite ou remova em "Gastos".
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ganho: {fmt(entry.totalEarnings)} · Custo: {fmt(entry.totalCost)} · {entry.kmDriven.toFixed(0)} km
                    </p>
                    {entry.expensesExtra > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Receipt size={10} /> inclui {fmt(entry.expensesExtra)} de gastos avulsos
                      </p>
                    )}
                    {(entry.vehicle || entry.rideType) && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {entry.vehicle && (
                          <span className="text-[10px] bg-secondary text-foreground px-1.5 py-0.5 rounded">🏍️ {entry.vehicle}</span>
                        )}
                        {entry.rideType && (
                          <span className="text-[10px] bg-secondary text-foreground px-1.5 py-0.5 rounded">📦 {entry.rideType}</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {!entry.expenseOnly && (
                <button
                  onClick={() => handleDeleteEntry(entry.id)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Excluir registro"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Saved rides */}
      {allRides.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide px-1">
            Corridas analisadas {hasFilter && `· ${rides.length} de ${allRides.length}`}
          </p>
          {rides.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Nenhuma corrida com esse filtro.</p>
          ) : (
            rides.map((ride: RideEntry) => {
              const verdictColor =
                ride.verdict === 'good' ? 'text-profit' :
                ride.verdict === 'ok' ? 'text-accent' : 'text-loss';
              const verdictEmoji = ride.verdict === 'good' ? '🟢' : ride.verdict === 'ok' ? '🟡' : '🔴';
              return (
                <div key={ride.id} className="bg-card rounded-lg p-4 border shadow-sm flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base">{verdictEmoji}</span>
                      <span className="text-[10px] font-semibold uppercase text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                        {weekday(ride.date)}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">{fmtDate(ride.date)}</span>
                      <span className={`text-sm font-display font-bold ${verdictColor}`}>
                        {fmt(ride.value)} / {ride.km.toFixed(1)} km
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Lucro estimado: {fmt(ride.profit)} · {fmt(ride.ridePerKm)}/km
                    </p>
                    {(ride.vehicle || ride.rideType) && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {ride.vehicle && (
                          <span className="text-[10px] bg-secondary text-foreground px-1.5 py-0.5 rounded">🏍️ {ride.vehicle}</span>
                        )}
                        {ride.rideType && (
                          <span className="text-[10px] bg-secondary text-foreground px-1.5 py-0.5 rounded">📦 {ride.rideType}</span>
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

