/**
 * SessionSummary — Sprint 10.
 * Resumo premium exibido ao encerrar a Sessão Visionária. Só apresentação.
 */
import { useMemo } from 'react';
import { Trophy, ArrowLeft } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp';
import { achievementService } from '@/lib/services/achievementService';
import { haptics } from '@/lib/haptics';
import SessionLayout from './SessionLayout';
import { formatDuracao } from './SessionHero';
import type { SessionSummaryData } from './SessionModeContext';

interface Props {
  data: SessionSummaryData;
  /** Lucro de ontem (já calculado pelo MetricsService). */
  lucroOntem: number;
  onClose: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-premium p-4">
      <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">{label}</p>
      <p className="kpi-display font-mono-num text-foreground text-2xl mt-2">{value}</p>
    </div>
  );
}

export default function SessionSummary({ data, lucroOntem, onClose }: Props) {
  const lucro = useCountUp(data.lucro, 240);
  const km = useCountUp(data.km, 240);
  const corridas = useCountUp(data.corridas, 240);
  const pct = useCountUp(data.metaPct, 240);

  const hoje = new Date().toISOString().slice(0, 10);
  const unlockedHoje = useMemo(
    () => achievementService.unlocked().filter(u => (u.unlockedAt ?? '').slice(0, 10) === hoje),
    [hoje],
  );
  const catalog = useMemo(() => achievementService.list(), []);

  const comparativo = lucroOntem > 0
    ? data.lucro > lucroOntem
      ? 'Hoje você trabalhou melhor que ontem.'
      : 'Excelente trabalho hoje.'
    : 'Excelente trabalho hoje.';

  return (
    <SessionLayout>
      <div className="flex-1 space-y-5">
        <div className="text-center space-y-1.5 pt-4">
          <p className="text-micro uppercase tracking-[0.28em] text-primary font-display font-semibold">
            Sessão Visionária
          </p>
          <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">Sessão Finalizada</h2>
        </div>

        <div className="card-highlight p-6 text-center animate-fade-in-up">
          <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">Lucro da sessão</p>
          <p className="kpi-display font-mono-num text-neon text-4xl mt-2">{fmt(lucro)}</p>
          {data.metaDaily > 0 && (
            <p className="text-caption text-muted-foreground mt-3">
              Meta <span className="text-foreground font-mono-num">{Math.round(pct)}%</span> de {fmt(data.metaDaily)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Tempo" value={formatDuracao(data.minutos)} />
          <Kpi label="Corridas" value={String(Math.round(corridas))} />
          <Kpi label="KM" value={km.toFixed(1)} />
        </div>

        <div className="card-glass p-4">
          <p className="text-sm text-foreground leading-snug">{comparativo}</p>
        </div>

        {unlockedHoje.length > 0 && (
          <div className="card-premium p-4 space-y-2.5">
            <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold inline-flex items-center gap-1.5">
              <Trophy size={11} className="text-primary" /> Conquistas desbloqueadas
            </p>
            {unlockedHoje.map(u => {
              const a = catalog.find(c => c.id === u.id);
              return (
                <div key={u.id} className="flex items-center gap-2.5">
                  <span className="text-base leading-none">{a?.icon ?? '★'}</span>
                  <p className="text-sm text-foreground">{a?.name ?? u.id}</p>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground pt-2">
          Até amanhã. Descanse.
        </p>
      </div>

      <button
        onClick={() => { haptics.light(); onClose(); }}
        className="w-full mt-8 p-4 rounded-xl bg-profit-gradient text-primary-foreground font-display font-bold text-base shadow-glow press inline-flex items-center justify-center gap-2"
      >
        <ArrowLeft size={18} /> Voltar ao Dashboard
      </button>
    </SessionLayout>
  );
}
