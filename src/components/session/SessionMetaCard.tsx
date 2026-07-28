/**
 * SessionMetaCard — Sprint 10.
 * Meta viva da sessão. Usa exclusivamente valores já calculados.
 */
import { Target } from 'lucide-react';

interface Props {
  lucro: number;
  metaDaily: number;
  metaPct: number;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function SessionMetaCard({ lucro, metaDaily, metaPct }: Props) {
  if (metaDaily <= 0) {
    return (
      <div className="card-premium p-5 animate-fade-in-up">
        <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold inline-flex items-center gap-1.5">
          <Target size={11} className="text-primary" /> Meta do dia
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Nenhuma meta diária definida.
        </p>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, metaPct));
  const batida = lucro >= metaDaily;

  return (
    <div className="card-premium p-5 animate-fade-in-up">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold inline-flex items-center gap-1.5">
            <Target size={11} className="text-primary" /> Meta do dia
          </p>
          <p className="kpi-display font-mono-num text-foreground text-2xl mt-2">
            {fmt(lucro)}
            <span className="text-muted-foreground text-sm"> / {fmt(metaDaily)}</span>
          </p>
        </div>
        <span className={`kpi-display font-mono-num text-xl ${batida ? 'text-neon' : 'text-foreground'}`}>
          {Math.round(pct)}%
        </span>
      </div>

      <div className="relative mt-4 h-2 rounded-full bg-secondary/70 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-brand transition-[width] duration-200 ease-out ${batida ? 'shadow-glow-sm' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="relative h-0">
        <span
          aria-hidden
          className="absolute -top-3.5 h-3 w-3 -translate-x-1/2 rounded-full bg-primary shadow-glow-sm transition-[left] duration-200 ease-out"
          style={{ left: `${pct}%` }}
        />
      </div>

      <p className="text-caption text-muted-foreground mt-4">
        {batida
          ? 'Meta concluída. Tudo acima disso é lucro.'
          : <>Faltam <span className="text-foreground font-mono-num font-semibold">{fmt(metaDaily - Math.max(0, lucro))}</span> para a meta</>}
      </p>
    </div>
  );
}
