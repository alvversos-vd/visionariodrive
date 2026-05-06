import { useState, useMemo, useEffect, useRef } from 'react';
import { getEntries, getSettings, getVehicles, getRideTypes, saveRide } from '@/lib/storage';
import { RideEntry } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getLastAvoidAt, markAvoidNow } from '@/lib/engagement';

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
  const [touched, setTouched] = useState<{ value: boolean; km: boolean }>({ value: false, km: false });
  const vehicles = useMemo(() => getVehicles(), [refresh]);
  const rideTypes = useMemo(() => getRideTypes(), [refresh]);
  const [vehicle, setVehicle] = useState<string>('');
  const [rideType, setRideType] = useState<string>('');

  const valueError =
    touched.value && rideValue === '' ? 'Informe o valor' :
    rideValue !== '' && (Number.isNaN(Number(rideValue)) || Number(rideValue) <= 0) ? 'Deve ser maior que zero' :
    undefined;
  const kmError =
    touched.km && rideKm === '' ? 'Informe a distância' :
    rideKm !== '' && (Number.isNaN(Number(rideKm)) || Number(rideKm) <= 0) ? 'Deve ser maior que zero' :
    undefined;

  const handleNumber = (setter: (v: string) => void) => (raw: string) => {
    if (raw === '' || parseFloat(raw) >= 0) setter(raw);
  };

  const latestEntry = useMemo(() => {
    const entries = getEntries();
    return entries.length > 0 ? entries[0] : null;
  }, [refresh]);

  const settings = useMemo(() => getSettings(), [refresh]);

  const costPerKm = latestEntry && latestEntry.kmDriven > 0
    ? latestEntry.totalCost / latestEntry.kmDriven
    : null;

  const minIdealKm = costPerKm !== null ? costPerKm * settings.profitMargin : null;

  // Realtime calculation
  useEffect(() => {
    setError('');
    const val = parseFloat(rideValue);
    const km = parseFloat(rideKm);

    if (!val || !km || val <= 0 || km <= 0) {
      setVerdict(null);
      setDetails(null);
      return;
    }

    if (costPerKm === null || minIdealKm === null) {
      setVerdict(null);
      setDetails(null);
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
  }, [rideValue, rideKm, costPerKm, minIdealKm]);

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
        <div className="flex items-center justify-between">
          <p className="font-display font-semibold text-foreground">🚀 Análise Rápida</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tempo real</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Valor da corrida</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
              <Input
                type="number" inputMode="decimal" step="any" min="0"
                value={rideValue}
                onChange={e => handleNumber(setRideValue)(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, value: true }))}
                placeholder="15"
                aria-invalid={!!valueError}
                className={`pl-9 h-12 text-base ${valueError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
            </div>
            {valueError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{valueError}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Distância (km)</Label>
            <Input
              type="number" inputMode="decimal" step="any" min="0"
              value={rideKm}
              onChange={e => handleNumber(setRideKm)(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, km: true }))}
              placeholder="8"
              aria-invalid={!!kmError}
              className={`h-12 text-base ${kmError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {kmError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{kmError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Veículo</Label>
            <Select value={vehicle} onValueChange={setVehicle}>
              <SelectTrigger className="h-11 text-sm">
                <SelectValue placeholder={vehicles.length === 0 ? 'Cadastre em Config.' : 'Selecione'} />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Tipo</Label>
            <Select value={rideType} onValueChange={setRideType}>
              <SelectTrigger className="h-11 text-sm">
                <SelectValue placeholder={rideTypes.length === 0 ? 'Cadastre em Config.' : 'Selecione'} />
              </SelectTrigger>
              <SelectContent>
                {rideTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error && <p className="text-destructive text-sm font-medium flex items-center gap-1"><AlertCircle size={14} />{error}</p>}
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

          <Button
            type="button"
            onClick={() => {
              if (!verdict || !details) return;
              const val = parseFloat(rideValue);
              const km = parseFloat(rideKm);
              const ride: RideEntry = {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                value: val,
                km,
                costPerKm: details.costPerKm,
                minIdealKm: details.minIdealKm,
                ridePerKm: details.ridePerKm,
                profit: val - details.costPerKm * km,
                verdict,
                vehicle: vehicle || undefined,
                rideType: rideType || undefined,
              };
              saveRide(ride);
              toast.success('Corrida salva no histórico');
              setRideValue('');
              setRideKm('');
              setVerdict(null);
              setDetails(null);
              setTouched({ value: false, km: false });
            }}
            className="w-full h-11 font-display font-semibold gap-2"
          >
            <Save size={16} /> Salvar corrida no histórico
          </Button>
        </div>
      )}
    </div>
  );
}
