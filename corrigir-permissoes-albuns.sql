-- =========================================================
-- MOTAZT STUDIO — PERMISSÕES DA GALERIA PRIVADA
-- Usa a tabela existente public.galerias e a tabela public.fotos.
-- Não apaga dados e não depende da RPC criar_novo_album.
-- =========================================================

BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- A versão antiga tinha cliente_email. O novo painel usa telefone.
-- O e-mail antigo é preservado para não apagar dados históricos.
ALTER TABLE public.galerias
    ADD COLUMN IF NOT EXISTS cliente_telefone TEXT;

-- Evita que registros antigos exijam e-mail ou agendamento depois da migração.
ALTER TABLE public.galerias
    ALTER COLUMN cliente_email DROP NOT NULL;

-- O painel atual cria a galeria manualmente, sem agendamento.
ALTER TABLE public.galerias
    ALTER COLUMN agendamento_id DROP NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.galerias TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fotos TO anon, authenticated;

ALTER TABLE public.galerias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;

-- Políticas da tabela de álbuns privados.
DROP POLICY IF EXISTS galerias_select_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_insert_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_update_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_delete_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_leitura_publica ON public.galerias;
DROP POLICY IF EXISTS galerias_operacoes_admin ON public.galerias;

CREATE POLICY galerias_select_publico
    ON public.galerias FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY galerias_insert_publico
    ON public.galerias FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY galerias_update_publico
    ON public.galerias FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY galerias_delete_publico
    ON public.galerias FOR DELETE
    TO anon, authenticated
    USING (true);

-- Políticas da tabela de fotos vinculadas pelo galeria_id.
DROP POLICY IF EXISTS fotos_select_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_insert_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_update_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_delete_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_leitura_publica ON public.fotos;
DROP POLICY IF EXISTS fotos_operacoes_admin ON public.fotos;

CREATE POLICY fotos_select_publico
    ON public.fotos FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY fotos_insert_publico
    ON public.fotos FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY fotos_update_publico
    ON public.fotos FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY fotos_delete_publico
    ON public.fotos FOR DELETE
    TO anon, authenticated
    USING (true);

-- Atualiza o cache do PostgREST depois da alteração estrutural.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verificação esperada após executar o script.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('galerias', 'fotos')
ORDER BY table_name, ordinal_position;

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('galerias', 'fotos')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('galeria', 'galerias', 'fotos')
ORDER BY table_name;
