/**
 * ProfileService — única API para o perfil do usuário. Consome profileRepository.
 * Componentes React não podem importar `@/integrations/supabase/client` para perfil.
 */

import { profileRepository, type ProfilePatch } from '../repositories/profileRepository';

export const profileService = {
  async update(userId: string, patch: ProfilePatch): Promise<void> {
    await profileRepository.update(userId, patch);
  },
  async get(userId: string) {
    return profileRepository.get(userId);
  },
  async markOnboarded(userId: string, patch: Omit<ProfilePatch, 'onboarding_completo'>): Promise<void> {
    await profileRepository.update(userId, { ...patch, onboarding_completo: true });
  },
};

export type { ProfilePatch };
