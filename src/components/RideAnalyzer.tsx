import { useState, useMemo } from 'react';
import { getEntries, getSettings } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Props {
  refresh: number;
}

type Verdict = 'good' | 'ok' | 'bad' | null;

export default function RideAnalyzer({ refresh }: Props) {
  const [rideValue, setRideValue] = useState('');
  const [rideKm, setRideKm] = useState('');
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [details, setDetails] = useState<{ costPerKm: number; minIdealKm: number; ridePerKm: number } | null>(null);
  const [error, setError] = useState('');

  const latestEntry = useMemo(() => {
    const entries = getEntries();
    return entries.length > 0 ? entries[0] : null;
  }, [refresh]);

  const settings = useMemo(() => getSettings(), [refresh]);

  const costPerKm = latestEntry && latestEntry.kmDriven > 0
    ? latestEntry.totalCost / latestEntry.kmDriven
    : null;

  const minIdealKm = costPerKm !== null ? costPerKm * settings.profitMargin : null;

  const analyze = () => {
    setError('');
    setVerdict(null);
    setDetails(null);

    const val = parseFloat(rideValue);
    const km = parseFloat(rideKm);

    if (!val || !km || val <= 0 || km <= 0) {
      setError('Preencha valor e distância corretamente.');
      return;
    }

    if (costPerKm === null || minIdealKm === null) {
      setError('Faça um cálculo diário primeiro para ter sua base de custo.');
      return;
    }

    const ridePerKm = val / km;

    let v: Verdict;
    if (ridePerKm >= minIdealKm) v = 'good';
    else if (ridePerKm >= costPerKm) v = 'ok';
    else v = 'bad';

    setVerdict(v);
    setDetails({ costPerKm, minIdealKm, ridePerKm });
  };

  const verdictConfig = {
    good: { bg: 'bg-profit', emoji: '🟢', label: 'Boa corrida — acima do mínimo ideal', text: 'text-profit' },
    ok: { bg: 'bg-accent', emoji: '🟡', label: 'Corrida aceitável — lucro baixo', text: 'text-accent' },
    bad: { bg: 'bg-loss', emoji: '🔴', label: 'Corrida ruim — prejuízo', text: 'text-loss' },
  };

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Cost base info */}
      {costPerKm !== null && minIdealKm !== null ? (
        <div className="bg-card rounded-lg p-4 border shadow-sm">
          <p className="text-xs text-muted-foreground mb-2">📊 Base do último cálculo</p>
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Custo real/km</p>
              <p className="font-display font-bold text-foreground">{fmt(costPerKm)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Mínimo ideal/km</p>
              <p className="font-display font-bold text-primary">{fmt(minIdealKm)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-secondary rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">⚠️ Faça um cálculo diário primeiro para ter sua base de custo por km.</p>
        </div>
      )}

      {/* Quick input */}
      <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
        <p className="font-display font-semibold text-foreground">🚀 Analisar Corrida Rápida</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Valor da corrida</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input type="number" inputMode="decimal" step="any" min="0" value={rideValue} onChange={e => setRideValue(e.target.value)} placeholder="15" className="pl-9 h-12 text-base" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Distância (km)</Label>
            <Input type="number" inputMode="decimal" step="any" min="0" value={rideKm} onChange={e => setRideKm(e.target.value)} placeholder="8" className="h-12 text-base" />
          </div>
        </div>
        {error && <p className="text-destructive text-sm font-medium">{error}</p>}
        <Button onClick={analyze} size="lg" className="w-full h-12 text-base font-display font-semibold">
          Analisar Corrida
        </Button>
      </div>

      {/* Verdict */}
      {verdict && details && (
        <div className="space-y-3 animate-slide-up">
          <div className={`rounded-xl p-6 text-center shadow-lg ${verdictConfig[verdict].bg}`}>
            <p className="text-3xl mb-1">{verdictConfig[verdict].emoji}</p>
            <p className="text-lg font-display font-bold text-primary-foreground">{verdictConfig[verdict].label}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card rounded-lg p-3 border shadow-sm text-center">
              <p className="text-[10px] text-muted-foreground">Custo/km</p>
              <p className="font-display font-bold text-sm text-foreground">{fmt(details.costPerKm)}</p>
            </div>
            <div className="bg-card rounded-lg p-3 border shadow-sm text-center">
              <p className="text-[10px] text-muted-foreground">Mínimo/km</p>
              <p className="font-display font-bold text-sm text-primary">{fmt(details.minIdealKm)}</p>
            </div>
            <div className="bg-card rounded-lg p-3 border shadow-sm text-center">
              <p className="text-[10px] text-muted-foreground">Corrida/km</p>
              <p className={`font-display font-bold text-sm ${verdictConfig[verdict].text}`}>{fmt(details.ridePerKm)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
