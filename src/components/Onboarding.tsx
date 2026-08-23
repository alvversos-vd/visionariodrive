import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { vehicleService } from '@/lib/services/vehicleService';
import type { TipoVeiculo } from '@/lib/vehicles';
import type { AppEntrega } from '@/lib/services/vehicleService';
import { goalsService } from '@/lib/services/goalsService';
import { profileService } from '@/lib/services/profileService';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

type StepKey = 'welcome' | 'vehicle' | 'goal' | 'app' | 'objective' | 'done';

const VEHICLES: { key: TipoVeiculo; label: string; emoji: string }[] = [
  { key: 'moto', label: 'Moto', emoji: '🏍️' },
  { key: 'carro', label: 'Carro', emoji: '🚗' },
  { key: 'bike', label: 'Bike', emoji: '🚲' },
  { key: 'bike_eletrica', label: 'Bike elétrica', emoji: '⚡' },
];

const GOALS = [100, 200, 300, 500];

const APPS: AppEntrega[] = ['iFood', 'Uber', '99', 'Rappi', 'Lalamove', 'Mercado Livre', 'Outro'];

const OBJECTIVES = [
  { key: 'ganhar_mais', label: 'Ganhar mais', emoji: '💰' },
  { key: 'controlar_gastos', label: 'Controlar gastos', emoji: '🧾' },
  { key: 'evitar_prejuizo', label: 'Evitar prejuízo', emoji: '🛡️' },
  { key: 'bater_metas', label: 'Bater metas', emoji: '🎯' },
  { key: 'organizar_ganhos', label: 'Organizar meus ganhos', emoji: '📊' },
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

  useEffect(() => {
    console.info('[NOTIF-LIFECYCLE] Onboarding mounted', { userId: user?.id ?? null });
    return () => console.info('[NOTIF-LIFECYCLE] Onboarding unmounted', { userId: user?.id ?? null });
  }, [user?.id]);

  const idx = STEP_ORDER.indexOf(step);
  const progress = (idx / (STEP_ORDER.length - 1)) * 100;

  const next = () => setStep(STEP_ORDER[Math.min(idx + 1, STEP_ORDER.length - 1)]);

  const finalize = async () => {
    if (!user) return;
    console.info('[NOTIF-LIFECYCLE] Onboarding finalize started', { userId: user.id });
    setSaving(true);
    try {
      if (vehicle && !vehicleService.hasAny()) {
        vehicleService.add({
          tipo_veiculo: vehicle,
          nome_veiculo: VEHICLES.find(v => v.key === vehicle)?.label || 'Meu veículo',
          km_por_litro: vehicle === 'bike' || vehicle === 'bike_eletrica' ? null : 10,
          tipo_combustivel: vehicle === 'bike' ? 'nenhum' : vehicle === 'bike_eletrica' ? 'eletrico' : 'gasolina',
          valor_combustivel_litro: vehicle === 'bike' || vehicle === 'bike_eletrica' ? 0 : 6,
          custo_fixo_mensal: 0,
        });
      }
      if (app) vehicleService.setLastApp(app);
      const finalGoal = goal ?? (customGoal ? Number(customGoal) : 0);
      if (finalGoal > 0) {
        const g = goalsService.get();
        goalsService.save({ ...g, daily: finalGoal });
      }
      await profileService.markOnboarded(user.id, {
        tipo_veiculo_principal: vehicle,
        meta_lucro_diaria: finalGoal || null,
        app_principal: app,
        objetivo_principal: objective,
      });
      await refreshProfile();
      console.info('[NOTIF-LIFECYCLE] Onboarding profile refreshed', { userId: user.id });
      onFinish();
      console.info('[NOTIF-LIFECYCLE] Onboarding finalize completed', { userId: user.id });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Tente novamente';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const skipAll = async () => {
    if (!user) return;
    console.info('[NOTIF-LIFECYCLE] Onboarding skip started', { userId: user.id });
    setSaving(true);
    await profileService.update(user.id, { onboarding_completo: true });
    await refreshProfile();
    console.info('[NOTIF-LIFECYCLE] Onboarding skipped profile refreshed', { userId: user.id });
    onFinish();
    console.info('[NOTIF-LIFECYCLE] Onboarding skip completed', { userId: user.id });
  };

  const displayName = profile?.nome_usuario?.trim() || '';

  return (
    <div className="min-h-screen bg-hero flex flex-col px-4 py-6">
      <div className="container max-w-md mx-auto w-full flex-1 flex flex-col">
        {step !== 'welcome' && step !== 'done' && (
          <div className="mb-6 space-y-1.5">
            <div className="flex items-center justify-between text-micro uppercase tracking-[0.2em] font-display font-semibold text-muted-foreground">
              <span>Visionario Drive</span>
              <span className="number-tabular">{idx} / {STEP_ORDER.length - 1}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center animate-in fade-in duration-300" key={step}>
          {step === 'welcome' && (
            <div className="text-center space-y-6">
              <div className="text-6xl animate-pulse-dot">👊</div>
              <div>
                <h1 className="font-display text-3xl font-bold bg-gradient-to-br from-primary to-foreground bg-clip-text text-transparent">Vamos montar seu painel</h1>
                <p className="text-muted-foreground mt-2">
                  Responda rápido e personalize sua experiência{displayName ? `, ${displayName}` : ''}.
                </p>
              </div>
              <Button size="lg" className="w-full bg-info-gradient text-info-foreground hover:opacity-90 shadow-premium" onClick={next}>Começar</Button>
              <button onClick={skipAll} className="text-sm text-muted-foreground hover:text-foreground">
                Pular tudo
              </button>
            </div>
          )}

          {step === 'vehicle' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Qual seu veículo?</h2>
                <p className="text-muted-foreground text-sm mt-1">Vamos calcular seus custos certinho.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {VEHICLES.map(v => (
                  <Card
                    key={v.key}
                    onClick={() => { setVehicle(v.key); setTimeout(next, 150); }}
                    className={`p-5 cursor-pointer transition-all hover:border-primary text-center ${vehicle === v.key ? 'border-primary ring-2 ring-primary' : ''}`}
                  >
                    <div className="text-4xl mb-2">{v.emoji}</div>
                    <div className="font-display font-semibold">{v.label}</div>
                  </Card>
                ))}
              </div>
              <button onClick={next} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">Pular</button>
            </div>
          )}

          {step === 'goal' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Quanto quer lucrar por dia?</h2>
                <p className="text-muted-foreground text-sm mt-1">Sua meta de lucro líquido.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map(g => (
                  <Card
                    key={g}
                    onClick={() => { setGoal(g); setCustomGoal(''); setTimeout(next, 150); }}
                    className={`p-5 cursor-pointer transition-all hover:border-primary text-center ${goal === g ? 'border-primary ring-2 ring-primary' : ''}`}
                  >
                    <div className="font-display text-2xl font-bold">R$ {g}</div>
                  </Card>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Personalizado (R$)"
                  value={customGoal}
                  onChange={e => { setCustomGoal(e.target.value); setGoal(null); }}
                />
                <Button onClick={next} disabled={!customGoal && !goal}>OK</Button>
              </div>
              <button onClick={next} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">Pular</button>
            </div>
          )}

          {step === 'app' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">Qual app você mais usa?</h2>
                <p className="text-muted-foreground text-sm mt-1">Você pode mudar depois.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {APPS.map(a => (
                  <Card
                    key={a}
                    onClick={() => { setApp(a); setTimeout(next, 150); }}
                    className={`p-4 cursor-pointer transition-all hover:border-primary text-center ${app === a ? 'border-primary ring-2 ring-primary' : ''}`}
                  >
                    <div className="font-display font-semibold">{a}</div>
                  </Card>
                ))}
              </div>
              <button onClick={next} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">Pular</button>
            </div>
          )}

          {step === 'objective' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold">O que quer melhorar?</h2>
                <p className="text-muted-foreground text-sm mt-1">Vamos focar no que importa pra você.</p>
              </div>
              <div className="grid gap-2">
                {OBJECTIVES.map(o => (
                  <Card
                    key={o.key}
                    onClick={() => { setObjective(o.key); setTimeout(next, 150); }}
                    className={`p-4 cursor-pointer transition-all hover:border-primary flex items-center gap-3 ${objective === o.key ? 'border-primary ring-2 ring-primary' : ''}`}
                  >
                    <div className="text-2xl">{o.emoji}</div>
                    <div className="font-display font-semibold">{o.label}</div>
                  </Card>
                ))}
              </div>
              <button onClick={next} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">Pular</button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center space-y-6">
              <div className="text-6xl animate-pulse-dot">👊</div>
              <div>
                <h1 className="font-display text-3xl font-bold bg-gradient-to-br from-profit to-foreground bg-clip-text text-transparent">Seu painel está pronto</h1>
                <p className="text-muted-foreground mt-2">Bora começar.</p>
              </div>
              <Button size="lg" className="w-full bg-profit-gradient text-primary-foreground hover:opacity-90 shadow-premium" onClick={finalize} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Começar turno
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
