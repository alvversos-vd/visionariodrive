import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Play, Square, Plus, Clock, Wallet, Navigation, X, Trophy,
  Car, Smartphone, Pause, Target, Zap, Maximize2, Minimize2,
  Satellite, MapPinOff, Pencil, Map as MapIcon,
} from 'lucide-react';
import {
  Shift, ShiftRide, getActiveShift, startShift, endShiftAtomic, addRideAuto,
  computeTotals, formatTempo, todayOperationalDate, yesterdayOperationalDate,
  formatOperationalDate, deleteRide, classifyRide, updateRide,
  pauseShift, resumeShift, metaProgresso, setShiftGpsStatus,
  restoreRide, revertLastEdit,
} from '@/lib/shifts';
import { getSettings } from '@/lib/storage';
import { DEFAULT_ALERT_THRESHOLDS } from '@/lib/types';
import {
  hasAnyVehicle, getVehiclesV2, getActiveVehicle, setActiveVehicleId, getVehicleById,
  getLastApp, setLastApp, APPS, AppEntrega, TIPO_LABEL,
} from '@/lib/vehicles';
import { useShiftTracker, fmtDuracao, tempoOnlineMs } from '@/hooks/useShiftTracker';
import GpsConsentDialog, { hasGpsConsent, saveGpsConsent } from './GpsConsentDialog';
import BackgroundLocationConsentDialog, {
  saveBackgroundGpsConsent, declineBackgroundGpsConsent, wasBackgroundGpsAsked,
} from './BackgroundLocationConsentDialog';
import ShiftLiveMap from './ShiftLiveMap';
import { exportRouteGpx, exportRouteKml } from '@/lib/exportRoute';
import VehiclesView from './VehiclesView';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';



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
  const [focus, setFocus] = useState(false);
  const [editing, setEditing] = useState<ShiftRide | null>(null);
  const [editKm, setEditKm] = useState('');
  const [editValor, setEditValor] = useState('');
  const fallbackShownRef = useRef<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentTurnoId, setConsentTurnoId] = useState<string | null>(null);
  const [bgConsentOpen, setBgConsentOpen] = useState(false);
  const [bgConsentTurnoId, setBgConsentTurnoId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef<number>(0);


  const refresh = () => {
    const a = getActiveShift();
    setShift(a);
    onChange?.();
  };

  const { gps, lastFixAt } = useShiftTracker(shift, { onTick: () => {
    // re-pega snapshot do shift do storage para refletir km_gps acumulado
    const a = getActiveShift();
    if (a) setShift({ ...a });
  }});

  const totals = useMemo(() => shift ? computeTotals(shift) : null, [shift]);
  const meta = useMemo(() => shift && totals ? metaProgresso(shift, totals.lucro_total) : null, [shift, totals]);

  // Sai do foco se turno terminar
  useEffect(() => { if (!shift) setFocus(false); }, [shift]);

  // Banner inteligente: avisa 1x por ocorrência quando GPS cai para modo manual,
  // e limpa o marcador quando o GPS volta a funcionar.
  useEffect(() => {
    if (!shift) { fallbackShownRef.current = null; return; }
    const key = `${shift.turno_id}:${gps}`;
    if ((gps === 'denied' || gps === 'unavailable') && fallbackShownRef.current !== key) {
      fallbackShownRef.current = key;
      toast('⚠️ GPS indisponível — modo manual ativado automaticamente', {
        description: 'O turno continua normalmente. Informe o km de cada corrida ao registrar.',
      });
    }
    if (gps === 'tracking') {
      if (fallbackShownRef.current && !fallbackShownRef.current.endsWith(':tracking')) {
        toast.success('GPS reconectado — cálculo automático retomado');
      }
      fallbackShownRef.current = key;
    }
  }, [gps, shift?.turno_id]);

  const openPicker = () => {
    if (!hasAnyVehicle()) {
      setVehiclesOpen(true);
      return;
    }
    const last = getActiveVehicle();
    setPickedVehicleId(last?.veiculo_id ?? null);
    setPickedApp(getLastApp());
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

  /**
   * Fluxo profissional de permissão de GPS:
   * 1) abre modal humanizado (GpsConsentDialog) explicando uso
   * 2) somente após "Aceitar" dispara o prompt nativo do navegador
   * 3) trata permissão negada com mensagens iOS/Android específicas
   */
  const requestGpsPermission = (turnoId?: string) => {
    const id = turnoId ?? shift?.turno_id ?? null;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (id) setShiftGpsStatus(id, 'unavailable');
      toast('GPS indisponível neste dispositivo — modo manual ativo');
      refresh();
      return;
    }
    // Se já consentiu antes, pula o modal e vai direto ao prompt nativo
    if (hasGpsConsent()) {
      triggerNativePrompt(id);
      return;
    }
    setConsentTurnoId(id);
    setConsentOpen(true);
  };

  const triggerNativePrompt = (id: string | null) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // Em plataforma nativa (Capacitor / APK), o WebView NÃO dispara o prompt
    // de permissão do sistema via navigator.geolocation. Precisamos chamar
    // @capacitor/geolocation diretamente para que o Android/iOS exibam o
    // diálogo nativo e registrem a permissão em Configurações > Apps.
    const cap = typeof window !== 'undefined'
      ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      : undefined;
    const isNative = !!cap?.isNativePlatform?.();

    const handleGranted = () => {
      if (id) setShiftGpsStatus(id, 'ok');
      saveGpsConsent();
      toast.success('GPS ativo — km serão calculados automaticamente');
      refresh();
      // Em plataforma nativa: oferecer rastreamento em background (foreground service Android)
      // somente uma vez por dispositivo. Decisão fica salva em localStorage.
      if (isNative && !wasBackgroundGpsAsked()) {
        // Pequeno delay para o usuário absorver o toast antes do próximo diálogo
        setTimeout(() => {
          setBgConsentTurnoId(id);
          setBgConsentOpen(true);
        }, 600);
      }
    };

    const handleDenied = () => {
      if (id) setShiftGpsStatus(id, 'denied');
      toast.error('Permissão de GPS negada', {
        description: isIOS
          ? 'Ajustes › Privacidade › Localização › Visionário Drive › Ao Usar. Modo manual ativado.'
          : 'Permita localização precisa nas configurações do app. Modo manual ativado.',
        duration: 7000,
      });
      refresh();
    };

    const handleUnavailable = () => {
      if (id) setShiftGpsStatus(id, 'unavailable');
      toast('GPS indisponível agora — modo manual ativo');
      refresh();
    };

    if (isNative) {
      (async () => {
        try {
          const { Geolocation } = await import('@capacitor/geolocation');
          // 1) Dispara o prompt nativo do sistema (Android/iOS)
          const perm = await Geolocation.requestPermissions();
          if (perm.location !== 'granted') {
            if (perm.location === 'denied') handleDenied();
            else handleUnavailable();
            return;
          }
          // 2) Confirma com um fix real para garantir que o GPS responde
          await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
          });
          handleGranted();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[ShiftMode] Capacitor Geolocation falhou', e);
          handleUnavailable();
        }
      })();
      return;
    }

    // Web / PWA — fluxo original via navigator.geolocation
    navigator.geolocation.getCurrentPosition(
      () => handleGranted(),
      err => {
        if (err.code === err.PERMISSION_DENIED) handleDenied();
        else handleUnavailable();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
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
    requestGpsPermission(s.turno_id);
  };

  const handleEnd = () => {
    if (!shift) return;
    // Abre AlertDialog semântico — funciona de forma confiável em PWA iOS/Android
    // (window.confirm é instável em standalone). Press-and-hold previne toque acidental.
    setHoldProgress(0);
    setEndConfirmOpen(true);
  };

  const [endingShift, setEndingShift] = useState(false);
  const finalizeEnd = async () => {
    if (!shift || endingShift) return;
    setEndingShift(true);
    try {
      // Atômico: só limpa a UI após o cloud confirmar a finalização.
      // Protege contra o usuário minimizar o app no meio do push e o turno
      // "renascer" como ativo no próximo reload (especialmente iOS standalone).
      const finished = await endShiftAtomic(shift.turno_id);
      setShift(null);
      setSummary(finished);
      setFocus(false);
      setEndConfirmOpen(false);
      setHoldProgress(0);
      onChange?.();
    } finally {
      setEndingShift(false);
    }
  };

  const HOLD_MS = 1000;
  const startHoldEnd = () => {
    if (holdTimerRef.current) return;
    holdStartRef.current = Date.now();
    holdTimerRef.current = setInterval(() => {
      const pct = Math.min(1, (Date.now() - holdStartRef.current) / HOLD_MS);
      setHoldProgress(pct);
      if (pct >= 1) {
        if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null; }
        finalizeEnd();
      }
    }, 50);
  };
  const cancelHoldEnd = () => {
    if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null; }
    setHoldProgress(0);
  };
  useEffect(() => () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
  }, []);

  const handlePause = () => {
    if (!shift) return;
    if (shift.status === 'pausado') {
      const r = resumeShift(shift.turno_id);
      if (r) { setShift({ ...r }); toast.success('Turno retomado'); }
    } else {
      const r = pauseShift(shift.turno_id);
      if (r) { setShift({ ...r }); toast('Turno pausado'); }
    }
    onChange?.();
  };

  const openRide = () => {
    setRideValor('');
    setRideKm(''); // vazio = usa km_desde_ultima_corrida
    setRideOpen(true);
  };

  const handleAddRide = () => {
    if (!shift) return;
    const v = parseFloat(rideValor.replace(',', '.'));
    const k = rideKm ? parseFloat(rideKm.replace(',', '.')) : undefined;
    if (!v || v <= 0) {
      toast.error('Informe o valor da corrida');
      return;
    }
    const kmEfetivo = k && k > 0 ? k : (shift.km_desde_ultima_corrida || 0);
    if (!kmEfetivo || kmEfetivo <= 0) {
      toast.error('Informe o km da corrida manualmente');
      return;
    }
    const r = addRideAuto(shift.turno_id, v, k);
    if (!r) return;
    setRideOpen(false);
    refresh();
    if (r.resultado === 'boa') toast.success('🟢 Boa corrida — acima do mínimo ideal');
    else if (r.resultado === 'aceitavel') toast('🟡 Corrida aceitável — lucro baixo');
    else toast.error('🔴 Corrida abaixo do custo ideal');
  };

  const openEdit = (r: ShiftRide) => {
    setEditing(r);
    setEditKm(String(r.km));
    setEditValor(String(r.valor));
  };

  const handleSaveEdit = () => {
    if (!shift || !editing) return;
    const km = parseFloat(editKm.replace(',', '.'));
    const valor = parseFloat(editValor.replace(',', '.'));
    if (!Number.isFinite(km) || km <= 0) { toast.error('Km inválido'); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error('Valor inválido'); return; }
    const patch: { km?: number; valor?: number } = {};
    if (km !== editing.km) patch.km = km;
    if (valor !== editing.valor) patch.valor = valor;
    if (!patch.km && !patch.valor) { setEditing(null); return; }
    const turnoId = shift.turno_id;
    const corridaId = editing.corrida_id;
    const r = updateRide(turnoId, corridaId, patch);
    if (r) {
      setEditing(null);
      refresh();
      toast.success('Corrida atualizada — indicadores recalculados', {
        duration: 6000,
        action: {
          label: 'Desfazer',
          onClick: () => {
            // Reverte uma edição por campo alterado
            if (patch.valor !== undefined) revertLastEdit(turnoId, corridaId);
            if (patch.km !== undefined) revertLastEdit(turnoId, corridaId);
            refresh();
            toast('Edição revertida');
          },
        },
      });
    }
  };

  const handleDeleteRide = (r: ShiftRide) => {
    if (!shift) return;
    const snapshot: ShiftRide = JSON.parse(JSON.stringify(r));
    const turnoId = shift.turno_id;
    deleteRide(turnoId, r.corrida_id);
    refresh();
    toast('Corrida removida', {
      duration: 6000,
      action: {
        label: 'Desfazer',
        onClick: () => {
          if (restoreRide(turnoId, snapshot)) {
            refresh();
            toast.success('Corrida restaurada');
          }
        },
      },
    });
  };

  // Onboarding obrigatório
  if (vehiclesOpen) {
    return (
      <div className="bg-card border-2 border-primary/40 rounded-xl p-4">
        <VehiclesView
          forceOnboarding={!hasAnyVehicle()}
          onClose={hasAnyVehicle() ? () => setVehiclesOpen(false) : undefined}
          onChange={() => { if (hasAnyVehicle()) setVehiclesOpen(false); }}
        />
      </div>
    );
  }

  // Resumo final estilo Strava
  if (summary) {
    const t = computeTotals(summary);
    const positivo = t.lucro_total > 0;
    const v = getVehicleById(summary.veiculo_id);
    const m = metaProgresso(summary, t.lucro_total);
    return (
      <div className="rounded-2xl p-5 bg-card border-2 border-primary/40 space-y-4 animate-slide-up shadow-premium">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Trophy className="text-accent" size={20} /> Resumo do turno
          </h3>
          <button onClick={() => setSummary(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatOperationalDate(summary.data_operacional)} · {fmtHora(summary.inicio_turno)} → {fmtHora(summary.fim_turno)} · ⏱ {formatTempo(Math.max(0, t.tempo_online_minutos))}
          {v && ` · ${TIPO_LABEL[v.tipo_veiculo]} ${v.nome_veiculo}`}
          {summary.app_utilizado && ` · ${summary.app_utilizado}`}
        </p>
        <div className={`rounded-2xl p-5 text-center ${positivo ? 'bg-profit-gradient' : 'bg-loss-gradient'} shadow-glow`}>
          <p className="text-xs text-primary-foreground/80 uppercase tracking-wider">💰 Lucro do turno</p>
          <p className="text-5xl font-display font-bold text-primary-foreground number-tabular mt-1">{fmt(t.lucro_total)}</p>
          {m.meta > 0 && (
            <p className="text-xs text-primary-foreground/90 mt-2">
              {m.atingida ? `🎯 Meta atingida (${m.pct.toFixed(0)}%)` : `🎯 ${m.pct.toFixed(0)}% da meta`}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-secondary/40 rounded-xl p-3"><Navigation size={14} className="mx-auto text-muted-foreground" /><p className="text-[10px] text-muted-foreground uppercase">Km</p><p className="font-display font-bold number-tabular">{t.km_total.toFixed(1)}</p></div>
          <div className="bg-secondary/40 rounded-xl p-3"><Clock size={14} className="mx-auto text-muted-foreground" /><p className="text-[10px] text-muted-foreground uppercase">Tempo</p><p className="font-display font-bold number-tabular">{formatTempo(t.tempo_online_minutos)}</p></div>
          <div className="bg-secondary/40 rounded-xl p-3"><Wallet size={14} className="mx-auto text-muted-foreground" /><p className="text-[10px] text-muted-foreground uppercase">Corridas</p><p className="font-display font-bold number-tabular">{t.corridas_total}</p></div>
          <div className="bg-secondary/40 rounded-xl p-3"><Zap size={14} className="mx-auto text-muted-foreground" /><p className="text-[10px] text-muted-foreground uppercase">R$/km</p><p className="font-display font-bold number-tabular">{fmt(t.media_por_km)}</p></div>
          <div className="bg-secondary/40 rounded-xl p-3"><p className="text-[10px] text-muted-foreground uppercase">Ganho</p><p className="font-display font-bold number-tabular">{fmt(t.ganho_total)}</p></div>
          <div className="bg-secondary/40 rounded-xl p-3"><p className="text-[10px] text-muted-foreground uppercase">Custos</p><p className="font-display font-bold number-tabular">{fmt(t.custo_total)}</p></div>
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
                  <p className="text-xs text-muted-foreground">Detectamos que ainda é madrugada. Escolha a data operacional.</p>
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

  // ============ TURNO ATIVO ============
  const t = totals!;
  const lucroOk = t.lucro_total >= 0;
  const veh = getVehicleById(shift.veiculo_id);
  const pausado = shift.status === 'pausado';
  const tempoLive = fmtDuracao(tempoOnlineMs(shift));
  const rPorKm = t.km_total > 0 ? t.ganho_total / t.km_total : 0;
  const kmDesde = shift.km_desde_ultima_corrida || 0;

  // === Smart alerts (limiares configuráveis) ===
  const thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...(getSettings().alertThresholds || {}) };
  const horasOnline = t.tempo_online_minutos / 60;
  const lucroHora = horasOnline > 0 ? t.lucro_total / horasOnline : 0;
  const custoPct = t.ganho_total > 0 ? (t.custo_total / t.ganho_total) * 100 : 0;
  const smartAlerts: { key: string; msg: string }[] = [];
  if (thresholds.maxHorasTurno > 0 && horasOnline >= thresholds.maxHorasTurno) {
    smartAlerts.push({ key: 'horas', msg: `⏰ Você já está há ${horasOnline.toFixed(1)}h online — limite definido: ${thresholds.maxHorasTurno}h. Considere pausar.` });
  }
  if (thresholds.minLucroHora > 0 && t.corridas_total >= 2 && lucroHora < thresholds.minLucroHora) {
    smartAlerts.push({ key: 'lucroh', msg: `📉 Lucro/hora atual ${fmt(lucroHora)} está abaixo do mínimo (${fmt(thresholds.minLucroHora)}).` });
  }
  if (thresholds.maxCustoPct > 0 && t.ganho_total > 0 && custoPct > thresholds.maxCustoPct) {
    smartAlerts.push({ key: 'custo', msg: `💸 Custos consumindo ${custoPct.toFixed(0)}% do ganho (limite ${thresholds.maxCustoPct}%).` });
  }

  // Preview da corrida no modal
  const vNum = parseFloat(rideValor.replace(',', '.'));
  const kNum = rideKm ? parseFloat(rideKm.replace(',', '.')) : kmDesde;
  const previewValid = vNum > 0 && kNum > 0;
  const previewClass = previewValid ? classifyRide(vNum, kNum, shift) : null;

  const gpsBadge =
    gps === 'tracking' ? { icon: <Satellite size={11} className="animate-pulse" />, label: '🟢 Tracking ativo', cls: 'text-profit bg-profit/10' } :
    gps === 'background' ? { icon: <Satellite size={11} />, label: '🟡 Em segundo plano', cls: 'text-accent bg-accent/10' } :
    gps === 'requesting' ? { icon: <Satellite size={11} />, label: 'GPS…', cls: 'text-accent bg-accent/10' } :
    gps === 'paused' ? { icon: <Pause size={11} />, label: 'GPS pausado', cls: 'text-muted-foreground bg-secondary' } :
    gps === 'denied' ? { icon: <MapPinOff size={11} />, label: '🔴 GPS negado', cls: 'text-loss bg-loss/10' } :
    gps === 'unavailable' ? { icon: <MapPinOff size={11} />, label: '🔴 Sem GPS', cls: 'text-muted-foreground bg-secondary' } :
    { icon: <Satellite size={11} />, label: '...', cls: 'text-muted-foreground bg-secondary' };

  // Tempo desde a última posição GPS (para UX honesta + banner de background longo)
  const gapMs = lastFixAt ? Date.now() - lastFixAt : null;
  const gapSec = gapMs != null ? Math.floor(gapMs / 1000) : null;
  const longBackgroundGap = gps === 'background' || (gapSec != null && gapSec > 60);
  const fmtGap = (s: number) => s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s/60)}min` : `${Math.floor(s/3600)}h${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;

  // === MODO FOCO ===
  if (focus) {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col p-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5`}>
              <span className={`absolute inline-flex h-full w-full rounded-full ${pausado ? 'bg-accent' : 'bg-profit'} opacity-60 animate-pulse-dot`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${pausado ? 'bg-accent' : 'bg-profit'}`} />
            </span>
            <p className="font-display font-semibold text-sm">{pausado ? 'Pausado' : 'Modo foco'}</p>
          </div>
          <button onClick={() => setFocus(false)} className="p-2 rounded-lg bg-secondary text-foreground">
            <Minimize2 size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-display">Lucro real agora</p>
            <p className={`text-7xl font-display font-bold number-tabular mt-2 ${lucroOk ? 'text-profit' : 'text-loss'}`}>
              {fmt(t.lucro_total)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 w-full max-w-sm">
            <div><p className="text-[10px] uppercase text-muted-foreground">Tempo</p><p className="font-display font-bold text-2xl number-tabular">{tempoLive}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground">Km</p><p className="font-display font-bold text-2xl number-tabular">{t.km_total.toFixed(1)}</p></div>
            <div><p className="text-[10px] uppercase text-muted-foreground">Corridas</p><p className="font-display font-bold text-2xl number-tabular">{t.corridas_total}</p></div>
          </div>
          {meta && meta.meta > 0 && (
            <div className="w-full max-w-sm">
              <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Meta</span><span className="font-display font-bold">{meta.pct.toFixed(0)}%</span></div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden"><div className={`h-full ${meta.atingida ? 'bg-profit-gradient' : 'bg-info-gradient'} transition-all`} style={{ width: `${meta.pct}%` }} /></div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button onClick={openRide} className="w-full rounded-2xl p-5 bg-profit-gradient text-primary-foreground font-display font-bold text-lg flex items-center justify-center gap-2 shadow-glow active:scale-[0.98]">
            <Plus size={22} /> Registrar corrida
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handlePause} className="p-3 rounded-xl bg-secondary text-foreground font-display font-semibold text-sm flex items-center justify-center gap-2">
              {pausado ? <><Play size={14} /> Retomar</> : <><Pause size={14} /> Pausar</>}
            </button>
            <button onClick={handleEnd} className="p-3 rounded-xl bg-loss/90 text-primary-foreground font-display font-semibold text-sm flex items-center justify-center gap-2">
              <Square size={14} /> Finalizar
            </button>
          </div>
        </div>

        {rideOpen && renderRideModal()}
      </div>
    );
  }

  // === HERO NORMAL ===
  return (
    <>
      <div className={`relative rounded-2xl p-5 border-2 space-y-4 overflow-hidden ${pausado ? 'border-accent/40 bg-accent/5' : lucroOk ? 'border-profit/40 bg-profit/5' : 'border-loss/50 bg-loss/5'} shadow-premium`}>
        <div className={`absolute inset-x-0 top-0 h-1 ${pausado ? 'bg-accent' : lucroOk ? 'bg-profit-gradient' : 'bg-loss-gradient'}`} />

        {/* Top: status + actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`relative flex h-2 w-2`}>
                <span className={`absolute inline-flex h-full w-full rounded-full ${pausado ? 'bg-accent' : 'bg-profit'} opacity-60 animate-pulse-dot`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${pausado ? 'bg-accent' : 'bg-profit'}`} />
              </span>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">
                {pausado ? '🟡 Turno pausado' : '🟢 Turno ativo'} · {fmtHora(shift.inicio_turno)} → agora · ⏱ {tempoLive}
              </p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-display font-semibold flex items-center gap-1 ${gpsBadge.cls}`}>
                {gpsBadge.icon} {gpsBadge.label}
              </span>
              {gapSec != null && (gps === 'tracking' || gps === 'background') && (
                <span className="text-[9px] text-muted-foreground font-display">
                  · última posição há {fmtGap(gapSec)}
                </span>
              )}
            </div>

            {/* Lucro gigante */}
            <p className={`text-5xl font-display font-bold mt-1 number-tabular ${lucroOk ? 'text-profit' : 'text-loss'}`}>{fmt(t.lucro_total)}</p>
            <p className="text-[11px] text-muted-foreground">💰 Lucro real agora</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {veh ? `${TIPO_LABEL[veh.tipo_veiculo]} ${veh.nome_veiculo}` : 'Sem veículo'}
              {shift.app_utilizado && ` · ${shift.app_utilizado}`}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button onClick={() => setFocus(true)} title="Modo foco" className="p-2 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 transition-colors">
              <Maximize2 size={14} />
            </button>
            <button onClick={handleEnd} className="p-2 rounded-xl bg-loss/90 hover:bg-loss text-primary-foreground transition-colors" title="Finalizar">
              <Square size={14} fill="currentColor" />
            </button>
          </div>
        </div>

        {/* 4 stats ao vivo */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-card/70 rounded-xl p-2 border border-border/60">
            <Clock size={12} className="mx-auto text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">Tempo</p>
            <p className="font-display font-bold text-xs number-tabular">{tempoLive}</p>
          </div>
          <div className="bg-card/70 rounded-xl p-2 border border-border/60">
            <Navigation size={12} className="mx-auto text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">Km</p>
            <p className="font-display font-bold text-xs number-tabular">{t.km_total.toFixed(1)}</p>
          </div>
          <div className="bg-card/70 rounded-xl p-2 border border-border/60">
            <Wallet size={12} className="mx-auto text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">Corridas</p>
            <p className="font-display font-bold text-xs number-tabular">{t.corridas_total}</p>
          </div>
          <div className="bg-card/70 rounded-xl p-2 border border-border/60">
            <Zap size={12} className="mx-auto text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">R$/km</p>
            <p className="font-display font-bold text-xs number-tabular">{rPorKm.toFixed(2)}</p>
          </div>
        </div>

        {/* Meta */}
        {meta && meta.meta > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-muted-foreground flex items-center gap-1"><Target size={11}/> Meta diária</span>
              <span className="font-display font-bold">
                {meta.pct.toFixed(0)}% {meta.atingida ? '· 🎯 atingida!' : `· faltam ${fmt(meta.faltam)}`}
              </span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ${meta.atingida ? 'bg-profit-gradient' : 'bg-info-gradient'}`} style={{ width: `${meta.pct}%` }} />
            </div>
          </div>
        )}

        {(gps === 'denied' || gps === 'unavailable') && (
          <div className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-2.5 text-[11px] text-accent">
            <MapPinOff size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-display font-semibold">Modo manual ativo</p>
              <p className="text-accent/80">
                {gps === 'denied'
                  ? 'GPS negado. Informe o km de cada corrida ao registrar — o cálculo continua funcionando.'
                  : 'GPS indisponível. Informe o km manualmente em cada corrida.'}
              </p>
            </div>
            {gps === 'denied' && (
              <button onClick={() => requestGpsPermission()} className="text-[10px] underline shrink-0">tentar de novo</button>
            )}
          </div>
        )}

        {/* Banner persistente — UX honesta sobre limitação de background do navegador/PWA.
            Some automaticamente quando o GPS volta a registrar fixes consistentes. */}
        {longBackgroundGap && gps !== 'denied' && gps !== 'unavailable' && gps !== 'paused' && (
          <div className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-2.5 text-[11px] text-accent">
            <Satellite size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-display font-semibold">Tracking em segundo plano reduzido</p>
              <p className="text-accent/80">
                {gapSec != null && gapSec > 5
                  ? `Sem nova posição há ${fmtGap(gapSec)}. `
                  : ''}
                Navegadores pausam o GPS quando o app sai do foco. Mantenha o app aberto para precisão máxima — o tracking retoma automaticamente ao voltar.
              </p>
            </div>
          </div>
        )}

        {smartAlerts.length > 0 && (
          <div className="space-y-1.5">
            {smartAlerts.map(a => (
              <div key={a.key} className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-2.5 text-[11px] text-accent">
                <Target size={14} className="mt-0.5 shrink-0" />
                <p className="flex-1 font-display">{a.msg}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mensagem motivadora */}
        <p className={`text-xs text-center font-display ${pausado ? 'text-accent' : lucroOk ? 'text-profit' : 'text-loss'}`}>
          {pausado ? 'Turno pausado — toque em retomar para continuar'
            : t.corridas_total === 0 ? 'Toque em registrar corrida para começar'
            : lucroOk ? 'Você está indo bem 👊' : 'Atenção — seu lucro caiu'}
        </p>

        {/* Mapa ao vivo (opt-in) */}
        {showMap && (shift.rota?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <ShiftLiveMap shift={shift} />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => { (await exportRouteGpx(shift)) ? toast.success('GPX exportado') : toast('Rota muito curta'); }}
                className="px-2 py-1.5 rounded-lg bg-secondary text-foreground text-[11px] font-display font-semibold flex items-center justify-center gap-1"
              ><MapIcon size={12}/> Exportar GPX</button>
              <button
                onClick={async () => { (await exportRouteKml(shift)) ? toast.success('KML exportado') : toast('Rota muito curta'); }}
                className="px-2 py-1.5 rounded-lg bg-secondary text-foreground text-[11px] font-display font-semibold flex items-center justify-center gap-1"
              ><MapIcon size={12}/> Exportar KML</button>
            </div>
          </div>
        )}


        {/* Actions */}
        <div className="grid grid-cols-4 gap-2">
          <button onClick={handlePause} className="p-3 rounded-xl bg-secondary text-foreground font-display font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform">
            {pausado ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            onClick={() => setShowMap(v => !v)}
            title={showMap ? 'Ocultar mapa' : 'Mostrar mapa'}
            className={`p-3 rounded-xl font-display font-semibold text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform ${showMap ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-foreground'}`}
          >
            <MapIcon size={14} />
          </button>
          <button onClick={openRide} disabled={pausado} className="col-span-2 p-3 rounded-xl bg-profit-gradient text-primary-foreground font-display font-bold flex items-center justify-center gap-2 shadow-glow active:scale-[0.98] transition-transform disabled:opacity-50">
            <Plus size={18} /> Corrida
          </button>
        </div>


        {/* Últimas corridas */}
        {shift.rides.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Últimas corridas</p>
            {shift.rides.slice(0, 5).map(r => (
              <div key={r.corrida_id} className="flex items-center justify-between gap-1 bg-card border rounded px-2.5 py-1.5 text-xs">
                <span>{r.resultado === 'boa' ? '🟢' : r.resultado === 'aceitavel' ? '🟡' : '🔴'}</span>
                <span className="font-semibold">{fmt(r.valor)}</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  {r.km.toFixed(1)} km
                  {r.edicoes && r.edicoes.length > 0 && (
                    <span title="Corrida editada" className="text-[9px] text-accent">✎</span>
                  )}
                </span>
                <span className="font-display font-bold">{fmt(r.valor_por_km)}/km</span>
                <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-primary" title="Editar km/valor"><Pencil size={12} /></button>
                <button onClick={() => handleDeleteRide(r)} className="text-muted-foreground hover:text-loss" title="Remover"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {rideOpen && renderRideModal()}
      {editing && renderEditModal()}
      <GpsConsentDialog
        open={consentOpen}
        onAccept={() => {
          saveGpsConsent();
          setConsentOpen(false);
          triggerNativePrompt(consentTurnoId);
        }}
        onDecline={() => {
          setConsentOpen(false);
          if (consentTurnoId) setShiftGpsStatus(consentTurnoId, 'denied');
          toast('Modo manual ativado — informe o km de cada corrida');
          refresh();
        }}
      />

      <BackgroundLocationConsentDialog
        open={bgConsentOpen}
        onAccept={() => {
          saveBackgroundGpsConsent();
          setBgConsentOpen(false);
          toast.success('Rastreamento em segundo plano ativado', {
            description: 'Uma notificação ficará visível durante o turno.',
          });
          // Bounce do tracker (pause+resume instantâneo) para re-selecionar o provider
          // e ativar o foreground service nativo no turno atual sem afetar km nem persistência.
          const id = bgConsentTurnoId;
          if (id) {
            const paused = pauseShift(id);
            if (paused) {
              const resumed = resumeShift(id);
              if (resumed) setShift({ ...resumed });
            }
          }
        }}
        onDecline={() => {
          declineBackgroundGpsConsent();
          setBgConsentOpen(false);
          toast('Rastreamento limitado ao app aberto', {
            description: 'Você pode habilitar depois nas configurações.',
          });
        }}
      />

      {/* Finalizar turno — AlertDialog semântico + press-and-hold para evitar toque acidental */}
      <AlertDialog open={endConfirmOpen} onOpenChange={(o) => { if (!o) { cancelHoldEnd(); setEndConfirmOpen(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar turno?</AlertDialogTitle>
            <AlertDialogDescription>
              Os totais do turno serão consolidados no histórico e dashboard. Esta ação não pode ser desfeita.
              {totals && (
                <span className="block mt-2 text-xs">
                  💰 Lucro: <b>{fmt(totals.lucro_total)}</b> · 🛣 {totals.km_total.toFixed(1)} km · 🚗 {totals.corridas_total} corridas
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelHoldEnd}>Cancelar</AlertDialogCancel>
            <button
              type="button"
              onPointerDown={startHoldEnd}
              onPointerUp={cancelHoldEnd}
              onPointerLeave={cancelHoldEnd}
              onPointerCancel={cancelHoldEnd}
              className="relative overflow-hidden inline-flex items-center justify-center rounded-md bg-loss text-primary-foreground font-display font-bold px-4 py-2.5 text-sm select-none touch-none active:scale-[0.99]"
              style={{ minWidth: 200 }}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-primary-foreground/20 transition-[width] duration-75 ease-linear"
                style={{ width: `${holdProgress * 100}%` }}
              />
              <span className="relative flex items-center gap-2">
                <Square size={14} fill="currentColor" />
                {holdProgress > 0 && holdProgress < 1
                  ? `Segure para confirmar… ${Math.round(holdProgress * 100)}%`
                  : 'Segure 1s para finalizar'}
              </span>
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );


  // ============ RIDE MODAL ============
  function renderRideModal() {
    return (
      <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={() => setRideOpen(false)}>
        <div className="bg-card rounded-2xl p-5 w-full max-w-sm space-y-4 border animate-slide-up" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base">Nova corrida</h3>
            <button onClick={() => setRideOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display font-semibold">Valor recebido</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <input
                type="number" inputMode="decimal" autoFocus
                value={rideValor} onChange={e => setRideValor(e.target.value)}
                placeholder="0,00"
                className="w-full pl-9 pr-3 py-3 text-2xl font-display font-bold rounded-xl border bg-background number-tabular"
              />
            </div>
          </div>

          {/* Km auto-detectado pelo GPS */}
          <div className="rounded-xl border bg-secondary/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1"><Navigation size={11}/> Km desde a última</span>
              <span className="font-display font-bold number-tabular">{kmDesde.toFixed(1)} km</span>
            </div>
            <input
              type="number" inputMode="decimal"
              value={rideKm} onChange={e => setRideKm(e.target.value)}
              placeholder={kmDesde > 0 ? `Auto (${kmDesde.toFixed(1)} km do GPS)` : 'Informe km manualmente'}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-background number-tabular"
            />
            <p className="text-[10px] text-muted-foreground">
              {kmDesde > 0
                ? 'Deixe vazio para usar o km automático do GPS'
                : (gps === 'denied' || gps === 'unavailable')
                  ? 'Modo manual — informe o km da corrida'
                  : 'GPS ainda não registrou movimento — você pode informar manualmente'}
            </p>
          </div>

          {/* Preview ao vivo */}
          {previewValid && previewClass && (
            <div className={`rounded-xl border p-3 ${
              previewClass.resultado === 'boa' ? 'border-profit/40 bg-profit/10 text-profit' :
              previewClass.resultado === 'aceitavel' ? 'border-accent/40 bg-accent/10 text-accent' :
              'border-loss/40 bg-loss/10 text-loss'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-display font-semibold uppercase tracking-wider">R$ por km</span>
                <span className="font-display font-bold">
                  {previewClass.resultado === 'boa' ? '🟢 Boa' : previewClass.resultado === 'aceitavel' ? '🟡 Aceitável' : '🔴 Ruim'}
                </span>
              </div>
              <p className="font-display font-bold text-2xl number-tabular mt-0.5">{fmt(previewClass.valor_por_km)}/km</p>
            </div>
          )}

          <button
            onClick={handleAddRide}
            disabled={!previewValid}
            className="w-full p-4 rounded-xl bg-profit-gradient text-primary-foreground font-display font-bold disabled:opacity-40 active:scale-[0.98] transition-transform shadow-glow"
          >
            Salvar corrida
          </button>
        </div>
      </div>
    );
  }

  // ============ EDIT MODAL ============
  function renderEditModal() {
    if (!editing) return null;
    const kmNum = parseFloat(editKm.replace(',', '.'));
    const valorNum = parseFloat(editValor.replace(',', '.'));
    const previewValid = Number.isFinite(kmNum) && kmNum > 0 && Number.isFinite(valorNum) && valorNum > 0;
    const previewCls = previewValid ? classifyRide(valorNum, kmNum, shift!) : null;
    return (
      <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={() => setEditing(null)}>
        <div className="bg-card rounded-2xl p-5 w-full max-w-sm space-y-4 border animate-slide-up" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base flex items-center gap-2"><Pencil size={16}/> Editar corrida</h3>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Registrada em {fmtHora(editing.data_registro)} · Horário e ordem cronológica não serão alterados.
          </p>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display font-semibold">Valor recebido</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <input
                type="number" inputMode="decimal"
                value={editValor} onChange={e => setEditValor(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-lg font-display font-bold rounded-xl border bg-background number-tabular"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display font-semibold">Km da corrida</label>
            <input
              type="number" inputMode="decimal" min={0}
              value={editKm} onChange={e => setEditKm(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 text-lg font-display font-bold rounded-xl border bg-background number-tabular"
            />
          </div>

          {previewValid && previewCls && (
            <div className={`rounded-xl border p-3 ${
              previewCls.resultado === 'boa' ? 'border-profit/40 bg-profit/10 text-profit' :
              previewCls.resultado === 'aceitavel' ? 'border-accent/40 bg-accent/10 text-accent' :
              'border-loss/40 bg-loss/10 text-loss'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-display font-semibold uppercase tracking-wider">Novo R$/km</span>
                <span className="font-display font-bold">
                  {previewCls.resultado === 'boa' ? '🟢 Boa' : previewCls.resultado === 'aceitavel' ? '🟡 Aceitável' : '🔴 Ruim'}
                </span>
              </div>
              <p className="font-display font-bold text-xl number-tabular mt-0.5">{fmt(previewCls.valor_por_km)}/km</p>
            </div>
          )}

          {editing.edicoes && editing.edicoes.length > 0 && (
            <div className="rounded-lg border bg-secondary/30 p-2 max-h-28 overflow-y-auto">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Histórico de edições</p>
              {editing.edicoes.slice().reverse().map((e, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">
                  {fmtHora(e.data_edicao)} · {e.campo}: {e.valor_antigo} → {e.valor_novo}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => setEditing(null)} className="flex-1 p-3 rounded-xl bg-secondary text-foreground font-display font-semibold text-sm">Cancelar</button>
            <button
              onClick={handleSaveEdit}
              disabled={!previewValid}
              className="flex-1 p-3 rounded-xl bg-primary text-primary-foreground font-display font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
