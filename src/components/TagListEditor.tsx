import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Plus, Pencil, Check } from 'lucide-react';

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
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

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

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditDraft(items[idx]);
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditDraft('');
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const v = editDraft.trim();
    if (!v) { cancelEdit(); return; }
    const dupe = items.some((it, i) => i !== editingIdx && it.toLowerCase() === v.toLowerCase());
    if (dupe) { cancelEdit(); return; }
    const next = items.slice();
    next[editingIdx] = v;
    onChange(next);
    cancelEdit();
  };

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
        <ul className="space-y-1.5">
          {items.map((item, idx) => {
            const isEditing = editingIdx === idx;
            return (
              <li
                key={item + idx}
                className="flex items-center gap-2 bg-secondary/60 rounded-md pl-3 pr-1 py-1"
              >
                {isEditing ? (
                  <>
                    <Input
                      autoFocus
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                        if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                      }}
                      className="h-9 text-sm flex-1"
                    />
                    <button
                      type="button"
                      onClick={commitEdit}
                      className="p-1.5 rounded-md text-profit hover:bg-profit/10"
                      aria-label="Salvar"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-foreground truncate">{item}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(idx)}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      aria-label={`Editar ${item}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Excluir ${item}`}
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
