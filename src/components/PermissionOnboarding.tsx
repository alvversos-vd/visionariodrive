/**
 * Assistente de configuração de permissões — versão premium.
 *
 * Doutrina:
 *  - Nunca bloqueia o uso. O usuário pode pular e usar modo manual.
 *  - Cada passo é validado pela leitura REAL das APIs nativas após o request.
 *  - Resiliente a fabricantes: se o pedido nativo falhar, mostra instrução
 *    textual + botão "Abrir configurações" e segue em frente.
 *
 * UX:
 *  - Linguagem visual idêntica ao Dashboard/Cockpit (mesmo design system).
 *  - Sensação de assistente guiado, não de popup de permissões.
 *  - Hero com brand glow, micro-step indicator, status pills consistentes.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Navigation, MapPin, Bell, BatteryCharging, ShieldCheck, ChevronRight,
  X, Wrench, Sparkles, Check, ArrowLeft, ExternalLink,
} from 'lucide-react';
import {
  refreshPermissionDiagnostic,
  markOnboardingCompleted,
  requestIgnoreBatteryOptimization,
  type PermissionDiagnostic,
} from '@/lib/permissionDiagnostic';
import {
  requestForegroundLocationPermissionIfPossible,
  requestBackgroundLocationPermissionIfPossible,
  requestNotificationPermissionIfNeeded,
  openAppLocationSettings,
  openNotificationSettings,
} from '@/lib/bgPermission';
import { pushBlockingModal } from '@/lib/uiModalState';

interface Props {
  onDone: (mode: 'automatic' | 'manual') => void;
}

type StepId = 'intro' | 'location' | 'background' | 'notifications' | 'battery' | 'summary';

const STEP_META: Record<StepId, { eyebrow: string; title: string }> = {
  intro:         { eyebrow: 'Configuração inicial', title: 'Bem-vindo ao Visionário' },
  location:      { eyebrow: 'Permissão 1 de 3',    title: 'Localização do aparelho' },
  background:    { eyebrow: 'Permissão 2 de 3',    title: 'Rastreio em segundo plano' },
  notifications: { eyebrow: 'Permissão 3 de 3',    title: 'Notificação do turno' },
  battery:       { eyebrow: 'Opcional',             title: 'Bateria sem restrições' },
  summary:       { eyebrow: 'Tudo pronto',          title: 'Configuração concluída' },
};

export default function PermissionOnboarding({ onDone }: Props) {
  const [step, setStep] = useState<StepId>('intro');
  const [d, setD] = useState<PermissionDiagnostic | null>(null);
  const [busy, setBusy] = useState(false);
  // Sprint 10.6 — GPS é capacidade exclusiva do PRO. No START o assistente
  // NUNCA apresenta passos de localização nem solicita essa permissão.
  const { gps: gpsEnabled } = useCapabilities();

  useEffect(() => {
    const release = pushBlockingModal();
    void refreshPermissionDiagnostic().then(setD);
    return () => { release(); };
  }, []);

  const isAndroidNative = d?.platform === 'android';
  const isWeb = d?.platform === 'web' || !d;

  const refresh = async () => {
    const next = await refreshPermissionDiagnostic();
    setD(next);
    return next;
  };

  const finish = (mode: 'automatic' | 'manual') => {
    markOnboardingCompleted();
    onDone(mode);
  };

  const skip = () => finish('manual');

  const stepOrder: StepId[] = useMemo(() => {
    if (!gpsEnabled) {
      // START — apenas notificação (quando o sistema exigir) e conclusão.
      const list: StepId[] = ['intro'];
      if (!isWeb && d?.notificationsRequired) list.push('notifications');
      list.push('summary');
      return list;
    }
    if (isWeb) return ['intro', 'location', 'summary'];
    const list: StepId[] = ['intro', 'location', 'background'];
    if (d?.notificationsRequired) list.push('notifications');
    list.push('battery', 'summary');
    return list;
  }, [gpsEnabled, isWeb, d?.notificationsRequired]);


  const currentIndex = stepOrder.indexOf(step);
  const goNext = () => setStep(stepOrder[Math.min(stepOrder.length - 1, currentIndex + 1)]);
  const goBack = () => setStep(stepOrder[Math.max(0, currentIndex - 1)]);

  const handleLocation = async () => {
    setBusy(true);
    try {
      const after = await requestForegroundLocationPermissionIfPossible();
      let next = await refresh();
      if (!next.locationGranted && after.foregroundLocationGranted) {
        for (let i = 0; i < 5 && !next.locationGranted; i++) {
          await new Promise(r => setTimeout(r, 250));
          next = await refresh();
        }
      }
      if (next.locationGranted || after.foregroundLocationGranted) {
        toast.success('Localização autorizada');
        goNext();
      } else {
        toast('Permissão não concedida — você pode seguir em modo manual.');
      }
    } finally { setBusy(false); }
  };

  const handleBackground = async () => {
    setBusy(true);
    try {
      await requestBackgroundLocationPermissionIfPossible();
      const next = await refresh();
      if (next.backgroundLocationGranted) {
        toast.success('Localização em segundo plano autorizada');
        goNext();
      } else {
        const opened = await openAppLocationSettings();
        if (!opened) {
          toast.error('Abra: Ajustes → Apps → Visionário Drive → Permissões → Localização → "Permitir o tempo todo"', { duration: 9000 });
        }
      }
    } finally { setBusy(false); }
  };

  const handleNotifications = async () => {
    setBusy(true);
    try {
      const status = await requestNotificationPermissionIfNeeded();
      const next = await refresh();
      if (status.notificationPermissionGranted || next.notificationsGranted) {
        toast.success('Notificações autorizadas');
        goNext();
      } else {
        const opened = await openNotificationSettings();
        if (!opened) toast('Você pode habilitar depois nas configurações.');
      }
    } finally { setBusy(false); }
  };

  const handleBattery = async () => {
    setBusy(true);
    try {
      const ok = await requestIgnoreBatteryOptimization();
      const next = await refresh();
      if (ok || next.batteryOptimizationDisabled) {
        toast.success('Bateria sem restrições para o app');
      }
      goNext();
    } finally { setBusy(false); }
  };

  const meta = STEP_META[step];

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        key={step}
        className="
          surface-1 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl
          border-t border-border/60 sm:border shadow-premium
          max-h-[95vh] overflow-y-auto
          pb-[max(1.25rem,env(safe-area-inset-bottom))]
          animate-fade-in-up
        "
      >
        {/* Header */}
        <div className="sticky top-0 z-10 surface-1/95 backdrop-blur-xl px-5 pt-4 pb-3 border-b border-border/40 flex items-center gap-3">
          {currentIndex > 0 && step !== 'summary' ? (
            <button
              onClick={goBack}
              aria-label="Voltar"
              className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 press transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-brand-gradient flex items-center justify-center shadow-glow-sm">
              <span className="font-display font-bold text-[15px] text-primary-foreground leading-none">V</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">
              {meta.eyebrow}
            </p>
            <h2 className="font-display font-bold text-[15px] truncate leading-tight">{meta.title}</h2>
          </div>
          <button
            onClick={skip}
            aria-label="Pular"
            className="p-2 -mr-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 press transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-6 pb-2">
          {step === 'intro' && (
            <Intro onStart={goNext} onSkip={skip} />
          )}

          {step === 'location' && (
            <Step
              icon={<MapPin size={28} className="text-primary" />}
              eyebrow="Necessário para automação"
              title="Permita acessar sua localização"
              body="O Visionário usa o GPS para calcular automaticamente os km percorridos a cada corrida. Sem isso, você ainda pode lançar km manualmente."
              ok={!!d?.locationGranted}
              okLabel="Localização autorizada"
              pendingLabel="Aguardando autorização"
              primaryLabel={d?.locationGranted ? 'Continuar' : 'Permitir localização'}
              onPrimary={d?.locationGranted ? goNext : handleLocation}
              busy={busy}
              onSkip={skip}
            />
          )}

          {step === 'background' && (
            <Step
              icon={<Navigation size={28} className="text-primary" />}
              eyebrow={isAndroidNative ? 'Android exige passo manual' : 'Necessário para tela bloqueada'}
              title={'Marque "Permitir o tempo todo"'}
              body={
                <>
                  Sem esta permissão, o Android <strong className="text-foreground">pausa o GPS</strong> quando você bloqueia a tela. Toque abaixo — pode ser que o Android abra direto a tela de Ajustes. Selecione <strong className="text-foreground">"Permitir o tempo todo"</strong> e volte ao app.
                </>
              }
              ok={!!d?.backgroundLocationGranted}
              okLabel="Segundo plano autorizado"
              pendingLabel='"Permitir o tempo todo" pendente'
              primaryLabel={d?.backgroundLocationGranted ? 'Continuar' : 'Permitir o tempo todo'}
              primaryIcon={!d?.backgroundLocationGranted && isAndroidNative ? <ExternalLink size={16} /> : undefined}
              onPrimary={d?.backgroundLocationGranted ? goNext : handleBackground}
              busy={busy}
              onSkip={skip}
              secondary={
                isAndroidNative && !d?.backgroundLocationGranted ? {
                  label: 'Abrir configurações do Android',
                  onClick: async () => { await openAppLocationSettings(); },
                } : undefined
              }
            />
          )}

          {step === 'notifications' && (
            <Step
              icon={<Bell size={28} className="text-primary" />}
              eyebrow="Mantém o turno vivo"
              title="Notificação persistente do turno"
              body="Uma notificação fica visível enquanto o turno está ativo — ela mantém o GPS rodando no segundo plano. Some automaticamente quando você encerra."
              ok={!!d?.notificationsGranted}
              okLabel="Notificações autorizadas"
              pendingLabel="Aguardando autorização"
              primaryLabel={d?.notificationsGranted ? 'Continuar' : 'Permitir notificações'}
              onPrimary={d?.notificationsGranted ? goNext : handleNotifications}
              busy={busy}
              onSkip={skip}
            />
          )}

          {step === 'battery' && (
            <Step
              icon={<BatteryCharging size={28} className="text-primary" />}
              eyebrow="Recomendado"
              title="Bateria sem restrições"
              body="Pede ao Android para não suspender o app durante o turno. Essencial em Samsung, Xiaomi, Motorola e Realme — esses fabricantes matam apps em segundo plano para economizar bateria."
              ok={!!d?.batteryOptimizationDisabled}
              okLabel="Sem restrições"
              pendingLabel="Recomendado para fabricantes agressivos"
              primaryLabel={d?.batteryOptimizationDisabled ? 'Continuar' : 'Solicitar permissão'}
              onPrimary={d?.batteryOptimizationDisabled ? goNext : handleBattery}
              busy={busy}
              onSkip={goNext}
              skipLabel="Pular este passo"
            />
          )}

          {step === 'summary' && d && (
            <Summary diagnostic={d} onFinish={() => finish(d.trackingMode)} onRetry={() => setStep('location')} />
          )}
        </div>

        {/* Progress */}
        <Progress current={currentIndex} total={stepOrder.length} />
      </div>
    </div>
  );
}

/* ============================================================
   Sub-components
   ============================================================ */

function Intro({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-hero p-6 text-center">
        <div className="absolute inset-x-0 -top-20 h-40 bg-primary/20 blur-3xl opacity-60 pointer-events-none" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow animate-pulse-glow">
            <Sparkles size={28} className="text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-display font-bold text-xl tracking-tight">Sua gestão financeira no controle</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O Visionário é uma <strong className="text-foreground">plataforma financeira</strong> para motoristas. O GPS é opcional — serve apenas para automatizar km, tempo e rota.
            </p>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        <p className="text-label">O que vamos configurar</p>
        <div className="space-y-2">
          <BulletRow icon={<MapPin size={14} />} title="Localização" desc="Cálculo automático de km" />
          <BulletRow icon={<Navigation size={14} />} title="Segundo plano" desc="GPS continua com tela bloqueada" />
          <BulletRow icon={<Bell size={14} />} title="Notificação" desc="Indica que o turno está ativo" />
        </div>
      </div>

      <div className="space-y-2">
        <PrimaryButton onClick={onStart}>Começar configuração</PrimaryButton>
        <GhostButton onClick={onSkip}>Pular — usar em modo manual</GhostButton>
      </div>
    </div>
  );
}

function Step({
  icon, eyebrow, title, body, ok, okLabel, pendingLabel,
  primaryLabel, primaryIcon, onPrimary, busy, onSkip, skipLabel, secondary,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  ok: boolean;
  okLabel: string;
  pendingLabel: string;
  primaryLabel: string;
  primaryIcon?: React.ReactNode;
  onPrimary: () => void;
  busy: boolean;
  onSkip: () => void;
  skipLabel?: string;
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="space-y-6">
      {/* Hero compacto */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-hero p-5">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex items-start gap-4">
          <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border ${ok ? 'bg-profit/10 border-profit/30' : 'bg-primary/10 border-primary/20'}`}>
            {ok ? <Check size={26} className="text-profit" strokeWidth={2.5} /> : icon}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold mb-1">
              {eyebrow}
            </p>
            <h3 className="font-display font-bold text-[17px] leading-tight tracking-tight">{title}</h3>
          </div>
        </div>
      </div>

      {/* Body */}
      <p className="text-sm text-muted-foreground leading-relaxed px-1">{body}</p>

      {/* Status pill */}
      <StatusPill ok={ok} okLabel={okLabel} pendingLabel={pendingLabel} />

      {/* Actions */}
      <div className="space-y-2">
        <PrimaryButton onClick={onPrimary} disabled={busy} icon={primaryIcon}>
          {primaryLabel}
        </PrimaryButton>
        {secondary && (
          <SecondaryButton onClick={secondary.onClick}>{secondary.label}</SecondaryButton>
        )}
        <GhostButton onClick={onSkip}>{skipLabel ?? 'Pular configuração'}</GhostButton>
      </div>
    </div>
  );
}

function Summary({
  diagnostic, onFinish, onRetry,
}: { diagnostic: PermissionDiagnostic; onFinish: () => void; onRetry: () => void }) {
  const isAuto = diagnostic.trackingMode === 'automatic';
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-hero p-6 text-center">
        <div className={`absolute inset-x-0 -top-20 h-40 blur-3xl opacity-50 pointer-events-none ${isAuto ? 'bg-profit/30' : 'bg-warning/20'}`} />
        <div className="relative flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 ${isAuto ? 'bg-profit/10 border-profit/40 shadow-glow-sm' : 'bg-warning/10 border-warning/30'}`}>
            {isAuto
              ? <ShieldCheck size={30} className="text-profit" strokeWidth={2.5} />
              : <Wrench size={28} className="text-warning" strokeWidth={2.5} />}
          </div>
          <div className="space-y-1.5">
            <h3 className="font-display font-bold text-xl tracking-tight">
              {isAuto ? 'Automação ativa' : 'Modo manual ativo'}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isAuto
                ? 'Tudo pronto. Km, tempo e rota serão registrados automaticamente durante o turno.'
                : 'O app funciona normalmente em modo manual — basta tocar no + para lançar uma corrida em segundos.'}
            </p>
          </div>
        </div>
      </div>

      {!isAuto && diagnostic.reasons.length > 0 && (
        <div className="space-y-2">
          <p className="text-label">Pendências detectadas</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {diagnostic.reasons.map(r => (
              <li key={r} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-warning mt-1.5 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <PrimaryButton onClick={onFinish}>
          {isAuto ? 'Começar a usar' : 'Continuar em modo manual'}
        </PrimaryButton>
        {!isAuto && <GhostButton onClick={onRetry}>Tentar configurar novamente</GhostButton>}
      </div>
    </div>
  );
}

/* ============================================================
   Atoms
   ============================================================ */

function BulletRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl surface-inset border border-border/40">
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold text-sm leading-tight">{title}</p>
        <p className="text-caption text-muted-foreground leading-tight mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function StatusPill({ ok, okLabel, pendingLabel }: { ok: boolean; okLabel: string; pendingLabel: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${ok
      ? 'bg-profit/10 border-profit/30 text-profit'
      : 'bg-warning/10 border-warning/30 text-warning'}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-profit' : 'bg-warning animate-pulse-dot'}`} />
      <span className="font-display font-semibold text-xs tracking-tight">
        {ok ? okLabel : pendingLabel}
      </span>
    </div>
  );
}

function PrimaryButton({
  children, onClick, disabled, icon,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        w-full h-12 rounded-xl bg-brand-gradient text-primary-foreground
        font-display font-bold text-sm tracking-tight
        flex items-center justify-center gap-2
        shadow-glow-sm press
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        transition-all
      "
    >
      {children}
      {icon ?? <ChevronRight size={16} strokeWidth={2.5} />}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="
        w-full h-11 rounded-xl surface-inset border border-border/60
        font-display font-semibold text-sm text-foreground
        flex items-center justify-center gap-2
        hover:bg-secondary/80 press transition-colors
      "
    >
      <ExternalLink size={14} />
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="
        w-full h-10 rounded-lg
        font-display font-medium text-xs text-muted-foreground
        hover:text-foreground hover:bg-secondary/40 press transition-colors
      "
    >
      {children}
    </button>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="px-5 pt-3 pb-1">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i < current ? 'bg-primary/70'
              : i === current ? 'bg-brand-gradient shadow-glow-sm'
              : 'bg-border/50'
            }`}
          />
        ))}
      </div>
      <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground mt-2 text-center font-display font-semibold">
        Passo {current + 1} de {total}
      </p>
    </div>
  );
}
