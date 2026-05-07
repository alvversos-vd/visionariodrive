import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateEntry, DailyEntry } from '@/lib/types';
import { saveEntry, getVehicles, getRideTypes } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Plus, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { shouldShowFixedCostsHint, markFixedCostsHintShown } from '@/lib/engagement';

interface Props {
  onCalculate: (entry: DailyEntry) => void;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  error?: string;
  required?: boolean;
}

function Field({ label, value, onChange, placeholder, prefix, error, required }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={value}
          onChange={e => {
            const v = e.target.value;
            // block negative typing
            if (v === '' || parseFloat(v) >= 0) onChange(v);
          }}
          placeholder={placeholder}
          aria-invalid={!!error}
          className={`h-12 text-base ${prefix ? 'pl-9' : ''} ${
            error ? 'border-destructive focus-visible:ring-destructive' : ''
          }`}
        />
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

type FormKey =
  | 'hoursWorked' | 'kmDriven' | 'totalEarnings'
  | 'fuelPrice' | 'vehicleConsumption'
  | 'installment' | 'maintenance' | 'insurance' | 'otherCosts';

type Form = Record<FormKey, string>;

const REQUIRED: FormKey[] = ['hoursWorked', 'kmDriven', 'totalEarnings', 'fuelPrice', 'vehicleConsumption'];
const POSITIVE: FormKey[] = ['hoursWorked', 'kmDriven', 'vehicleConsumption']; // > 0 (avoid div/0)

function validateField(key: FormKey, value: string): string | undefined {
  const isRequired = REQUIRED.includes(key);
  if (isRequired && value.trim() === '') return 'Campo obrigatório';
  if (value === '') return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) return 'Valor inválido';
  if (n < 0) return 'Não pode ser negativo';
  if (POSITIVE.includes(key) && n === 0) return 'Deve ser maior que zero';
  if (n > 1_000_000) return 'Valor muito alto';
  return undefined;
}

export default function DailyInputForm({ onCalculate }: Props) {
  const [form, setForm] = useState<Form>({
    hoursWorked: '', kmDriven: '', totalEarnings: '',
    fuelPrice: '', vehicleConsumption: '',
    installment: '', maintenance: '', insurance: '', otherCosts: '',
  });
  const [touched, setTouched] = useState<Partial<Record<FormKey, boolean>>>({});
  const vehicles = useMemo(() => getVehicles(), []);
  const rideTypes = useMemo(() => getRideTypes(), []);
  const [vehicle, setVehicle] = useState<string>('');
  const [rideType, setRideType] = useState<string>('');
  const [showFixed, setShowFixed] = useState(false);
  const hintShownRef = useRef(false);

  // Auto-expandir custos fixos se já houver algum valor (modo completo)
  const hasAnyFixed = !!(form.installment || form.maintenance || form.insurance || form.otherCosts);
  const sectionOpen = showFixed || hasAnyFixed;

  useEffect(() => {
    if (!sectionOpen && shouldShowFixedCostsHint()) {
      markFixedCostsHintShown();
      toast('Você pode adicionar custos fixos para ter um cálculo mais preciso', { icon: '💡' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (key: FormKey) => (v: string) => {
    setForm(prev => ({ ...prev, [key]: v }));
    setTouched(prev => ({ ...prev, [key]: true }));
  };

  const errors = useMemo(() => {
    const e: Partial<Record<FormKey, string>> = {};
    (Object.keys(form) as FormKey[]).forEach(k => {
      const err = validateField(k, form[k]);
      if (err) e[k] = err;
    });
    return e;
  }, [form]);

  const showError = (k: FormKey) => (touched[k] ? errors[k] : undefined);

  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = () => {
    // mark all touched to surface errors
    const allTouched = Object.keys(form).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<FormKey, boolean>);
    setTouched(allTouched);
    if (!isValid) return;

    const n = (k: FormKey) => parseFloat(form[k]) || 0;

    const calculated = calculateEntry({
      hoursWorked: n('hoursWorked'), kmDriven: n('kmDriven'), totalEarnings: n('totalEarnings'),
      fuelPrice: n('fuelPrice'), vehicleConsumption: n('vehicleConsumption'),
      installment: n('installment'), maintenance: n('maintenance'),
      insurance: n('insurance'), otherCosts: n('otherCosts'),
      vehicle: vehicle || undefined,
      rideType: rideType || undefined,
    });

    const entry: DailyEntry = {
      ...calculated,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };

    saveEntry(entry);
    onCalculate(entry);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">📋 Dados do Dia</h2>
        <div className="bg-card rounded-lg p-4 space-y-3 shadow-sm border">
          <Field label="Horas trabalhadas" value={form.hoursWorked} onChange={set('hoursWorked')} placeholder="8" error={showError('hoursWorked')} required />
          <Field label="Km rodados" value={form.kmDriven} onChange={set('kmDriven')} placeholder="120" error={showError('kmDriven')} required />
          <Field label="Ganho total do dia" value={form.totalEarnings} onChange={set('totalEarnings')} placeholder="200" prefix="R$" error={showError('totalEarnings')} required />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-muted-foreground">Veículo</Label>
              <Select value={vehicle} onValueChange={setVehicle}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder={vehicles.length === 0 ? 'Cadastre em Config.' : 'Selecione'} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-muted-foreground">Tipo de corrida</Label>
              <Select value={rideType} onValueChange={setRideType}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder={rideTypes.length === 0 ? 'Cadastre em Config.' : 'Selecione'} />
                </SelectTrigger>
                <SelectContent>
                  {rideTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">⛽ Combustível</h2>
        <div className="bg-card rounded-lg p-4 space-y-3 shadow-sm border">
          <Field label="Preço do litro" value={form.fuelPrice} onChange={set('fuelPrice')} placeholder="5.89" prefix="R$" error={showError('fuelPrice')} required />
          <Field label="Consumo do veículo (km/l)" value={form.vehicleConsumption} onChange={set('vehicleConsumption')} placeholder="35" error={showError('vehicleConsumption')} required />
        </div>
      </div>

      {sectionOpen ? (
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">🔧 Custos Fixos Mensais <span className="text-xs text-muted-foreground font-normal">(opcional)</span></h2>
          <div className="bg-card rounded-lg p-4 space-y-3 shadow-sm border">
            <Field label="Parcela do veículo" value={form.installment} onChange={set('installment')} placeholder="500" prefix="R$" error={showError('installment')} />
            <Field label="Manutenção média" value={form.maintenance} onChange={set('maintenance')} placeholder="150" prefix="R$" error={showError('maintenance')} />
            <Field label="Seguro" value={form.insurance} onChange={set('insurance')} placeholder="100" prefix="R$" error={showError('insurance')} />
            <Field label="Outros custos" value={form.otherCosts} onChange={set('otherCosts')} placeholder="50" prefix="R$" error={showError('otherCosts')} />
            {!hasAnyFixed && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowFixed(false)}
                className="w-full text-muted-foreground gap-1.5"
              >
                <ChevronUp size={14} /> Ocultar custos fixos
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setShowFixed(true);
            if (!hintShownRef.current && shouldShowFixedCostsHint()) {
              hintShownRef.current = true;
              markFixedCostsHintShown();
            }
          }}
          className="w-full h-12 gap-2 border-dashed"
        >
          <Plus size={16} /> Adicionar custos fixos (opcional)
        </Button>
      )}

      {!isValid && Object.keys(touched).length > 0 && (
        <p className="text-destructive text-sm font-medium text-center flex items-center justify-center gap-1.5">
          <AlertCircle size={14} /> Corrija os campos destacados para calcular.
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!isValid}
        size="lg"
        className="w-full h-14 text-lg font-display font-semibold disabled:opacity-50"
      >
        Calcular Lucro
      </Button>
    </div>
  );
}
