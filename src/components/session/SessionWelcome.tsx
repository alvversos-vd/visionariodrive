/**
 * SessionWelcome — Sprint 10.
 * Tela de entrada da Sessão Visionária. Apenas apresentação.
 */
import { ArrowRight } from 'lucide-react';
import { BRAND_ICON_URL } from '@/assets/branding/logo';
import { haptics } from '@/lib/haptics';
import SessionLayout from './SessionLayout';

interface Props {
  metaDaily: number;
  onStart: () => void;
  onCancel: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function SessionWelcome({ metaDaily, onStart, onCancel }: Props) {
  return (
    <SessionLayout>
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <div className="relative animate-count-up">
          <div aria-hidden className="absolute inset-0 rounded-2xl blur-2xl bg-primary/40 animate-pulse-glow" />
          <img
            src={BRAND_ICON_URL}
            alt=""
            draggable={false}
            className="relative h-20 w-20 rounded-2xl select-none"
          />
        </div>

        <div className="space-y-2">
          <p className="text-micro uppercase tracking-[0.28em] text-primary font-display font-semibold">
            Sessão Visionária
          </p>
          <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">
            Hoje é um novo turno.
          </h2>
        </div>

        <div className="w-full card-highlight p-5">
          <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">
            Sua meta hoje
          </p>
          <p className="kpi-display font-mono-num text-neon text-4xl mt-2">
            {metaDaily > 0 ? fmt(metaDaily) : '—'}
          </p>
          {metaDaily <= 0 && (
            <p className="text-caption text-muted-foreground mt-2">
              Defina uma meta diária para acompanhar seu progresso.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-sm text-foreground">Boa jornada.</p>
          <p className="text-caption text-muted-foreground">Dirija com segurança.</p>
        </div>
      </div>

      <div className="space-y-3 pt-8">
        <button
          onClick={() => { haptics.medium(); onStart(); }}
          className="w-full p-4 rounded-xl bg-profit-gradient text-primary-foreground font-display font-bold text-base shadow-glow press inline-flex items-center justify-center gap-2"
        >
          INICIAR SESSÃO <ArrowRight size={18} />
        </button>
        <button
          onClick={onCancel}
          className="w-full p-3 rounded-xl border border-border text-muted-foreground font-display font-semibold text-sm hover:text-foreground transition-colors press"
        >
          Cancelar
        </button>
      </div>
    </SessionLayout>
  );
}
