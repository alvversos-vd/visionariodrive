import { useMemo, useState, useEffect } from 'react';
import { goalsService } from '@/lib/services/goalsService';
import { settingsService } from '@/lib/services/settingsService';
import { metricsService } from '@/lib/services/metricsService';
import { rideService } from '@/lib/services/rideService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lightbulb, AlertTriangle, TrendingUp } from 'lucide-react';

interface Props {
  refresh: number;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SimulatorView({ refresh }: Props) {
  const entries = useMemo(() => rideService.listEntries(), [refresh]);
  const goals = useMemo(() => goalsService.get(), [refresh]);
  const settings = useMemo(() => settingsService.get(), [refresh]);
  const stats = useMemo(() => metricsService.statsFor(entries, goals.daily), [entries, goals.daily]);

  const today = stats.todayEntry;
  const costPerKm = today && today.kmDriven > 0 ? today.totalCost / today.kmDriven : 0;
  const minIdealKm = costPerKm * settings.profitMargin;

  // Simulator inputs
  const [valuePerKm, setValuePerKm] = useState('');
  const [kmEstimated, setKmEstimated] = useState('');
  const [costEstimated, setCostEstimated] = useState('');

  // Pre-fill cost with today's costPerKm * km when km changes (only if user hasn't typed)
  const [costTouched, setCostTouched] = useState(false);
  useEffect(() => {
    if (!costTouched && kmEstimated && costPerKm > 0) {
      const k = parseFloat(kmEstimated);
      if (k > 0) setCostEstimated((k * costPerKm).toFixed(2));
    }
  }, [kmEstimated, costPerKm, costTouched]);

  const sim = useMemo(() => {
    const v = parseFloat(valuePerKm) || 0;
    const k = parseFloat(kmEstimated) || 0;
    const c = parseFloat(costEstimated) || 0;
    const earn = v * k;
    const profit = earn - c;
    return { earn, profit, valid: v > 0 && k > 0 };
  }, [valuePerKm, kmEstimated, costEstimated]);

  // Strategy messages
  const tips: { type: 'warn' | 'info' | 'good'; msg: string }[] = [];

  if (today) {
    const valuePerKmAvg = today.kmDriven > 0 ? today.totalEarnings / today.kmDriven : 0;
    if (minIdealKm > 0 && valuePerKmAvg < minIdealKm && valuePerKmAvg > 0) {
      tips.push({
        type: 'warn',
        msg: `Você está aceitando corridas abaixo do ideal. Média ${fmt(valuePerKmAvg)}/km vs mínimo ${fmt(minIdealKm)}/km.`,
      });
    }
    if (goals.daily > 0 && today.profit < goals.daily * 0.5) {
      tips.push({
        type: 'warn',
        msg: 'Seu lucro está abaixo do esperado para a meta diária.',
      });
    }
    if (today.profit < 0) {
      tips.push({ type: 'warn', msg: 'Você está com prejuízo hoje. Reveja custos e valor por km.' });
    }
    if (goals.daily > 0 && today.profit >= goals.daily) {
      tips.push({ type: 'good', msg: 'Meta batida! Excelente desempenho hoje.' });
    }
  }

  if (stats.costChangePct !== null && stats.costChangePct > 15) {
    tips.push({
      type: 'warn',
      msg: `Seus custos subiram ${stats.costChangePct.toFixed(0)}% vs semana passada.`,
    });
  }

  if (stats.bestDayOfWeek) {
    tips.push({
      type: 'info',
      msg: `Seu melhor dia costuma ser ${stats.bestDayOfWeek.day} (média ${fmt(stats.bestDayOfWeek.avg)}).`,
    });
  }

  if (entries.length === 0) {
    tips.push({
      type: 'info',
      msg: 'Faça seu primeiro cálculo diário para receber estratégias personalizadas.',
    });
  }

  const tipStyle = {
    warn: { icon: AlertTriangle, color: 'text-loss', bg: 'bg-loss/10 border-loss/30' },
    info: { icon: Lightbulb, color: 'text-accent', bg: 'bg-accent/10 border-accent/30' },
    good: { icon: TrendingUp, color: 'text-profit', bg: 'bg-profit/10 border-profit/30' },
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Estratégia */}
      <div className="space-y-2">
        <p className="font-display font-semibold text-foreground px-1">💡 Estratégia</p>
        {tips.map((t, i) => {
          const cfg = tipStyle[t.type];
          const Icon = cfg.icon;
          return (
            <div key={i} className={`rounded-lg p-3 border ${cfg.bg} flex gap-2.5 items-start`}>
              <Icon size={18} className={`${cfg.color} flex-shrink-0 mt-0.5`} />
              <p className="text-sm text-foreground">{t.msg}</p>
            </div>
          );
        })}
      </div>

      {/* Simulador */}
      <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
        <div>
          <p className="font-display font-semibold text-foreground">🧮 Simulador de jornada</p>
          <p className="text-xs text-muted-foreground">Estime ganhos e lucro de uma jornada futura.</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Valor médio por km</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={valuePerKm}
                onChange={e => setValuePerKm(e.target.value)}
                placeholder={minIdealKm > 0 ? minIdealKm.toFixed(2) : '1.50'}
                className="pl-9 h-12 text-base"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Km estimados</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={kmEstimated}
              onChange={e => setKmEstimated(e.target.value)}
              placeholder="120"
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">
              Custo estimado {costPerKm > 0 && !costTouched && '(auto)'}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={costEstimated}
                onChange={e => {
                  setCostEstimated(e.target.value);
                  setCostTouched(true);
                }}
                placeholder="60"
                className="pl-9 h-12 text-base"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Resultado simulação */}
      {sim.valid && (
        <div className="grid grid-cols-2 gap-3 animate-slide-up">
          <div className="bg-card rounded-lg p-4 border shadow-sm">
            <p className="text-xs text-muted-foreground">💰 Ganho estimado</p>
            <p className="text-xl font-display font-bold text-foreground">{fmt(sim.earn)}</p>
          </div>
          <div className={`rounded-lg p-4 border shadow-sm ${
            sim.profit > 0 ? 'bg-profit/10 border-profit/30' :
            sim.profit < 0 ? 'bg-loss/10 border-loss/30' : 'bg-card'
          }`}>
            <p className="text-xs text-muted-foreground">📈 Lucro estimado</p>
            <p className={`text-xl font-display font-bold ${
              sim.profit > 0 ? 'text-profit' : sim.profit < 0 ? 'text-loss' : 'text-foreground'
            }`}>{fmt(sim.profit)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
