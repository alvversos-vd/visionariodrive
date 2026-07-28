/**
 * SessionInsightCard — Sprint 10.
 * Seleciona (não calcula) uma mensagem a partir de valores já existentes.
 */
import { Sparkles } from 'lucide-react';

interface Props {
  lucro: number;
  metaDaily: number;
  corridas: number;
  lucroOntem: number;
  mediaSemana: number;
  mediaPorCorrida: number;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function selectSessionInsight(p: Props): string | null {
  const { lucro, metaDaily, corridas, lucroOntem, mediaSemana, mediaPorCorrida } = p;
  const falta = metaDaily > 0 ? metaDaily - lucro : 0;

  if (metaDaily > 0 && falta > 0 && mediaPorCorrida > 0 && falta <= mediaPorCorrida * 2) {
    const n = Math.ceil(falta / mediaPorCorrida);
    return n <= 1
      ? 'Mais uma corrida média deve concluir sua meta.'
      : `Mais ${n} corridas médias devem concluir sua meta.`;
  }
  if (metaDaily > 0 && falta > 0 && corridas > 0) {
    return `Faltam ${fmt(falta)} para atingir sua meta.`;
  }
  if (lucroOntem > 0 && lucro > lucroOntem) {
    return 'Você já superou o lucro de ontem.';
  }
  if (mediaSemana > 0 && lucro > mediaSemana) {
    return 'Hoje você está acima da média desta semana.';
  }
  if (metaDaily > 0 && lucro >= metaDaily) {
    return 'Meta concluída. Agora tudo acima disso é lucro.';
  }
  return null;
}

export default function SessionInsightCard(props: Props) {
  const msg = selectSessionInsight(props)
    ?? 'Continue registrando suas corridas para receber insights.';

  return (
    <div className="card-glass p-4 flex items-start gap-3 animate-fade-in-up">
      <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
        <Sparkles size={15} className="text-primary" />
      </div>
      <p className="text-sm text-foreground leading-snug">{msg}</p>
    </div>
  );
}
