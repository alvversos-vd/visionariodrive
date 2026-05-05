-- Tabela única de sincronização na nuvem por usuário (JSON)
CREATE TABLE public.user_data (
  user_id UUID NOT NULL PRIMARY KEY,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  rides JSONB NOT NULL DEFAULT '[]'::jsonb,
  goals JSONB NOT NULL DEFAULT '{"daily":0,"weekly":0,"monthly":0}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{"profitMargin":1.3,"currency":"BRL","estimatedHours":8}'::jsonb,
  vehicles JSONB NOT NULL DEFAULT '[]'::jsonb,
  ride_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own data" ON public.user_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own data" ON public.user_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own data" ON public.user_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own data" ON public.user_data FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_data_updated_at
BEFORE UPDATE ON public.user_data
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_data REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_data;