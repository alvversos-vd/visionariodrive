/**
 * AchievementToast — Sprint 6 · Fase 2.
 *
 * Componente invisível montado uma vez em <App/>. Escuta o bus:
 *   - 'achievement:unlocked' → toast 🏆 com nome/descrição + XP
 *   - 'level-up'             → toast ⭐ "Nível X alcançado"
 *
 * Zero regra de negócio, zero acesso a storage. Só orquestra a UI.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useBusVersion } from '@/hooks/useBusVersion';
import { achievementService } from '@/lib/services/achievementService';
import { xpService } from '@/lib/services/xpService';

export default function AchievementToast() {
  const vAch = useBusVersion('achievement:unlocked');
  const vLevel = useBusVersion('level-up');
  const lastSeenAchIdRef = useRef<string | null>(null);
  const lastSeenLevelRef = useRef<number>(-1);

  useEffect(() => {
    const list = achievementService.unlocked();
    if (list.length === 0) { lastSeenAchIdRef.current = null; return; }
    const last = list[list.length - 1];
    if (lastSeenAchIdRef.current === last.id) return;
    // Evita disparo no bootstrap (primeira montagem com estado pré-existente)
    if (lastSeenAchIdRef.current === null) {
      lastSeenAchIdRef.current = last.id;
      return;
    }
    lastSeenAchIdRef.current = last.id;
    const def = achievementService.get(last.id);
    if (!def) return;
    toast.success(`${def.icon} ${def.name}`, {
      id: `achievement-${def.id}`,
      description: `${def.description} · +${def.xp} XP`,
      duration: 6000,
    });
  }, [vAch]);

  useEffect(() => {
    const p = xpService.progress();
    if (lastSeenLevelRef.current === -1) { lastSeenLevelRef.current = p.level; return; }
    if (p.level > lastSeenLevelRef.current) {
      lastSeenLevelRef.current = p.level;
      toast(`⭐ Nível ${p.level} alcançado!`, {
        id: `level-${p.level}`,
        description: 'Continue nesse ritmo — próximas conquistas estão perto.',
        duration: 5000,
      });
    }
  }, [vLevel]);

  return null;
}
