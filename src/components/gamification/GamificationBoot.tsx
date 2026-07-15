/**
 * GamificationBoot — Sprint 6 · Fase 2.
 * Componente invisível. Alimenta xpEngine com o accountCreatedAt do profile.
 * Zero UI. Executa uma única vez por mudança de perfil.
 */
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { xpEngine } from '@/lib/gamification/xpEngine';

export default function GamificationBoot() {
  const { profile } = useAuth();
  useEffect(() => {
    xpEngine.setAccountContext(profile?.created_at ?? null);
  }, [profile?.created_at]);
  return null;
}
