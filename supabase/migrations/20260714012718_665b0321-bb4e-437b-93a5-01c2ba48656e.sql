-- Admins podem ler todos os profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins podem ler todos os user_data
CREATE POLICY "Admins can view all user_data"
  ON public.user_data
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));