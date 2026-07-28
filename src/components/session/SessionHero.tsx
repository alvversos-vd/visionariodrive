/**
 * SessionHero — Sprint 10.
 * Card hero da sessão: tempo, lucro e meta. Somente apresentação.
 */
import { useCountUp } from '@/hooks/useCountUp';

interface Props {
  minutos: number;
  lucro: number;
  metaPct: number;
  ativo: boolean;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDuracao(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}h${String(m % 60).padStart(2, '0')}`;
}

export default function SessionHero({ minutos, lucro, metaPct, ativo }: Props) {
  const lucroAnim = useCountUp(lucro, 240);
  const pctAnim = useCountUp(metaPct, 240);

  return (
    <div className="relative card-highlight p-6 overflow-hidden animate-fade-in-up">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-primary/10 border border-primary/40 text-caption font-display font-semibold text-primary">
          <span className="relative flex h-2 w-2">
            {ativo && <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Sessão Visionária
        </span>
        <span className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">
          Tempo
        </span>
      </div>

      <p className="relative kpi-display font-mono-num text-foreground text-3xl mt-4">
        {formatDuracao(minutos)}
      </p>

      <div className="relative mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">Lucro</p>
          <p className="kpi-display font-mono-num text-neon text-3xl mt-1.5">{fmt(lucroAnim)}</p>
        </div>
        <div className="text-right">
          <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">Meta</p>
          <p className="kpi-display font-mono-num text-foreground text-3xl mt-1.5">{Math.round(pctAnim)}%</p>
        </div>
      </div>
    </div>
  );
}
