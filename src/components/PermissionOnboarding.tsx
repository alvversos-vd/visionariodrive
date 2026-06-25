/**
 * Assistente de configuração de permissões.
 *
 * Doutrina:
 *  - Nunca bloqueia o uso. O usuário pode pular e usar modo manual.
 *  - Cada passo é validado pela leitura REAL das APIs nativas após o request.
 *  - Resiliente a fabricantes: se o pedido nativo falhar, mostra instrução
 *    textual + botão "Abrir configurações" e segue em frente.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Navigation, MapPin, Bell, BatteryCharging, ShieldCheck, ChevronRight, X, Wrench, Sparkles } from 'lucide-react';
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

const STEP_TITLES: Record<StepId, string> = {
  intro: 'Bem-vindo ao Visionário Drive',
  location: 'Localização do aparelho',
  background: 'Rastreamento em segundo plano',
  notifications: 'Notificação do turno',
  battery: 'Bateria sem restrições',
  summary: 'Tudo pronto',
};

export default function PermissionOnboarding({ onDone }: Props) {
  const [step, setStep] = useState<StepId>('intro');
  const [d, setD] = useState<PermissionDiagnostic | null>(null);
  const [busy, setBusy] = useState(false);

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

  // ===== Steps =====
  const stepOrder: StepId[] = useMemo(() => {
    if (isWeb) return ['intro', 'location', 'summary'];
    const list: StepId[] = ['intro', 'location', 'background'];
    if (d?.notificationsRequired) list.push('notifications');
    list.push('battery', 'summary');
    return list;
  }, [isWeb, d?.notificationsRequired]);

  const goNext = () => {
    const i = stepOrder.indexOf(step);
    setStep(stepOrder[Math.min(stepOrder.length - 1, i + 1)]);
  };

  const handleLocation = async () => {
    setBusy(true);
    try {
      // Fonte da verdade: o próprio plugin nativo (callback pós-diálogo do Android)
      // ou Capacitor Geolocation em iOS/web. Não confiar só no clique do usuário.
      const after = await requestForegroundLocationPermissionIfPossible();
      let next = await refresh();
      // Rede de segurança: alguns aparelhos demoram a propagar checkSelfPermission
      // logo após o diálogo. Faz um polling curto antes de desistir.
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
        // Android 11+: prompt nativo não oferece "O tempo todo".
        const opened = await openAppLocationSettings();
        if (!opened) {
          toast.error('Abra manualmente: Ajustes → Apps → Visionário Drive → Permissões → Localização → "Permitir o tempo todo"', { duration: 9000 });
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

  // ===== Render =====
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl border-t sm:border max-h-[95vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 bg-card/95 backdrop-blur px-5 pt-4 pb-3 border-b flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-display font-semibold">Configuração inicial</p>
            <h2 className="font-display font-bold text-base truncate">{STEP_TITLES[step]}</h2>
          </div>
          <button onClick={skip} aria-label="Pular" className="p-2 -mr-2 text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {step === 'intro' && (
            <Section icon={<Sparkles className="text-primary" size={22} />} title="Sua gestão financeira no controle">
              <p>
                O Visionário é uma <strong>plataforma de gestão financeira</strong> para motoristas. O GPS é opcional e serve para automatizar km, tempo e rota.
              </p>
              <p className="text-muted-foreground">
                Vamos configurar 3 permissões para liberar o modo automático. Você pode pular e usar tudo manualmente — nada do financeiro depende disso.
              </p>
              <Primary onClick={goNext}>Começar configuração</Primary>
              <Secondary onClick={skip}>Pular e usar modo manual</Secondary>
            </Section>
          )}

          {step === 'location' && (
            <Section icon={<MapPin className="text-primary" size={22} />} title="Localização">
              <p>Permite que o app leia a posição do GPS para calcular km percorridos automaticamente.</p>
              <Status ok={!!d?.locationGranted} okLabel="Localização autorizada" pendingLabel="Aguardando autorização" />
              <Primary disabled={busy} onClick={handleLocation}>
                {d?.locationGranted ? 'Continuar' : 'Permitir localização'}
              </Primary>
              {d?.locationGranted && <Secondary onClick={goNext}>Continuar</Secondary>}
              <Secondary onClick={skip}>Pular configuração</Secondary>
            </Section>
          )}

          {step === 'background' && (
            <Section icon={<Navigation className="text-primary" size={22} />} title='"Permitir o tempo todo"'>
              <p>Sem essa permissão, o Android pausa o GPS quando a tela bloqueia. O cálculo automático de km depende dela.</p>
              <p className="text-muted-foreground text-xs">
                Em alguns aparelhos, o Android abre as configurações em vez de mostrar o diálogo. Marque <strong>"Permitir o tempo todo"</strong> e volte.
              </p>
              <Status ok={!!d?.backgroundLocationGranted} okLabel="Segundo plano autorizado" pendingLabel="Permitir o tempo todo" />
              <Primary disabled={busy} onClick={handleBackground}>
                {d?.backgroundLocationGranted ? 'Continuar' : 'Permitir o tempo todo'}
              </Primary>
              {d?.backgroundLocationGranted && <Secondary onClick={goNext}>Continuar</Secondary>}
              {isAndroidNative && (
                <Secondary onClick={async () => { await openAppLocationSettings(); }}>
                  Abrir configurações do Android
                </Secondary>
              )}
              <Secondary onClick={skip}>Pular configuração</Secondary>
            </Section>
          )}

          {step === 'notifications' && (
            <Section icon={<Bell className="text-primary" size={22} />} title="Notificação do turno">
              <p>Uma notificação fica visível enquanto o turno está ativo. Ela mantém o GPS rodando e some quando o turno encerra.</p>
              <Status ok={!!d?.notificationsGranted} okLabel="Notificações autorizadas" pendingLabel="Aguardando autorização" />
              <Primary disabled={busy} onClick={handleNotifications}>
                {d?.notificationsGranted ? 'Continuar' : 'Permitir notificações'}
              </Primary>
              {d?.notificationsGranted && <Secondary onClick={goNext}>Continuar</Secondary>}
              <Secondary onClick={skip}>Pular configuração</Secondary>
            </Section>
          )}

          {step === 'battery' && (
            <Section icon={<BatteryCharging className="text-primary" size={22} />} title="Bateria sem restrições">
              <p>Pede para o Android não suspender o app por economia de bateria durante o turno. Recomendado em Samsung, Xiaomi, Motorola e Realme.</p>
              <Status ok={!!d?.batteryOptimizationDisabled} okLabel="Sem restrições" pendingLabel="Recomendado" />
              <Primary disabled={busy} onClick={handleBattery}>
                {d?.batteryOptimizationDisabled ? 'Continuar' : 'Solicitar permissão'}
              </Primary>
              <Secondary onClick={goNext}>Pular esse passo</Secondary>
            </Section>
          )}

          {step === 'summary' && d && (
            <Section
              icon={d.trackingMode === 'automatic' ? <ShieldCheck className="text-profit" size={22} /> : <Wrench className="text-accent" size={22} />}
              title={d.trackingMode === 'automatic' ? '🟢 Automação ativa' : '🟡 Modo manual ativo'}
            >
              {d.trackingMode === 'automatic' ? (
                <p>Tudo pronto. Km, tempo e rota serão registrados automaticamente durante o turno.</p>
              ) : (
                <>
                  <p>Você pode usar o app normalmente em modo manual. Para registrar uma corrida em menos de 10 segundos, basta tocar no botão <strong>+</strong> e informar valor e km.</p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                    {d.reasons.map(r => <li key={r}>{r}</li>)}
                  </ul>
                </>
              )}
              <Primary onClick={() => finish(d.trackingMode)}>
                {d.trackingMode === 'automatic' ? 'Começar a usar' : 'Continuar em modo manual'}
              </Primary>
              {d.trackingMode === 'manual' && (
                <Secondary onClick={() => setStep('location')}>Tentar configurar novamente</Secondary>
              )}
            </Section>
          )}
        </div>

        <Progress current={stepOrder.indexOf(step)} total={stepOrder.length} />
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">{icon}</div>
        <h3 className="font-display font-bold text-lg leading-tight mt-1">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full p-3.5 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-50"
    >
      {children} <ChevronRight size={16} />
    </button>
  );
}

function Secondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full p-2.5 rounded-xl bg-secondary text-foreground font-display font-semibold text-xs hover:bg-secondary/80 transition-colors">
      {children}
    </button>
  );
}

function Status({ ok, okLabel, pendingLabel }: { ok: boolean; okLabel: string; pendingLabel: string }) {
  return (
    <p className={`text-xs font-display font-semibold inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md ${ok ? 'text-profit bg-profit/10' : 'text-accent bg-accent/10'}`}>
      {ok ? '✓' : '○'} {ok ? okLabel : pendingLabel}
    </p>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  const pct = ((current + 1) / total) * 100;
  return (
    <div className="px-5 pb-4">
      <div className="h-1 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 text-center font-display">Passo {current + 1} de {total}</p>
    </div>
  );
}
