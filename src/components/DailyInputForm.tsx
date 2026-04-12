import { useState } from 'react';
import { calculateEntry, DailyEntry } from '@/lib/types';
import { saveEntry } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  onCalculate: (entry: DailyEntry) => void;
}

function Field({ label, value, onChange, placeholder, prefix }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; prefix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-12 text-base ${prefix ? 'pl-9' : ''}`}
        />
      </div>
    </div>
  );
}

export default function DailyInputForm({ onCalculate }: Props) {
  const [form, setForm] = useState({
    hoursWorked: '', kmDriven: '', totalEarnings: '',
    fuelPrice: '', vehicleConsumption: '',
    installment: '', maintenance: '', insurance: '', otherCosts: '',
  });
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (v: string) => setForm(prev => ({ ...prev, [key]: v }));

  const handleSubmit = () => {
    setError('');
    const n = (k: keyof typeof form) => parseFloat(form[k]) || 0;

    if (!form.hoursWorked || !form.kmDriven || !form.totalEarnings || !form.fuelPrice || !form.vehicleConsumption) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    if (n('hoursWorked') <= 0 || n('kmDriven') <= 0 || n('vehicleConsumption') <= 0) {
      setError('Horas, km e consumo devem ser maiores que zero.');
      return;
    }

    const calculated = calculateEntry({
      hoursWorked: n('hoursWorked'), kmDriven: n('kmDriven'), totalEarnings: n('totalEarnings'),
      fuelPrice: n('fuelPrice'), vehicleConsumption: n('vehicleConsumption'),
      installment: n('installment'), maintenance: n('maintenance'),
      insurance: n('insurance'), otherCosts: n('otherCosts'),
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
          <Field label="Horas trabalhadas" value={form.hoursWorked} onChange={set('hoursWorked')} placeholder="8" />
          <Field label="Km rodados" value={form.kmDriven} onChange={set('kmDriven')} placeholder="120" />
          <Field label="Ganho total do dia" value={form.totalEarnings} onChange={set('totalEarnings')} placeholder="200" prefix="R$" />
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">⛽ Combustível</h2>
        <div className="bg-card rounded-lg p-4 space-y-3 shadow-sm border">
          <Field label="Preço do litro" value={form.fuelPrice} onChange={set('fuelPrice')} placeholder="5.89" prefix="R$" />
          <Field label="Consumo do veículo (km/l)" value={form.vehicleConsumption} onChange={set('vehicleConsumption')} placeholder="35" />
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">🔧 Custos Fixos Mensais</h2>
        <div className="bg-card rounded-lg p-4 space-y-3 shadow-sm border">
          <Field label="Parcela do veículo" value={form.installment} onChange={set('installment')} placeholder="500" prefix="R$" />
          <Field label="Manutenção média" value={form.maintenance} onChange={set('maintenance')} placeholder="150" prefix="R$" />
          <Field label="Seguro" value={form.insurance} onChange={set('insurance')} placeholder="100" prefix="R$" />
          <Field label="Outros custos" value={form.otherCosts} onChange={set('otherCosts')} placeholder="50" prefix="R$" />
        </div>
      </div>

      {error && <p className="text-destructive text-sm font-medium text-center">{error}</p>}

      <Button onClick={handleSubmit} size="lg" className="w-full h-14 text-lg font-display font-semibold">
        Calcular Lucro
      </Button>
    </div>
  );
}
