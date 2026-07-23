import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { goalsService, type Goals } from '@/lib/services/goalsService';
import { settingsService } from '@/lib/services/settingsService';
import { metricsService } from '@/lib/services/metricsService';
import { rideService } from '@/lib/services/rideService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sparkles, EyeOff, Target, TrendingUp, Calendar, CalendarDays } from 'lucide-react';

interface Props {
  refresh: number;
  onSaved: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const MOTIVATIONAL = [
  'Foco até bater a meta 🎯',
  'Você está no controle 💪',
  'Cada corrida é um passo 🚀',
  'Disciplina vence talento 🔥',
  'Resultado é consequência 📈',
];

export default function GoalsView({ refresh, onSaved }: Props) {
  const entries = useMemo(() => { void refresh; return rideService.listEntries(); }, [refresh]);
  const settings = useMemo(() => { void refresh; return settingsService.get(); }, [refresh]);
  const initialGoals = useMemo(() => { void refresh; return goalsService.get(); }, [refresh]);
  const [goals, setGoals] = useState<Goals>(initialGoals);
  const [focusMode, setFocusMode] = useState(false);
  const [phrase, setPhrase] = useState(MOTIVATIONAL[0]);

  useEffect(() => setGoals(initialGoals), [initialGoals]);

  useEffect(() => {
    if (!focusMode) return;
    const id = setInterval(() => {
      setPhrase(MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]);
    }, 4000);
    return () => clearInterval(id);
  }, [focusMode]);

  const stats = useMemo(() => metricsService.statsFor(entries, goals.daily), [entries, goals.daily]);
  const today = stats.todayEntry;
  const todayProfit = today?.profit ?? 0;

  const dailyProgress = goals.daily > 0 ? Math.min(100, (todayProfit / goals.daily) * 100) : 0;
  const weeklyProgress = goals.weekly > 0 ? Math.min(100, (stats.weekProfit / goals.weekly) * 100) : 0;

  const monthProfit = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return entries.filter(e => new Date(e.date).getTime() >= cutoff).reduce((s, e) => s + e.profit, 0);
  }, [entries]);
  const monthlyProgress = goals.monthly > 0 ? Math.min(100, (monthProfit / goals.monthly) * 100) : 0;

  const missing = Math.max(0, goals.daily - todayProfit);
  const costPerKm = today && today.kmDriven > 0 ? today.totalCost / today.kmDriven : 0;
  const minIdealKm = costPerKm * settings.profitMargin;
  const kmNeeded = minIdealKm > 0 ? missing / minIdealKm : 0;

  const status: 'good' | 'ok' | 'bad' = todayProfit >= goals.daily && goals.daily > 0
    ? 'good'
    : dailyProgress >= 70
    ? 'ok'
    : 'bad';
  const statusMsg = {
    good: { emoji: '🟢', label: 'Meta batida — dia excelente', cls: 'text-profit' },
    ok: { emoji: '🟡', label: 'Falta pouco para bater a meta', cls: 'text-accent' },
    bad: { emoji: '🔴', label: 'Ajuste sua estratégia', cls: 'text-loss' },
  }[status];

  const handleSave = () => {
    goalsService.save(goals);
    toast.success('Metas salvas 👊');
    onSaved();
  };

  if (focusMode) {
    return (
      <div className="space-y-6 animate-fade-in text-center py-6">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setFocusMode(false)} className="gap-1.5">
            <EyeOff size={14} /> Sair do Modo Foco
          </Button>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Meta diária</p>
          <p className="text-2xl font-display font-bold mt-1 number-tabular">{fmt(goals.daily)}</p>
        </div>
        <div className="bg-gradient-to-br from-card to-secondary/30 rounded-2xl p-8 border border-border/60 shadow-premium">
          <p className={`text-7xl font-display font-bold number-tabular ${dailyProgress >= 100 ? 'text-profit' : 'text-primary'}`}>{dailyProgress.toFixed(0)}%</p>
          <div className="w-full bg-secondary/60 rounded-full h-3 overflow-hidden mt-5">
            <div className={`h-full transition-all duration-700 ${dailyProgress >= 100 ? 'bg-profit-gradient' : 'bg-info-gradient'}`} style={{ width: `${dailyProgress}%` }} />
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Faltam</p>
          <p className="text-3xl font-display font-bold mt-1 number-tabular">{fmt(missing)}</p>
          {kmNeeded > 0 && (
            <p className="text-sm text-muted-foreground mt-2">≈ {kmNeeded.toFixed(0)} km no ritmo ideal</p>
          )}
        </div>
        <p className="text-base font-display font-semibold text-primary mt-6 animate-pulse-dot">{phrase}</p>
      </div>
    );
  }

  const ringDeg = Math.min(360, dailyProgress * 3.6);
  const ringColor = dailyProgress >= 100 ? 'hsl(var(--profit))' : dailyProgress >= 70 ? 'hsl(var(--accent))' : 'hsl(var(--primary))';

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Hero diário com anel de progresso */}
      <div className="relative overflow-hidden rounded-2xl bg-hero border border-border/60 p-5 shadow-premium">
        <div className="flex items-center gap-4">
          <div
            className="relative h-24 w-24 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: `conic-gradient(${ringColor} ${ringDeg}deg, hsl(var(--secondary)) ${ringDeg}deg)`,
            }}
          >
            <div className="absolute inset-1.5 rounded-full bg-card flex flex-col items-center justify-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Hoje</p>
              <p className="text-lg font-display font-bold number-tabular">{dailyProgress.toFixed(0)}%</p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold flex items-center gap-1">
              <Target size={10}/> Meta diária
            </p>
            {goals.daily > 0 ? (
              <>
                <p className="text-2xl font-display font-bold number-tabular leading-tight">{fmt(todayProfit)}</p>
                <p className="text-[11px] text-muted-foreground number-tabular">de {fmt(goals.daily)}</p>
                <p className={`text-[11px] font-display font-semibold mt-1 ${statusMsg.cls}`}>
                  {statusMsg.emoji} {statusMsg.label}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Defina sua meta diária abaixo.</p>
            )}
          </div>
        </div>
        {goals.daily > 0 && missing > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="bg-card/70 border border-border/40 rounded-lg p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Faltam</p>
              <p className="font-display font-bold number-tabular">{fmt(missing)}</p>
            </div>
            {kmNeeded > 0 && (
              <div className="bg-card/70 border border-border/40 rounded-lg p-2.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">≈ Km ideais</p>
                <p className="font-display font-bold number-tabular">{kmNeeded.toFixed(0)} km</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        onClick={() => setFocusMode(true)}
        size="lg"
        className="w-full h-12 font-display font-semibold gap-2 bg-info-gradient text-info-foreground hover:opacity-90 shadow-premium"
      >
        <Sparkles size={18} /> Modo Visionário
      </Button>

      {/* Semana e mês */}
      <div className="grid grid-cols-1 gap-3">
        <ProgressBlock
          label="Semana"
          icon={Calendar}
          current={stats.weekProfit}
          goal={goals.weekly}
          progress={weeklyProgress}
        />
        <ProgressBlock
          label="Mês"
          icon={CalendarDays}
          current={monthProfit}
          goal={goals.monthly}
          progress={monthlyProgress}
        />
      </div>

      {/* Definir metas */}
      <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-primary"/>
          <p className="font-display font-semibold">Definir metas</p>
        </div>
        <GoalInput label="Meta diária" value={goals.daily} onChange={v => setGoals(g => ({ ...g, daily: v }))} />
        <GoalInput label="Meta semanal" value={goals.weekly} onChange={v => setGoals(g => ({ ...g, weekly: v }))} />
        <GoalInput label="Meta mensal" value={goals.monthly} onChange={v => setGoals(g => ({ ...g, monthly: v }))} />
        <Button onClick={handleSave} className="w-full h-11 font-display font-semibold">
          Salvar metas
        </Button>
      </div>
    </div>
  );
}

function ProgressBlock({
  label, icon: Icon, current, goal, progress,
}: { label: string; icon: typeof Target; current: number; goal: number; progress: number }) {
  const empty = goal <= 0;
  const done = current >= goal && goal > 0;
  return (
    <div className="bg-card rounded-xl p-4 border border-border/60 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-display font-semibold flex items-center gap-1.5"><Icon size={14} className="text-muted-foreground"/> {label}</p>
        {!empty && <p className={`text-xs font-display font-semibold number-tabular ${done ? 'text-profit' : 'text-muted-foreground'}`}>{progress.toFixed(0)}%</p>}
      </div>
      {empty ? (
        <p className="text-xs text-muted-foreground">Defina uma meta para acompanhar.</p>
      ) : (
        <>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${done ? 'bg-profit-gradient' : 'bg-info-gradient'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 number-tabular">
            <span className="font-bold text-foreground">{fmt(current)}</span> de {fmt(goal)}
          </p>
        </>
      )}
    </div>
  );
}

function GoalInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={value || ''}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="pl-9 h-10 number-tabular"
        />
      </div>
    </div>
  );
}
