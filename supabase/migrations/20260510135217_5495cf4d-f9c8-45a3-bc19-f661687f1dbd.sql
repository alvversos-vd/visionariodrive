ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_veiculo_principal text,
  ADD COLUMN IF NOT EXISTS meta_lucro_diaria numeric,
  ADD COLUMN IF NOT EXISTS app_principal text,
  ADD COLUMN IF NOT EXISTS objetivo_principal text,
  ADD COLUMN IF NOT EXISTS onboarding_completo boolean NOT NULL DEFAULT false;