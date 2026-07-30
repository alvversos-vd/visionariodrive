/**
 * SessionEntryCard — Sprint 10.2.
 * Porta de entrada da Sessão Visionária (aba Metas). Apenas apresentação:
 * lê o turno ativo via hook público e a fase visual via SessionModeContext.
 */
import { ArrowRight, Check } from 'lucide-react';
import BrandMark from '@/components/brand/BrandMark';
import { haptics } from '@/lib/haptics';
import { useDashboard } from '@/hooks/useDashboard';
import { useSessionMode } from './SessionModeContext';
import { formatDuracao } from './SessionHero';

interface Props {
  refresh: number;
  /** Leva o usuário ao HUD (Dashboard) quando a sessão já está ativa. */
  onEnter?: () => void;
}

const BENEFITS = [
  'Interface limpa para dirigir',
  'KPIs em tempo real',
  'Meta sempre visível',
  'Insights inteligentes',
  'Acompanhamento do turno',
  'Resumo premium ao finalizar',
];

export default function SessionEntryCard({ refresh, onEnter }: Props) {
  const { activeShift } = useDashboard(refresh);
  const { phase, openWelcome } = useSessionMode();

  const emAndamento = phase === 'active';
  const minutos = activeShift
    ? Math.max(0, Math.round((Date.now() - new Date(activeShift.inicio_turno).getTime()) / 60000))
    : 0;

  const label = emAndamento ? 'Entrar' : activeShift ? 'Continuar Sessão' : 'Iniciar Sessão';
  const handle = () => {
    haptics.medium();
    if (emAndamento) onEnter?.();
    else openWelcome();
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden card-premium border-primary/30 p-5 transition-colors duration-200 hover:border-primary/50">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
        />

        <div className="relative flex items-start gap-3.5">
          <BrandMark size="md" glow="soft" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-display text-base font-bold text-foreground leading-tight">Sessão Visionária</p>
              <span className="text-micro uppercase tracking-[0.18em] font-display font-semibold px-2 py-0.5 rounded-full border border-primary/40 text-primary bg-primary/10">
                Modo Performance
              </span>
            </div>
            <p className="text-caption text-muted-foreground mt-1.5 leading-snug">
              Entre em modo foco durante o turno. Desligue distrações e acompanhe apenas o que importa.
            </p>

            {emAndamento && (
              <p className="text-caption text-foreground mt-2.5">
                Sessão em andamento ·{' '}
                <span className="font-mono-num text-primary">{formatDuracao(minutos)}</span>
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handle}
          className="relative w-full mt-4 p-3.5 rounded-xl bg-profit-gradient text-primary-foreground font-display font-bold text-sm shadow-glow press inline-flex items-center justify-center gap-2"
        >
          {label} <ArrowRight size={16} />
        </button>
      </div>

      <div className="card-glass p-4 space-y-2.5">
        <p className="font-display text-sm font-semibold text-foreground">
          O que acontece durante uma Sessão Visionária?
        </p>
        <ul className="space-y-1.5">
          {BENEFITS.map(b => (
            <li key={b} className="flex items-center gap-2.5">
              <Check size={13} className="text-primary shrink-0" />
              <span className="text-caption text-muted-foreground">{b}</span>
            </li>
          ))}
        </ul>
        <p className="text-micro text-muted-foreground pt-1 leading-relaxed">
          Tudo isso utilizando os dados existentes. Sem alterar seu turno, suas corridas ou seus históricos.
        </p>
      </div>

      <p className="text-micro text-muted-foreground text-center leading-relaxed px-2">
        A Sessão Visionária não altera seu turno. Ela apenas cria um ambiente focado para dirigir.
      </p>
    </div>
  );
}
