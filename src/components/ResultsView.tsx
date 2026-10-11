import { type LucideIcon, Banknote, Fuel, TrendingDown, Receipt, Clock, Route, CircleCheck, CircleX, Target, AlertTriangle } from 'lucide-react';
import { DailyEntry } from '@/lib/types';
import { goalsService } from '@/lib/services/goalsService';
import { Button } from '@/components/ui/button';

interface Props {
  entry: DailyEntry;
  onBack: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatCard({ icon: Icon, label, value, highlight }: {
  icon: LucideIcon; label: string; value: string; highlight?: 'profit' | 'loss';
}) {
  const colorClass = highlight === 'profit' ? 'text-profit' : highlight === 'loss' ? 'text-loss' : 'text-foreground';
  return (
    <div className="bg-card rounded-lg p-4 border shadow-sm flex items-center gap-3">
      <Icon aria-hidden="true" size={24} className="shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-display font-bold ${colorClass}`}>{value}</p>
      </div>
    </div>
  );
}

export default function ResultsView({ entry, onBack }: Props) {
  const isProfit = entry.profit >= 0;
  const goalDaily = goalsService.getDaily();
  const alerts: string[] = [];

  if (entry.hoursWorked >= 10 && entry.profitPerHour < 10) {
    alerts.push('Seu esforço hoje foi alto, mas o lucro foi baixo.');
  }
  if (entry.totalCost > entry.totalEarnings * 0.6) {
    alerts.push('Seu custo está impactando seu lucro.');
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Main profit card */}
      <div className={`rounded-xl p-6 text-center shadow-lg ${isProfit ? 'bg-profit' : 'bg-loss'}`}>
        <p className="text-sm font-medium text-primary-foreground/80">{isProfit ? <CircleCheck aria-hidden="true" size={20} className="inline-block align-middle mr-1.5" /> : <CircleX aria-hidden="true" size={20} className="inline-block align-middle mr-1.5" />}{isProfit ? 'Lucro Real' : 'Prejuízo no dia'}</p>
        <p className="text-4xl font-display font-bold text-primary-foreground mt-1">{fmt(entry.profit)}</p>
      </div>

      {/* Goal progress */}
      {goalDaily > 0 && (
        <div className="bg-card rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-muted-foreground mb-1"><Target aria-hidden="true" size=16 className="inline-block shrink-0 align-middle mr-1.5 text-primary" />Meta diária: {fmt(goalDaily)}</p>
          <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (entry.profit / goalDaily) * 100)}%` }}
            />
          </div>
          <p className="text-sm font-medium mt-1.5 text-foreground">
            {entry.profit >= goalDaily
              ? <><CircleCheck aria-hidden="true" size={16} className="inline-block align-middle mr-1" />Meta batida!</>
              : `Faltam ${fmt(goalDaily - entry.profit)}`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        <StatCard icon={Banknote} label="Ganho do dia" value={fmt(entry.totalEarnings)} />
        <StatCard icon={Fuel} label="Gasto com combustível" value={fmt(entry.fuelCost)} />
        <StatCard icon={TrendingDown} label="Custo fixo diário" value={fmt(entry.dailyFixedCost)} />
        <StatCard icon={Receipt} label="Custo total" value={fmt(entry.totalCost)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Clock} label="Lucro/hora" value={fmt(entry.profitPerHour)} highlight={isProfit ? 'profit' : 'loss'} />
        <StatCard icon={Route} label="Lucro/km" value={fmt(entry.profitPerKm)} highlight={isProfit ? 'profit' : 'loss'} />
      </div>

      {alerts.length > 0 && (
        <div className="bg-accent/10 border border-accent rounded-lg p-4 space-y-1">
          {alerts.map((a, i) => <p key={i} className="text-sm font-medium text-foreground"><AlertTriangle aria-hidden="true" size={16} className="inline-block align-middle mr-1 text-warning" />{a}</p>)}
        </div>
      )}

      <Button onClick={onBack} variant="outline" size="lg" className="w-full h-12 font-display">
        Novo Cálculo
      </Button>
    </div>
  );
}
