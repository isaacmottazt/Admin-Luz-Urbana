-- =========================================================
-- MOTAZT STUDIO — REFORÇO DE SEGURANÇA RLS
-- =========================================================
-- Este script separa dados públicos de dados administrativos:
-- * anon lê somente views públicas, sem telefone, e-mail ou agendamento;
-- * authenticated gerencia tabelas reais no Admin;
-- * anon não recebe INSERT, UPDATE ou DELETE nas tabelas reais;
-- * favoritos são alterados por uma função controlada, apenas para fotos
--   pertencentes a álbuns ativos e não expirados.
--
-- O bucket fotos permanece público nesta etapa porque o Site atual usa URLs
-- públicas. Torná-lo privado exige migrar o carregamento para URLs assinadas.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. Permissões das tabelas reais
-- =========================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.galerias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fotos TO authenticated;
GRANT SELECT ON TABLE public.galeria, public.destaques TO anon, authenticated;

REVOKE ALL ON TABLE public.galerias FROM anon;
REVOKE ALL ON TABLE public.fotos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.galeria FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.destaques FROM anon;

ALTER TABLE public.galerias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galeria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destaques ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. Limpeza das políticas abertas antigas
-- =========================================================
DO $$
DECLARE
    politica record;
BEGIN
    FOR politica IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('galerias', 'fotos', 'galeria', 'destaques')
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            politica.policyname,
            politica.schemaname,
            politica.tablename
        );
    END LOOP;
END;
$$;

DROP POLICY IF EXISTS galerias_select_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_insert_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_update_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_delete_publico ON public.galerias;
DROP POLICY IF EXISTS galerias_leitura_publica ON public.galerias;
DROP POLICY IF EXISTS galerias_operacoes_admin ON public.galerias;
DROP POLICY IF EXISTS fotos_select_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_insert_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_update_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_delete_publico ON public.fotos;
DROP POLICY IF EXISTS fotos_leitura_publica ON public.fotos;
DROP POLICY IF EXISTS fotos_operacoes_admin ON public.fotos;

DROP POLICY IF EXISTS motazt_galerias_authenticated_select ON public.galerias;
DROP POLICY IF EXISTS motazt_galerias_authenticated_insert ON public.galerias;
DROP POLICY IF EXISTS motazt_galerias_authenticated_update ON public.galerias;
DROP POLICY IF EXISTS motazt_galerias_authenticated_delete ON public.galerias;
DROP POLICY IF EXISTS motazt_fotos_authenticated_select ON public.fotos;
DROP POLICY IF EXISTS motazt_fotos_authenticated_insert ON public.fotos;
DROP POLICY IF EXISTS motazt_fotos_authenticated_update ON public.fotos;
DROP POLICY IF EXISTS motazt_fotos_authenticated_delete ON public.fotos;
DROP POLICY IF EXISTS motazt_galeria_anon_select ON public.galeria;
DROP POLICY IF EXISTS motazt_galeria_authenticated_select ON public.galeria;
DROP POLICY IF EXISTS motazt_destaques_anon_select ON public.destaques;
DROP POLICY IF EXISTS motazt_destaques_authenticated_select ON public.destaques;

-- =========================================================
-- 3. Políticas das tabelas reais
-- =========================================================
CREATE POLICY motazt_galerias_authenticated_select
    ON public.galerias FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY motazt_galerias_authenticated_insert
    ON public.galerias FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY motazt_galerias_authenticated_update
    ON public.galerias FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY motazt_galerias_authenticated_delete
    ON public.galerias FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY motazt_fotos_authenticated_select
    ON public.fotos FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY motazt_fotos_authenticated_insert
    ON public.fotos FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY motazt_fotos_authenticated_update
    ON public.fotos FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY motazt_fotos_authenticated_delete
    ON public.fotos FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY motazt_galeria_anon_select
    ON public.galeria FOR SELECT
    TO anon
    USING (true);

CREATE POLICY motazt_galeria_authenticated_select
    ON public.galeria FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY motazt_destaques_anon_select
    ON public.destaques FOR SELECT
    TO anon
    USING (true);

CREATE POLICY motazt_destaques_authenticated_select
    ON public.destaques FOR SELECT
    TO authenticated
    USING (true);

-- =========================================================
-- 4. Views públicas sem dados administrativos
-- =========================================================
CREATE OR REPLACE VIEW public.galerias_publicas AS
SELECT
    id,
    titulo,
    status,
    total_fotos,
    data_criacao,
    data_expiracao
FROM public.galerias
WHERE status = 'ativa'
  AND (data_expiracao IS NULL OR data_expiracao > now());

CREATE OR REPLACE VIEW public.fotos_publicas AS
SELECT
    f.id,
    f.galeria_id,
    f.arquivo_preview,
    f.arquivo_full,
    f.favorita,
    f.posicao
FROM public.fotos AS f
INNER JOIN public.galerias AS g ON g.id = f.galeria_id
WHERE g.status = 'ativa'
  AND (g.data_expiracao IS NULL OR g.data_expiracao > now());

GRANT SELECT ON public.galerias_publicas, public.fotos_publicas TO anon, authenticated;

-- =========================================================
-- 5. Candidatos a arquivos órfãos
-- =========================================================
-- A função apenas lista candidatos. A exclusão continua sendo confirmada
-- pelo Admin usando Storage.remove, evitando apagar arquivos válidos por engano.
DROP FUNCTION IF EXISTS public.listar_arquivos_orfaos();

CREATE FUNCTION public.listar_arquivos_orfaos()
RETURNS TABLE (
    nome text,
    tamanho_bytes bigint,
    criado_em timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
    WITH usados AS (
        SELECT DISTINCT split_part(regexp_replace(url, '^.*/storage/v1/object/public/fotos/', ''), '?', 1) AS caminho
        FROM (
            SELECT arquivo_full AS url FROM public.fotos WHERE arquivo_full IS NOT NULL
            UNION ALL
            SELECT arquivo_preview AS url FROM public.fotos WHERE arquivo_preview IS NOT NULL
            UNION ALL
            SELECT imagem_url AS url FROM public.galeria WHERE imagem_url IS NOT NULL
            UNION ALL
            SELECT imagem_url AS url FROM public.destaques WHERE imagem_url IS NOT NULL
        ) AS referencias
        WHERE url LIKE '%/storage/v1/object/public/fotos/%'
    )
    SELECT
        objetos.name,
        COALESCE((objetos.metadata->>'size')::bigint, 0),
        objetos.created_at
    FROM storage.objects AS objetos
    LEFT JOIN usados ON usados.caminho = objetos.name
    WHERE objetos.bucket_id = 'fotos'
      AND usados.caminho IS NULL
    ORDER BY objetos.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.listar_arquivos_orfaos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_arquivos_orfaos() TO authenticated;

-- 6. Favoritas públicas via função controlada
-- =========================================================
DROP FUNCTION IF EXISTS public.marcar_favorita_publica(uuid, boolean);

CREATE FUNCTION public.marcar_favorita_publica(
    p_foto_id uuid,
    p_favorita boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    alterada boolean;
BEGIN
    UPDATE public.fotos AS f
    SET favorita = p_favorita
    WHERE f.id = p_foto_id
      AND EXISTS (
          SELECT 1
          FROM public.galerias AS g
          WHERE g.id = f.galeria_id
            AND g.status = 'ativa'
            AND (g.data_expiracao IS NULL OR g.data_expiracao > now())
      )
    RETURNING true INTO alterada;

    RETURN COALESCE(alterada, false);
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_favorita_publica(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_favorita_publica(uuid, boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- =========================================================
-- 6. Verificação após a execução
-- =========================================================
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('galerias', 'fotos', 'galeria', 'destaques')
ORDER BY tablename;

SELECT schemaname, viewname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('galerias_publicas', 'fotos_publicas')
ORDER BY viewname;

SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('galerias', 'fotos', 'galeria', 'destaques')
ORDER BY tablename, policyname;
