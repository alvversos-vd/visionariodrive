/**
 * EntryForm — formulário único reutilizável para Bônus, Despesas e Receitas extras.
 *
 * Componente puramente apresentacional: recebe `type`, coleta os campos
 * necessários e delega a persistência ao FinancialService via callback `onSubmit`.
 * Nenhuma regra de negócio aqui.
 */

import { useMemo, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  categoriesOf, RIDE_APPS, type FinancialType, type RideApp,
} from '@/lib/domain/models';

interface SubmitPayload {
  type: FinancialType;
  value: number;
  category: string;
  app?: RideApp;
  notes?: string;
  date?: string;
}

interface Props {
  open: boolean;
  type: FinancialType;
  onClose: () => void;
  onSubmit: (payload: SubmitPayload) => void;
}

const TITLES: Record<FinancialType, string> = {
  bonus:   'Novo bônus',
  expense: 'Nova despesa',
  income:  'Nova receita extra',
};

const HELP: Record<FinancialType, string> = {
  bonus:   'Promoções, metas batidas, indicação, campanhas.',
  expense: 'Alimentação, manutenção, pedágio e gastos do dia.',
  income:  'Cashback, reembolsos, gorjetas e outras entradas.',
};

const SHOW_APP: Record<FinancialType, boolean> = {
  bonus: true, expense: false, income: true,
};

export default function EntryForm({ open, type, onClose, onSubmit }: Props) {
  const cats = useMemo(() => categoriesOf(type), [type]);
  const [value, setValue] = useState('');
  const [category, setCategory] = useState<string>(cats[0]);
  const [app, setApp] = useState<RideApp | ''>('');
  const [notes, setNotes] = useState('');

  // Resetar quando muda o tipo (open/type são gatilhos intencionais de reset; cats deriva de type)
  useMemo(() => { void open; void type; setCategory(cats[0]); setValue(''); setApp(''); setNotes(''); }, [cats, type, open]);

  const submit = () => {
    const v = parseFloat(value.replace(',', '.'));
    if (!v || v <= 0) return;
    onSubmit({
      type,
      value: v,
      category,
      app: app || undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-2xl border-border bg-card px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] [&>button]:h-11 [&>button]:w-11 [&>button]:top-2 [&>button]:right-2 [&>button]:flex [&>button]:items-center [&>button]:justify-center">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle className="font-display tracking-normal">{TITLES[type]}</SheetTitle>
          <p className="text-xs text-muted-foreground">{HELP[type]}</p>
        </SheetHeader>

        <div className="space-y-5 py-6 [&_input]:min-h-11 [&_button[role=combobox]]:min-h-11">
          <div className="space-y-1.5">
            <Label htmlFor="fin-value">Valor (R$)</Label>
            <Input
              id="fin-value"
              type="number"
              inputMode="decimal"
              placeholder="0,00"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              className="font-mono-num text-lg"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {cats.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {SHOW_APP[type] && (
            <div className="space-y-1.5">
              <Label>Aplicativo (opcional)</Label>
              <Select value={app || undefined} onValueChange={(v) => setApp(v as RideApp)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {RIDE_APPS.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fin-notes">Observação (opcional)</Label>
            <Input
              id="fin-notes"
              type="text"
              placeholder="Descrição rápida"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="gap-2 border-t border-border pt-4 sm:space-x-0">
          <Button variant="ghost" onClick={onClose} className="press">Cancelar</Button>
          <Button onClick={submit} className="press">Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
