/**
 * SessionCompanion — Sprint 10.1.
 * Mensagem ocasional de acompanhamento. Seleção simples sobre dados existentes.
 */
import { useEffect, useState } from 'react';
import { Coffee, X } from 'lucide-react';

interface Props {
  minutos: number;
  lucro: number;
  metaDaily: number;
  corridas: number;
}

export function selectCompanionMessage(p: Props): string | null {
  const { minutos, lucro, metaDaily, corridas } = p;
  if (metaDaily > 0 && lucro >= metaDaily) {
    return 'Sua meta foi concluída. Todo lucro adicional agora representa ganho acima do planejado.';
  }
  if (minutos >= 180) {
    return 'Você já dirige há bastante tempo. Considere uma pequena pausa.';
  }
  if (corridas >= 5) {
    return 'Ritmo constante até aqui.';
  }
  return null;
}

export default function SessionCompanion(props: Props) {
  const msg = selectCompanionMessage(props);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => { setDismissed(null); }, [msg]);

  if (!msg || dismissed === msg) return null;

  return (
    <div className="card-glass p-3.5 flex items-center gap-3 animate-fade-in-up">
      <Coffee size={15} className="text-primary shrink-0" />
      <p className="text-caption text-foreground leading-snug flex-1">{msg}</p>
      <button
        onClick={() => setDismissed(msg)}
        aria-label="Dispensar mensagem"
        className="text-muted-foreground hover:text-foreground p-1 press"
      >
        <X size={14} />
      </button>
    </div>
  );
}
