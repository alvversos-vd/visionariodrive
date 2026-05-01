import { useMemo } from 'react';
import { getEntries, deleteEntry, getGoals } from '@/lib/storage';
import { computeStats } from '@/lib/types';
import { Trash2, TrendingUp, TrendingDown, Trophy, Calendar, FileDown } from 'lucide-react';
import { exportHistoryPdf } from '@/lib/exportPdf';
import { toast } from 'sonner';
import HistoryCharts from './HistoryCharts';

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
  const goals = useMemo(() => getGoals(), [refresh]);
  const stats = useMemo(() => computeStats(entries, goals.daily), [entries, goals.daily]);

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

  const insights: { icon: string; text: string }[] = [];
  if (stats.weekChangePct !== null) {
    const up = stats.weekChangePct >= 0;
    insights.push({
      icon: up ? '📈' : '📉',
      text: `Você ${up ? 'lucrou' : 'caiu'} ${Math.abs(stats.weekChangePct).toFixed(0)}% comparado à semana passada.`,
    });
  }
  if (stats.costChangePct !== null && Math.abs(stats.costChangePct) >= 5) {
    insights.push({
      icon: stats.costChangePct > 0 ? '⚠️' : '✅',
      text: `Seu custo ${stats.costChangePct > 0 ? 'aumentou' : 'reduziu'} ${Math.abs(stats.costChangePct).toFixed(0)}%.`,
    });
  }
  if (stats.bestDayOfWeek && entries.length >= 3) {
    insights.push({ icon: '🔥', text: `Você lucra mais às ${stats.bestDayOfWeek.day}s.` });
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <button
        onClick={() => {
          try {
            exportHistoryPdf(entries);
            toast.success('Relatório PDF gerado com sucesso');
          } catch (e) {
            toast.error('Erro ao gerar PDF');
          }
        }}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors"
      >
        <FileDown size={16} /> Exportar relatório PDF
      </button>
      {/* Week summary */}
      <div className="bg-card rounded-lg p-4 border shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display font-semibold text-foreground flex items-center gap-1.5">
            <Calendar size={14} /> Últimos 7 dias
          </p>
          {stats.weekChangePct !== null && (
            <span
              className={`text-xs font-semibold flex items-center gap-0.5 ${
                stats.weekChangePct >= 0 ? 'text-profit' : 'text-loss'
              }`}
            >
              {stats.weekChangePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {stats.weekChangePct >= 0 ? '+' : ''}{stats.weekChangePct.toFixed(0)}%
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Ganho</p>
            <p className="font-display font-bold text-sm text-foreground">{fmt(stats.weekTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Lucro</p>
            <p className={`font-display font-bold text-sm ${stats.weekProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
              {fmt(stats.weekProfit)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Média/dia</p>
            <p className={`font-display font-bold text-sm ${stats.weekAvgProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
              {fmt(stats.weekAvgProfit)}
            </p>
          </div>
      </div>

      {/* Charts */}
      <HistoryCharts entries={entries} />
      </div>

      {/* Records */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg p-4 border shadow-sm text-center">
          <Trophy size={18} className="mx-auto text-accent mb-1" />
          <p className="text-xs text-muted-foreground">Recorde de lucro</p>
          <p className="font-display font-bold text-profit">{fmt(stats.recordProfit)}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border shadow-sm text-center">
          <p className="text-lg">🔥</p>
          <p className="text-xs text-muted-foreground">Sequência metas</p>
          <p className="font-display font-bold text-foreground">{stats.streak} dia{stats.streak !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-accent/10 border border-accent/40 rounded-lg p-4 space-y-2">
          <p className="text-xs font-display font-semibold text-foreground uppercase tracking-wide">💡 Insights</p>
          {insights.map((i, idx) => (
            <p key={idx} className="text-sm text-foreground">{i.icon} {i.text}</p>
          ))}
        </div>
      )}

      {/* Entry list */}
      <div className="space-y-2">
        <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide px-1">Histórico</p>
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
                Ganho: {fmt(entry.totalEarnings)} · Custo: {fmt(entry.totalCost)} · {entry.kmDriven.toFixed(0)} km
              </p>
            </div>
            <button
              onClick={() => handleDelete(entry.id)}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Excluir registro"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
