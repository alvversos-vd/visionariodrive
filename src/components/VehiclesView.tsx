import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Check, Bike, Car, Zap, Truck, X } from 'lucide-react';
import { vehicleService, type Vehicle } from '@/lib/services/vehicleService';
import type { TipoVeiculo, TipoCombustivel } from '@/lib/vehicles';
import { TIPO_LABEL } from '@/lib/vehicles';

interface Props {
  onChange?: () => void;
  onClose?: () => void;
  forceOnboarding?: boolean;
}

const TIPOS: { key: TipoVeiculo; label: string; Icon: typeof Bike }[] = [
  { key: 'moto', label: 'Moto', Icon: Truck },
  { key: 'carro', label: 'Carro', Icon: Car },
  { key: 'bike', label: 'Bike', Icon: Bike },
  { key: 'bike_eletrica', label: 'Bike elétrica', Icon: Zap },
];

export default function VehiclesView({ onChange, onClose, forceOnboarding }: Props) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => vehicleService.list());
  const [activeId, setActive] = useState<string | null>(() => vehicleService.getActiveId());
  const [adding, setAdding] = useState(forceOnboarding || vehicles.length === 0);

  const refresh = () => {
    setVehicles(vehicleService.list());
    setActive(vehicleService.getActiveId());
    onChange?.();
  };

  const handleSetActive = (id: string) => {
    vehicleService.setActive(id);
    refresh();
    toast.success('Veículo ativo atualizado');
  };

  const handleDelete = (id: string) => {
    vehicleService.remove(id);
    refresh();
    toast('Veículo removido');
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-lg">🚗 Meus veículos</h2>
          <p className="text-xs text-muted-foreground">Cada turno usa um veículo. Cálculos vêm daqui.</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        )}
      </div>

      {forceOnboarding && (
        <div className="rounded-xl p-4 bg-primary/10 border border-primary/30">
          <p className="font-display font-bold text-foreground">Vamos configurar seu veículo 👊</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre pelo menos 1 veículo para começar a usar o app.</p>
        </div>
      )}

      {!adding && vehicles.length > 0 && (
        <div className="space-y-2">
          {vehicles.map(v => {
            const isActive = activeId === v.veiculo_id || (!activeId && v === vehicles[0]);
            return (
              <div key={v.veiculo_id} className={`rounded-lg p-3 border ${isActive ? 'border-primary bg-primary/5' : 'bg-card'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm flex items-center gap-1.5">
                      {TIPO_LABEL[v.tipo_veiculo]} · {v.nome_veiculo}
                      {isActive && <span className="text-micro font-display text-primary flex items-center gap-0.5"><Check size={10}/> Ativo</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {v.marca || ''} {v.modelo || ''} {v.ano ? `· ${v.ano}` : ''}
                      {v.placa ? ` · ${v.placa}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-caption text-muted-foreground">
                      {v.km_por_litro && <span>⛽ {v.km_por_litro} km/L</span>}
                      {v.valor_combustivel_litro > 0 && <span>R$ {v.valor_combustivel_litro.toFixed(2)}/L</span>}
                      {v.custo_fixo_mensal > 0 && <span>📅 R$ {v.custo_fixo_mensal.toFixed(0)}/mês</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!isActive && (
                      <button onClick={() => handleSetActive(v.veiculo_id)} className="text-micro px-2 py-1 rounded bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
                        Tornar ativo
                      </button>
                    )}
                    <button onClick={() => handleDelete(v.veiculo_id)} className="text-micro px-2 py-1 rounded text-loss hover:bg-loss/10 flex items-center gap-1 justify-center">
                      <Trash2 size={10} /> Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button onClick={() => setAdding(true)} className="w-full p-3 rounded-lg border-2 border-dashed border-border text-sm font-display font-semibold text-primary hover:border-primary transition-colors flex items-center justify-center gap-2">
            <Plus size={16} /> Adicionar veículo
          </button>
        </div>
      )}

      {adding && (
        <VehicleForm
          onSaved={() => { setAdding(false); refresh(); }}
          onCancel={vehicles.length > 0 ? () => setAdding(false) : undefined}
        />
      )}
    </div>
  );
}

function VehicleForm({ onSaved, onCancel }: { onSaved: () => void; onCancel?: () => void }) {
  const [tipo, setTipo] = useState<TipoVeiculo | null>(null);
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [placa, setPlaca] = useState('');
  const [kmL, setKmL] = useState('');
  const [combustivel, setCombustivel] = useState<TipoCombustivel>('gasolina');
  const [valorL, setValorL] = useState('');
  const [fixo, setFixo] = useState('');

  if (!tipo) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-display font-semibold">Qual o tipo do seu veículo?</p>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map(t => (
            <button
              key={t.key}
              onClick={() => {
                setTipo(t.key);
                if (t.key === 'bike') { setCombustivel('nenhum'); }
                else if (t.key === 'bike_eletrica') { setCombustivel('eletrico'); }
              }}
              className="p-4 rounded-lg border bg-card hover:border-primary text-left"
            >
              <t.Icon size={22} className="text-primary mb-1.5" />
              <p className="font-display font-bold text-sm">{t.label}</p>
            </button>
          ))}
        </div>
        {onCancel && (
          <button onClick={onCancel} className="w-full text-xs text-muted-foreground py-1">Cancelar</button>
        )}
      </div>
    );
  }

  const isMotor = tipo === 'moto' || tipo === 'carro';
  const isEletrica = tipo === 'bike_eletrica';

  const handleSave = () => {
    if (!nome.trim()) { toast.error('Dê um nome ao veículo'); return; }
    if (isMotor && (!kmL || parseFloat(kmL) <= 0)) { toast.error('Informe km/L'); return; }
    vehicleService.add({
      tipo_veiculo: tipo,
      nome_veiculo: nome.trim(),
      marca: marca.trim() || undefined,
      modelo: modelo.trim() || undefined,
      ano: ano ? parseInt(ano) : undefined,
      placa: placa.trim() || undefined,
      km_por_litro: isMotor ? parseFloat(kmL.replace(',', '.')) : isEletrica && kmL ? parseFloat(kmL.replace(',', '.')) : null,
      tipo_combustivel: combustivel,
      valor_combustivel_litro: parseFloat(valorL.replace(',', '.')) || 0,
      custo_fixo_mensal: parseFloat(fixo.replace(',', '.')) || 0,
    });
    toast.success('Veículo salvo 👊');
    onSaved();
  };

  return (
    <div className="space-y-3 bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <p className="font-display font-bold text-sm">{TIPO_LABEL[tipo]}</p>
        <button onClick={() => setTipo(null)} className="text-xs text-muted-foreground">Trocar tipo</button>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Nome / apelido *</label>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Honda Vermelha" className="w-full px-3 py-2 rounded-md border bg-background" />
      </div>

      {isMotor && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Marca</label>
              <input value={marca} onChange={e => setMarca(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Modelo</label>
              <input value={modelo} onChange={e => setModelo(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ano</label>
              <input type="number" value={ano} onChange={e => setAno(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Placa (opcional)</label>
              <input value={placa} onChange={e => setPlaca(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background uppercase" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo de combustível</label>
            <select value={combustivel} onChange={e => setCombustivel(e.target.value as TipoCombustivel)} className="w-full px-3 py-2 rounded-md border bg-background">
              <option value="gasolina">Gasolina</option>
              <option value="etanol">Etanol</option>
              <option value="diesel">Diesel</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Km por litro *</label>
              <input type="number" inputMode="decimal" value={kmL} onChange={e => setKmL(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background" placeholder="35" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">R$ / litro</label>
              <input type="number" inputMode="decimal" value={valorL} onChange={e => setValorL(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background" placeholder="5,50" />
            </div>
          </div>
        </>
      )}

      {isEletrica && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Custo/recarga (R$) opcional</label>
            <input type="number" inputMode="decimal" value={valorL} onChange={e => setValorL(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background" placeholder="0" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Km por recarga (opcional)</label>
            <input type="number" inputMode="decimal" value={kmL} onChange={e => setKmL(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background" placeholder="60" />
          </div>
        </div>
      )}

      <div>
        <label className="text-xs text-muted-foreground">Custo fixo mensal (opcional)</label>
        <input type="number" inputMode="decimal" value={fixo} onChange={e => setFixo(e.target.value)} className="w-full px-3 py-2 rounded-md border bg-background" placeholder="Parcela, seguro, manutenção..." />
      </div>

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button onClick={onCancel} className="flex-1 p-2.5 rounded-lg bg-secondary text-foreground text-sm">Cancelar</button>
        )}
        <button onClick={handleSave} className="flex-1 p-2.5 rounded-lg bg-primary text-primary-foreground font-display font-bold">
          Salvar veículo
        </button>
      </div>
    </div>
  );
}
