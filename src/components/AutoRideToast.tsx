/**
 * AutoRideToast — Sprint 4.
 *
 * Componente invisível montado uma vez em <App/>. Escuta o
 * `rideDetectionService` via eventBus (`detection:changed`) e:
 *
 *   pending detectado  → toast persistente com Confirmar/Editar/Descartar
 *   confirmado         → toast curto com "Desfazer" (undo)
 *
 * Zero polling. Zero acesso a storage. Zero regra de negócio.
 * Só orquestra a UI da automação e devolve controle ao motorista.
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useBusVersion } from '@/hooks/useBusVersion';
import { rideDetectionService, type PendingRide } from '@/lib/services/rideDetectionService';
import { getRideDetectionConfig } from '@/lib/rideDetectionConfig';
import { rideService } from '@/lib/services/rideService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PENDING_TOAST_ID = 'auto-ride-pending';
const CONFIRMED_TOAST_ID = 'auto-ride-confirmed';

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function PendingCard({
  pending, onDone, initialEditing = false,
}: { pending: PendingRide; onDone: () => void; initialEditing?: boolean }) {
  const [editing, setEditing] = useState(initialEditing);
  const [value, setValue] = useState<string>('');
  const [km, setKm] = useState<string>(pending.distanceKm.toFixed(1));

  const handleConfirm = () => {
    const v = parseFloat(value.replace(',', '.')) || 0;
    const k = parseFloat(km.replace(',', '.')) || pending.distanceKm;
    rideDetectionService.confirmPending({ value: v, km: k });
    onDone();
  };
  const handleDiscard = () => {
    rideDetectionService.discardPending();
    onDone();
  };

  if (editing) {
    return (
      <div className="w-full space-y-2">
        <p className="text-xs font-display font-semibold text-foreground">
          Ajustar corrida detectada
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor (R$)</span>
            <Input type="number" inputMode="decimal" step="any" min="0"
              value={value} onChange={e => setValue(e.target.value)} placeholder="0,00" className="h-9" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Km</span>
            <Input type="number" inputMode="decimal" step="any" min="0"
              value={km} onChange={e => setKm(e.target.value)} className="h-9" />
          </label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleConfirm} className="flex-1">Salvar</Button>
          <Button size="sm" variant="ghost" onClick={handleDiscard}>Descartar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div>
        <p className="text-xs font-display font-semibold text-foreground">
          Corrida detectada automaticamente
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {pending.distanceKm.toFixed(1)} km · {Math.round(pending.durationMin)} min
          <span className="ml-2 text-primary/80">· confiança {pending.confidence}%</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleConfirm} className="h-8">Confirmar</Button>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)} className="h-8">Editar</Button>
        <Button size="sm" variant="ghost" onClick={handleDiscard} className="h-8">Descartar</Button>
      </div>
    </div>
  );
}

export default function AutoRideToast() {
  const v = useBusVersion('detection:changed');
  // Sprint 7 · CP3 — sinal do plugin nativo: abrir toast já em modo edição.
  const editReq = useBusVersion('notification:edit-auto');
  const lastPendingIdRef = useRef<string | null>(null);
  const lastConfirmedIdRef = useRef<string | null>(null);
  const lastEditVersionRef = useRef<number>(0);

  useEffect(() => {
    const pending = rideDetectionService.getPending();
    const cfg = getRideDetectionConfig();

    // Sinal one-shot vindo da notificação nativa → reabrir toast em modo edit.
    const editTriggered = editReq !== lastEditVersionRef.current;
    lastEditVersionRef.current = editReq;

    if (pending) {
      const sameId = lastPendingIdRef.current === pending.id;
      if (sameId && !editTriggered) return;
      lastPendingIdRef.current = pending.id;
      toast(
        <PendingCard
          pending={pending}
          initialEditing={editTriggered}
          onDone={() => toast.dismiss(PENDING_TOAST_ID)}
        />,
        { id: PENDING_TOAST_ID, duration: cfg.pendingTimeoutSeconds * 1000 },
      );
      return;
    }

    // Sem pending → detecta se acabou de confirmar (existe uma última ride GPS auto).
    lastPendingIdRef.current = null;
    const lastGpsRide = rideService
      .list({ captureMode: 'gps' })
      .find(r => r.kmOrigin === 'auto');
    if (!lastGpsRide) return;
    if (lastGpsRide.id === lastConfirmedIdRef.current) return;
    const ageMs = Date.now() - new Date(lastGpsRide.date).getTime();
    if (ageMs > (cfg.undoWindowSeconds + 2) * 1000) return;
    lastConfirmedIdRef.current = lastGpsRide.id;

    toast.success('Corrida salva automaticamente', {
      id: CONFIRMED_TOAST_ID,
      description: `${lastGpsRide.km.toFixed(1)} km${lastGpsRide.value > 0 ? ` · ${fmtBRL(lastGpsRide.value)}` : ''}`,
      duration: cfg.undoWindowSeconds * 1000,
      action: {
        label: 'Desfazer',
        onClick: () => { rideDetectionService.undoConfirmed(lastGpsRide.id); },
      },
    });
  }, [v, editReq]);

  return null;
}
