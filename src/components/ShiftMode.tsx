import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Play, Square, Plus, Clock, Wallet, Navigation, X, Trophy } from 'lucide-react';
import {
  Shift, ShiftRide, getActiveShift, startShift, endShift, addRide,
  computeTotals, formatTempo, todayOperationalDate, yesterdayOperationalDate,
  formatOperationalDate, deleteRide,
} from '@/lib/shifts';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface Props { onChange?: () => void }

export default function ShiftMode({ onChange }: Props) {
  const [shift, setShift] = useState<Shift | null>(() => getActiveShift());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customDate, setCustomDate] = useState(todayOperationalDate());
  const [rideOpen, setRideOpen] = useState(false);
  const [rideValor, setRideValor] = useState('');
  const [rideKm, setRideKm] = useState('');
  const [summary, setSummary] = useState<Shift | null>(null);
  const [, force] = useState(0);

  // tick a cada 30s para atualizar tempo online
  useEffect(() => {
    if (!shift) return;
    const t = setInterval(() => force(x => x + 1), 30000);
    return () => clearInterval(t);
  }, [shift]);

  const totals = useMemo(() => shift ? computeTotals(shift) : null, [shift]);
  const prevLucro = useMemo(() => totals?.lucro_total ?? 0, [shift?.rides.length]); // eslint-disable-line

  const refresh = () => {
    setShift(getActiveShift());
    onChange?.();
  };

  const handleStart = (data_op: string) => {
    const s = startShift(data_op);
    setShift(s);
    setPickerOpen(false);
    onChange?.();
    toast.success('Turno iniciado 👊');
  };

  const handleEnd = () => {
    if (!shift) return;
    const finished = endShift(shift.turno_id);
    setShift(null);
    setSummary(finished);
    onChange?.();
  };

  const handleAddRide = () => {
    if (!shift) return;
    const v = parseFloat(rideValor.replace(',', '.'));
    const k = parseFloat(rideKm.replace(',', '.'));
    if (!v || !k || v <= 0 || k <= 0) {
      toast.error('Preencha valor e km');
      return;
    }
    const lucroAntes = totals?.lucro_total ?? 0;
    const r = addRide(shift.turno_id, v, k);
    if (!r) return;
    setRideValor('');
    setRideKm('');
    setRideOpen(false);
    refresh();
    if (r.resultado === 'boa') toast.success('🟢 Boa corrida 👊');
    else if (r.resultado === 'aceitavel') toast('🟡 Lucro baixo nessa corrida');
    else toast.error('🔴 Essa corrida reduziu seu lucro');

    // feedback do dia
    const novoLucro = lucroAntes + (r.valor - (r.km * (totals ? totals.custo_total / Math.max(1, totals.km_total) : 0)));
    if (novoLucro > 0 && novoLucro > lucroAntes) {
      // ok — mantém silêncio para não poluir
    } else if (novoLucro < lucroAntes) {
      // aviso já foi dado pela corrida
    }
  };

  // Resumo final
  if (summary) {
    const t = computeTotals(summary);
    const positivo = t.lucro_total > 0;
    return (
      <div className="rounded-xl p-5 bg-card border-2 border-primary/40 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Trophy className="text-accent" size={20} /> Resumo do turno
          </h3>
          <button onClick={() => setSummary(null)} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Dia operacional: {formatOperationalDate(summary.data_operacional)}</p>
        <div className={`rounded-lg p-4 text-center ${positivo ? 'bg-profit' : 'bg-loss'}`}>
          <p className="text-xs text-primary-foreground/80 uppercase">Lucro do turno</p>
          <p className="text-3xl font-display font-bold text-primary-foreground">{fmt(t.lucro_total)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-secondary/40 rounded p-3"><p className="text-xs text-muted-foreground">Ganho total</p><p className="font-display font-bold">{fmt(t.ganho_total)}</p></div>
          <div className="bg-secondary/40 rounded p-3"><p className="text-xs text-muted-foreground">Km total</p><p className="font-display font-bold">{t.km_total.toFixed(1)} km</p></div>
          <div className="bg-secondary/40 rounded p-3"><p className="text-xs text-muted-foreground">Tempo online</p><p className="font-display font-bold">{formatTempo(t.tempo_online_minutos)}</p></div>
          <div className="bg-secondary/40 rounded p-3"><p className="text-xs text-muted-foreground">Corridas</p><p className="font-display font-bold">{t.corridas_total}</p></div>
          <div className="bg-secondary/40 rounded p-3 col-span-2"><p className="text-xs text-muted-foreground">Média por km</p><p className="font-display font-bold">{fmt(t.media_por_km)}/km</p></div>
        </div>
        <p className={`text-center text-sm font-display ${positivo ? 'text-profit' : 'text-loss'}`}>
          {positivo ? 'Bom trabalho hoje 👊' : 'Você pode melhorar suas escolhas amanhã'}
        </p>
      </div>
    );
  }

  // Sem turno ativo
  if (!shift) {
    return (
      <>
        <button
          onClick={() => setPickerOpen(true)}
          className="w-full rounded-xl p-4 bg-profit hover:bg-profit/90 text-primary-foreground font-display font-bold text-base flex items-center justify-center gap-2 shadow-md transition-colors"
        >
          <Play size={18} /> Iniciar turno
        </button>

        {pickerOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
            <div className="bg-card rounded-xl p-5 w-full max-w-sm space-y-3 border" onClick={e => e.stopPropagation()}>
              <h3 className="font-display font-bold text-base">Esse turno pertence a qual dia?</h3>
              <button onClick={() => handleStart(todayOperationalDate())} className="w-full p-3 rounded-lg bg-primary text-primary-foreground font-semibold">
                Hoje · {formatOperationalDate(todayOperationalDate())}
              </button>
              <button onClick={() => handleStart(yesterdayOperationalDate())} className="w-full p-3 rounded-lg bg-secondary text-foreground font-semibold">
                Ontem · {formatOperationalDate(yesterdayOperationalDate())}
              </button>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Escolher data</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background text-foreground"
                />
                <button onClick={() => handleStart(customDate)} className="w-full p-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm">
                  Iniciar com essa data
                </button>
              </div>
              <button onClick={() => setPickerOpen(false)} className="w-full text-xs text-muted-foreground py-1">Cancelar</button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Turno ativo
  const t = totals!;
  const lucroOk = t.lucro_total >= 0;
  return (
    <>
      <div className={`rounded-xl p-4 border-2 space-y-3 ${lucroOk ? 'border-profit/50 bg-profit/5' : 'border-loss/50 bg-loss/5'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Turno ativo · {formatOperationalDate(shift.data_operacional)}</p>
            <p className={`text-3xl font-display font-bold ${lucroOk ? 'text-profit' : 'text-loss'}`}>{fmt(t.lucro_total)}</p>
            <p className="text-xs text-muted-foreground">Lucro parcial</p>
          </div>
          <button onClick={handleEnd} className="px-3 py-2 rounded-lg bg-loss text-primary-foreground font-display font-semibold text-xs flex items-center gap-1.5">
            <Square size={14} /> Finalizar
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-card rounded p-2 border"><Clock size={12} className="mx-auto text-muted-foreground" /><p className="text-[10px] text-muted-foreground">Online</p><p className="font-display font-bold text-xs">{formatTempo(t.tempo_online_minutos)}</p></div>
          <div className="bg-card rounded p-2 border"><Wallet size={12} className="mx-auto text-muted-foreground" /><p className="text-[10px] text-muted-foreground">Ganho</p><p className="font-display font-bold text-xs">{fmt(t.ganho_total)}</p></div>
          <div className="bg-card rounded p-2 border"><Navigation size={12} className="mx-auto text-muted-foreground" /><p className="text-[10px] text-muted-foreground">Km</p><p className="font-display font-bold text-xs">{t.km_total.toFixed(0)}</p></div>
          <div className="bg-card rounded p-2 border"><p className="text-[10px] text-muted-foreground mt-2.5">Corridas</p><p className="font-display font-bold text-xs">{t.corridas_total}</p></div>
        </div>
        <p className={`text-xs text-center font-display ${lucroOk ? 'text-profit' : 'text-loss'}`}>
          {t.corridas_total === 0 ? 'Registre sua primeira corrida' : lucroOk ? 'Você está indo bem hoje 👊' : 'Atenção — seu lucro caiu'}
        </p>
        <button
          onClick={() => setRideOpen(true)}
          className="w-full rounded-lg p-3 bg-primary text-primary-foreground font-display font-bold flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Registrar corrida
        </button>

        {shift.rides.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Últimas corridas</p>
            {shift.rides.slice(0, 5).map(r => (
              <div key={r.corrida_id} className="flex items-center justify-between bg-card border rounded px-2.5 py-1.5 text-xs">
                <span>{r.resultado === 'boa' ? '🟢' : r.resultado === 'aceitavel' ? '🟡' : '🔴'}</span>
                <span className="font-semibold">{fmt(r.valor)}</span>
                <span className="text-muted-foreground">{r.km.toFixed(1)} km</span>
                <span className="font-display font-bold">{fmt(r.valor_por_km)}/km</span>
                <button onClick={() => { deleteRide(shift.turno_id, r.corrida_id); refresh(); }} className="text-muted-foreground hover:text-loss">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {rideOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setRideOpen(false)}>
          <div className="bg-card rounded-xl p-5 w-full max-w-sm space-y-3 border" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-base">Registrar corrida</h3>
            <div>
              <label className="text-xs text-muted-foreground">Valor (R$)</label>
              <input
                type="number" inputMode="decimal" autoFocus
                value={rideValor} onChange={e => setRideValor(e.target.value)}
                className="w-full px-3 py-3 text-lg rounded-md border bg-background"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">KM</label>
              <input
                type="number" inputMode="decimal"
                value={rideKm} onChange={e => setRideKm(e.target.value)}
                className="w-full px-3 py-3 text-lg rounded-md border bg-background"
                placeholder="0"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRideOpen(false)} className="flex-1 p-2.5 rounded-lg bg-secondary text-foreground text-sm">Cancelar</button>
              <button onClick={handleAddRide} className="flex-1 p-2.5 rounded-lg bg-primary text-primary-foreground font-display font-bold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
