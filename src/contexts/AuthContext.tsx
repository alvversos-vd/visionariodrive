import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { hydrateFromCloud, setSyncUser, subscribeRealtime, clearLocalCache } from '@/lib/cloudSync';

export type UserPlan = 'FREE' | 'PRO';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  usuario_plano: UserPlan;
  stripe_customer_id: string | null;
  ultimo_login: string | null;
  nome_usuario: string | null;
  tipo_veiculo_principal: string | null;
  meta_lucro_diaria: number | null;
  app_principal: string | null;
  objetivo_principal: string | null;
  onboarding_completo: boolean;
  created_at: string;
}

export function getDisplayName(profile: Profile | null): string {
  return profile?.nome_usuario?.trim() || 'motorista';
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  dataReady: boolean;
  dataVersion: number;
  isPro: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const prevPlanRef = useRef<UserPlan | null>(null);

  const bumpData = () => setDataVersion(v => v + 1);

  const applyProfile = (next: Profile | null) => {
    const prev = prevPlanRef.current;
    if (prev && next && prev !== 'PRO' && next.usuario_plano === 'PRO') {
      toast({
        title: '🎉 Bem-vindo ao modo Visionário!',
        description: 'Suas funções premium foram liberadas. Aproveite!',
      });
    }
    prevPlanRef.current = next?.usuario_plano ?? null;
    setProfile(next);
  };

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    applyProfile((data as Profile) ?? null);
  };

  useEffect(() => {
    // Listener primeiro
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        const uid = newSession.user.id;
        setSyncUser(uid);
        setDataReady(false);
        setTimeout(() => {
          loadProfile(uid);
          supabase
            .from('profiles')
            .update({ ultimo_login: new Date().toISOString() })
            .eq('user_id', uid)
            .then(() => {});
          hydrateFromCloud(uid)
            .catch(() => {})
            .finally(() => {
              setDataReady(true);
              bumpData();
            });
        }, 0);
      } else {
        setSyncUser(null);
        setProfile(null);
        setDataReady(false);
      }
    });

    // Depois sessão atual
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        const uid = existing.user.id;
        setSyncUser(uid);
        loadProfile(uid);
        hydrateFromCloud(uid)
          .catch(() => {})
          .finally(() => {
            setDataReady(true);
            bumpData();
          });
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Realtime: detecta mudança de plano (ex.: upgrade para PRO)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` },
        (payload) => applyProfile(payload.new as Profile),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Realtime sync de user_data entre dispositivos
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeRealtime(user.id, () => bumpData());
    return unsub;
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    prevPlanRef.current = null;
    setProfile(null);
    setSyncUser(null);
    clearLocalCache();
    setDataReady(false);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        dataReady,
        dataVersion,
        isPro: profile?.usuario_plano === 'PRO',
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
