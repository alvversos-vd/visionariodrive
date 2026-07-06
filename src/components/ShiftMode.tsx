import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Play, Square, Plus, Clock, Wallet, Navigation, X, Trophy,
  Car, Smartphone, Pause, Target, Zap, Maximize2, Minimize2,
  Satellite, MapPinOff, Pencil, Map as MapIcon, Bell,
} from 'lucide-react';
import { shiftService, type Shift } from '@/lib/services/shiftService';
import { rideService } from '@/lib/services/rideService';
import { rideModelToShiftRide, type ShiftRide } from '@/lib/adapters/rideAdapters';
import { settingsService } from '@/lib/services/settingsService';
import { DEFAULT_ALERT_THRESHOLDS } from '@/lib/types';
import {
  hasAnyVehicle, getVehiclesV2, getActiveVehicle, setActiveVehicleId, getVehicleById,
  getLastApp, setLastApp, APPS, AppEntrega, TIPO_LABEL,
} from '@/lib/vehicles';
import { useShiftTracker, fmtDuracao, tempoOnlineMs } from '@/hooks/useShiftTracker';
import GpsConsentDialog, { hasGpsConsent, saveGpsConsent } from './GpsConsentDialog';
import BackgroundLocationConsentDialog, {
  saveBackgroundGpsConsent, declineBackgroundGpsConsent, wasBackgroundGpsAsked, hasBackgroundGpsConsent,
} from './BackgroundLocationConsentDialog';
import {
  getBackgroundPermissionStatus,
  isBgAlwaysVerified,
  openAppLocationSettings,
  openNotificationSettings,
  requestBackgroundLocationPermissionIfPossible,
  requestNotificationPermissionIfNeeded,
  type BackgroundPermissionStatus,
} from '@/lib/bgPermission';
import ShiftLiveMap from './ShiftLiveMap';
import { exportRouteGpx, exportRouteKml } from '@/lib/exportRoute';
import VehiclesView from './VehiclesView';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { gpsTelemetry } from '@/lib/gpsTelemetry';
import {
  subscribePermissionDiagnostic,
  refreshPermissionDiagnostic,
  type PermissionDiagnostic,
} from '@/lib/permissionDiagnostic';



function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtHora(iso?: string) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function KpiTile({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="surface-inset rounded-xl p-2.5 border border-border/40 text-center">
      {icon && <div className="text-muted-foreground mb-1 flex justify-center">{icon}</div>}
      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground font-display font-semibold">{label}</p>
      <p className="font-display font-bold text-[13px] font-mono-num mt-0.5">{value}</p>
    </div>
  );
}

function AlertBanner({
  tone, icon, title, body, cta, onClick,
}: {
  tone: 'warning' | 'info' | 'loss';
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  cta?: string;
  onClick?: () => void;
}) {
  const toneCls =
    tone === 'warning' ? 'border-warning/30 bg-warning/5 text-warning' :
    tone === 'loss' ? 'border-loss/30 bg-loss/5 text-loss' :
    'border-info/30 bg-info/5 text-info';
  const stripeCls =
    tone === 'warning' ? 'bg-warning' :
    tone === 'loss' ? 'bg-loss' :
    'bg-info';
  const Wrapper: React.ElementType = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`relative w-full overflow-hidden flex items-start gap-2.5 rounded-xl border p-3 text-[11px] text-left ${toneCls} ${onClick ? 'press transition-transform' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-0.5 ${stripeCls}`} />
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-display font-semibold leading-tight">{title}</p>}
        <p className="opacity-80 leading-relaxed mt-0.5">{body}</p>
      </div>
      {cta && <span className="text-[10px] font-display font-semibold underline shrink-0 mt-0.5">{cta}</span>}
    </Wrapper>
  );
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
  const [trackerRestartSignal, setTrackerRestartSignal] = useState(0);
  const [bgPermissionStatus, setBgPermissionStatus] = useState<BackgroundPermissionStatus | null>(null);
  const [permDiag, setPermDiag] = useState<PermissionDiagnostic | null>(null);
  useEffect(() => {
    const unsub = subscribePermissionDiagnostic(setPermDiag);
    void refreshPermissionDiagnostic();
    return unsub;
  }, []);
  const trackingMode: 'automatic' | 'manual' = permDiag?.trackingMode ?? 'automatic';
  const lastBgVerifiedRef = useRef<boolean>(isBgAlwaysVerified());

  // Verificação REAL de "Permitir o tempo todo" — fonte primária é nativa Android.
  const [bgVerified, setBgVerified] = useState<boolean>(() => isBgAlwaysVerified());
  const syncBackgroundPermission = useCallback(async (reason: string) => {
    const status = await getBackgroundPermissionStatus();
    setBgPermissionStatus(status);
    const verified = status.backgroundLocationGranted || isBgAlwaysVerified();
    setBgVerified(verified);
    try { gpsTelemetry.event('bg_permission_state_checked', { reason, ...status }); } catch { /* noop */ }
    if (verified && !lastBgVerifiedRef.current) setTrackerRestartSignal(v => v + 1);
    lastBgVerifiedRef.current = verified;
    return status;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let appStateHandle: { remove: () => Promise<void> } | null = null;
    const onChange = () => {
      const verified = isBgAlwaysVerified();
      setBgVerified(verified);
      lastBgVerifiedRef.current = verified;
      void syncBackgroundPermission('bg-verified-event');
    };
    window.addEventListener('vd-bg-verified-changed', onChange);
    // Re-checa também ao voltar pro app (após o usuário ir nas configs)
    const onVis = () => { if (!document.hidden) void syncBackgroundPermission('visibility-return'); };
    const onFocus = () => { void syncBackgroundPermission('focus-return'); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    import('@capacitor/app')
      .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void syncBackgroundPermission('app-state-active');
      }))
      .then(handle => { if (cancelled) void handle.remove(); else appStateHandle = handle; })
      .catch(() => { /* web/noop */ });
    void syncBackgroundPermission('mount');
    return () => {
      cancelled = true;
      window.removeEventListener('vd-bg-verified-changed', onChange);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      if (appStateHandle) void appStateHandle.remove();
    };
  }, [syncBackgroundPermission]);

  const isNativePlatform = (() => {
    try {
      const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
      return !!w.Capacitor?.isNativePlatform?.();
    } catch { return false; }
  })();

  const openSettingsClick = async () => {
    try { gpsTelemetry.event('bg_open_settings_clicked', { from: 'banner' }); } catch { /* noop */ }
    const ok = await openAppLocationSettings();
    if (!ok) {
      toast.error('Abra manualmente: Ajustes do celular → Apps → Visionário Drive → Permissões → Localização → "Permitir o tempo todo"', { duration: 9000 });
    }
  };


  const [ridesVersion, setRidesVersion] = useState(0);
  const refresh = () => {
    const a = getActiveShift();
    setShift(a);
    setRidesVersion(v => v + 1);
    onChange?.();
  };

  const { gps, lastFixAt } = useShiftTracker(shift, { restartSignal: trackerRestartSignal, mode: trackingMode, onTick: () => {
    // re-pega snapshot do shift do storage para refletir km_gps acumulado
    const a = getActiveShift();
    if (a) setShift({ ...a });
  }});

  const activeRides = useMemo(
    () => (shift ? rideService.listByShift(shift.turno_id) : []),
    [shift, ridesVersion],
  );
  const totals = useMemo(
    () => (shift ? computeTotals(shift, activeRides) : null),
    [shift, activeRides],
  );
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
  const requestGpsPermission = async (turnoId?: string) => {
    const id = turnoId ?? shift?.turno_id ?? null;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (id) setShiftGpsStatus(id, 'unavailable');
      toast('GPS indisponível neste dispositivo — modo manual ativo');
      refresh();
      return;
    }
    const cap = typeof window !== 'undefined'
      ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      : undefined;
    const isNative = !!cap?.isNativePlatform?.();
    const nativeStatus = isNative ? await syncBackgroundPermission('gps-permission-entry') : null;
    // Se já consentiu antes, pula o modal e vai direto ao prompt nativo
    // — exceto quando o Android mostra que a permissão real foi revogada/ausente.
    if (hasGpsConsent() && (!isNative || nativeStatus?.foregroundLocationGranted)) {
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

    const handleGranted = async () => {
      if (id) setShiftGpsStatus(id, 'ok');
      saveGpsConsent();
      toast.success('GPS ativo — km serão calculados automaticamente');
      refresh();
      const status = await syncBackgroundPermission('foreground-location-granted');
      // Em plataforma nativa: oferecer rastreamento em background (foreground service Android)
      // quando ainda não existe permissão real "Permitir o tempo todo".
      if (isNative && !status.backgroundLocationGranted && !wasBackgroundGpsAsked()) {
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
          void handleGranted();
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
      () => { void handleGranted(); },
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
    const usedManual = !!(k && k > 0);
    const kmEfetivo = usedManual ? (k as number) : (shift.km_desde_ultima_corrida || 0);
    if (!kmEfetivo || kmEfetivo <= 0) {
      toast.error('Informe o km da corrida manualmente');
      return;
    }
    const ride = rideService.registerShiftRide({
      shiftId: shift.turno_id,
      value: v,
      km: kmEfetivo,
      kmOrigin: usedManual ? 'manual' : 'auto',
    });
    if (!ride) return;
    setRideOpen(false);
    refresh();
    const view = rideModelToShiftRide(ride);
    if (view.resultado === 'boa') toast.success('🟢 Boa corrida — acima do mínimo ideal');
    else if (view.resultado === 'aceitavel') toast('🟡 Corrida aceitável — lucro baixo');
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
    const corridaId = editing.corrida_id;
    const r = rideService.updateShiftRide(corridaId, patch);
    if (r) {
      setEditing(null);
      refresh();
      toast.success('Corrida atualizada — indicadores recalculados', {
        duration: 6000,
        action: {
          label: 'Desfazer',
          onClick: () => {
            if (patch.valor !== undefined) rideService.revertLastShiftRideEdit(corridaId);
            if (patch.km !== undefined) rideService.revertLastShiftRideEdit(corridaId);
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
    rideService.deleteShiftRide(r.corrida_id);
    refresh();
    toast('Corrida removida', {
      duration: 6000,
      action: {
        label: 'Desfazer',
        onClick: () => {
          if (rideService.restoreShiftRide(snapshot)) {
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

  // Resumo final — cockpit premium
  if (summary) {
    const t = computeTotals(summary, rideService.listByShift(summary.turno_id));
    const positivo = t.lucro_total > 0;
    const v = getVehicleById(summary.veiculo_id);
    const m = metaProgresso(summary, t.lucro_total);
    return (
      <div className="rounded-2xl p-5 surface-1 border border-border/60 space-y-5 animate-fade-in-up shadow-premium">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Trophy className="text-primary" size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">Turno encerrado</p>
              <h3 className="font-display font-bold text-base leading-tight">Resumo do turno</h3>
            </div>
          </div>
          <button onClick={() => setSummary(null)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 press"><X size={18} /></button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {formatOperationalDate(summary.data_operacional)} · {fmtHora(summary.inicio_turno)} → {fmtHora(summary.fim_turno)} · {formatTempo(Math.max(0, t.tempo_online_minutos))}
          {v && ` · ${TIPO_LABEL[v.tipo_veiculo]} ${v.nome_veiculo}`}
          {summary.app_utilizado && ` · ${summary.app_utilizado}`}
        </p>
        <div className={`relative overflow-hidden rounded-2xl p-6 text-center border ${positivo ? 'border-profit/40 bg-hero' : 'border-loss/40 bg-hero'}`}>
          <div className={`absolute inset-x-0 -top-16 h-32 blur-3xl opacity-50 pointer-events-none ${positivo ? 'bg-profit/30' : 'bg-loss/30'}`} />
          <p className="relative text-label">Lucro do turno</p>
          <p className={`relative text-[44px] leading-none font-display font-bold font-mono-num mt-2 ${positivo ? 'text-profit' : 'text-loss'}`}>{fmt(t.lucro_total)}</p>
          {m.meta > 0 && (
            <p className="relative text-[11px] text-muted-foreground font-display font-semibold mt-3 inline-flex items-center gap-1.5">
              <Target size={11} className={m.atingida ? 'text-profit' : 'text-info'} />
              {m.atingida ? `Meta atingida · ${m.pct.toFixed(0)}%` : `${m.pct.toFixed(0)}% da meta diária`}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <KpiTile icon={<Navigation size={12} />} label="Km" value={t.km_total.toFixed(1)} />
          <KpiTile icon={<Clock size={12} />} label="Tempo" value={formatTempo(t.tempo_online_minutos)} />
          <KpiTile icon={<Wallet size={12} />} label="Corridas" value={String(t.corridas_total)} />
          <KpiTile icon={<Zap size={12} />} label="R$/km" value={fmt(t.media_por_km)} />
          <KpiTile label="Ganho" value={fmt(t.ganho_total)} />
          <KpiTile label="Custos" value={fmt(t.custo_total)} />
        </div>
        <p className={`text-center text-[12px] font-display font-semibold ${positivo ? 'text-profit' : 'text-loss'}`}>
          {positivo ? 'Bom trabalho hoje.' : 'Você pode melhorar amanhã.'}
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
          className="
            relative w-full overflow-hidden rounded-2xl p-5 surface-1 border border-border/60
            text-foreground font-display font-bold text-base
            flex items-center justify-center gap-3 shadow-premium press transition-all
            hover:border-primary/40
          "
        >
          <span className="absolute inset-x-0 -top-12 h-24 bg-primary/10 blur-3xl opacity-60 pointer-events-none" />
          <span className="relative w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow-sm">
            <Play size={20} fill="currentColor" className="text-primary-foreground ml-0.5" />
          </span>
          <span className="relative flex flex-col items-start">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Pronto para rodar</span>
            <span className="text-[15px] tracking-tight">Iniciar turno</span>
          </span>
        </button>

        {pickerOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPickerOpen(false)}>
            <div className="surface-1 sm:rounded-2xl rounded-t-3xl p-5 w-full max-w-sm space-y-3 border-t sm:border border-border/60 shadow-premium max-h-[85vh] overflow-y-auto animate-fade-in-up pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
              {step === 'date' && (
                <>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">Etapa 1 de 3</p>
                    <h3 className="font-display font-bold text-base">Esse turno pertence a qual dia?</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">Detectamos que ainda é madrugada. Escolha a data operacional.</p>
                  <button onClick={() => { setPickedDate(todayOperationalDate()); setStep('vehicle'); }} className="w-full p-3 rounded-xl bg-brand-gradient text-primary-foreground font-display font-bold text-sm press shadow-glow-sm">
                    Hoje · {formatOperationalDate(todayOperationalDate())}
                  </button>
                  <button onClick={() => { setPickedDate(yesterdayOperationalDate()); setStep('vehicle'); }} className="w-full p-3 rounded-xl surface-inset border border-border/60 text-foreground font-display font-semibold text-sm press">
                    Ontem · {formatOperationalDate(yesterdayOperationalDate())}
                  </button>
                </>
              )}

              {step === 'vehicle' && (
                <>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold flex items-center gap-1.5">
                      <Car size={11} /> Etapa {new Date().getHours() < 5 ? '2' : '1'} de {new Date().getHours() < 5 ? '3' : '2'}
                    </p>
                    <h3 className="font-display font-bold text-base">Qual veículo será usado?</h3>
                  </div>
                  <div className="space-y-2">
                    {getVehiclesV2().map(v => (
                      <button
                        key={v.veiculo_id}
                        onClick={() => setPickedVehicleId(v.veiculo_id)}
                        className={`w-full text-left p-3 rounded-xl border press transition-colors ${pickedVehicleId === v.veiculo_id ? 'border-primary bg-primary/10 shadow-glow-sm' : 'border-border/60 surface-inset hover:border-border'}`}
                      >
                        <p className="font-display font-bold text-sm tracking-tight">{TIPO_LABEL[v.tipo_veiculo]} · {v.nome_veiculo}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {v.km_por_litro ? `${v.km_por_litro} km/L` : 'sem combustível'}
                          {v.custo_fixo_mensal > 0 ? ` · R$ ${v.custo_fixo_mensal.toFixed(0)}/mês` : ''}
                        </p>
                      </button>
                    ))}
                    <button onClick={() => { setPickerOpen(false); setVehiclesOpen(true); }} className="w-full p-2.5 rounded-xl border border-dashed border-border/80 text-xs text-primary font-display font-semibold hover:bg-primary/5 press">
                      + Adicionar veículo
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {new Date().getHours() < 5 && (
                      <button onClick={() => setStep('date')} className="flex-1 p-2.5 rounded-xl surface-inset border border-border/60 text-xs font-display font-semibold press">Voltar</button>
                    )}
                    <button
                      disabled={!pickedVehicleId}
                      onClick={() => setStep('app')}
                      className="flex-1 h-11 rounded-xl bg-brand-gradient text-primary-foreground font-display font-bold text-sm disabled:opacity-40 disabled:shadow-none shadow-glow-sm press transition-all"
                    >
                      Continuar
                    </button>
                  </div>
                </>
              )}

              {step === 'app' && (
                <>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold flex items-center gap-1.5">
                      <Smartphone size={11} /> Última etapa
                    </p>
                    <h3 className="font-display font-bold text-base">Qual app você vai usar?</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {APPS.map(a => (
                      <button
                        key={a}
                        onClick={() => setPickedApp(a)}
                        className={`p-3 rounded-xl text-sm font-display font-semibold border press transition-colors ${pickedApp === a ? 'border-primary bg-primary/10 text-primary shadow-glow-sm' : 'border-border/60 surface-inset text-foreground hover:border-border'}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setStep('vehicle')} className="flex-1 p-2.5 rounded-xl surface-inset border border-border/60 text-xs font-display font-semibold press">Voltar</button>
                    <button
                      disabled={!pickedApp}
                      onClick={finalizeStart}
                      className="flex-1 h-11 rounded-xl bg-brand-gradient text-primary-foreground font-display font-bold text-sm disabled:opacity-40 disabled:shadow-none shadow-glow press transition-all flex items-center justify-center gap-1.5"
                    >
                      <Play size={14} fill="currentColor" /> Iniciar turno
                    </button>
                  </div>
                </>
              )}

              <button onClick={() => setPickerOpen(false)} className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1.5 font-display">Cancelar</button>

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
  const thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...(settingsService.get().alertThresholds || {}) };
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
    gps === 'tracking' ? { icon: <Satellite size={10} className="animate-pulse" />, label: 'GPS ativo', cls: 'text-profit bg-profit/10 border-profit/30' } :
    gps === 'background' ? { icon: <Satellite size={10} />, label: 'Segundo plano', cls: 'text-warning bg-warning/10 border-warning/30' } :
    gps === 'requesting' ? { icon: <Satellite size={10} />, label: 'Conectando…', cls: 'text-info bg-info/10 border-info/30' } :
    gps === 'paused' ? { icon: <Pause size={10} />, label: 'GPS pausado', cls: 'text-muted-foreground bg-secondary border-border/60' } :
    gps === 'denied' ? { icon: <MapPinOff size={10} />, label: 'GPS negado', cls: 'text-loss bg-loss/10 border-loss/30' } :
    gps === 'unavailable' ? { icon: <MapPinOff size={10} />, label: 'Sem GPS', cls: 'text-muted-foreground bg-secondary border-border/60' } :
    { icon: <Satellite size={10} />, label: '...', cls: 'text-muted-foreground bg-secondary border-border/60' };


  // Tempo desde a última posição GPS (para UX honesta + banner de background longo)
  const gapMs = lastFixAt ? Date.now() - lastFixAt : null;
  const gapSec = gapMs != null ? Math.floor(gapMs / 1000) : null;
  const longBackgroundGap = gps === 'background' || (gapSec != null && gapSec > 60);
  const needsBackgroundPermission = isNativePlatform && hasBackgroundGpsConsent() && !bgVerified && gps !== 'denied' && gps !== 'unavailable';
  const needsNotificationPermission = isNativePlatform && hasBackgroundGpsConsent()
    && !!bgPermissionStatus?.notificationPermissionRequired
    && !bgPermissionStatus.notificationPermissionGranted;
  const fmtGap = (s: number) => s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s/60)}min` : `${Math.floor(s/3600)}h${String(Math.floor((s%3600)/60)).padStart(2,'0')}`;

  // === MODO FOCO ===
  if (focus) {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col p-6 animate-fade-in-up">
        {/* Glow ambiente */}
        <div className={`absolute inset-x-0 top-0 h-64 blur-3xl opacity-40 pointer-events-none ${pausado ? 'bg-warning/20' : lucroOk ? 'bg-primary/25' : 'bg-loss/25'}`} />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-dot ${pausado ? 'bg-warning' : 'bg-profit'}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${pausado ? 'bg-warning' : 'bg-profit'}`} />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold leading-none">
                {pausado ? 'Turno pausado' : 'Modo foco'}
              </p>
              <p className="font-display font-bold text-[13px] font-mono-num leading-tight mt-0.5">{tempoLive}</p>
            </div>
          </div>
          <button onClick={() => setFocus(false)} aria-label="Sair do modo foco" className="p-2.5 rounded-xl surface-inset border border-border/60 text-foreground hover:bg-secondary/80 press">
            <Minimize2 size={18} />
          </button>
        </div>

        <div className="relative flex-1 flex flex-col items-center justify-center text-center gap-8">
          <div>
            <p className="text-label">Lucro real agora</p>
            <p className={`text-[72px] leading-none font-display font-bold font-mono-num mt-3 ${lucroOk ? 'text-profit' : 'text-loss'}`}>
              {fmt(t.lucro_total)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
            <KpiTile icon={<Clock size={12} />} label="Tempo" value={tempoLive} />
            <KpiTile icon={<Navigation size={12} />} label="Km" value={t.km_total.toFixed(1)} />
            <KpiTile icon={<Wallet size={12} />} label="Corridas" value={String(t.corridas_total)} />
          </div>
          {meta && meta.meta > 0 && (
            <div className="w-full max-w-sm">
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-label inline-flex items-center gap-1"><Target size={10} /> Meta</span>
                <span className="font-display font-bold font-mono-num">{meta.pct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 surface-inset rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${meta.atingida ? 'bg-profit-gradient' : 'bg-info-gradient'}`} style={{ width: `${meta.pct}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="relative space-y-2">
          <button onClick={openRide} className="w-full h-14 rounded-2xl bg-brand-gradient text-primary-foreground font-display font-bold text-[15px] tracking-tight flex items-center justify-center gap-2 shadow-glow press">
            <Plus size={20} strokeWidth={2.5} /> Registrar corrida
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handlePause} className="h-12 rounded-xl surface-inset border border-border/60 text-foreground font-display font-semibold text-[13px] flex items-center justify-center gap-2 press">
              {pausado ? <><Play size={14} /> Retomar</> : <><Pause size={14} /> Pausar</>}
            </button>
            <button onClick={handleEnd} className="h-12 rounded-xl bg-loss/15 border border-loss/40 text-loss font-display font-semibold text-[13px] flex items-center justify-center gap-2 press">
              <Square size={14} /> Finalizar
            </button>
          </div>
        </div>

        {rideOpen && renderRideModal()}
      </div>
    );
  }


  // === HERO NORMAL — Cockpit do turno ===
  return (
    <>
      <div className="relative rounded-2xl p-5 surface-1 border border-border/60 space-y-4 overflow-hidden shadow-premium">
        {/* Faixa lateral de status */}
        <div className={`absolute inset-y-0 left-0 w-1 ${pausado ? 'bg-warning' : lucroOk ? 'bg-brand-gradient' : 'bg-loss-gradient'}`} />
        {/* Glow ambiente */}
        <div className={`absolute -top-16 -right-16 w-48 h-48 blur-3xl rounded-full opacity-30 pointer-events-none ${pausado ? 'bg-warning/30' : lucroOk ? 'bg-primary/30' : 'bg-loss/30'}`} />

        {/* Top: status + actions */}
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            {/* Status row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-pulse-dot ${pausado ? 'bg-warning' : 'bg-profit'}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${pausado ? 'bg-warning' : 'bg-profit'}`} />
              </span>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">
                {pausado ? 'Turno pausado' : 'Turno ativo'}
              </p>
              <span className="text-[10px] text-muted-foreground font-display font-mono-num">
                {fmtHora(shift.inicio_turno)} · {tempoLive}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-display font-semibold inline-flex items-center gap-1 border ${gpsBadge.cls}`}>
                {gpsBadge.icon} {gpsBadge.label}
              </span>
              {gapSec != null && (gps === 'tracking' || gps === 'background') && (
                <span className="text-[9px] text-muted-foreground font-display font-mono-num">
                  · {fmtGap(gapSec)}
                </span>
              )}
            </div>

            {/* Lucro hero */}
            <div>
              <p className="text-label">Lucro real agora</p>
              <p className={`text-[42px] leading-none font-display font-bold font-mono-num mt-1.5 ${lucroOk ? 'text-profit' : 'text-loss'}`}>
                {fmt(t.lucro_total)}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground truncate font-display">
              {veh ? `${TIPO_LABEL[veh.tipo_veiculo]} · ${veh.nome_veiculo}` : 'Sem veículo'}
              {shift.app_utilizado && ` · ${shift.app_utilizado}`}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button onClick={() => setFocus(true)} title="Modo foco" className="p-2.5 rounded-xl surface-inset border border-border/60 text-foreground hover:bg-secondary/80 press">
              <Maximize2 size={14} />
            </button>
            <button onClick={handleEnd} className="p-2.5 rounded-xl bg-loss/15 border border-loss/40 text-loss hover:bg-loss/25 press" title="Finalizar turno">
              <Square size={14} fill="currentColor" />
            </button>
          </div>
        </div>

        {/* 4 KPIs ao vivo */}
        <div className="relative grid grid-cols-4 gap-2">
          <KpiTile icon={<Clock size={11} />} label="Tempo" value={tempoLive} />
          <KpiTile icon={<Navigation size={11} />} label="Km" value={t.km_total.toFixed(1)} />
          <KpiTile icon={<Wallet size={11} />} label="Corridas" value={String(t.corridas_total)} />
          <KpiTile icon={<Zap size={11} />} label="R$/km" value={rPorKm.toFixed(2)} />
        </div>

        {/* Meta */}
        {meta && meta.meta > 0 && (
          <div className="relative">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-label inline-flex items-center gap-1"><Target size={10} /> Meta diária</span>
              <span className="font-display font-bold font-mono-num">
                {meta.pct.toFixed(0)}% {meta.atingida ? '· atingida' : `· faltam ${fmt(meta.faltam)}`}
              </span>
            </div>
            <div className="h-1.5 surface-inset rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-500 ${meta.atingida ? 'bg-profit-gradient shadow-glow-sm' : 'bg-info-gradient'}`} style={{ width: `${meta.pct}%` }} />
            </div>
          </div>
        )}


        {/* Alertas — estilo banner premium com stripe lateral, sem saturar */}
        {needsBackgroundPermission && (
          <AlertBanner
            tone="warning"
            icon={<MapPinOff size={14} />}
            title="GPS limitado ao app aberto"
            body={<>Toque para habilitar <strong>"Permitir o tempo todo"</strong>. Sem isso, o Android pausa o GPS quando a tela bloqueia.</>}
            cta="Abrir ajustes"
            onClick={openSettingsClick}
          />
        )}

        {needsNotificationPermission && (
          <AlertBanner
            tone="info"
            icon={<Bell size={14} />}
            title="Notificação do turno pendente"
            body="Ela mantém o GPS ativo durante o turno e some ao finalizar. Sem ela, o Android pode cortar o tracking em segundo plano."
            cta="Permitir"
            onClick={async () => {
              const status = await requestNotificationPermissionIfNeeded();
              setBgPermissionStatus(status);
              if (!status.notificationPermissionGranted) {
                const ok = await openNotificationSettings();
                if (!ok) toast.error('Abra manualmente: Ajustes do celular → Apps → Visionário Drive → Notificações → Permitir');
              }
            }}
          />
        )}

        {(gps === 'denied' || gps === 'unavailable') && (
          <AlertBanner
            tone="warning"
            icon={<MapPinOff size={14} />}
            title="Modo manual ativo"
            body={gps === 'denied'
              ? 'GPS negado. Informe o km de cada corrida ao registrar — o cálculo continua funcionando.'
              : 'GPS indisponível. Informe o km manualmente em cada corrida.'}
            cta={gps === 'denied' ? 'Tentar de novo' : undefined}
            onClick={gps === 'denied' ? () => requestGpsPermission() : undefined}
          />
        )}

        {longBackgroundGap && !bgVerified && gps !== 'denied' && gps !== 'unavailable' && gps !== 'paused' && (
          <AlertBanner
            tone="warning"
            icon={<Satellite size={14} />}
            title="Tracking em segundo plano reduzido"
            body={<>
              {gapSec != null && gapSec > 5 ? `Sem nova posição há ${fmtGap(gapSec)}. ` : ''}
              Navegadores pausam o GPS quando o app sai do foco. Mantenha o app aberto para precisão máxima — o tracking retoma automaticamente ao voltar.
            </>}
          />
        )}

        {smartAlerts.length > 0 && (
          <div className="relative space-y-1.5">
            {smartAlerts.map(a => (
              <AlertBanner key={a.key} tone="warning" icon={<Target size={14} />} title="" body={a.msg} />
            ))}
          </div>
        )}

        {/* Mensagem motivadora */}
        <p className={`relative text-[11px] text-center font-display font-medium ${pausado ? 'text-warning' : lucroOk ? 'text-profit' : 'text-loss'}`}>
          {pausado ? 'Turno pausado — toque em retomar para continuar.'
            : t.corridas_total === 0 ? 'Toque em registrar corrida para começar.'
            : lucroOk ? 'Você está indo bem.' : 'Atenção — seu lucro caiu.'}
        </p>


        {/* Mapa ao vivo (opt-in) */}
        {showMap && (shift.rota?.length ?? 0) > 0 && (
          <div className="relative space-y-2">
            <ShiftLiveMap shift={shift} />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={async () => { (await exportRouteGpx(shift)) ? toast.success('GPX exportado') : toast('Rota muito curta'); }}
                className="h-9 rounded-lg surface-inset border border-border/60 text-foreground text-[11px] font-display font-semibold flex items-center justify-center gap-1.5 press"
              ><MapIcon size={12}/> Exportar GPX</button>
              <button
                onClick={async () => { (await exportRouteKml(shift)) ? toast.success('KML exportado') : toast('Rota muito curta'); }}
                className="h-9 rounded-lg surface-inset border border-border/60 text-foreground text-[11px] font-display font-semibold flex items-center justify-center gap-1.5 press"
              ><MapIcon size={12}/> Exportar KML</button>
            </div>
          </div>
        )}

        {/* Actions principais */}
        <div className="relative grid grid-cols-4 gap-2">
          <button onClick={handlePause} title={pausado ? 'Retomar' : 'Pausar'} className="h-12 rounded-xl surface-inset border border-border/60 text-foreground font-display font-semibold text-sm flex items-center justify-center press">
            {pausado ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            onClick={() => setShowMap(v => !v)}
            title={showMap ? 'Ocultar mapa' : 'Mostrar mapa'}
            className={`h-12 rounded-xl font-display font-semibold text-sm flex items-center justify-center press ${showMap ? 'bg-primary/15 text-primary border border-primary/40 shadow-glow-sm' : 'surface-inset border border-border/60 text-foreground'}`}
          >
            <MapIcon size={16} />
          </button>
          <button
            onClick={openRide}
            disabled={pausado}
            className="col-span-2 h-12 rounded-xl bg-brand-gradient text-primary-foreground font-display font-bold flex items-center justify-center gap-2 shadow-glow press disabled:opacity-50 disabled:shadow-none"
          >
            <Plus size={18} strokeWidth={2.5} /> Registrar corrida
          </button>
        </div>

        {/* Últimas corridas */}
        {activeRides.length > 0 && (
          <div className="relative space-y-1.5 pt-1">
            <p className="text-label">Últimas corridas</p>
            <div className="space-y-1">
              {activeRides.slice(0, 5).map(rideModelToShiftRide).map(r => {
                const dotCls = r.resultado === 'boa' ? 'bg-profit' : r.resultado === 'aceitavel' ? 'bg-warning' : 'bg-loss';
                return (
                  <div key={r.corrida_id} className="flex items-center gap-2 surface-inset border border-border/40 rounded-lg px-2.5 py-2 text-[12px]">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
                    <span className="font-display font-semibold font-mono-num">{fmt(r.valor)}</span>
                    <span className="text-muted-foreground font-mono-num text-[11px]">
                      {r.km.toFixed(1)} km
                    </span>
                    {r.edicoes && r.edicoes.length > 0 && (
                      <span title="Corrida editada" className="text-[9px] text-warning">✎</span>
                    )}
                    <span className="font-display font-bold font-mono-num text-[11px] ml-auto">{fmt(r.valor_por_km)}/km</span>
                    <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-primary press" title="Editar"><Pencil size={11} /></button>
                    <button onClick={() => handleDeleteRide(r)} className="text-muted-foreground hover:text-loss press" title="Remover"><X size={11} /></button>
                  </div>
                );
              })}
            </div>
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
        onAccept={async () => {
          saveBackgroundGpsConsent();
          // eslint-disable-next-line no-console
          console.info('[ShiftMode] Background GPS consent aceito', { turnoId: bgConsentTurnoId });
          try { gpsTelemetry.event('bg_consent_accepted', { turnoId: bgConsentTurnoId }); } catch { /* noop */ }
          setBgConsentOpen(false);
          const notificationStatus = await requestNotificationPermissionIfNeeded();
          setBgPermissionStatus(notificationStatus);

          const bgStatus = await requestBackgroundLocationPermissionIfPossible();
          setBgPermissionStatus(bgStatus);
          if (bgStatus.backgroundLocationGranted) {
            setBgVerified(true);
            lastBgVerifiedRef.current = true;
          } else {
            // Android 11+: o sistema NÃO oferece "Permitir o tempo todo" no diálogo padrão —
            // é preciso enviar o usuário pra tela de Configurações do app.
            toast('Falta 1 passo: "Permitir o tempo todo"', {
              description: 'Toque em "Abrir ajustes" → Permissões → Localização → "Permitir o tempo todo". Sem isso, o Android pausa o GPS quando você bloqueia a tela.',
              duration: 15000,
              action: {
                label: 'Abrir ajustes',
                onClick: async () => {
                  const ok = await openAppLocationSettings();
                  try { gpsTelemetry.event('bg_open_settings_clicked', { turnoId: bgConsentTurnoId, from: 'consent-toast' }); } catch { /* noop */ }
                  if (!ok) {
                    // eslint-disable-next-line no-console
                    console.warn('[ShiftMode] openSettings falhou');
                    toast.error('Abra manualmente: Ajustes do celular → Apps → Visionário Drive → Permissões → Localização → "Permitir o tempo todo"');
                  }
                },
              },
            });
            await syncBackgroundPermission('background-consent-accepted');
          }

          // Reinício explícito do watcher para re-selecionar o provider sem alterar estado do turno.
          try { gpsTelemetry.event('bg_restart_bounce_requested', { turnoId: bgConsentTurnoId, method: 'restartSignal' }); } catch { /* noop */ }
          setTrackerRestartSignal(v => v + 1);
        }}
        onDecline={() => {
          declineBackgroundGpsConsent();
          // eslint-disable-next-line no-console
          console.info('[ShiftMode] Background GPS consent recusado', { turnoId: bgConsentTurnoId });
          try { gpsTelemetry.event('bg_consent_declined', { turnoId: bgConsentTurnoId }); } catch { /* noop */ }
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
