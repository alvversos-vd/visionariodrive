/**
 * NotificationPermissionCard — Sprint 10.6.1.
 *
 * Pedido de permissão de notificação no MOMENTO CERTO: ao iniciar um turno,
 * e somente quando a permissão ainda está pendente. Não é onboarding, não
 * bloqueia o turno e NUNCA menciona nem solicita localização (ADR-015).
 */
import { Bell } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}

export function NotificationPermissionCard({ open, onAllow, onDismiss }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            Mantenha seu turno na barra de notificações
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <ul className="mt-1 space-y-1.5 text-left text-sm">
              <li>• Registre corridas sem sair do Uber, 99, iFood, Keeta e afins.</li>
              <li>• A notificação aparece somente durante um turno ativo.</li>
              <li>• Por ela você registra uma corrida em segundos.</li>
              <li>• Ao finalizar o turno, ela desaparece.</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDismiss}>Agora não</AlertDialogCancel>
          <AlertDialogAction onClick={onAllow}>Permitir notificações</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
