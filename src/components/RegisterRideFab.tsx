import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Navigation, Zap, Pencil, Car, Smartphone, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { shiftService } from '@/lib/services/shiftService';
import { rideService } from '@/lib/services/rideService';
import { verdictToResultado } from '@/lib/adapters/rideAdapters';
import { getVehicleById } from '@/lib/vehicles';
import { useActiveShift } from '@/hooks/useShift';
import { useBusVersion } from '@/hooks/useBusVersion';
import { useCapabilities } from '@/hooks/useCapabilities';


interface Props { onChange?: () => void }

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtSince(iso?: string): string {
  if (!iso) return '—';
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

export default function RegisterRideFab({ onChange }: Props) {
  // Sprint 5.2 — reativo via eventBus (shift:changed / rides:changed).
  // Substitui o polling anterior (setInterval 3s + 1s → shiftService.getActive()).
  // Elimina timer sempre-ativo e renders periódicos desnecessários.
  const shift = useActiveShift();
  const { gps: gpsEnabled } = useCapabilities();
  const [open, setOpen] = useState(false);

  const [valor, setValor] = useState('');
  const [km, setKm] = useState('');
  const [obs, setObs] = useState('');
  const [forceManual, setForceManual] = useState(false);
  const [, setNowTick] = useState(0);

  // Enquanto o modal está aberto, tick 1x/s apenas para atualizar
  // o rótulo "última há Xs" (fmtSince). Não relê o service — o hook
  // reativo já refletirá qualquer mudança de shift automaticamente.
  useEffect(() => {
    if (!open) return;
    const i = setInterval(() => setNowTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, [open]);

  // Sprint 10.3 — Quick Action "Registrar corrida" da notificação persistente.
  // Abre exatamente o mesmo modal manual (valor + km). Zero fluxo paralelo.
  const notifRegister = useBusVersion('notification:register');
  useEffect(() => {
    if (notifRegister > 0) setOpen(true);
  }, [notifRegister]);



  const vehicle = useMemo(
    () => (shift?.veiculo_id ? getVehicleById(shift.veiculo_id) : null),
    [shift?.veiculo_id]
  );

  if (!shift || shift.status !== 'ativo') return null;

  const kmAuto = shift.km_desde_ultima_corrida || 0;
  // START é 100% manual (Sprint 10.6): nenhum modo inteligente, nenhum texto de GPS.
  const gpsOk = gpsEnabled && shift.gps_status === 'ok';
  // "Modo inteligente" = GPS válido + houve movimento rastreado desde a última corrida
  const smartAvailable = gpsOk && kmAuto > 0;
  const smartMode = smartAvailable && !forceManual;


  const v = parseFloat(valor.replace(',', '.'));
  const kManual = km ? parseFloat(km.replace(',', '.')) : NaN;
  const kUsed = smartMode ? kmAuto : (Number.isFinite(kManual) && kManual > 0 ? kManual : 0);
  const valid = v > 0 && kUsed > 0;
  const preview = valid ? shiftService.classifyRide(v, kUsed, shift) : null;

  const reset = () => { setValor(''); setKm(''); setObs(''); setForceManual(false); };

  const submit = () => {
    if (!valid) {
      toast.error(smartMode ? 'Informe o valor recebido' : 'Preencha valor e km');
      return;
    }
    const ride = rideService.registerShiftRide({
      shiftId: shift.turno_id,
      value: v,
      km: kUsed,
      kmOrigin: smartMode ? 'auto' : 'manual',
      observacao: obs.trim() || undefined,
    });
    if (!ride) { toast.error('Não foi possível salvar a corrida'); return; }
    reset();
    setOpen(false);
    onChange?.();
    const resultado = verdictToResultado(ride.analysis?.verdict);
    if (resultado === 'boa') toast.success('🟢 Boa corrida 👊');
    else if (resultado === 'aceitavel') toast('🟡 Lucro baixo nessa corrida');
    else toast.error('🔴 Essa corrida reduziu seu lucro');
  };

  const previewColor =
    preview?.resultado === 'boa' ? 'text-profit border-profit/40 bg-profit/10' :
    preview?.resultado === 'aceitavel' ? 'text-accent border-accent/40 bg-accent/10' :
    preview ? 'text-loss border-loss/40 bg-loss/10' : 'text-muted-foreground border-border bg-secondary/40';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Registrar nova corrida"
        className="fixed z-40 bottom-5 right-5 h-14 w-14 rounded-full bg-profit-gradient text-primary-foreground shadow-glow shadow-premium flex items-center justify-center active:scale-95 transition-transform animate-fab-pop"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {open && (
        <div
          className="overlay-scrim flex items-end sm:items-center justify-center"
          onClick={() => { setOpen(false); reset(); }}
        >
          <div
            className="bg-card rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm space-y-4 border-t sm:border animate-slide-up max-h-[92vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg">Nova corrida</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {smartMode ? (<><Zap size={11} className="text-profit"/> Modo automático</>) : 'Modo manual'}
                </p>
              </div>
              <button onClick={() => { setOpen(false); reset(); }} className="text-muted-foreground hover:text-foreground p-1">
                <X size={20} />
              </button>
            </div>

            {/* Contexto herdado do turno — sempre visível */}
            <div className="flex flex-wrap gap-1.5 text-caption">
              {shift.app_utilizado && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/60 border text-muted-foreground">
                  <Smartphone size={11}/> {shift.app_utilizado}
                </span>
              )}
              {vehicle?.nome_veiculo && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/60 border text-muted-foreground">
                  <Car size={11}/> {vehicle.nome_veiculo}
                </span>
              )}
              {shift.ultima_corrida_iso && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/60 border text-muted-foreground">
                  <Clock size={11}/> última há {fmtSince(shift.ultima_corrida_iso)}
                </span>
              )}
            </div>

            {/* Valor — sempre */}
            <div>
              <label className="text-caption uppercase tracking-wider text-muted-foreground font-display font-semibold">Valor recebido</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                <input
                  type="number" inputMode="decimal" autoFocus
                  value={valor} onChange={e => setValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3 py-3 text-2xl font-display font-bold rounded-xl border bg-background number-tabular"
                />
              </div>
            </div>

            {/* KM — modo inteligente: chip readonly + link para ajustar. Manual: input. */}
            {smartMode ? (
              <div className="rounded-xl border border-profit/30 bg-profit/5 p-3 flex items-center justify-between">
                <div>
                  <p className="text-micro uppercase tracking-wider text-muted-foreground font-display font-semibold flex items-center gap-1">
                    <Navigation size={10}/> KM do GPS
                  </p>
                  <p className="font-display font-bold text-xl number-tabular text-profit">
                    {kmAuto.toFixed(1)} <span className="text-xs font-normal opacity-70">km</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setForceManual(true); setKm(kmAuto.toFixed(1)); }}
                  className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-secondary/60"
                >
                  <Pencil size={11}/> ajustar
                </button>
              </div>
            ) : (
              <div className="rounded-xl border bg-secondary/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Navigation size={11}/> KM da corrida
                  </span>
                  {smartAvailable && (
                    <button
                      type="button"
                      onClick={() => { setForceManual(false); setKm(''); }}
                      className="text-micro text-profit hover:underline inline-flex items-center gap-1"
                    >
                      <Zap size={10}/> usar GPS ({kmAuto.toFixed(1)} km)
                    </button>
                  )}
                </div>
                <input
                  type="number" inputMode="decimal"
                  value={km} onChange={e => setKm(e.target.value)}
                  placeholder={kmAuto > 0 ? `Sugestão: ${kmAuto.toFixed(1)} km` : 'Informe a distância'}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background number-tabular"
                />
                {gpsEnabled && !gpsOk && (
                  <p className="text-micro text-muted-foreground">
                    GPS indisponível — informe o km manualmente.
                  </p>
                )}

              </div>
            )}

            {/* Observação opcional */}
            <div>
              <label className="text-micro uppercase tracking-wider text-muted-foreground font-display font-semibold">
                Observação <span className="opacity-60 normal-case">(opcional)</span>
              </label>
              <input
                type="text" maxLength={120}
                value={obs} onChange={e => setObs(e.target.value)}
                placeholder="ex: gorjeta, chuva, longa…"
                className="mt-1 w-full px-3 py-2 text-sm rounded-lg border bg-background"
              />
            </div>

            {/* Preview lucro/km */}
            <div className={`rounded-xl border p-3 transition-colors ${previewColor}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-display font-semibold uppercase tracking-wider">Valor por km</span>
                {preview && <span className="font-display font-bold">
                  {preview.resultado === 'boa' ? '🟢 Boa' : preview.resultado === 'aceitavel' ? '🟡 Aceitável' : '🔴 Ruim'}
                </span>}
              </div>
              <p className="font-display font-bold text-2xl number-tabular mt-0.5">
                {valid ? fmt(v / kUsed) : 'R$ —,—'}<span className="text-xs font-normal opacity-70">/km</span>
              </p>
            </div>

            <button
              onClick={submit}
              disabled={!valid}
              className="w-full p-4 rounded-xl bg-profit-gradient text-primary-foreground font-display font-bold text-base disabled:opacity-40 active:scale-[0.98] transition-transform shadow-glow"
            >
              {smartMode ? 'Salvar corrida' : 'Salvar corrida'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
