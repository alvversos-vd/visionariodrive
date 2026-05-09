import { useMemo, useState } from 'react';
import { Shift, getShifts, computeTotals, formatTempo, formatOperationalDate } from '@/lib/shifts';
import { getGoals } from '@/lib/storage';
import { getVehiclesV2, getVehicleById, TIPO_LABEL, APPS, TipoVeiculo } from '@/lib/vehicles';
import { ChevronDown, ChevronUp, Trophy, Clock, Wallet, Navigation, Car, Smartphone, Award } from 'lucide-react';

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

const RESULT_STYLE: Record<DayResult, { bg: string; label: string; emoji: string; text: string }> = {
  excelente: { bg: 'bg-profit', label: 'Excelente', emoji: '🟢', text: 'text-profit' },
  bom: { bg: 'bg-accent', label: 'Bom', emoji: '🟡', text: 'text-accent' },
  ruim: { bg: 'bg-loss', label: 'Ruim', emoji: '🔴', text: 'text-loss' },
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
    const acc = { lucro: 0, ganho: 0, km: 0, corridas: 0 };
    filtered.forEach(s => {
      const t = computeTotals(s);
      acc.lucro += t.lucro_total;
      acc.ganho += t.ganho_total;
      acc.km += t.km_total;
      acc.corridas += t.corridas_total;
    });
    return acc;
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
    const lucroPorTurno = periodShifts.length > 0 ? periodShifts.reduce((s, x) => s + computeTotals(x).lucro_total, 0) / periodShifts.length : 0;
    return { bestApp, bestVeh, lucroPorTurno };
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

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h2 className="font-display font-bold text-lg flex items-center gap-2">📊 Histórico de turnos</h2>
        <p className="text-xs text-muted-foreground">Cada turno mostra o que está valendo a pena.</p>
      </div>

      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex-1 py-1.5 text-xs font-display font-semibold rounded-md transition-colors ${filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Car size={10}/> Veículo</p>
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            {tipoOptions.map(o => (
              <button key={o.key} onClick={() => setVehicleFilter(o.key)}
                className={`flex-1 py-1 text-[11px] font-display font-semibold rounded ${vehicleFilter === o.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
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

      {(insights.bestApp || insights.bestVeh) && (
        <div className="grid grid-cols-2 gap-2">
          {insights.bestApp && (
            <div className="bg-card border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><Award size={10}/> Melhor app</p>
              <p className="font-display font-bold text-sm">{insights.bestApp.app}</p>
              <p className="text-[11px] text-profit">{fmt(insights.bestApp.mediaLucro)}/turno</p>
            </div>
          )}
          {insights.bestVeh && (
            <div className="bg-card border rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><Award size={10}/> Melhor veículo</p>
              <p className="font-display font-bold text-sm truncate">{insights.bestVeh.nome}</p>
              <p className="text-[11px] text-profit">{fmt(insights.bestVeh.lucroPorKm)}/km</p>
            </div>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card rounded-lg p-3 border">
            <p className="text-[10px] text-muted-foreground uppercase">Lucro no período</p>
            <p className={`font-display font-bold text-lg ${totals.lucro >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(totals.lucro)}</p>
          </div>
          <div className="bg-card rounded-lg p-3 border">
            <p className="text-[10px] text-muted-foreground uppercase">Turnos · Corridas</p>
            <p className="font-display font-bold text-lg">{filtered.length} · {totals.corridas}</p>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-card border-2 border-dashed rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum turno no filtro atual</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const t = computeTotals(s);
            const result = classifyDay(t.lucro_total, meta);
            const style = RESULT_STYLE[result];
            const open = openId === s.turno_id;
            const v = getVehicleById(s.veiculo_id);
            return (
              <div key={s.turno_id} className="bg-card border rounded-lg overflow-hidden">
                <button onClick={() => setOpenId(open ? null : s.turno_id)} className="w-full p-3 flex items-center gap-3 text-left hover:bg-secondary/30 transition-colors">
                  <div className={`w-1 self-stretch rounded ${style.bg}`} />
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
                      <p className={`font-display font-bold ${t.lucro_total >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(t.lucro_total)}</p>
                      <p className="text-xs text-muted-foreground">{t.corridas_total} corr · {formatTempo(t.tempo_online_minutos)}</p>
                    </div>
                  </div>
                  {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                </button>
                {open && (
                  <div className="border-t p-3 space-y-2 bg-secondary/20">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground flex items-center gap-1"><Clock size={10}/> Início</p><p className="font-semibold">{new Date(s.inicio_turno).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground flex items-center gap-1"><Clock size={10}/> Fim</p><p className="font-semibold">{s.fim_turno ? new Date(s.fim_turno).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground flex items-center gap-1"><Wallet size={10}/> Ganho</p><p className="font-semibold">{fmt(t.ganho_total)}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground">Combustível</p><p className="font-semibold">{fmt(t.custo_combustivel)}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground">Custo fixo</p><p className="font-semibold">{fmt(t.custo_fixo_rateado)}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground">Custo total</p><p className="font-semibold">{fmt(t.custo_total)}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground flex items-center gap-1"><Navigation size={10}/> Km</p><p className="font-semibold">{t.km_total.toFixed(1)}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground">Online</p><p className="font-semibold">{formatTempo(t.tempo_online_minutos)}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground">Média/km</p><p className="font-semibold">{fmt(t.media_por_km)}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground">Média/corrida</p><p className="font-semibold">{fmt(t.media_por_corrida)}</p></div>
                    </div>
                    {meta > 0 && result === 'excelente' && (
                      <p className="text-xs text-profit flex items-center gap-1"><Trophy size={12}/> Bateu a meta de {fmt(meta)}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
