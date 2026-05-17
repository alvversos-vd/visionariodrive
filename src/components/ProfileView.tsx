import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Trash2, CreditCard, Sparkles, Pencil, Check, X, FileText, Shield, MapPin, UserMinus, Loader2 } from 'lucide-react';
import { resetAllData } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { clearLocalCache } from '@/lib/cloudSync';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function ProfileView({ onReset }: { onReset?: () => void }) {
  const { profile, user, signOut, isPro, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(profile?.nome_usuario ?? '');
  const [saving, setSaving] = useState(false);

  const handleReset = () => {
    resetAllData();
    onReset?.();
    toast({ title: 'Dados apagados', description: 'Todos os dados locais do app foram removidos.' });
  };

  const startEdit = () => {
    setNome(profile?.nome_usuario ?? '');
    setEditing(true);
  };

  const saveNome = async () => {
    if (!user) return;
    const value = nome.trim().slice(0, 30);
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ nome_usuario: value || null })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    await refreshProfile();
    setEditing(false);
    toast({ title: 'Nome atualizado' });
  };

  const created = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center justify-between">
          <span>Perfil</span>
          <Badge variant={isPro ? 'default' : 'secondary'} className="gap-1">
            {isPro && <Sparkles size={12} />}
            {profile?.usuario_plano ?? 'FREE'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="nome-edit" className="text-muted-foreground text-xs">Nome / apelido</Label>
            {editing ? (
              <div className="flex gap-2">
                <Input
                  id="nome-edit"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  maxLength={30}
                  placeholder="Ex: Rafael, Rafa…"
                  autoFocus
                />
                <Button size="icon" onClick={saveNome} disabled={saving} aria-label="Salvar">
                  <Check size={16} />
                </Button>
                <Button size="icon" variant="outline" onClick={() => setEditing(false)} disabled={saving} aria-label="Cancelar">
                  <X size={16} />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-medium">{profile?.nome_usuario || <span className="text-muted-foreground italic">não definido</span>}</span>
                <Button size="sm" variant="ghost" className="gap-1.5 h-8" onClick={startEdit}>
                  <Pencil size={13} /> Editar nome
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">E-mail</span>
            <span className="font-medium truncate ml-2">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plano</span>
            <span className="font-medium">{profile?.usuario_plano ?? 'FREE'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cadastro</span>
            <span className="font-medium">{created}</span>
          </div>

          <div className="space-y-1.5 pt-2">
            <Label className="text-muted-foreground text-xs">Objetivo principal</Label>
            <p className="text-[11px] text-muted-foreground">Personaliza o destaque e a ordem dos cards do painel.</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'ganhar_mais', label: '💰 Ganhar mais' },
                { key: 'controlar_gastos', label: '🧮 Controlar gastos' },
                { key: 'evitar_prejuizo', label: '🛡️ Evitar prejuízo' },
                { key: 'bater_metas', label: '🎯 Bater metas' },
                { key: 'organizar_ganhos', label: '📊 Organizar ganhos' },
              ] as const).map(opt => {
                const active = profile?.objetivo_principal === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={async () => {
                      if (!user || active) return;
                      const { error } = await supabase
                        .from('profiles')
                        .update({ objetivo_principal: opt.key })
                        .eq('user_id', user.id);
                      if (error) {
                        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
                        return;
                      }
                      await refreshProfile();
                      toast({ title: 'Objetivo atualizado', description: 'Painel personalizado.' });
                    }}
                    className={`text-xs font-display font-semibold rounded-md border px-2 py-2 text-left transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-foreground border-border hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <Button variant="outline" className="w-full justify-start gap-2" disabled>
            <CreditCard size={16} />
            Em breve: Gerenciar assinatura
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive">
                <Trash2 size={16} />
                Resetar dados do app
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso remove lançamentos, corridas, metas e configurações deste dispositivo. Não pode ser desfeito.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Apagar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="destructive" className="w-full gap-2" onClick={signOut}>
            <LogOut size={16} />
            Sair da conta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
