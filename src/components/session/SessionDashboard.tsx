/**
 * SessionDashboard — Sprint 10.1 (HUD Operacional).
 *
 * Substitui APENAS o conteúdo visual do Dashboard enquanto a Sessão
 * Visionária está ativa. Zero regra de negócio: consome os mesmos hooks
 * públicos (useDashboard / useDayMetrics) já usados pelo modo normal.
 */
import { useEffect, useRef, useState } from 'react';
import { Route, Navigation, Flag, Banknote, Gauge } from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { useDayMetrics } from '@/hooks/useMetrics';
import { haptics } from '@/lib/haptics';
import { useSessionMode } from './SessionModeContext';
import SessionHero, { formatDuracao } from './SessionHero';
import SessionMetaCard from './SessionMetaCard';
import SessionInsightCard from './SessionInsightCard';
import SessionCompanion from './SessionCompanion';

interface Props { refresh: number }

const YESTERDAY = new Date(Date.now() - 86_400_000);

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-premium p-4">
      <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold inline-flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className="kpi-display font-mono-num text-foreground text-2xl mt-2">{value}</p>
    </div>
  );
}

export default function SessionDashboard({ refresh }: Props) {
  const { goals, snapshot, activeShift, shiftTotals } = useDashboard(refresh);
  const yesterday = useDayMetrics(YESTERDAY);
  const { finishSession } = useSessionMode();

  // Tick visual (mm) — não lê Services, apenas força re-render do relógio.
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const minutos = activeShift
    ? Math.max(0, Math.round((Date.now() - new Date(activeShift.inicio_turno).getTime()) / 60000))
    : shiftTotals?.tempo_online_minutos ?? 0;

  const lucro = snapshot.today.netProfit;
  const metaDaily = goals.daily;
  const metaPct = metaDaily > 0 ? Math.min(100, (lucro / metaDaily) * 100) : 0;
  const corridas = shiftTotals?.corridas_total ?? 0;
  const km = shiftTotals?.km_total ?? snapshot.today.km;
  const porHora = snapshot.today.profitPerHour;

  // Encerramento visual: quando o turno deixa de existir, mostra o resumo.
  const hadShift = useRef(false);
  const lastData = useRef({ minutos, corridas, km, lucro, metaDaily, metaPct });
  lastData.current = { minutos, corridas, km, lucro, metaDaily, metaPct };
  useEffect(() => {
    if (activeShift) { hadShift.current = true; return; }
    if (hadShift.current) {
      hadShift.current = false;
      finishSession(lastData.current);
    }
  }, [activeShift, finishSession]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <SessionHero minutos={minutos} lucro={lucro} metaPct={metaPct} ativo={!!activeShift} />

      <div className="grid grid-cols-2 gap-3">
        <Kpi icon={<Banknote size={11} className="text-primary" />} label="Lucro" value={fmt(lucro)} />
        <Kpi icon={<Route size={11} className="text-primary" />} label="KM" value={km.toFixed(1)} />
        <Kpi icon={<Navigation size={11} className="text-primary" />} label="Corridas" value={String(corridas)} />
        <Kpi icon={<Gauge size={11} className="text-primary" />} label="R$/hora" value={porHora > 0 ? fmt(porHora) : '—'} />
      </div>

      <SessionInsightCard
        lucro={lucro}
        metaDaily={metaDaily}
        corridas={corridas}
        lucroOntem={yesterday.netProfit}
        mediaSemana={snapshot.stats.weekAvgProfit}
        mediaPorCorrida={shiftTotals?.media_por_corrida ?? 0}
      />

      <SessionMetaCard lucro={lucro} metaDaily={metaDaily} metaPct={metaPct} />

      <SessionCompanion minutos={minutos} lucro={lucro} metaDaily={metaDaily} corridas={corridas} />

      {!activeShift && (
        <p className="text-caption text-muted-foreground text-center">
          Nenhum turno ativo — inicie um turno para acompanhar tempo, km e corridas em tempo real.
        </p>
      )}

      <button
        onClick={() => { haptics.medium(); finishSession(lastData.current); }}
        className="w-full p-3.5 rounded-xl border border-border text-muted-foreground font-display font-semibold text-sm hover:text-foreground transition-colors press inline-flex items-center justify-center gap-2"
      >
        <Flag size={15} /> Encerrar Sessão Visionária
      </button>
      <p className="text-micro text-muted-foreground text-center">
        Encerrar a sessão não finaliza seu turno · Tempo em sessão {formatDuracao(minutos)}
      </p>
    </div>
  );
}
