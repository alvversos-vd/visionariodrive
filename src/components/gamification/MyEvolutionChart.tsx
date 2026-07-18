/**
 * MyEvolutionChart — Sprint 6.3.
 * Gráfico "Minha Evolução": XP por semana (últimas 8). Recharts.
 * Fonte: xpService.weeklySeries() (localStorage-only, sem sync).
 */
import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useBusVersion } from '@/hooks/useBusVersion';
import { xpService } from '@/lib/services/xpService';

export default function MyEvolutionChart() {
  useBusVersion('xp:changed');

  const data = useMemo(() => {
    const series = xpService.weeklySeries(8);
    return series.map(b => ({
      label: b.week.slice(-3), // "W42"
      xp: b.xp,
      total: b.endXp,
    }));
  }, []);

  if (data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-secondary/20 px-3 py-6 text-center">
        <p className="text-[11px] text-muted-foreground italic">
          Ganhe XP para começar sua evolução.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 6 }}
            formatter={(v: number, key: string) => [`${v} XP`, key === 'xp' ? 'Ganhos' : 'Total']}
          />
          <Line type="monotone" dataKey="xp" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
