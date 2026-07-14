/**
 * useIsAdmin — verifica se o usuário logado possui role 'admin'.
 * Consome crmService.isAdmin (que passa por user_roles + RLS).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { crmService } from '@/lib/services/crmService';

export function useIsAdmin(): { loading: boolean; isAdmin: boolean } {
  const { user } = useAuth();
  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean }>({ loading: true, isAdmin: false });

  useEffect(() => {
    let alive = true;
    if (!user) { setState({ loading: false, isAdmin: false }); return; }
    crmService.isAdmin(user.id)
      .then(ok => { if (alive) setState({ loading: false, isAdmin: ok }); })
      .catch(() => { if (alive) setState({ loading: false, isAdmin: false }); });
    return () => { alive = false; };
  }, [user]);

  return state;
}
