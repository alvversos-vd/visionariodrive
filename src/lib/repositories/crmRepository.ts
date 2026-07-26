/**
 * CrmRepository — owner ÚNICO das leituras agregadas admin.
 *
 * Camadas: apenas crmService/crmAnalyticsService importam este arquivo.
 * Componentes NUNCA. Todas as leituras dependem de policy "Admins can view all …"
 * no banco; usuários sem role admin recebem 0 linhas (RLS filtra silenciosamente).
 *
 * Sprint 8 — colunas adicionais (vehicles_v2, financial, gamification, goals,
 * created_at) para as análises derivadas do CRM Intelligence. Nenhuma tabela nova.
 */
import { supabase } from '@/integrations/supabase/client';

export interface CrmProfileRow {
  user_id: string;
  usuario_plano: 'FREE' | 'PRO';
  ultimo_login: string | null;
  created_at: string;
  onboarding_completo: boolean;
}

export interface CrmUserDataRow {
  user_id: string;
  entries: unknown;
  rides: unknown;
  rides_v2: unknown;
  shifts: unknown;
  vehicles_v2: unknown;
  financial: unknown;
  gamification: unknown;
  goals: unknown;
  created_at: string;
  updated_at: string;
}

export const crmRepository = {
  async listProfiles(): Promise<CrmProfileRow[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, usuario_plano, ultimo_login, created_at, onboarding_completo');
    if (error) throw error;
    return (data ?? []) as CrmProfileRow[];
  },

  async listUserData(): Promise<CrmUserDataRow[]> {
    const { data, error } = await supabase
      .from('user_data')
      .select(
        'user_id, entries, rides, rides_v2, shifts, vehicles_v2, financial, gamification, goals, created_at, updated_at',
      );
    if (error) throw error;
    return (data ?? []) as CrmUserDataRow[];
  },

  async isCurrentUserAdmin(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    if (error) return false;
    return !!data;
  },
};
