import { MapPin, Bell, Battery, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { pushBlockingModal } from '@/lib/uiModalState';

interface Props {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Tela de educação prévia ao pedido nativo de "Permitir o tempo todo"
 * (ACCESS_BACKGROUND_LOCATION + POST_NOTIFICATIONS).
 *
 * Distinta de GpsConsentDialog (que cobre apenas foreground). Só deve ser
 * exibida em plataforma nativa, após o consentimento foreground.
 */
export default function BackgroundLocationConsentDialog({ open, onAccept, onDecline }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (open) setMounted(true); }, [open]);
  useEffect(() => {
    if (!open) return;
    const release = pushBlockingModal();
    return release;
  }, [open]);
  if (!open) return null;

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
            Continuar registrando<br />com a tela bloqueada
          </h2>
          <p className="text-xs text-info-foreground/80 mt-1">
            Para que o tracking não pare quando você guardar o celular no suporte.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-foreground">
            Sem essa permissão, o Android pausa o GPS após alguns minutos com a tela bloqueada — você perde km e o lucro/km fica errado.
          </p>

          <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2 font-display font-bold text-foreground">
              <Bell size={16} className="text-primary shrink-0" />
              <span>Notificação durante o turno</span>
            </div>
            <p className="text-muted-foreground">
              Ela mantém o rastreamento ativo em segundo plano, aparece só enquanto existe turno ativo e desaparece ao encerrar. Sem essa notificação, o Android pode interromper o GPS com a tela bloqueada.
            </p>
          </div>

          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
              <span>O sistema vai pedir <strong>"Permitir o tempo todo"</strong>. Aceite para registrar km mesmo com app minimizado.</span>
            </li>
            <li className="flex items-start gap-2">
              <Bell size={16} className="text-primary mt-0.5 shrink-0" />
              <span>Uma notificação fica visível durante o turno — você pode encerrar o turno direto por ela.</span>
            </li>
            <li className="flex items-start gap-2">
              <Battery size={16} className="text-primary mt-0.5 shrink-0" />
              <span>Para preservar bateria, o tracking <strong>só fica ativo durante turnos</strong>. Ao encerrar, para imediatamente.</span>
            </li>
          </ul>

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
              Continuar
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Se recusar, o tracking ainda funciona enquanto o app está aberto na tela.
          </p>
        </div>
      </div>
    </div>
  );
}

const BG_CONSENT_KEY = 'vd-bg-gps-consent-v1';
export function hasBackgroundGpsConsent(): boolean {
  try { return localStorage.getItem(BG_CONSENT_KEY) === '1'; } catch { return false; }
}
export function saveBackgroundGpsConsent(): void {
  try { localStorage.setItem(BG_CONSENT_KEY, '1'); } catch { /* noop */ }
}
export function declineBackgroundGpsConsent(): void {
  // Marcador "perguntado" para não reabrir todo turno após recusa.
  try { localStorage.setItem(BG_CONSENT_KEY, '0'); } catch { /* noop */ }
}
export function wasBackgroundGpsAsked(): boolean {
  try { return localStorage.getItem(BG_CONSENT_KEY) !== null; } catch { return false; }
}
