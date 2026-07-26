import { useMemo } from 'react';
import { DailyEntry } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  entries: DailyEntry[];
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function avg(entries: DailyEntry[]) {
  if (entries.length === 0) return { profit: 0, cost: 0, profitPerKm: 0, days: 0 };
  const sumProfit = entries.reduce((s, e) => s + e.profit, 0);
  const sumCost = entries.reduce((s, e) => s + e.totalCost, 0);
  const sumKm = entries.reduce((s, e) => s + e.kmDriven, 0);
  return {
    profit: sumProfit / entries.length,
    cost: sumCost / entries.length,
    profitPerKm: sumKm > 0 ? sumProfit / sumKm : 0,
    days: entries.length,
  };
}

function pctChange(curr: number, base: number): number | null {
  if (base === 0) return null;
  return ((curr - base) / Math.abs(base)) * 100;
}

interface RowProps {
  label: string;
  weekVal: number;
  monthVal: number;
  pct: number | null;
  invertColors?: boolean; // for cost: lower is better
}

function Row({ label, weekVal, monthVal, pct, invertColors }: RowProps) {
  let color = 'text-muted-foreground';
  let Icon = Minus;
  if (pct !== null && Math.abs(pct) >= 0.5) {
    const positive = invertColors ? pct < 0 : pct > 0;
    color = positive ? 'text-profit' : 'text-loss';
    Icon = pct > 0 ? TrendingUp : TrendingDown;
  }
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-display font-semibold text-foreground">
          {fmt(weekVal)} <span className="text-micro text-muted-foreground font-normal">vs {fmt(monthVal)}</span>
        </p>
      </div>
      <div className={`flex items-center gap-1 font-display font-bold text-sm ${color}`}>
        <Icon size={14} />
        {pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
      </div>
    </div>
  );
}

export default function PeriodComparison({ entries }: Props) {
  const { week, month, profitPct, costPct, perKmPct } = useMemo(() => {
    const today = startOfDay(new Date());
    const last7 = entries.filter(e => {
      const d = (today.getTime() - startOfDay(new Date(e.date)).getTime()) / 86400000;
      return d >= 0 && d < 7;
    });
    const last30 = entries.filter(e => {
      const d = (today.getTime() - startOfDay(new Date(e.date)).getTime()) / 86400000;
      return d >= 0 && d < 30;
    });
    const week = avg(last7);
    const month = avg(last30);
    return {
      week,
      month,
      profitPct: pctChange(week.profit, month.profit),
      costPct: pctChange(week.cost, month.cost),
      perKmPct: pctChange(week.profitPerKm, month.profitPerKm),
    };
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display font-semibold text-foreground text-sm">⚖️ 7 dias vs 30 dias</p>
        <p className="text-micro text-muted-foreground">média/dia</p>
      </div>
      {week.days === 0 || month.days === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">Dados insuficientes para comparar.</p>
      ) : (
        <div className="space-y-1">
          <Row label="Lucro" weekVal={week.profit} monthVal={month.profit} pct={profitPct} />
          <Row label="Custo" weekVal={week.cost} monthVal={month.cost} pct={costPct} invertColors />
          <Row label="Lucro por km" weekVal={week.profitPerKm} monthVal={month.profitPerKm} pct={perKmPct} />
        </div>
      )}
    </div>
  );
}
