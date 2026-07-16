-- Sprint 6.2.5: adiciona coluna 'gamification' ao user_data para sync do XP+Conquistas.
-- Reutiliza o pipeline existente do CloudSync. Nenhuma tabela nova. Nenhuma RLS nova.
ALTER TABLE public.user_data
  ADD COLUMN IF NOT EXISTS gamification jsonb NOT NULL
  DEFAULT '{"schemaVersion":1,"xp":{"totalXp":0},"achievements":[],"stats":{},"updatedAt":null}'::jsonb;