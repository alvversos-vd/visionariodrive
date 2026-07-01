import { useState, useEffect } from 'react';
import { goalsService } from '@/lib/services/goalsService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function GoalSetting() {
  const [amount, setAmount] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const d = goalsService.getDaily();
    if (d > 0) setAmount(String(d));
  }, []);

  const handleSave = () => {
    const val = parseFloat(amount);
    if (val > 0) {
      goalsService.saveDaily(val);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="bg-card rounded-lg p-4 border shadow-sm">
      <p className="text-sm font-display font-semibold text-foreground mb-2">🎯 Meta Diária</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
          <Input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="150"
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={handleSave} size="sm" className="h-10 px-4">
          {saved ? '✓' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
