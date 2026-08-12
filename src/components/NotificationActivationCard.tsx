/**
 * NotificationActivationCard — Sprint 10.6.x.
 *
 * Card de descoberta mostrado APÓS o login, quando o app roda em Android
 * nativo e a permissão POST_NOTIFICATIONS ainda está pendente.
 *
 * Não é um novo sistema de permissões: reutiliza `bgPermission`
 * (`getBackgroundPermissionStatus`, `requestNotificationPermissionIfNeeded`,
 * `openNotificationSettings`). Não bloqueia o START e NUNCA menciona nem
 * solicita localização (ADR-015).
 */
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  getBackgroundPermissionStatus,
  requestNotificationPermissionIfNeeded,
  openNotificationSettings,
} from '@/lib/bgPermission';

const SNOOZE_KEY = 'vd-notif-activation-snooze-until';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    return !!raw && Number(raw) > Date.now();
  } catch { return false; }
}

export default function NotificationActivationCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (snoozed()) return;
      const status = await getBackgroundPermissionStatus();
      if (cancelled) return;
      const pending =
        status.native &&
        status.platform === 'android' &&
        status.notificationPermissionRequired &&
        !status.notificationPermissionGranted;
      setVisible(pending);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch { /* noop */ }
    setVisible(false);
  };

  const activate = async () => {
    const status = await requestNotificationPermissionIfNeeded();
    if (status.notificationPermissionGranted) {
      setVisible(false);
      toast.success('Notificações ativadas');
      return;
    }
    const opened = await openNotificationSettings();
    if (!opened) {
      toast('Ative em Ajustes → Apps → Visionário Drive → Notificações');
    }
  };

  return (
    <div className="relative rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 animate-slide-up">
      <button
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute right-2 top-2 text-muted-foreground press"
      >
        <X size={14} />
      </button>

      <p className="font-display font-bold text-sm text-foreground flex items-center gap-2">
        <Bell size={15} className="text-primary" />
        Ative as notificações do Visionário Drive
      </p>

      <p className="text-caption text-muted-foreground">
        Para facilitar seu turno, usamos uma notificação fixa enquanto você estiver trabalhando.
      </p>

      <ul className="space-y-1 text-caption text-muted-foreground">
        <li>• Acompanhe o turno em tempo real.</li>
        <li>• Registre uma corrida em segundos.</li>
        <li>• Registre sem sair do Uber, 99, iFood, Keeta ou outro app de trabalho.</li>
      </ul>

      <p className="text-micro text-muted-foreground">
        Ela aparece somente durante o turno ativo e desaparece quando o turno termina.
      </p>

      <div className="flex gap-2 pt-1">
        <button
          onClick={dismiss}
          className="flex-1 h-10 rounded-lg surface-inset border border-border/60 text-foreground text-caption font-display font-semibold press"
        >
          Agora não
        </button>
        <button
          onClick={activate}
          className="flex-[1.4] h-10 rounded-lg bg-brand-gradient text-primary-foreground text-caption font-display font-bold press"
        >
          Ativar notificações
        </button>
      </div>
    </div>
  );
}
