import { useMemo, useState } from 'react';
import { Shift, getShifts, computeTotals, formatTempo, formatOperationalDate } from '@/lib/shifts';
import { getGoals } from '@/lib/storage';
import { ChevronDown, ChevronUp, Trophy, Clock, Wallet, Navigation } from 'lucide-react';

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
  const [openId, setOpenId] = useState<string | null>(null);

  const shifts = useMemo<Shift[]>(
    () => getShifts().filter(s => s.status === 'finalizado'),
    [refresh]
  );
  const meta = useMemo(() => getGoals().daily, [refresh]);

  const filtered = useMemo(
    () => shifts
      .filter(s => inFilter(s.data_operacional, filter))
      .sort((a, b) => b.data_operacional.localeCompare(a.data_operacional) ||
                      (b.fim_turno || '').localeCompare(a.fim_turno || '')),
    [shifts, filter]
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

  const filters: { key: Filter; label: string }[] = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'semana', label: 'Semana' },
    { key: 'mes', label: 'Mês' },
    { key: 'todos', label: 'Todos' },
  ];

  return (
    <div className="space-y-4 animate-slide-up">
      <div>
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          📊 Histórico de turnos
        </h2>
        <p className="text-xs text-muted-foreground">Cada turno vira um aprendizado.</p>
      </div>

      <div className="flex gap-1 bg-secondary rounded-lg p-1">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-1 py-1.5 text-xs font-display font-semibold rounded-md transition-colors ${
              filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

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
          <p className="text-sm text-muted-foreground">Nenhum turno finalizado no período</p>
          <p className="text-xs text-muted-foreground mt-1">Inicie e finalize um turno para começar seu histórico.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const t = computeTotals(s);
            const result = classifyDay(t.lucro_total, meta);
            const style = RESULT_STYLE[result];
            const open = openId === s.turno_id;
            const valorMedioCorrida = t.corridas_total > 0 ? t.ganho_total / t.corridas_total : 0;
            return (
              <div key={s.turno_id} className="bg-card border rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenId(open ? null : s.turno_id)}
                  className="w-full p-3 flex items-center gap-3 text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className={`w-1 self-stretch rounded ${style.bg}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display font-bold text-sm">{formatOperationalDate(s.data_operacional)}</p>
                      <span className={`text-[10px] font-display font-semibold ${style.text}`}>
                        {style.emoji} {style.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`font-display font-bold ${t.lucro_total >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(t.lucro_total)}</p>
                      <p className="text-xs text-muted-foreground">{t.corridas_total} corridas · {formatTempo(t.tempo_online_minutos)}</p>
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
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground">Custo</p><p className="font-semibold">{fmt(t.custo_total)}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground flex items-center gap-1"><Navigation size={10}/> Km</p><p className="font-semibold">{t.km_total.toFixed(1)} km</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground">Online</p><p className="font-semibold">{formatTempo(t.tempo_online_minutos)}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground">Média/km</p><p className="font-semibold">{fmt(t.media_por_km)}</p></div>
                      <div className="bg-card rounded p-2 border"><p className="text-muted-foreground">Média/corrida</p><p className="font-semibold">{fmt(valorMedioCorrida)}</p></div>
                    </div>
                    {meta > 0 && result === 'excelente' && (
                      <p className="text-xs text-profit flex items-center gap-1"><Trophy size={12}/> Bateu a meta de {fmt(meta)} (+{fmt(t.lucro_total - meta)})</p>
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
