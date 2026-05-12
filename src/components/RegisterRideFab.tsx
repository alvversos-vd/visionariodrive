import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { getActiveShift, addRide, classifyRide } from '@/lib/shifts';

interface Props { onChange?: () => void }

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function RegisterRideFab({ onChange }: Props) {
  const [active, setActive] = useState(() => !!getActiveShift());
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState('');
  const [km, setKm] = useState('');

  useEffect(() => {
    const i = setInterval(() => setActive(!!getActiveShift()), 4000);
    return () => clearInterval(i);
  }, []);

  if (!active) return null;

  const v = parseFloat(valor.replace(',', '.'));
  const k = parseFloat(km.replace(',', '.'));
  const valid = v > 0 && k > 0;
  const shift = getActiveShift();
  const preview = valid && shift ? classifyRide(v, k, shift) : null;

  const submit = () => {
    if (!valid || !shift) { toast.error('Preencha valor e km'); return; }
    const r = addRide(shift.turno_id, v, k);
    if (!r) return;
    setValor(''); setKm(''); setOpen(false);
    onChange?.();
    if (r.resultado === 'boa') toast.success('🟢 Boa corrida 👊');
    else if (r.resultado === 'aceitavel') toast('🟡 Lucro baixo nessa corrida');
    else toast.error('🔴 Essa corrida reduziu seu lucro');
  };

  const previewColor =
    preview?.resultado === 'boa' ? 'text-profit border-profit/40 bg-profit/10' :
    preview?.resultado === 'aceitavel' ? 'text-accent border-accent/40 bg-accent/10' :
    preview ? 'text-loss border-loss/40 bg-loss/10' : 'text-muted-foreground border-border bg-secondary/40';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Registrar nova corrida"
        className="fixed z-40 bottom-5 right-5 h-14 w-14 rounded-full bg-profit-gradient text-primary-foreground shadow-glow shadow-premium flex items-center justify-center active:scale-95 transition-transform animate-fab-pop"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-sm space-y-4 border-t sm:border animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg">Nova corrida</h3>
                <p className="text-xs text-muted-foreground">Registre em segundos</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display font-semibold">Valor</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <input
                    type="number" inputMode="decimal" autoFocus
                    value={valor} onChange={e => setValor(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-3 text-xl font-display font-bold rounded-xl border bg-background number-tabular"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-display font-semibold">Distância</label>
                <div className="relative mt-1">
                  <input
                    type="number" inputMode="decimal"
                    value={km} onChange={e => setKm(e.target.value)}
                    placeholder="0"
                    className="w-full pl-3 pr-10 py-3 text-xl font-display font-bold rounded-xl border bg-background number-tabular"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">km</span>
                </div>
              </div>
            </div>

            <div className={`rounded-xl border p-3 transition-colors ${previewColor}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-display font-semibold uppercase tracking-wider">Valor por km</span>
                {preview && <span className="font-display font-bold">
                  {preview.resultado === 'boa' ? '🟢 Boa' : preview.resultado === 'aceitavel' ? '🟡 Aceitável' : '🔴 Ruim'}
                </span>}
              </div>
              <p className="font-display font-bold text-2xl number-tabular mt-0.5">
                {valid ? fmt(v / k) : 'R$ —,—'}<span className="text-xs font-normal opacity-70">/km</span>
              </p>
            </div>

            <button
              onClick={submit}
              disabled={!valid}
              className="w-full p-4 rounded-xl bg-profit-gradient text-primary-foreground font-display font-bold text-base disabled:opacity-40 active:scale-[0.98] transition-transform shadow-glow"
            >
              Salvar corrida
            </button>
          </div>
        </div>
      )}
    </>
  );
}
