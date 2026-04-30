import { useMemo, useState, useEffect } from 'react';
import { getEntries, getGoals, getSettings, saveGoals } from '@/lib/storage';
import { computeStats, Goals } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Sparkles, Eye, EyeOff } from 'lucide-react';

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
  const entries = useMemo(() => getEntries(), [refresh]);
  const settings = useMemo(() => getSettings(), [refresh]);
  const initialGoals = useMemo(() => getGoals(), [refresh]);
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

  const stats = useMemo(() => computeStats(entries, goals.daily), [entries, goals.daily]);
  const today = stats.todayEntry;
  const todayEarnings = today?.totalEarnings ?? 0;
  const todayProfit = today?.profit ?? 0;

  const dailyProgress = goals.daily > 0 ? Math.min(100, (todayProfit / goals.daily) * 100) : 0;
  const weeklyProgress = goals.weekly > 0 ? Math.min(100, (stats.weekProfit / goals.weekly) * 100) : 0;

  // Monthly: last 30 days profit
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
    good: { emoji: '🟢', label: 'Dia excelente — meta batida!', bg: 'bg-profit' },
    ok: { emoji: '🟡', label: 'Falta pouco', bg: 'bg-accent' },
    bad: { emoji: '🔴', label: 'Ajuste sua estratégia', bg: 'bg-loss' },
  }[status];

  const handleSave = () => {
    saveGoals(goals);
    onSaved();
  };

  if (focusMode) {
    return (
      <div className="space-y-6 animate-slide-up text-center py-8">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setFocusMode(false)} className="gap-1.5">
            <EyeOff size={14} /> Sair do Modo Foco
          </Button>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Meta diária</p>
          <p className="text-2xl font-display font-bold text-foreground mt-1">{fmt(goals.daily)}</p>
        </div>
        <div className="bg-card rounded-2xl p-8 border shadow-lg">
          <p className="text-7xl font-display font-bold text-primary">{dailyProgress.toFixed(0)}%</p>
          <div className="w-full bg-secondary rounded-full h-3 overflow-hidden mt-4">
            <div className="h-full bg-primary transition-all" style={{ width: `${dailyProgress}%` }} />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Faltam</p>
          <p className="text-3xl font-display font-bold text-foreground mt-1">{fmt(missing)}</p>
          {kmNeeded > 0 && (
            <p className="text-sm text-muted-foreground mt-2">≈ {kmNeeded.toFixed(0)} km no ritmo ideal</p>
          )}
        </div>
        <p className="text-base font-display font-medium text-primary mt-8">{phrase}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <Button
        onClick={() => setFocusMode(true)}
        size="lg"
        className="w-full h-12 font-display font-semibold gap-2"
        variant="default"
      >
        <Sparkles size={18} /> Modo Visionário
      </Button>

      {/* Daily progress */}
      <div className="bg-card rounded-lg p-5 border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="font-display font-semibold text-foreground">📊 Hoje</p>
          <p className="text-xs text-muted-foreground">{dailyProgress.toFixed(0)}%</p>
        </div>
        <div className="w-full bg-secondary rounded-full h-3 overflow-hidden mb-3">
          <div
            className={`h-full transition-all ${todayProfit >= goals.daily && goals.daily > 0 ? 'bg-profit' : 'bg-primary'}`}
            style={{ width: `${dailyProgress}%` }}
          />
        </div>
        {goals.daily > 0 ? (
          <>
            <p className="text-sm text-foreground">
              <span className="font-display font-bold">{fmt(todayProfit)}</span>
              <span className="text-muted-foreground"> de {fmt(goals.daily)}</span>
            </p>
            {missing > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                💰 Faltam <span className="text-foreground font-semibold">{fmt(missing)}</span>
                {kmNeeded > 0 && <> · 🚗 ≈ {kmNeeded.toFixed(0)} km</>}
              </p>
            )}
            <div className={`mt-3 rounded-md px-3 py-2 ${statusMsg.bg}`}>
              <p className="text-sm font-medium text-primary-foreground">
                {statusMsg.emoji} {statusMsg.label}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Defina sua meta diária abaixo.</p>
        )}
      </div>

      {/* Week + Month */}
      <div className="grid grid-cols-1 gap-3">
        <ProgressBlock label="📅 Semana" current={stats.weekProfit} goal={goals.weekly} progress={weeklyProgress} />
        <ProgressBlock label="🗓️ Mês" current={monthProfit} goal={goals.monthly} progress={monthlyProgress} />
      </div>

      {/* Goal inputs */}
      <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
        <p className="font-display font-semibold text-foreground">🎯 Definir metas</p>
        <GoalInput label="Meta diária" value={goals.daily} onChange={v => setGoals(g => ({ ...g, daily: v }))} />
        <GoalInput label="Meta semanal" value={goals.weekly} onChange={v => setGoals(g => ({ ...g, weekly: v }))} />
        <GoalInput label="Meta mensal" value={goals.monthly} onChange={v => setGoals(g => ({ ...g, monthly: v }))} />
        <Button onClick={handleSave} className="w-full h-11 font-display font-semibold">
          Salvar Metas
        </Button>
      </div>
    </div>
  );
}

function ProgressBlock({ label, current, goal, progress }: { label: string; current: number; goal: number; progress: number }) {
  if (goal <= 0) {
    return (
      <div className="bg-card rounded-lg p-4 border shadow-sm">
        <p className="text-sm font-display font-semibold text-foreground mb-1">{label}</p>
        <p className="text-xs text-muted-foreground">Defina uma meta para acompanhar.</p>
      </div>
    );
  }
  return (
    <div className="bg-card rounded-lg p-4 border shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-display font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{progress.toFixed(0)}%</p>
      </div>
      <div className="w-full bg-secondary rounded-full h-2 overflow-hidden mb-1.5">
        <div
          className={`h-full transition-all ${current >= goal ? 'bg-profit' : 'bg-primary'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-bold text-foreground">{fmt(current)}</span> de {fmt(goal)}
      </p>
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
          className="pl-9 h-10"
        />
      </div>
    </div>
  );
}
