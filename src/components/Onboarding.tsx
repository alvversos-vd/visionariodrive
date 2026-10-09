import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BrandMark from '@/components/brand/BrandMark';
import { BRAND_NAME } from '@/assets/branding/logo';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { vehicleService } from '@/lib/services/vehicleService';
import type { TipoVeiculo } from '@/lib/vehicles';
import type { AppEntrega } from '@/lib/services/vehicleService';
import { goalsService } from '@/lib/services/goalsService';
import { profileService } from '@/lib/services/profileService';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Bike, Car, Check, CircleCheck, Loader2, Receipt, ShieldCheck, Target, TrendingUp, Wallet, Zap, type LucideIcon } from 'lucide-react';

type StepKey = 'welcome' | 'vehicle' | 'goal' | 'app' | 'objective' | 'done';

const VEHICLES: { key: TipoVeiculo; label: string; icon: LucideIcon }[] = [
  { key: 'moto', label: 'Moto', icon: Bike },
  { key: 'carro', label: 'Carro', icon: Car },
  { key: 'bike', label: 'Bike', icon: Bike },
  { key: 'bike_eletrica', label: 'Bike elétrica', icon: Zap },
];

const GOALS = [100, 200, 300, 500];

const APPS: AppEntrega[] = ['iFood', 'Uber', '99', 'Rappi', 'Lalamove', 'Mercado Livre', 'Outro'];

const OBJECTIVES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'ganhar_mais', label: 'Ganhar mais', icon: TrendingUp },
  { key: 'controlar_gastos', label: 'Controlar gastos', icon: Receipt },
  { key: 'evitar_prejuizo', label: 'Evitar prejuízo', icon: ShieldCheck },
  { key: 'bater_metas', label: 'Bater metas', icon: Target },
  { key: 'organizar_ganhos', label: 'Organizar meus ganhos', icon: Wallet },
];

const STEP_ORDER: StepKey[] = ['welcome', 'vehicle', 'goal', 'app', 'objective', 'done'];

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<StepKey>('welcome');
  const [vehicle, setVehicle] = useState<TipoVeiculo | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const [customGoal, setCustomGoal] = useState('');
  const [app, setApp] = useState<AppEntrega | null>(null);
  const [objective, setObjective] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step !== 'welcome') headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    console.info('[NOTIF-LIFECYCLE] Onboarding mounted', { userId: user?.id ?? null });
    const titles: Record<StepKey, string> = {
    welcome: 'Vamos montar seu painel', vehicle: 'Qual seu veículo?',
    goal: 'Quanto quer lucrar por dia?', app: 'Qual app você mais usa?',
    objective: 'O que quer melhorar?', done: 'Tudo certo para começar?',
  };
  const descriptions: Record<StepKey, string> = {
    welcome: `Personalize sua experiência${displayName ? `, ${displayName}` : ''}.`,
    vehicle: 'Seu veículo ajuda a organizar os custos.', goal: 'Defina sua meta de lucro líquido.',
    app: 'Escolha o app que mais usa no dia a dia.', objective: 'Vamos focar no que importa para você.',
    done: 'Conclua para salvar suas preferências e entrar no painel.',
  };
  const labels = ['Boas-vindas', 'Veículo', 'Meta diária', 'Aplicativo', 'Objetivo', 'Concluir'];
  const choiceClass = (selected: boolean) => cn(
    'h-auto min-h-14 whitespace-normal rounded-lg border bg-card px-4 py-4 text-base text-foreground transition-colors duration-150 motion-reduce:transition-none hover:bg-secondary hover:border-primary/60',
    selected ? 'border-primary bg-primary/10 text-primary' : 'border-border',
  );
  const skip = <Button variant="ghost" className="min-h-11 w-full text-muted-foreground" onClick={next}>Pular por enquanto</Button>;

  return (
    <div className="min-h-screen supports-[height:100dvh]:min-h-dvh bg-background px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 lg:flex lg:items-center">
      <div className="mx-auto w-full max-w-4xl lg:grid lg:grid-cols-[1fr_1fr] lg:gap-16 lg:py-10">
        <header className="mb-8 lg:mb-0 lg:border-r lg:border-border lg:pr-12">
          <div className="mb-7 flex items-center gap-3">
            <BrandMark size="sm" glow="none" />
            <span className="font-display text-lg font-semibold text-foreground">{BRAND_NAME}</span>
          </div>
          <div className="mb-5 flex items-center justify-between text-xs text-muted-foreground">
            <span>{labels[idx]}</span><span className="number-tabular">{idx + 1} de {STEP_ORDER.length}</span>
          </div>
          <Progress value={progress} aria-label="Progresso da personalização" className="mb-7 h-1 [&>div]:transition-transform [&>div]:duration-200 motion-reduce:[&>div]:transition-none" />
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold leading-tight !tracking-normal sm:text-3xl focus-visible:shadow-none">{titles[step]}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{descriptions[step]}</p>
          {step !== 'welcome' && step !== 'done' && <p className="mt-4 text-xs text-muted-foreground">Opcional · você pode ajustar depois.</p>}
          <ol aria-label="Etapas" className="mt-9 hidden space-y-4 lg:block">
            {labels.map((label, index) => (
              <li key={label} aria-current={index === idx ? 'step' : undefined} className={cn('flex items-center gap-3 text-sm', index === idx ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs', index <= idx ? 'border-primary/50 text-primary' : 'border-border')}>
                  {index < idx ? <Check size={12} aria-hidden="true" /> : index + 1}
                </span>{label}
              </li>
            ))}
          </ol>
        </header>

        <main aria-label="Personalização" className="mx-auto w-full max-w-md lg:flex lg:min-h-[28rem] lg:flex-col lg:justify-center">
          <div key={step} className="animate-in fade-in duration-200 motion-reduce:animate-none">
            {step === 'welcome' && <div className="space-y-5">
              <div className="mb-8 flex items-center gap-4 border-y border-border py-6">
                <Target className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-muted-foreground">Seu veículo, sua meta e seu jeito de trabalhar.</p>
              </div>
              <Button size="lg" className="w-full bg-primary bg-none shadow-none" onClick={next}>Começar <ArrowRight aria-hidden="true" /></Button>
              <Button variant="ghost" className="w-full min-h-11 text-muted-foreground" onClick={skipAll} disabled={saving}>
                {saving && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />} {saving ? 'Concluindo…' : 'Pular tudo'}
              </Button>
            </div>}

            {step === 'vehicle' && <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {VEHICLES.map(v => <Button key={v.key} variant="outline" aria-pressed={vehicle === v.key} className={cn(choiceClass(vehicle === v.key), 'min-h-28 flex-col gap-3')} onClick={() => { setVehicle(v.key); next(); }}>
                  <v.icon className="!h-7 !w-7 text-primary" aria-hidden="true" />{v.label}
                </Button>)}
              </div>{skip}
            </div>}

            {step === 'goal' && <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map(g => <Button key={g} variant="outline" aria-pressed={goal === g} className={cn(choiceClass(goal === g), 'min-h-20 font-display text-xl')} onClick={() => { setGoal(g); setCustomGoal(''); next(); }}>R$ {g}</Button>)}
              </div>
              <div>
                <label htmlFor="onboarding-goal" className="mb-2 block text-sm font-medium">Outra meta (R$)</label>
                <div className="flex items-center gap-2">
                  <Input id="onboarding-goal" type="number" inputMode="numeric" placeholder="Valor diário" aria-describedby="goal-hint" className="h-12 min-w-0 bg-card text-base md:text-base" value={customGoal} onChange={e => { setCustomGoal(e.target.value); setGoal(null); }} />
                  <Button className="h-12 shrink-0 bg-primary bg-none shadow-none" onClick={next} disabled={!customGoal && !goal}>OK <ArrowRight aria-hidden="true" /></Button>
                </div>
                <p id="goal-hint" className="mt-2 text-xs text-muted-foreground">Meta de lucro líquido por dia.</p>
              </div>{skip}
            </div>}

            {step === 'app' && <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {APPS.map(a => <Button key={a} variant="outline" aria-pressed={app === a} className={choiceClass(app === a)} onClick={() => { setApp(a); next(); }}>{a}</Button>)}
              </div>{skip}
            </div>}

            {step === 'objective' && <div className="space-y-5">
              <div className="grid gap-3">
                {OBJECTIVES.map(o => <Button key={o.key} variant="outline" aria-pressed={objective === o.key} className={cn(choiceClass(objective === o.key), 'justify-start gap-3 text-left')} onClick={() => { setObjective(o.key); next(); }}>
                  <o.icon className="text-primary" aria-hidden="true" />{o.label}
                </Button>)}
              </div>{skip}
            </div>}

            {step === 'done' && <div className="space-y-6">
              <CircleCheck className="h-12 w-12 text-primary" aria-hidden="true" />
              <dl className="divide-y divide-border border-y border-border text-sm">
                {[
                  ['Veículo', VEHICLES.find(v => v.key === vehicle)?.label],
                  ['Meta diária', goal || customGoal ? `R$ ${goal ?? customGoal}` : null],
                  ['Aplicativo', app], ['Objetivo', OBJECTIVES.find(o => o.key === objective)?.label],
                ].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4 py-3"><dt className="shrink-0 text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-right text-foreground">{value || 'Não definido'}</dd></div>)}
              </dl>
              <Button size="lg" className="w-full bg-primary bg-none shadow-none" onClick={finalize} disabled={saving}>
                {saving ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check aria-hidden="true" />}
                {saving ? 'Salvando…' : 'Concluir e entrar'}
              </Button>
            </div>}
          </div>
          {step !== 'welcome' && <div className="mt-6 border-t border-border pt-3">
            <Button variant="ghost" className="min-h-11 text-muted-foreground" disabled={saving} onClick={() => setStep(STEP_ORDER[Math.max(idx - 1, 0)])}><ArrowLeft aria-hidden="true" /> Voltar</Button>
          </div>}
        </main>
      </div>
    </div>
  );
}
