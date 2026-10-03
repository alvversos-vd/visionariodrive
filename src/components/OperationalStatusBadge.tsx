import { useEffect, useState } from 'react';
import { Satellite, Wrench, ChevronRight } from 'lucide-react';
import {
  subscribePermissionDiagnostic,
  refreshPermissionDiagnostic,
  type PermissionDiagnostic,
} from '@/lib/permissionDiagnostic';
import { useCapabilities } from '@/hooks/useCapabilities';

interface Props {
  /** layout compacto p/ headers; default = card. */
  compact?: boolean;
}

/**
 * Badge de estado operacional do rastreamento automático.
 *
 * Existe APENAS onde a capability `gps` está ativa (PRO). No START o produto é
 * 100% manual: não há automação a diagnosticar, portanto o componente não é
 * renderizado (não é ocultação visual — ele não existe na árvore).
 */
export default function OperationalStatusBadge({ compact = false }: Props) {
  const { gps: gpsEnabled } = useCapabilities();
  const [d, setD] = useState<PermissionDiagnostic | null>(null);
  useEffect(() => {
    if (!gpsEnabled) return;
    const unsub = subscribePermissionDiagnostic(setD);
    void refreshPermissionDiagnostic();
    return unsub;
  }, [gpsEnabled]);

  if (!gpsEnabled || !d) return null;

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
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-micro font-display font-semibold ${
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
          <p className="text-caption text-muted-foreground leading-tight mt-0.5">
            {auto
              ? 'GPS, km e tempo registrados automaticamente.'
              : d.reasons[0] ?? 'Ative o rastreamento automático para registrar quilometragem sem digitar.'}
          </p>
        </div>
      </div>
      {!auto && (
        <span className="shrink-0 inline-flex items-center gap-1 text-caption font-display font-semibold text-accent">
          Configurar <ChevronRight size={12} />
        </span>
      )}
    </button>
  );
}
