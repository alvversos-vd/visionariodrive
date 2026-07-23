import { MapPin, Shield, Navigation, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { pushBlockingModal } from '@/lib/uiModalState';

interface Props {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Modal humanizado de consentimento de localização — exibido ANTES do prompt nativo
 * do navegador. Explica em linguagem clara por que o GPS é usado e o que é feito
 * com os dados. Aprovação fica salva em localStorage para não reabrir todo turno.
 */
export default function GpsConsentDialog({ open, onAccept, onDecline }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (open) setMounted(true); }, [open]);
  useEffect(() => {
    if (!open) return;
    const release = pushBlockingModal();
    return release;
  }, [open]);
  if (!open) return null;

  // Detecta iOS para mostrar dica extra de "Permitir Sempre"
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div
      data-vd-modal="consent"
      className="overlay-scrim z-[60] flex items-end sm:items-center justify-center p-3"
      onClick={onDecline}
    >
      <div
        className={`bg-card rounded-2xl w-full max-w-sm border-2 border-primary/40 shadow-premium overflow-hidden ${mounted ? 'animate-slide-up' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-info-gradient p-5 text-info-foreground relative">
          <button onClick={onDecline} className="absolute top-3 right-3 text-info-foreground/80 hover:text-info-foreground" aria-label="Fechar">
            <X size={18} />
          </button>
          <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center mb-2">
            <MapPin size={26} />
          </div>
          <h2 className="font-display font-bold text-lg leading-tight">
            Ativar localização<br />durante o turno
          </h2>
          <p className="text-xs text-info-foreground/80 mt-1">
            Você está prestes a iniciar um turno operacional.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-foreground">
            Usamos sua localização <strong>apenas durante turnos ativos</strong> para calcular:
          </p>

          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Navigation size={15} className="text-primary mt-0.5 shrink-0" />
              <span>Km rodados e rota percorrida</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5 shrink-0 font-bold">R$</span>
              <span>Lucro real, custo por km e desempenho em tempo real</span>
            </li>
            <li className="flex items-start gap-2">
              <Shield size={15} className="text-primary mt-0.5 shrink-0" />
              <span>Tudo fica salvo <strong>apenas no seu aparelho</strong>. Sua localização nunca é compartilhada.</span>
            </li>
          </ul>

          {isIOS && (
            <div className="bg-secondary/40 rounded-lg p-3 text-[11px] text-muted-foreground">
              <strong className="text-foreground">📱 iPhone:</strong> ao receber o pedido do sistema, escolha <strong>“Permitir uma vez”</strong> ou <strong>“Ao usar o app”</strong>.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onDecline}
              className="p-3 rounded-xl bg-secondary text-foreground text-sm font-semibold active:scale-[0.98] transition-transform"
            >
              Agora não
            </button>
            <button
              onClick={onAccept}
              className="p-3 rounded-xl bg-primary text-primary-foreground text-sm font-display font-bold active:scale-[0.98] transition-transform shadow-glow"
            >
              Ativar GPS
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Se recusar, o turno continua normalmente em modo manual — você informa o km de cada corrida.
          </p>
        </div>
      </div>
    </div>
  );
}

const CONSENT_KEY = 'vd-gps-consent-v1';
export function hasGpsConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; }
}
export function saveGpsConsent(): void {
  try { localStorage.setItem(CONSENT_KEY, '1'); } catch { /* noop */ }
}
export function clearGpsConsent(): void {
  try { localStorage.removeItem(CONSENT_KEY); } catch { /* noop */ }
}
