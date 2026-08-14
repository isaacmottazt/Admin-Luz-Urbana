-- =========================================================
-- MIGRAÇÃO DA GALERIA PRIVADA PARA TELEFONE
-- A tabela privada existente é public.galerias.
-- =========================================================

BEGIN;

ALTER TABLE public.galerias
    ADD COLUMN IF NOT EXISTS cliente_telefone TEXT;

ALTER TABLE public.galerias
    ALTER COLUMN cliente_email DROP NOT NULL;

ALTER TABLE public.galerias
    ALTER COLUMN agendamento_id DROP NOT NULL;

-- Mantém os registros antigos e não tenta transformar e-mails em telefones.
-- O painel passa a gravar e consultar somente cliente_telefone.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.galerias TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fotos TO anon, authenticated;

ALTER TABLE public.galerias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS galerias_select_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_insert_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_update_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_delete_publico ON public.galerias;

CREATE POLICY galerias_select_publico ON public.galerias
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY galerias_insert_publico ON public.galerias
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY galerias_update_publico ON public.galerias
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY galerias_delete_publico ON public.galerias
    FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS fotos_select_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_insert_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_update_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_delete_publico ON public.fotos;

CREATE POLICY fotos_select_publico ON public.fotos
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY fotos_insert_publico ON public.fotos
    FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY fotos_update_publico ON public.fotos
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY fotos_delete_publico ON public.fotos
    FOR DELETE TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';
COMMIT;
