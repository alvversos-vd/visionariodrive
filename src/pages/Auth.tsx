import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import BrandLockup from '@/components/brand/BrandLockup';

const TERMS_VERSION = '1.0';

const schema = z.object({
  email: z.string().trim().email('E-mail inválido').max(255),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(72),
  nome_usuario: z.string().trim().max(30, 'Máximo 30 caracteres').optional(),
});

export default function Auth() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = mode === 'login' ? 'Entrar · Visionario Drive' : 'Criar conta · Visionario Drive';
  }, [mode]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (user) return <Navigate to="/" replace />;

  const enableGpsDiag = () => {
    try {
      localStorage.setItem('vd-gps-debug-enabled', '1');
      window.dispatchEvent(new Event('vd-gps-debug-enable'));
      toast({ title: 'GPS diag ativado', description: 'O botão de diagnóstico GPS ficará visível neste aparelho.' });
    } catch {
      toast({ title: 'GPS diag', description: 'Não foi possível persistir o atalho, mas tente recarregar o app.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, nome_usuario: nomeUsuario || undefined });
    if (!parsed.success) {
      toast({ title: 'Confira os dados', description: parsed.error.issues[0].message, variant: 'destructive' });
      return;
    }
    if (mode === 'signup' && !acceptTerms) {
      toast({
        title: 'Falta aceitar os termos',
        description: 'Marque o aceite dos Termos de Uso e da Política de Privacidade para continuar.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const nome = parsed.data.nome_usuario?.trim();
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              ...(nome ? { nome_usuario: nome } : {}),
              termos_aceitos_em: new Date().toISOString(),
              termos_versao: TERMS_VERSION,
            },
          },
        });
        if (error) throw error;
        toast({ title: 'Conta criada', description: 'Você já pode usar o app.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : '';
      const isCred = raw.includes('Invalid login');
      const title = mode === 'login' ? 'Não conseguimos entrar' : 'Não conseguimos criar sua conta';
      const msg = isCred ? 'E-mail ou senha incorretos. Tente novamente.' : (raw || 'Verifique sua conexão e tente novamente.');
      toast({ title, description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-14">
      <div className="w-full max-w-[22rem] flex flex-col items-center">
        <div
          onDoubleClick={enableGpsDiag}
          onContextMenu={(e) => { e.preventDefault(); enableGpsDiag(); }}
        >
          <BrandLockup size="lg" />
        </div>

        <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">
          {mode === 'login'
            ? 'Entre para acompanhar seu lucro real em tempo real.'
            : 'Crie sua conta e comece a medir cada quilômetro.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-10 w-full space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-caption uppercase tracking-[0.1em] text-muted-foreground">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-caption uppercase tracking-[0.1em] text-muted-foreground">Senha</Label>
            <Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {mode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-caption uppercase tracking-[0.1em] text-muted-foreground">
                  Como quer ser chamado? <span className="normal-case tracking-normal">(opcional)</span>
                </Label>
                <Input
                  id="nome"
                  type="text"
                  maxLength={30}
                  placeholder="Ex: Rafael, Rafa, Irmão…"
                  value={nomeUsuario}
                  onChange={e => setNomeUsuario(e.target.value)}
                />
              </div>
              <label htmlFor="aceite" className="flex items-start gap-2.5 text-caption text-muted-foreground cursor-pointer select-none leading-relaxed">
                <Checkbox
                  id="aceite"
                  checked={acceptTerms}
                  onCheckedChange={(v) => setAcceptTerms(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Li e aceito os{' '}
                  <Link to="/legal?tab=termos" target="_blank" className="underline text-foreground">Termos de Uso</Link>
                  {' '}e a{' '}
                  <Link to="/legal?tab=privacidade" target="_blank" className="underline text-foreground">Política de Privacidade</Link>.
                </span>
              </label>
            </>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={submitting || (mode === 'signup' && !acceptTerms)}>
            {submitting && <Loader2 className="animate-spin" />}
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <button
          type="button"
          className="mt-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
        </button>

        <div className="mt-12 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-micro uppercase tracking-[0.1em] text-muted-foreground/70">
          <Link to="/legal?tab=termos" className="transition-colors hover:text-foreground">Termos</Link>
          <Link to="/legal?tab=privacidade" className="transition-colors hover:text-foreground">Privacidade</Link>
          <Link to="/legal?tab=localizacao" className="transition-colors hover:text-foreground">Localização</Link>
          <Link to="/legal?tab=exclusao" className="transition-colors hover:text-foreground">Excluir conta</Link>
        </div>
      </div>
    </div>
  );
}
