/**
 * ProfileRepository — owner de leitura/escrita do profile do usuário.
 *
 * Único ponto de acesso ao Supabase para perfil. Componentes React nunca
 * devem importar `@/integrations/supabase/client` para operações de perfil.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ProfilePatch {
  nome_usuario?: string | null;
  tipo_veiculo_principal?: string | null;
  meta_lucro_diaria?: number | null;
  app_principal?: string | null;
  objetivo_principal?: string | null;
  onboarding_completo?: boolean;
}

export const profileRepository = {
  async update(userId: string, patch: ProfilePatch): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('user_id', userId);
    if (error) throw error;
  },

  async get(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
};
