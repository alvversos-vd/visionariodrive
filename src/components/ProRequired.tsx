import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function ProRequired({ feature }: { feature?: string }) {
  const { toast } = useToast();
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="py-10 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="text-primary" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Você está no modo básico</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
            Ative o modo <strong>Visionário</strong> para liberar {feature ?? 'todas as funções'} e aumentar seu lucro.
          </p>
        </div>
        <Button
          size="lg"
          className="gap-2"
          onClick={() => toast({ title: 'Em breve', description: 'Pagamentos serão liberados em breve.' })}
        >
          <Sparkles size={16} />
          Ativar PRO
        </Button>
      </CardContent>
    </Card>
  );
}
