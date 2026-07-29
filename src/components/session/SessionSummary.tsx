/**
 * SessionSummary — Sprint 10.1 (encerramento cinematográfico).
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

function Row({ label, value, delay, neon }: { label: string; value: string; delay: number; neon?: boolean }) {
  return (
    <div
      className="card-premium p-4 flex items-center justify-between gap-3 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">{label}</p>
      <p className={`kpi-display font-mono-num text-2xl ${neon ? 'text-neon' : 'text-foreground'}`}>{value}</p>
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
      : 'Excelente trabalho.'
    : 'Excelente trabalho.';

  return (
    <SessionLayout>
      <div className="flex-1 space-y-4">
        <div className="text-center space-y-1.5 pt-6 animate-fade-in-up">
          <p className="text-micro uppercase tracking-[0.28em] text-primary font-display font-semibold">
            Sessão Visionária
          </p>
          <h2 className="font-display text-3xl font-bold text-foreground tracking-tight">MISSÃO CONCLUÍDA</h2>
        </div>

        <div className="space-y-3 pt-2">
          <Row label="Tempo" value={formatDuracao(data.minutos)} delay={60} />
          <Row label="Corridas" value={String(Math.round(corridas))} delay={120} />
          <Row label="KM" value={km.toFixed(1)} delay={180} />
          <Row label="Lucro" value={fmt(lucro)} delay={240} neon />
          {data.metaDaily > 0 && (
            <Row label="Meta" value={`${Math.round(pct)}%`} delay={300} />
          )}
        </div>

        <div className="card-glass p-4 animate-fade-in-up">
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

        <div className="text-center pt-2 space-y-1">
          <p className="text-sm text-foreground">Sessão encerrada.</p>
          <p className="text-caption text-muted-foreground">Descanse. Até a próxima.</p>
        </div>
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
