import { useMemo } from 'react';
import { DailyEntry } from '@/lib/types';
import { getEntries, deleteEntry } from '@/lib/storage';
import { Trash2 } from 'lucide-react';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

interface Props {
  refresh: number;
  onRefresh: () => void;
}

export default function HistoryView({ refresh, onRefresh }: Props) {
  const entries = useMemo(() => getEntries(), [refresh]);

  const weekAvg = useMemo(() => {
    const last7 = entries.slice(0, 7);
    if (last7.length === 0) return 0;
    return last7.reduce((s, e) => s + e.profit, 0) / last7.length;
  }, [entries]);

  const monthAvg = useMemo(() => {
    const last30 = entries.slice(0, 30);
    if (last30.length === 0) return 0;
    return last30.reduce((s, e) => s + e.profit, 0) / last30.length;
  }, [entries]);

  const handleDelete = (id: string) => {
    deleteEntry(id);
    onRefresh();
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground animate-slide-up">
        <p className="text-4xl mb-3">📊</p>
        <p className="font-display font-semibold">Nenhum registro ainda</p>
        <p className="text-sm">Faça seu primeiro cálculo para ver o histórico.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Averages */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg p-4 border shadow-sm text-center">
          <p className="text-xs text-muted-foreground">Média semanal</p>
          <p className={`text-lg font-display font-bold ${weekAvg >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(weekAvg)}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-sm text-center">
          <p className="text-xs text-muted-foreground">Média mensal</p>
          <p className={`text-lg font-display font-bold ${monthAvg >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(monthAvg)}</p>
        </div>
      </div>

      {/* Entry list */}
      <div className="space-y-2">
        {entries.map(entry => (
          <div key={entry.id} className="bg-card rounded-lg p-4 border shadow-sm flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">{fmtDate(entry.date)}</span>
                <span className={`text-base font-display font-bold ${entry.profit >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {fmt(entry.profit)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ganho: {fmt(entry.totalEarnings)} · Custo: {fmt(entry.totalCost)}
              </p>
            </div>
            <button onClick={() => handleDelete(entry.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
