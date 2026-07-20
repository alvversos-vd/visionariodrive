/**
 * NotificationActionsBoot — Sprint 7 · Checkpoint 1.
 *
 * Componente sem UI. Monta uma única vez em App.tsx e faz attach/detach
 * do NotificationActionService no ciclo de vida do bundle.
 */
import { useEffect } from 'react';

import { notificationActionService } from '@/lib/services/notificationActionService';

export default function NotificationActionsBoot(): null {
  useEffect(() => {
    let cancelled = false;
    void notificationActionService.attach().catch(() => { /* noop */ });
    return () => {
      cancelled = true;
      void notificationActionService.detach().catch(() => { /* noop */ });
      void cancelled;
    };
  }, []);
  return null;
}
