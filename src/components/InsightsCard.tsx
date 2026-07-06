/**
 * InsightsCard — Sprint 3.
 *
 * Componente 100% apresentacional. Recebe insights prontos do hook.
 * Nunca calcula. Nunca importa Service. Renderiza no máximo 3 itens.
 */
import { AlertTriangle, TrendingUp, TrendingDown, Target, Clock, Sparkles } from 'lucide-react';
import type { Insight, InsightIcon, InsightSeverity } from '@/lib/services/metricsService';

const ICONS: Record<InsightIcon, typeof AlertTriangle> = {
  'trend-up': TrendingUp,
  'trend-down': TrendingDown,
  'target': Target,
  'clock': Clock,
  'sparkle': Sparkles,
};

const TONE: Record<InsightSeverity, { chip: string; border: string; bg: string; text: string; accent: string; icon: string }> = {
  warning:     { chip: 'Atenção',      border: 'border-warning/40', bg: 'bg-warning/[0.06]', text: 'text-foreground', accent: 'bg-warning',  icon: 'text-warning' },
  positive:    { chip: 'Boa notícia',  border: 'border-primary/40', bg: 'bg-primary/[0.06]', text: 'text-foreground', accent: 'bg-primary',  icon: 'text-primary' },
  opportunity: { chip: 'Oportunidade', border: 'border-info/40',    bg: 'bg-info/[0.06]',    text: 'text-foreground', accent: 'bg-info',     icon: 'text-info' },
};

interface Props {
  insights: Insight[];
  /** Se true, mostra Empty State em vez de sumir. */
  showEmpty?: boolean;
}

export default function InsightsCard({ insights, showEmpty = true }: Props) {
  if (!insights || insights.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="rounded-2xl p-5 bg-card border border-dashed border-border/70 text-center">
        <div className="mx-auto h-9 w-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Sparkles size={15} className="text-primary" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-display font-semibold mt-3">
          Insights
        </p>
        <p className="text-sm text-foreground mt-1">Ainda coletando dados</p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
          Registre pelo menos 3 dias para receber sugestões personalizadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="px-1 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold inline-flex items-center gap-1.5">
          <Sparkles size={11} className="text-primary" /> Insights
        </p>
        <span className="text-[10px] text-muted-foreground font-mono-num">{insights.length}/3</span>
      </div>
      <div className="space-y-2">
        {insights.map((it) => {
          const Icon = ICONS[it.icon] ?? Sparkles;
          const tone = TONE[it.severity];
          return (
            <div
              key={it.id}
              className={`relative rounded-xl p-3.5 pl-4 border ${tone.border} ${tone.bg} flex items-start gap-3 overflow-hidden`}
            >
              <span className={`absolute inset-y-0 left-0 w-[2px] ${tone.accent}`} />
              <Icon size={16} className={`shrink-0 mt-0.5 ${tone.icon}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-display font-semibold ${tone.text} leading-snug`}>{it.title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{it.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
