import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';

interface Props {
  title: string;
  emoji?: string;
  description?: string;
  placeholder?: string;
  items: string[];
  onChange: (items: string[]) => void;
}

export default function TagListEditor({ title, emoji, description, placeholder, items, onChange }: Props) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.some(i => i.toLowerCase() === v.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...items, v]);
    setDraft('');
  };

  const remove = (name: string) => onChange(items.filter(i => i !== name));

  return (
    <div className="bg-card rounded-lg p-4 border shadow-sm space-y-3">
      <div>
        <p className="font-display font-semibold text-foreground">
          {emoji && <span className="mr-1">{emoji}</span>}{title}
        </p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-11 text-base"
        />
        <Button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="h-11 px-3"
          aria-label="Adicionar"
        >
          <Plus size={16} />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum item cadastrado.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map(item => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 bg-secondary text-foreground rounded-full pl-3 pr-1 py-1 text-sm"
            >
              {item}
              <button
                type="button"
                onClick={() => remove(item)}
                className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                aria-label={`Remover ${item}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
