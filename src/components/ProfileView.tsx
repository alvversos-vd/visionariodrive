import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Trash2, CreditCard, Sparkles, Pencil, Check, X } from 'lucide-react';
import { resetAllData } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function ProfileView({ onReset }: { onReset?: () => void }) {
  const { profile, user, signOut, isPro } = useAuth();
  const { toast } = useToast();

  const handleReset = () => {
    resetAllData();
    onReset?.();
    toast({ title: 'Dados apagados', description: 'Todos os dados locais do app foram removidos.' });
  };

  const created = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center justify-between">
          <span>Perfil</span>
          <Badge variant={isPro ? 'default' : 'secondary'} className="gap-1">
            {isPro && <Sparkles size={12} />}
            {profile?.usuario_plano ?? 'FREE'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">E-mail</span>
            <span className="font-medium truncate ml-2">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plano</span>
            <span className="font-medium">{profile?.usuario_plano ?? 'FREE'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cadastro</span>
            <span className="font-medium">{created}</span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <Button variant="outline" className="w-full justify-start gap-2" disabled>
            <CreditCard size={16} />
            Em breve: Gerenciar assinatura
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive">
                <Trash2 size={16} />
                Resetar dados do app
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso remove lançamentos, corridas, metas e configurações deste dispositivo. Não pode ser desfeito.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Apagar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="destructive" className="w-full gap-2" onClick={signOut}>
            <LogOut size={16} />
            Sair da conta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
