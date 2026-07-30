/**
 * SessionWelcome — Sprint 10.1 (Ritual de Entrada).
 * Apenas apresentação: lê estados já existentes (meta, veículo, permissões).
 */
import { useEffect, useState } from 'react';
import { ArrowRight, Check, Minus, Clock, Target, Car } from 'lucide-react';
import BrandMark from '@/components/brand/BrandMark';
import { haptics } from '@/lib/haptics';
import { vehicleService } from '@/lib/services/vehicleService';
import { getBackgroundPermissionStatus } from '@/lib/bgPermission';
import SessionLayout from './SessionLayout';
import { formatDuracao } from './SessionHero';

interface Props {
  metaDaily: number;
  /** Lucro/hora médio já calculado pelo MetricsService (0 quando indisponível). */
  lucroPorHora?: number;
  onStart: () => void;
  onCancel: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 border ${
          ok ? 'bg-primary/15 border-primary/50 text-primary' : 'border-border text-muted-foreground'
        }`}
      >
        {ok ? <Check size={12} /> : <Minus size={12} />}
      </span>
      <p className={`text-sm ${ok ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold inline-flex items-center gap-1.5">
        {icon} {label}
      </span>
      <span className="kpi-display font-mono-num text-foreground text-base">{value}</span>
    </div>
  );
}

export default function SessionWelcome({ metaDaily, lucroPorHora = 0, onStart, onCancel }: Props) {
  const [veiculo] = useState(() => vehicleService.getActive());
  const [gpsOk, setGpsOk] = useState(false);
  const [bgOk, setBgOk] = useState(false);

  useEffect(() => {
    let alive = true;
    getBackgroundPermissionStatus()
      .then(s => {
        if (!alive) return;
        setGpsOk(s.foregroundLocationGranted && s.locationServicesEnabled);
        setBgOk(s.backgroundLocationGranted);
      })
      .catch(() => { /* noop */ });
    return () => { alive = false; };
  }, []);

  const previstoMin = metaDaily > 0 && lucroPorHora > 0
    ? Math.round((metaDaily / lucroPorHora) * 60)
    : 0;

  return (
    <SessionLayout>
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 py-6">
        <BrandMark size="lg" glow="soft" className="animate-count-up" />

        <div className="space-y-2">
          <p className="text-micro uppercase tracking-[0.28em] text-primary font-display font-semibold">
            Sessão Visionária
          </p>
          <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">
            Hoje é uma nova oportunidade.
          </h2>
        </div>

        <div className="w-full card-highlight p-5 text-left">
          <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold">
            Meta do dia
          </p>
          <p className="kpi-display font-mono-num text-neon text-4xl mt-2">
            {metaDaily > 0 ? fmt(metaDaily) : '—'}
          </p>

          <div className="mt-4 divide-y divide-border/60 border-t border-border/60">
            <InfoRow
              icon={<Clock size={11} className="text-primary" />}
              label="Tempo previsto"
              value={previstoMin > 0 ? formatDuracao(previstoMin) : '—'}
            />
            <InfoRow
              icon={<Car size={11} className="text-primary" />}
              label="Veículo"
              value={veiculo?.nome_veiculo || '—'}
            />
          </div>
        </div>

        <div className="w-full card-premium p-5 text-left space-y-2.5">
          <p className="text-micro uppercase tracking-[0.18em] text-muted-foreground font-display font-semibold inline-flex items-center gap-1.5">
            <Target size={11} className="text-primary" /> Checklist
          </p>
          <ChecklistItem ok={gpsOk} label="GPS ativo" />
          <ChecklistItem ok={bgOk} label="Localização em segundo plano" />
          <ChecklistItem ok={!!veiculo} label="Veículo selecionado" />
          <ChecklistItem ok={metaDaily > 0} label="Meta carregada" />
        </div>

        <div className="space-y-1">
          <p className="text-sm text-foreground">Tudo pronto.</p>
          <p className="text-caption text-muted-foreground">Boa jornada. Dirija com segurança.</p>
        </div>
      </div>

      <div className="space-y-3 pt-4">
        <button
          onClick={() => { haptics.medium(); onStart(); }}
          className="w-full p-4 rounded-xl bg-profit-gradient text-primary-foreground font-display font-bold text-base shadow-glow press inline-flex items-center justify-center gap-2"
        >
          INICIAR SESSÃO <ArrowRight size={18} />
        </button>
        <button
          onClick={onCancel}
          className="w-full p-3 rounded-xl border border-border text-muted-foreground font-display font-semibold text-sm hover:text-foreground transition-colors press"
        >
          Cancelar
        </button>
      </div>
    </SessionLayout>
  );
}
