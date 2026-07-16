/**
 * XpRepository — Sprint 6 · Fase 2 (Sprint 6.2.5: unificado sob gamificationRepository).
 *
 * Mantém a API pública original (read/write/reset). O storage físico é
 * delegado ao `gamificationRepository`, único owner do payload sincronizado
 * pelo CloudSync.
 */
import { gamificationRepository } from './gamificationRepository';

export interface XpState {
  totalXp: number;
  updatedAt: string;
}

function empty(): XpState {
  return { totalXp: 0, updatedAt: new Date(0).toISOString() };
}

export const xpRepository = {
  read(): XpState {
    const g = gamificationRepository.read();
    return {
      totalXp: g.xp.totalXp,
      updatedAt: g.updatedAt ?? empty().updatedAt,
    };
  },
  write(state: XpState): void {
    const g = gamificationRepository.read();
    g.xp.totalXp = Math.max(0, Math.floor(state.totalXp || 0));
    gamificationRepository.write(g);
  },
  reset(): void {
    const g = gamificationRepository.read();
    g.xp.totalXp = 0;
    gamificationRepository.write(g);
  },
};
