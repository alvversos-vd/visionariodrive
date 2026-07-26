import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'vd-install-dismissed-at';
const DISMISS_DAYS = 7;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return !!nav.standalone;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function wasRecentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const t = Number(raw);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());
  const [hidden, setHidden] = useState(wasRecentlyDismissed());

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || hidden) return null;

  const canPrompt = !!deferred;
  const showIosFallback = !canPrompt && isIOS();
  if (!canPrompt && !showIosFallback) return null;

  const handleClick = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === 'dismissed') {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
          setHidden(true);
        }
      } catch { /* noop */ }
      setDeferred(null);
    } else {
      setShowIosHelp(true);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setHidden(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="px-2.5 py-2 rounded-xl bg-primary text-primary-foreground font-display font-semibold text-caption flex items-center gap-1.5 shadow-md hover:opacity-95 active:scale-95 transition"
        title="Instalar o app no celular"
        aria-label="Baixar app"
      >
        <Download size={14} />
        Baixar app
      </button>

      {showIosHelp && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowIosHelp(false)}>
          <div className="bg-card rounded-2xl p-5 w-full max-w-sm border space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <Smartphone size={18} className="text-primary" /> Instalar no iPhone
              </h3>
              <button onClick={() => setShowIosHelp(false)} className="text-muted-foreground"><X size={18} /></button>
            </div>
            <ol className="text-sm space-y-2 text-foreground list-decimal pl-5">
              <li>Toque no botão <strong>Compartilhar</strong> do Safari (ícone de seta para cima).</li>
              <li>Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.</li>
              <li>Confirme em <strong>Adicionar</strong>. Pronto — o Visionario Drive vira um app.</li>
            </ol>
            <p className="text-caption text-muted-foreground">
              No iOS a instalação só funciona pelo Safari. Em outros navegadores, abra esta página no Safari primeiro.
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={dismiss} className="flex-1 p-2 rounded-lg bg-secondary text-foreground text-xs font-display font-semibold">
                Não mostrar por 7 dias
              </button>
              <button onClick={() => setShowIosHelp(false)} className="flex-1 p-2 rounded-lg bg-primary text-primary-foreground text-xs font-display font-bold">
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
