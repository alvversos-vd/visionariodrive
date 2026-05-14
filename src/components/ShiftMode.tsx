import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Play, Square, Plus, Clock, Wallet, Navigation, X, Trophy, Car, Smartphone } from 'lucide-react';
import {
  Shift, getActiveShift, startShift, endShift, addRide,
  computeTotals, formatTempo, todayOperationalDate, yesterdayOperationalDate,
  formatOperationalDate, deleteRide,
} from '@/lib/shifts';
import {
  hasAnyVehicle, getVehiclesV2, getActiveVehicle, setActiveVehicleId, getVehicleById,
  getLastApp, setLastApp, APPS, AppEntrega, TIPO_LABEL,
} from '@/lib/vehicles';
import VehiclesView from './VehiclesView';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtHora(iso?: string) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props { onChange?: () => void }

export default function ShiftMode({ onChange }: Props) {
  const [shift, setShift] = useState<Shift | null>(() => getActiveShift());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [step, setStep] = useState<'date' | 'vehicle' | 'app'>('vehicle');
  const [pickedDate, setPickedDate] = useState<string>(todayOperationalDate());
  const [pickedVehicleId, setPickedVehicleId] = useState<string | null>(null);
  const [pickedApp, setPickedApp] = useState<AppEntrega | null>(null);
  const [rideOpen, setRideOpen] = useState(false);
  const [rideValor, setRideValor] = useState('');
  const [rideKm, setRideKm] = useState('');
  const [summary, setSummary] = useState<Shift | null>(null);
  const [vehiclesOpen, setVehiclesOpen] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    if (!shift) return;
    const t = setInterval(() => force(x => x + 1), 30000);
    return () => clearInterval(t);
  }, [shift]);

  const totals = useMemo(() => shift ? computeTotals(shift) : null, [shift]);

  const refresh = () => {
    setShift(getActiveShift());
    onChange?.();
  };

  const openPicker = () => {
    if (!hasAnyVehicle()) {
      setVehiclesOpen(true);
      return;
    }
    const last = getActiveVehicle();
    setPickedVehicleId(last?.veiculo_id ?? null);
    setPickedApp(getLastApp());
    // Regra madrugada: 00:00–04:59 → perguntar hoje ou ontem
    const hour = new Date().getHours();
    if (hour < 5) {
      setPickedDate(todayOperationalDate());
      setStep('date');
    } else {
      setPickedDate(todayOperationalDate());
      setStep('vehicle');
    }
    setPickerOpen(true);
  };

  const finalizeStart = () => {
    if (!pickedVehicleId || !pickedApp) return;
    setActiveVehicleId(pickedVehicleId);
    setLastApp(pickedApp);
    const s = startShift({
      data_operacional: pickedDate,
      veiculo_id: pickedVehicleId,
      app_utilizado: pickedApp,
    });
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
    const r = addRide(shift.turno_id, v, k);
    if (!r) return;
    setRideValor('');
    setRideKm('');
    setRideOpen(false);
    refresh();
    if (r.resultado === 'boa') toast.success('🟢 Boa corrida 👊');
    else if (r.resultado === 'aceitavel') toast('🟡 Lucro baixo nessa corrida');
    else toast.error('🔴 Essa corrida reduziu seu lucro');
  };

  // Onboarding obrigatório
  if (vehiclesOpen) {
    return (
      <div className="bg-card border-2 border-primary/40 rounded-xl p-4">
        <VehiclesView
          forceOnboarding={!hasAnyVehicle()}
          onClose={hasAnyVehicle() ? () => setVehiclesOpen(false) : undefined}
          onChange={() => {
            if (hasAnyVehicle()) setVehiclesOpen(false);
          }}
        />
      </div>
    );
  }

  // Resumo
  if (summary) {
    const t = computeTotals(summary);
    const positivo = t.lucro_total > 0;
    const v = getVehicleById(summary.veiculo_id);
    return (
      <div className="rounded-xl p-5 bg-card border-2 border-primary/40 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Trophy className="text-accent" size={20} /> Resumo do turno
          </h3>
          <button onClick={() => setSummary(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatOperationalDate(summary.data_operacional)} · {fmtHora(summary.inicio_turno)} → {fmtHora(summary.fim_turno)}
          {v && ` · ${TIPO_LABEL[v.tipo_veiculo]} ${v.nome_veiculo}`}
          {summary.app_utilizado && ` · ${summary.app_utilizado}`}
        </p>
        <div className={`rounded-lg p-4 text-center ${positivo ? 'bg-profit' : 'bg-loss'}`}>
          <p className="text-xs text-primary-foreground/80 uppercase">Lucro do turno</p>
          <p className="text-3xl font-display font-bold text-primary-foreground">{fmt(t.lucro_total)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-secondary/40 rounded p-3"><p className="text-xs text-muted-foreground">Ganho total</p><p className="font-display font-bold">{fmt(t.ganho_total)}</p></div>
          <div className="bg-secondary/40 rounded p-3"><p className="text-xs text-muted-foreground">Custo total</p><p className="font-display font-bold">{fmt(t.custo_total)}</p></div>
          {(t.custo_combustivel > 0 || (v && v.km_por_litro && v.km_por_litro > 0)) && (
            <div className="bg-secondary/40 rounded p-3"><p className="text-xs text-muted-foreground">Combustível</p><p className="font-display font-bold">{fmt(t.custo_combustivel)}</p></div>
          )}
          <div className="bg-secondary/40 rounded p-3"><p className="text-xs text-muted-foreground">Fixo rateado</p><p className="font-display font-bold">{fmt(t.custo_fixo_rateado)}</p></div>
          <div className="bg-secondary/40 rounded p-3"><p className="text-xs text-muted-foreground">Km · Corridas</p><p className="font-display font-bold">{t.km_total.toFixed(1)} · {t.corridas_total}</p></div>
          <div className="bg-secondary/40 rounded p-3"><p className="text-xs text-muted-foreground">Online</p><p className="font-display font-bold">{formatTempo(t.tempo_online_minutos)}</p></div>
        </div>
        <p className={`text-center text-sm font-display ${positivo ? 'text-profit' : 'text-loss'}`}>
          {positivo ? 'Bom trabalho hoje 👊' : 'Você pode melhorar amanhã'}
        </p>
      </div>
    );
  }

  // Sem turno ativo
  if (!shift) {
    return (
      <>
        <button
          onClick={openPicker}
          className="w-full rounded-2xl p-5 bg-info-gradient text-info-foreground font-display font-bold text-base flex items-center justify-center gap-2.5 shadow-premium active:scale-[0.99] transition-transform"
        >
          <Play size={20} fill="currentColor" /> Iniciar turno
        </button>

        {pickerOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
            <div className="bg-card rounded-xl p-5 w-full max-w-sm space-y-3 border max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {step === 'date' && (
                <>
                  <h3 className="font-display font-bold text-base">Esse turno pertence a qual dia?</h3>
                  <p className="text-xs text-muted-foreground">Detectamos que ainda é madrugada. Escolha a data operacional do turno.</p>
                  <button onClick={() => { setPickedDate(todayOperationalDate()); setStep('vehicle'); }} className="w-full p-3 rounded-lg bg-primary text-primary-foreground font-semibold">
                    Hoje · {formatOperationalDate(todayOperationalDate())}
                  </button>
                  <button onClick={() => { setPickedDate(yesterdayOperationalDate()); setStep('vehicle'); }} className="w-full p-3 rounded-lg bg-secondary text-foreground font-semibold">
                    Ontem · {formatOperationalDate(yesterdayOperationalDate())}
                  </button>
                </>
              )}

              {step === 'vehicle' && (
                <>
                  <div className="flex items-center gap-2">
                    <Car size={16} className="text-primary" />
                    <h3 className="font-display font-bold text-base">Qual veículo será usado?</h3>
                  </div>
                  <div className="space-y-2">
                    {getVehiclesV2().map(v => (
                      <button
                        key={v.veiculo_id}
                        onClick={() => setPickedVehicleId(v.veiculo_id)}
                        className={`w-full text-left p-3 rounded-lg border ${pickedVehicleId === v.veiculo_id ? 'border-primary bg-primary/10' : 'bg-secondary/40'}`}
                      >
                        <p className="font-display font-bold text-sm">{TIPO_LABEL[v.tipo_veiculo]} · {v.nome_veiculo}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {v.km_por_litro ? `${v.km_por_litro} km/L` : 'sem combustível'}
                          {v.custo_fixo_mensal > 0 ? ` · R$ ${v.custo_fixo_mensal.toFixed(0)}/mês` : ''}
                        </p>
                      </button>
                    ))}
                    <button onClick={() => { setPickerOpen(false); setVehiclesOpen(true); }} className="w-full p-2 rounded-lg border-2 border-dashed text-xs text-primary font-semibold">
                      + Adicionar veículo
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {new Date().getHours() < 5 && (
                      <button onClick={() => setStep('date')} className="flex-1 p-2 rounded-lg bg-secondary text-xs">Voltar</button>
                    )}
                    <button
                      disabled={!pickedVehicleId}
                      onClick={() => setStep('app')}
                      className="flex-1 p-2 rounded-lg bg-primary text-primary-foreground font-display font-bold text-sm disabled:opacity-40"
                    >
                      Continuar
                    </button>
                  </div>
                </>
              )}

              {step === 'app' && (
                <>
                  <div className="flex items-center gap-2">
                    <Smartphone size={16} className="text-primary" />
                    <h3 className="font-display font-bold text-base">Qual app você vai usar?</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {APPS.map(a => (
                      <button
                        key={a}
                        onClick={() => setPickedApp(a)}
                        className={`p-2.5 rounded-lg text-sm font-display font-semibold border ${pickedApp === a ? 'border-primary bg-primary/10 text-primary' : 'bg-secondary/40 text-foreground'}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setStep('vehicle')} className="flex-1 p-2 rounded-lg bg-secondary text-xs">Voltar</button>
                    <button
                      disabled={!pickedApp}
                      onClick={finalizeStart}
                      className="flex-1 p-2.5 rounded-lg bg-profit text-primary-foreground font-display font-bold disabled:opacity-40"
                    >
                      Iniciar turno
                    </button>
                  </div>
                </>
              )}

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
  const veh = getVehicleById(shift.veiculo_id);
  return (
    <>
      <div className={`relative rounded-2xl p-5 border-2 space-y-4 overflow-hidden ${lucroOk ? 'border-profit/40 bg-profit/5' : 'border-loss/50 bg-loss/5'} shadow-premium`}>
        <div className={`absolute inset-x-0 top-0 h-1 ${lucroOk ? 'bg-profit-gradient' : 'bg-loss-gradient'}`} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`relative flex h-2 w-2 ${lucroOk ? 'text-profit' : 'text-loss'}`}>
                <span className={`absolute inline-flex h-full w-full rounded-full ${lucroOk ? 'bg-profit' : 'bg-loss'} opacity-60 animate-pulse-dot`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${lucroOk ? 'bg-profit' : 'bg-loss'}`} />
              </span>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">Turno ativo · {formatOperationalDate(shift.data_operacional)} · início {fmtHora(shift.inicio_turno)}</p>
            </div>
            <p className={`text-3xl font-display font-bold mt-1 number-tabular ${lucroOk ? 'text-profit' : 'text-loss'}`}>{fmt(t.lucro_total)}</p>
            <p className="text-[11px] text-muted-foreground">Lucro parcial em tempo real</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {veh ? `${TIPO_LABEL[veh.tipo_veiculo]} ${veh.nome_veiculo}` : 'Sem veículo'}
              {shift.app_utilizado && ` · ${shift.app_utilizado}`}
            </p>
          </div>
          <button onClick={handleEnd} className="px-3 py-2 rounded-xl bg-loss/90 hover:bg-loss text-primary-foreground font-display font-semibold text-xs flex items-center gap-1.5 transition-colors">
            <Square size={14} fill="currentColor" /> Finalizar
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-card/70 rounded-xl p-2 border border-border/60"><Clock size={12} className="mx-auto text-muted-foreground" /><p className="text-[10px] text-muted-foreground">Online</p><p className="font-display font-bold text-xs number-tabular">{formatTempo(t.tempo_online_minutos)}</p></div>
          <div className="bg-card/70 rounded-xl p-2 border border-border/60"><Wallet size={12} className="mx-auto text-muted-foreground" /><p className="text-[10px] text-muted-foreground">Ganho</p><p className="font-display font-bold text-xs number-tabular">{fmt(t.ganho_total)}</p></div>
          <div className="bg-card/70 rounded-xl p-2 border border-border/60"><Navigation size={12} className="mx-auto text-muted-foreground" /><p className="text-[10px] text-muted-foreground">Km</p><p className="font-display font-bold text-xs number-tabular">{t.km_total.toFixed(0)}</p></div>
          <div className="bg-card/70 rounded-xl p-2 border border-border/60"><p className="text-[10px] text-muted-foreground mt-2.5">Corridas</p><p className="font-display font-bold text-xs number-tabular">{t.corridas_total}</p></div>
        </div>
        <p className={`text-xs text-center font-display ${lucroOk ? 'text-profit' : 'text-loss'}`}>
          {t.corridas_total === 0 ? 'Toque no + para registrar sua primeira corrida' : lucroOk ? 'Você está indo bem 👊' : 'Atenção — seu lucro caiu'}
        </p>
        <button onClick={() => setRideOpen(true)} className="w-full rounded-xl p-3 bg-primary text-primary-foreground font-display font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform">
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
                <button onClick={() => { deleteRide(shift.turno_id, r.corrida_id); refresh(); }} className="text-muted-foreground hover:text-loss"><X size={12} /></button>
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
              <input type="number" inputMode="decimal" autoFocus value={rideValor} onChange={e => setRideValor(e.target.value)} className="w-full px-3 py-3 text-lg rounded-md border bg-background" placeholder="0,00" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">KM</label>
              <input type="number" inputMode="decimal" value={rideKm} onChange={e => setRideKm(e.target.value)} className="w-full px-3 py-3 text-lg rounded-md border bg-background" placeholder="0" />
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
