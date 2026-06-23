import { useEffect, useState } from 'react';
import { Satellite, Wrench, ChevronRight } from 'lucide-react';
import {
  subscribePermissionDiagnostic,
  refreshPermissionDiagnostic,
  type PermissionDiagnostic,
} from '@/lib/permissionDiagnostic';

interface Props {
  /** layout compacto p/ headers; default = card. */
  compact?: boolean;
}

/**
 * Badge SEMPRE visível indicando se o app está em automação ou modo manual.
 * Toque → reabre o onboarding de permissões (via evento global).
 */
export default function OperationalStatusBadge({ compact = false }: Props) {
  const [d, setD] = useState<PermissionDiagnostic | null>(null);
  useEffect(() => {
    const unsub = subscribePermissionDiagnostic(setD);
    void refreshPermissionDiagnostic();
    return unsub;
  }, []);

  if (!d) return null;
  const auto = d.trackingMode === 'automatic';

  const openOnboarding = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vd-open-permission-onboarding'));
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={auto ? undefined : openOnboarding}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-display font-semibold ${
          auto ? 'bg-profit/15 text-profit' : 'bg-accent/15 text-accent hover:bg-accent/25 transition-colors'
        }`}
      >
        {auto ? <Satellite size={11} /> : <Wrench size={11} />}
        {auto ? 'Automação ativa' : 'Modo manual'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={auto ? undefined : openOnboarding}
      aria-label={auto ? 'Automação ativa' : 'Configurar automação'}
      className={`w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
        auto
          ? 'border-profit/30 bg-profit/5'
          : 'border-accent/40 bg-accent/10 hover:bg-accent/15 active:scale-[0.99]'
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <span className={`shrink-0 mt-0.5 ${auto ? 'text-profit' : 'text-accent'}`}>
          {auto ? <Satellite size={16} /> : <Wrench size={16} />}
        </span>
        <div className="min-w-0">
          <p className={`font-display font-semibold text-sm ${auto ? 'text-profit' : 'text-accent'}`}>
            {auto ? '🟢 Automação ativa' : '🟡 Modo manual'}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            {auto
              ? 'GPS, km e tempo registrados automaticamente.'
              : d.reasons[0] ?? 'Ative o rastreamento automático para registrar quilometragem sem digitar.'}
          </p>
        </div>
      </div>
      {!auto && (
        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-display font-semibold text-accent">
          Configurar <ChevronRight size={12} />
        </span>
      )}
    </button>
  );
}
