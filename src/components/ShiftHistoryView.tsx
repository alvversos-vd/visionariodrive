import { useMemo, useState } from 'react';
import { Shift, getShifts, computeTotals, formatTempo, formatOperationalDate } from '@/lib/shifts';
import { getGoals } from '@/lib/storage';
import { getVehiclesV2, getVehicleById, TIPO_LABEL, APPS, TipoVeiculo } from '@/lib/vehicles';
import { ChevronDown, ChevronUp, Trophy, Clock, Wallet, Navigation, Car, Smartphone, Award, TrendingUp, Filter, X } from 'lucide-react';

type DayResult = 'excelente' | 'bom' | 'ruim';
type Filter = 'hoje' | 'semana' | 'mes' | 'todos';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function classifyDay(lucro: number, meta: number): DayResult {
  if (meta > 0 && lucro >= meta) return 'excelente';
  if (lucro > 0) return 'bom';
  return 'ruim';
}

const RESULT_STYLE: Record<DayResult, { bg: string; label: string; emoji: string; text: string; ring: string }> = {
  excelente: { bg: 'bg-profit', label: 'Excelente', emoji: '🟢', text: 'text-profit', ring: 'ring-profit/30' },
  bom: { bg: 'bg-accent', label: 'Bom', emoji: '🟡', text: 'text-accent', ring: 'ring-accent/30' },
  ruim: { bg: 'bg-loss', label: 'Ruim', emoji: '🔴', text: 'text-loss', ring: 'ring-loss/30' },
};

function inFilter(dataOp: string, filter: Filter): boolean {
  if (filter === 'todos') return true;
  const [y, m, d] = dataOp.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (filter === 'hoje') return diff === 0;
  if (filter === 'semana') return diff >= 0 && diff < 7;
  if (filter === 'mes') return diff >= 0 && diff < 30;
  return true;
}

interface Props { refresh: number }

export default function ShiftHistoryView({ refresh }: Props) {
  const [filter, setFilter] = useState<Filter>('semana');
  const [vehicleFilter, setVehicleFilter] = useState<'todos' | TipoVeiculo>('todos');
  const [appFilter, setAppFilter] = useState<string>('todos');
  const [openId, setOpenId] = useState<string | null>(null);

  const shifts = useMemo<Shift[]>(
    () => getShifts().filter(s => s.status === 'finalizado'),
    [refresh]
  );
  const meta = useMemo(() => getGoals().daily, [refresh]);
  const vehicles = useMemo(() => getVehiclesV2(), [refresh]);

  // Counts per period filter (respeitando filtros de veículo e app)
  const periodCounts = useMemo(() => {
    const base = shifts
      .filter(s => vehicleFilter === 'todos' || s.tipo_veiculo === vehicleFilter)
      .filter(s => appFilter === 'todos' || s.app_utilizado === appFilter);
    return {
      hoje: base.filter(s => inFilter(s.data_operacional, 'hoje')).length,
      semana: base.filter(s => inFilter(s.data_operacional, 'semana')).length,
      mes: base.filter(s => inFilter(s.data_operacional, 'mes')).length,
      todos: base.length,
    } as Record<Filter, number>;
  }, [shifts, vehicleFilter, appFilter]);

  const filtered = useMemo(
    () => shifts
      .filter(s => inFilter(s.data_operacional, filter))
      .filter(s => vehicleFilter === 'todos' || s.tipo_veiculo === vehicleFilter)
      .filter(s => appFilter === 'todos' || s.app_utilizado === appFilter)
      .sort((a, b) => b.data_operacional.localeCompare(a.data_operacional) ||
                      (b.fim_turno || '').localeCompare(a.fim_turno || '')),
    [shifts, filter, vehicleFilter, appFilter]
  );

  const totals = useMemo(() => {
    const acc = { lucro: 0, ganho: 0, km: 0, corridas: 0, minutos: 0, custo: 0 };
    filtered.forEach(s => {
      const t = computeTotals(s);
      acc.lucro += t.lucro_total;
      acc.ganho += t.ganho_total;
      acc.km += t.km_total;
      acc.corridas += t.corridas_total;
      acc.minutos += t.tempo_online_minutos;
      acc.custo += t.custo_total;
    });
    return {
      ...acc,
      lucroPorHora: acc.minutos > 0 ? acc.lucro / (acc.minutos / 60) : 0,
      lucroPorKm: acc.km > 0 ? acc.lucro / acc.km : 0,
      lucroPorTurno: filtered.length > 0 ? acc.lucro / filtered.length : 0,
    };
  }, [filtered]);

  // Melhor app & melhor veículo (no filtro atual de período)
  const insights = useMemo(() => {
    const periodShifts = shifts.filter(s => inFilter(s.data_operacional, filter));
    const byApp: Record<string, { lucro: number; turnos: number }> = {};
    const byVeh: Record<string, { lucro: number; km: number; turnos: number; nome: string }> = {};
    periodShifts.forEach(s => {
      const t = computeTotals(s);
      if (s.app_utilizado) {
        byApp[s.app_utilizado] = byApp[s.app_utilizado] || { lucro: 0, turnos: 0 };
        byApp[s.app_utilizado].lucro += t.lucro_total;
        byApp[s.app_utilizado].turnos += 1;
      }
      if (s.veiculo_id) {
        const v = getVehicleById(s.veiculo_id);
        const nome = v ? `${TIPO_LABEL[v.tipo_veiculo]} ${v.nome_veiculo}` : 'Veículo removido';
        byVeh[s.veiculo_id] = byVeh[s.veiculo_id] || { lucro: 0, km: 0, turnos: 0, nome };
        byVeh[s.veiculo_id].lucro += t.lucro_total;
        byVeh[s.veiculo_id].km += t.km_total;
        byVeh[s.veiculo_id].turnos += 1;
      }
    });
    let bestApp: { app: string; mediaLucro: number } | null = null;
    Object.entries(byApp).forEach(([app, v]) => {
      const media = v.lucro / v.turnos;
      if (!bestApp || media > bestApp.mediaLucro) bestApp = { app, mediaLucro: media };
    });
    let bestVeh: { nome: string; lucroPorKm: number } | null = null;
    Object.values(byVeh).forEach(v => {
      const lpk = v.km > 0 ? v.lucro / v.km : 0;
      if (!bestVeh || lpk > bestVeh.lucroPorKm) bestVeh = { nome: v.nome, lucroPorKm: lpk };
    });
    return { bestApp, bestVeh };
  }, [shifts, filter]);

  const filters: { key: Filter; label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Mês' },
    { key: 'todos', label: 'Todos' },
  ];

  const tipoOptions: { key: 'todos' | TipoVeiculo; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'moto', label: '🏍️' },
    { key: 'carro', label: '🚗' },
    { key: 'bike', label: '🚲' },
    { key: 'bike_eletrica', label: '⚡' },
  ];

  const hasActiveFilter = vehicleFilter !== 'todos' || appFilter !== 'todos';

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h2 className="font-display font-bold text-lg flex items-center gap-2">📊 Histórico de turnos</h2>
        <p className="text-xs text-muted-foreground">Cada turno mostra o que está valendo a pena.</p>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-md border-b border-border/40 space-y-2">
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          {filters.map(f => {
            const active = filter === f.key;
            const count = periodCounts[f.key];
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`flex-1 py-1.5 text-xs font-display font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {f.label}
                <span className={`text-[10px] px-1.5 rounded-full number-tabular ${active ? 'bg-primary-foreground/20' : 'bg-background/60'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Car size={10}/> Veículo</p>
            <div className="flex gap-1 bg-secondary rounded-lg p-1">
              {tipoOptions.map(o => (
                <button key={o.key} onClick={() => setVehicleFilter(o.key)}
                  className={`flex-1 py-1 text-[11px] font-display font-semibold rounded transition-colors ${vehicleFilter === o.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Smartphone size={10}/> App</p>
            <select value={appFilter} onChange={e => setAppFilter(e.target.value)} className="w-full px-2 py-2 rounded-lg border bg-background text-xs">
              <option value="todos">Todos</option>
              {APPS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {hasActiveFilter && (
          <button
            onClick={() => { setVehicleFilter('todos'); setAppFilter('todos'); }}
            className="w-full text-[11px] font-display font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1"
          >
            <X size={11}/> Limpar filtros
          </button>
        )}
      </div>

      {/* KPIs do período */}
      {filtered.length > 0 && (
        <div className="bg-gradient-to-br from-card to-secondary/40 border border-border/60 rounded-xl p-4 shadow-premium space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground">Resumo do período</p>
            <span className="text-[10px] text-muted-foreground number-tabular">{filtered.length} turno{filtered.length === 1 ? '' : 's'} · {totals.corridas} corr</span>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Lucro total</p>
            <p className={`font-display font-bold text-3xl number-tabular ${totals.lucro >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(totals.lucro)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background/60 rounded-lg p-2 border border-border/40">
              <p className="text-[9px] text-muted-foreground uppercase">Lucro/h</p>
              <p className={`font-display font-bold text-sm number-tabular ${totals.lucroPorHora >= 0 ? 'text-foreground' : 'text-loss'}`}>{fmt(totals.lucroPorHora)}</p>
            </div>
            <div className="bg-background/60 rounded-lg p-2 border border-border/40">
              <p className="text-[9px] text-muted-foreground uppercase">Lucro/km</p>
              <p className={`font-display font-bold text-sm number-tabular ${totals.lucroPorKm >= 0 ? 'text-foreground' : 'text-loss'}`}>{fmt(totals.lucroPorKm)}</p>
            </div>
            <div className="bg-background/60 rounded-lg p-2 border border-border/40">
              <p className="text-[9px] text-muted-foreground uppercase">Lucro/turno</p>
              <p className={`font-display font-bold text-sm number-tabular ${totals.lucroPorTurno >= 0 ? 'text-foreground' : 'text-loss'}`}>{fmt(totals.lucroPorTurno)}</p>
            </div>
          </div>
        </div>
      )}

      {(insights.bestApp || insights.bestVeh) && filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {insights.bestApp && (
            <div className="bg-card border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><Award size={10}/> Melhor app</p>
              <p className="font-display font-bold text-sm">{insights.bestApp.app}</p>
              <p className="text-[11px] text-profit number-tabular">{fmt(insights.bestApp.mediaLucro)}/turno</p>
            </div>
          )}
          {insights.bestVeh && (
            <div className="bg-card border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><Award size={10}/> Melhor veículo</p>
              <p className="font-display font-bold text-sm truncate">{insights.bestVeh.nome}</p>
              <p className="text-[11px] text-profit number-tabular">{fmt(insights.bestVeh.lucroPorKm)}/km</p>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card border-2 border-dashed border-border/50 rounded-xl p-10 text-center space-y-2">
          <Filter size={28} className="mx-auto text-muted-foreground/60" />
          <p className="text-sm font-display font-semibold">Nenhum turno encontrado</p>
          <p className="text-xs text-muted-foreground">
            {hasActiveFilter ? 'Tente limpar os filtros ou trocar o período.' : 'Finalize um turno no Modo Turno para vê-lo aqui.'}
          </p>
          {hasActiveFilter && (
            <button onClick={() => { setVehicleFilter('todos'); setAppFilter('todos'); setFilter('todos'); }}
              className="mt-2 text-xs font-display font-semibold text-primary hover:underline">
              Limpar tudo
            </button>
          )}
        </div>
      ) : (() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const groups: Record<string, Shift[]> = { Hoje: [], Ontem: [], 'Esta semana': [], 'Este mês': [], Anteriores: [] };
        filtered.forEach(s => {
          const [y,m,d] = s.data_operacional.split('-').map(Number);
          const date = new Date(y, m-1, d);
          const diff = Math.floor((today.getTime() - date.getTime()) / 86400000);
          if (diff === 0) groups['Hoje'].push(s);
          else if (diff === 1) groups['Ontem'].push(s);
          else if (diff < 7) groups['Esta semana'].push(s);
          else if (diff < 30) groups['Este mês'].push(s);
          else groups['Anteriores'].push(s);
        });
        const order = ['Hoje','Ontem','Esta semana','Este mês','Anteriores'];
        return (
          <div className="space-y-5">
            {order.filter(k => groups[k].length > 0).map(label => {
              const groupLucro = groups[label].reduce((a, s) => a + computeTotals(s).lucro_total, 0);
              return (
                <div key={label} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-display font-semibold text-muted-foreground">{label} · {groups[label].length}</p>
                    <p className={`text-[11px] font-display font-bold number-tabular ${groupLucro >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(groupLucro)}</p>
                  </div>
                  {groups[label].map(s => {
                    const t = computeTotals(s);
                    const result = classifyDay(t.lucro_total, meta);
                    const style = RESULT_STYLE[result];
                    const open = openId === s.turno_id;
                    const v = getVehicleById(s.veiculo_id);
                    const lucroHora = t.tempo_online_minutos > 0 ? t.lucro_total / (t.tempo_online_minutos / 60) : 0;
                    return (
                      <div key={s.turno_id} className={`bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm transition-all ${open ? `ring-2 ${style.ring}` : ''}`}>
                        <button onClick={() => setOpenId(open ? null : s.turno_id)} className="w-full p-3 flex items-center gap-3 text-left hover:bg-secondary/30 transition-colors">
                          <div className={`w-1 self-stretch rounded-full ${style.bg}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-display font-bold text-sm">{formatOperationalDate(s.data_operacional)}</p>
                              <span className={`text-[10px] font-display font-semibold ${style.text}`}>{style.emoji} {style.label}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {v ? `${TIPO_LABEL[v.tipo_veiculo]} ${v.nome_veiculo}` : 'Sem veículo'}
                              {s.app_utilizado && ` · ${s.app_utilizado}`}
                            </p>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p className={`font-display font-bold number-tabular ${t.lucro_total >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(t.lucro_total)}</p>
                              <p className="text-xs text-muted-foreground number-tabular">{t.corridas_total} corr · {formatTempo(t.tempo_online_minutos)} · {t.km_total.toFixed(0)} km</p>
                            </div>
                          </div>
                          {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                        </button>
                        {open && (
                          <div className="border-t border-border/60 p-3 space-y-2 bg-secondary/20">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-card rounded-lg p-2 border border-border/40">
                                <p className="text-[9px] text-muted-foreground uppercase flex items-center gap-1"><TrendingUp size={9}/> Lucro/h</p>
                                <p className={`font-display font-bold text-xs number-tabular ${lucroHora >= 0 ? 'text-foreground' : 'text-loss'}`}>{fmt(lucroHora)}</p>
                              </div>
                              <div className="bg-card rounded-lg p-2 border border-border/40">
                                <p className="text-[9px] text-muted-foreground uppercase">Média/km</p>
                                <p className="font-display font-bold text-xs number-tabular">{fmt(t.media_por_km)}</p>
                              </div>
                              <div className="bg-card rounded-lg p-2 border border-border/40">
                                <p className="text-[9px] text-muted-foreground uppercase">Média/corrida</p>
                                <p className="font-display font-bold text-xs number-tabular">{fmt(t.media_por_corrida)}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-card rounded-lg p-2 border border-border/40"><p className="text-muted-foreground flex items-center gap-1"><Clock size={10}/> Início</p><p className="font-semibold">{new Date(s.inicio_turno).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>
                              <div className="bg-card rounded-lg p-2 border border-border/40"><p className="text-muted-foreground flex items-center gap-1"><Clock size={10}/> Fim</p><p className="font-semibold">{s.fim_turno ? new Date(s.fim_turno).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div>
                              <div className="bg-card rounded-lg p-2 border border-border/40"><p className="text-muted-foreground flex items-center gap-1"><Wallet size={10}/> Ganho</p><p className="font-semibold number-tabular text-profit">{fmt(t.ganho_total)}</p></div>
                              <div className="bg-card rounded-lg p-2 border border-border/40"><p className="text-muted-foreground">Custo total</p><p className="font-semibold number-tabular text-loss">{fmt(t.custo_total)}</p></div>
                              <div className="bg-card rounded-lg p-2 border border-border/40"><p className="text-muted-foreground">Combustível</p><p className="font-semibold number-tabular">{fmt(t.custo_combustivel)}</p></div>
                              <div className="bg-card rounded-lg p-2 border border-border/40"><p className="text-muted-foreground">Custo fixo</p><p className="font-semibold number-tabular">{fmt(t.custo_fixo_rateado)}</p></div>
                              <div className="bg-card rounded-lg p-2 border border-border/40"><p className="text-muted-foreground flex items-center gap-1"><Navigation size={10}/> Km</p><p className="font-semibold number-tabular">{t.km_total.toFixed(1)}</p></div>
                              <div className="bg-card rounded-lg p-2 border border-border/40"><p className="text-muted-foreground">Online</p><p className="font-semibold">{formatTempo(t.tempo_online_minutos)}</p></div>
                            </div>
                            {meta > 0 && result === 'excelente' && (
                              <p className="text-xs text-profit flex items-center gap-1 font-display font-semibold"><Trophy size={12}/> Bateu a meta de {fmt(meta)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
