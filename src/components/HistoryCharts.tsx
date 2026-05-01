import { useMemo, useState } from 'react';
import { DailyEntry } from '@/lib/types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface Props {
  entries: DailyEntry[];
}

type Range = 'week' | 'month';

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildDailySeries(entries: DailyEntry[], days: number) {
  const today = startOfDay(new Date());
  const buckets: { key: string; label: string; profit: number; cost: number; km: number; earnings: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    buckets.push({ key, label, profit: 0, cost: 0, km: 0, earnings: 0 });
  }
  const map = new Map(buckets.map(b => [b.key, b]));
  entries.forEach(e => {
    const key = startOfDay(new Date(e.date)).toISOString().slice(0, 10);
    const b = map.get(key);
    if (b) {
      b.profit += e.profit;
      b.cost += e.totalCost;
      b.km += e.kmDriven;
      b.earnings += e.totalEarnings;
    }
  });
  return buckets.map(b => ({
    label: b.label,
    Lucro: Math.round(b.profit * 100) / 100,
    Custo: Math.round(b.cost * 100) / 100,
    'Lucro/km': b.km > 0 ? Math.round((b.profit / b.km) * 100) / 100 : 0,
  }));
}

export default function HistoryCharts({ entries }: Props) {
  const [range, setRange] = useState<Range>('week');
  const data = useMemo(
    () => buildDailySeries(entries, range === 'week' ? 7 : 30),
    [entries, range]
  );

  const hasData = entries.length > 0;

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-display font-semibold text-foreground text-sm">📈 Evolução</p>
        <div className="flex bg-secondary rounded-md p-0.5 gap-0.5">
          {(['week', 'month'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-display font-semibold rounded transition-colors ${
                range === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {r === 'week' ? '7 dias' : '30 dias'}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p className="text-center text-sm text-muted-foreground py-6">Sem dados para exibir.</p>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Lucro x Custo</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={fmtBRL} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => fmtBRL(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Lucro" fill="hsl(var(--profit))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Custo" fill="hsl(var(--loss))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Lucro por km</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={fmtBRL} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => fmtBRL(v)}
                />
                <Line
                  type="monotone"
                  dataKey="Lucro/km"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
