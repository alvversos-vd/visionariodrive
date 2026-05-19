import { useMemo, useState } from 'react';
import { getSettings, saveSettings, resetAllData, getVehicles, saveVehicles, getRideTypes, saveRideTypes } from '@/lib/storage';
import { AppSettings, DEFAULT_ALERT_THRESHOLDS } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import TagListEditor from './TagListEditor';
import VehiclesView from './VehiclesView';

interface Props {
  refresh: number;
  onChanged: () => void;
}

export default function SettingsView({ refresh, onChanged }: Props) {
  const initial = useMemo(() => getSettings(), [refresh]);
  const [marginPct, setMarginPct] = useState(String(((initial.profitMargin - 1) * 100).toFixed(0)));
  const [estHours, setEstHours] = useState(String(initial.estimatedHours));
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState(false);
  const [vehicles, setVehicles] = useState<string[]>(() => getVehicles());
  const [rideTypes, setRideTypes] = useState<string[]>(() => getRideTypes());
  const initialAlerts = { ...DEFAULT_ALERT_THRESHOLDS, ...(initial.alertThresholds || {}) };
  const [alertMaxHoras, setAlertMaxHoras] = useState(String(initialAlerts.maxHorasTurno));
  const [alertMinLucroHora, setAlertMinLucroHora] = useState(String(initialAlerts.minLucroHora));
  const [alertMaxCustoPct, setAlertMaxCustoPct] = useState(String(initialAlerts.maxCustoPct));

  const updateVehicles = (list: string[]) => {
    setVehicles(list);
    saveVehicles(list);
    onChanged();
  };
  const updateRideTypes = (list: string[]) => {
    setRideTypes(list);
    saveRideTypes(list);
    onChanged();
  };

  const handleSave = () => {
    const pct = parseFloat(marginPct);
    const hrs = parseFloat(estHours);
    if (isNaN(pct) || pct < 0 || pct > 500) return;
    if (isNaN(hrs) || hrs <= 0 || hrs > 24) return;
    const mh = Math.max(0, Number(alertMaxHoras) || 0);
    const ml = Math.max(0, Number(alertMinLucroHora) || 0);
    const mc = Math.min(100, Math.max(0, Number(alertMaxCustoPct) || 0));
    const next: AppSettings = {
      ...initial,
      profitMargin: 1 + pct / 100,
      estimatedHours: hrs,
      alertThresholds: { maxHorasTurno: mh, minLucroHora: ml, maxCustoPct: mc },
    };
    saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChanged();
  };

  const handleReset = () => {
    resetAllData();
    setConfirmReset(false);
    onChanged();
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
        <p className="font-display font-semibold text-foreground">⚙️ Margem de lucro</p>
        <p className="text-xs text-muted-foreground">
          Quanto acima do custo por km você considera uma corrida boa. Padrão: 30%.
        </p>
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Margem (%)</Label>
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={marginPct}
              onChange={e => setMarginPct(e.target.value)}
              className="pr-9 h-12 text-base"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
        <p className="font-display font-semibold text-foreground">⏱️ Jornada estimada</p>
        <p className="text-xs text-muted-foreground">
          Quantas horas você planeja trabalhar por dia. Usado para calcular a previsão.
        </p>
        <div className="space-y-1.5">
          <Label className="text-sm text-muted-foreground">Horas estimadas</Label>
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              max="24"
              value={estHours}
              onChange={e => setEstHours(e.target.value)}
              className="pr-9 h-12 text-base"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">h</span>
          </div>
        </div>
        <Button onClick={handleSave} className="w-full h-11 font-display font-semibold">
          {saved ? '✓ Salvo' : 'Salvar configurações'}
        </Button>
      </div>

      <div className="bg-card rounded-lg p-4 border shadow-sm">
        <VehiclesView onChange={onChanged} />
      </div>

      <TagListEditor
        title="Tipos de corrida"
        emoji="📦"
        description="Apps ou categorias que você usa (iFood, Uber, particular...)."
        placeholder="Ex: iFood, Uber, 99"
        items={rideTypes}
        onChange={updateRideTypes}
      />

      <div className="bg-card rounded-lg p-4 border shadow-sm space-y-2">
        <p className="font-display font-semibold text-foreground">💱 Moeda</p>
        <p className="text-sm text-muted-foreground">Real brasileiro (R$) — padrão.</p>
      </div>

      <div className="bg-card rounded-lg p-4 border-2 border-destructive/30 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-destructive" size={18} />
          <p className="font-display font-semibold text-foreground">Zona de perigo</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Apaga todos os cálculos, metas e configurações. Não pode ser desfeito.
        </p>
        {!confirmReset ? (
          <Button variant="outline" onClick={() => setConfirmReset(true)} className="w-full">
            Resetar todos os dados
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmReset(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReset} className="flex-1">
              Confirmar reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
