import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  feature?: string;
  onUpgrade?: () => void;
}

export default function ProRequired({ feature, onUpgrade }: Props) {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="py-10 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="text-primary" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Você está no modo básico</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
            Você já está evitando prejuízo…
            <br />
            <span className="text-foreground/80">Mas pode estar deixando dinheiro na mesa.</span>
          </p>
          {feature && (
            <p className="text-xs text-muted-foreground mt-2">
              Ative o modo <strong>Visionário</strong> para liberar {feature}.
            </p>
          )}
        </div>
        <Button
          size="lg"
          className="gap-2"
          onClick={onUpgrade}
        >
          <Sparkles size={16} />
          Ativar modo Visionário
        </Button>
      </CardContent>
    </Card>
  );
}
