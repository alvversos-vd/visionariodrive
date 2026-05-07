import { Sparkles, Check, BarChart3, Wallet, Brain, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { dismissUpgrade } from '@/lib/engagement';

interface Props {
  onDismiss?: () => void;
}

export default function UpgradeView({ onDismiss }: Props) {
  const { toast } = useToast();

  const handleActivate = () => {
    toast({ title: 'Em breve', description: 'O modo Visionário será liberado em breve.' });
  };

  const handleDismiss = () => {
    dismissUpgrade();
    onDismiss?.();
  };

  const benefits = [
    'Veja quanto realmente sobra no seu bolso',
    'Descubra onde está perdendo dinheiro',
    'Tome decisões melhores todos os dias',
  ];

  const teasers = [
    { icon: BarChart3, label: 'Relatório de ganhos' },
    { icon: Wallet, label: 'Controle avançado de gastos' },
    { icon: Brain, label: 'Insights inteligentes' },
  ];

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="rounded-xl p-6 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/30 text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
          <Sparkles className="text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground leading-tight">
          Pare de só trabalhar… comece a lucrar de verdade
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          No modo PRO você entende exatamente para onde seu dinheiro está indo
          e como ganhar mais todos os dias.
        </p>
      </div>

      <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
        <p className="font-display font-semibold text-foreground">O que muda no Visionário</p>
        <ul className="space-y-2.5">
          {benefits.map(b => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-foreground">
              <Check size={16} className="text-profit shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">Funções PRO</p>
        <div className="grid grid-cols-1 gap-2">
          {teasers.map(t => (
            <div
              key={t.label}
              className="flex items-center gap-3 bg-card rounded-lg p-3 border opacity-90"
            >
              <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                <t.icon size={18} />
              </div>
              <span className="text-sm font-medium text-foreground flex-1">{t.label}</span>
              <Lock size={14} className="text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Button
          onClick={handleActivate}
          size="lg"
          className="w-full h-14 text-base font-display font-semibold gap-2"
        >
          <Sparkles size={18} />
          Ativar modo Visionário
        </Button>
        {onDismiss && (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleDismiss}
          >
            Agora não
          </Button>
        )}
      </div>
    </div>
  );
}
