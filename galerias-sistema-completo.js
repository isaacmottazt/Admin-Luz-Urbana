/**
 * SISTEMA COMPLETO DE GALERIAS PRIVADAS
 * Motaz Studio
 *
 * Funciona em 3 momentos:
 * 1. Admin cria uma galeria privada manualmente com nome, telefone e título
 * 2. Admin faz upload de fotos → vincula à galeria específica
 * 3. Cliente acessa galeria-privada.html?id=xyz → vê só suas fotos
 *
 * Requer supabase-js via CDN:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */

const SUPABASE_URL = "https://tbwmsgztpyyratambgqs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";
const ADMIN_API_ORIGIN = 'https://motazt-studio.vercel.app';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function chamarMutacaoAdmin(payload) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão administrativa expirada. Faça login novamente.');
    const resposta = await fetch(`${ADMIN_API_ORIGIN}/api/admin-mutations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(payload)
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(dados?.error || 'A operação administrativa falhou.');
    return dados;
}

async function obterUrlsAssinadasAdmin(referencias) {
    const entradas = Array.isArray(referencias) ? referencias.filter(Boolean) : [referencias].filter(Boolean);
    if (!entradas.length) return new Map();
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão administrativa expirada.');
    const resposta = await fetch(`${ADMIN_API_ORIGIN}/api/signed-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        credentials: 'same-origin',
        body: JSON.stringify({ paths: entradas, admin: true })
    });
    if (!resposta.ok) throw new Error('Não foi possível assinar as imagens do painel.');
    const payload = await resposta.json();
    const mapa = new Map((Array.isArray(payload.signed) ? payload.signed : []).map(item => [item.path, item.signedUrl]));
    return new Map(entradas.map(item => [item, mapa.get(item) || '']));
}

const CAMPOS_GALERIA_PUBLICA = 'id, codigo_curto, titulo, status, total_fotos, data_criacao, data_expiracao, mensagem_agradecimento, data_publicacao, status_publicacao';
const CAMPOS_FOTO_PUBLICA = 'id, galeria_id, arquivo_preview, arquivo_full, favorita, posicao';
const CAMPOS_MENSAGEM_PUBLICA = 'id, galeria_id, autor, mensagem, data_criacao';

function viewPublicaIndisponivel(error) {
    const mensagem = String(error?.message || '').toLowerCase();
    return error?.code === '42P01' || error?.code === '42883' || error?.code === 'PGRST202' || error?.status === 404 || mensagem.includes('does not exist') || mensagem.includes('schema cache') || mensagem.includes('function');
}

const CAMPOS_GALERIA_LEGADA = 'id, titulo, status, total_fotos, data_criacao, data_expiracao';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizarGaleria(galeria) {
    if (!galeria) return null;
    return {
        ...galeria,
        codigo_curto: galeria.codigo_curto || '',
        mensagem_agradecimento: galeria.mensagem_agradecimento || '',
        data_publicacao: galeria.data_publicacao || null,
        status_publicacao: galeria.status_publicacao || 'publicado'
    };
}

async function consultarGaleriaPublica(galeriaId) {
    let resposta = await supabaseClient.rpc('obter_estado_galeria_por_identificador', {
        p_identificador: String(galeriaId || '').trim()
    });

    if (!resposta.error) {
        const registro = Array.isArray(resposta.data) ? (resposta.data[0] || null) : resposta.data;
        return { data: normalizarGaleria(registro), error: null };
    }

    if (viewPublicaIndisponivel(resposta.error) && UUID_RE.test(String(galeriaId || '').trim())) {
        resposta = await supabaseClient
            .from('galerias_publicas')
            .select(CAMPOS_GALERIA_LEGADA)
            .eq('id', galeriaId)
            .maybeSingle();
    }

    if (resposta.data) resposta.data = normalizarGaleria(resposta.data);
    return resposta;
}

async function consultarEstadoGaleriaPublico(identificador) {
    let resposta = await supabaseClient.rpc('obter_estado_galeria_por_identificador', {
        p_identificador: String(identificador || '').trim()
    });

    if (!resposta.error) {
        const registro = Array.isArray(resposta.data) ? (resposta.data[0] || null) : resposta.data;
        return { data: normalizarGaleria(registro), error: null };
    }

    // Compatibilidade com a instalação anterior, que consultava somente UUID.
    if (viewPublicaIndisponivel(resposta.error) && UUID_RE.test(String(identificador || '').trim())) {
        resposta = await supabaseClient.rpc('obter_estado_galeria_publico', {
            p_galeria_id: identificador
        });
        if (!resposta.error) {
            const registro = Array.isArray(resposta.data) ? (resposta.data[0] || null) : resposta.data;
            return { data: normalizarGaleria(registro), error: null };
        }
    }

    if (viewPublicaIndisponivel(resposta.error) && UUID_RE.test(String(identificador || '').trim())) {
        resposta = await supabaseClient
            .from('galerias_publicas')
            .select(CAMPOS_GALERIA_LEGADA)
            .eq('id', identificador)
            .maybeSingle();
    }

    if (resposta.data) resposta.data = normalizarGaleria(resposta.data);
    return resposta;
}

async function consultarMensagensPublicas(galeriaId) {
    let resposta = await supabaseClient
        .from('mensagens_album_publicas')
        .select(CAMPOS_MENSAGEM_PUBLICA)
        .eq('galeria_id', galeriaId)
        .order('data_criacao', { ascending: false });

    if (resposta.error && viewPublicaIndisponivel(resposta.error)) {
        resposta = await supabaseClient
            .from('mensagens_album')
            .select(CAMPOS_MENSAGEM_PUBLICA)
            .eq('galeria_id', galeriaId)
            .eq('status', 'aprovada')
            .order('data_criacao', { ascending: false });
    }
    return resposta;
}

async function consultarFotosPublicas(galeriaId) {
    let resposta = await supabaseClient
        .from('fotos_publicas')
        .select(CAMPOS_FOTO_PUBLICA)
        .eq('galeria_id', galeriaId)
        .order('posicao', { ascending: true });

    if (resposta.error && viewPublicaIndisponivel(resposta.error)) {
        resposta = await supabaseClient
            .from('fotos')
            .select(CAMPOS_FOTO_PUBLICA)
            .eq('galeria_id', galeriaId)
            .order('posicao', { ascending: true });
    }
    return resposta;
}

// ===== 1. CRIAR GALERIA PRIVADA MANUALMENTE =====

/**
 * Cria uma galeria privada manualmente pelo painel administrativo.
 *
 * @param {string} clienteNome - Nome do cliente
 * @param {string} clienteTelefone - Telefone do cliente
 * @param {string} titulo - Título da galeria (nome do evento/ensaio), exibido para o cliente
 * @returns {Promise} { galeria_id, mensagem }
 */
async function criarGaleria(clienteNome, clienteTelefone, titulo = '', opcoes = {}) {
    try {
        const resposta = await chamarMutacaoAdmin({
            action: 'create-gallery',
            clienteNome,
            clienteTelefone,
            titulo,
            dataPublicacao: opcoes.dataPublicacao || null,
            mensagemAgradecimento: opcoes.mensagemAgradecimento || ''
        });
        if (!resposta?.galeria_id) throw new Error('O servidor não retornou o ID do álbum criado.');
        return {
            sucesso: true,
            galeria_id: resposta.galeria_id,
            galeria: resposta.galeria,
            mensagem: resposta.mensagem || 'Álbum criado! Envie o link ao cliente pelo WhatsApp.'
        };
    } catch (erro) {
        console.error('Erro ao criar galeria:', erro);
        throw erro;
    }
}

function avaliarEstadoGaleria(galeria) {
    if (!galeria) {
        return { estado: 'nao_encontrada', galeria: null };
    }

    const agora = new Date();
    const dataExpiracao = galeria.data_expiracao ? new Date(galeria.data_expiracao) : null;
    const dataPublicacao = galeria.data_publicacao ? new Date(galeria.data_publicacao) : null;

    if (galeria.status !== 'ativa' || galeria.status_publicacao === 'bloqueado') {
        return { estado: 'bloqueado', galeria };
    }

    if (dataExpiracao && agora >= dataExpiracao) {
        return { estado: 'expirado', galeria };
    }

    if (galeria.status_publicacao === 'agendado' && dataPublicacao && agora < dataPublicacao) {
        return { estado: 'agendado', galeria, dataPublicacao };
    }

    return { estado: 'disponivel', galeria };
}

async function obterEstadoGaleria(galeriaId) {
    try {
        const { data, error } = await consultarEstadoGaleriaPublico(galeriaId);
        if (error) {
            console.error('Erro ao consultar estado da galeria:', error);
            return { estado: 'nao_encontrada', galeria: null };
        }
        return avaliarEstadoGaleria(normalizarGaleria(data));
    } catch (erro) {
        console.error('Erro ao obter estado da galeria:', erro);
        return { estado: 'nao_encontrada', galeria: null };
    }
}

async function registrarAcessoAlbum(identificador, codigoUtilizado = null) {
    try {
        const { data, error } = await supabaseClient.rpc('registrar_acesso_album_publico', {
            p_identificador: String(identificador || '').trim(),
            p_codigo_utilizado: codigoUtilizado ? String(codigoUtilizado).trim() : null,
            p_user_agent: navigator.userAgent || null,
            p_referrer: document.referrer || null
        });
        if (error) throw error;
        return data === true;
    } catch (erro) {
        console.warn('Histórico de acesso indisponível:', erro?.message || erro);
        return false;
    }
}

async function registrarDownloadAlbum(galeriaId, fotoId = null, tipoDownload = 'original') {
    try {
        const { data, error } = await supabaseClient.rpc('registrar_download_album_publico', {
            p_galeria_id: galeriaId,
            p_foto_id: fotoId,
            p_tipo_download: tipoDownload,
            p_user_agent: navigator.userAgent || null
        });
        if (error) throw error;
        return data === true;
    } catch (erro) {
        console.warn('Histórico de download indisponível:', erro?.message || erro);
        return false;
    }
}

async function listarHistoricoAcessosAdmin(galeriaId, limite = 100) {
    const { data, error } = await supabaseClient
        .from('album_acessos')
        .select('id, galeria_id, codigo_utilizado, data_acesso, user_agent, referrer, origem')
        .eq('galeria_id', galeriaId)
        .order('data_acesso', { ascending: false })
        .limit(limite);
    if (error) throw error;
    return data || [];
}

async function listarHistoricoDownloadsAdmin(galeriaId, limite = 100) {
    const { data, error } = await supabaseClient
        .from('album_downloads')
        .select('id, galeria_id, foto_id, tipo_download, data_download, user_agent, origem')
        .eq('galeria_id', galeriaId)
        .order('data_download', { ascending: false })
        .limit(limite);
    if (error) throw error;
    return data || [];
}

// ===== 2. VALIDAR SE A GALERIA EXISTE E ESTÁ ATIVA =====

/**
 * Valida se a galeria existe, está ativa e não expirou
 * Chamado quando o cliente acessa galeria-privada.html?id=xyz
 *
 * @param {string} galeriaId - ID da galeria (do ?id=xyz na URL)
 * @returns {Promise<object|null>} os dados da galeria se válida, ou null
 *
 * @example
 * const galeria = await validarGaleria('123e4567');
 * if (galeria) {
 *   // mostra as fotos
 * } else {
 *   // mostra "galeria não encontrada"
 * }
 */
async function validarGaleria(galeriaId) {
    const resultado = await obterEstadoGaleria(galeriaId);
    return resultado.estado === 'disponivel' ? resultado.galeria : null;
}

// ===== 3. LISTAR FOTOS DA GALERIA =====

/**
 * Carrega todas as fotos de uma galeria
 * Chamado depois que a galeria foi validada
 *
 * @param {string} galeriaId - ID da galeria
 * @returns {Promise<Array>} Array de fotos ordenadas por posição
 *
 * @example
 * const fotos = await listarFotosDaGaleria('123e4567');
 * fotos.forEach(foto => {
 *   console.log(foto.arquivo_preview); // URL da imagem
 *   console.log(foto.favorita); // true/false
 * });
 */
async function listarFotosDaGaleria(galeriaId) {
    try {
        const { data: fotos, error } = await consultarFotosPublicas(galeriaId);

        if (error) throw error;
        return fotos || [];

    } catch (erro) {
        console.error('Erro ao listar fotos:', erro);
        return [];
    }
}

// ===== 4. UPLOAD DE FOTOS (admin) =====

/**
 * Admin faz upload de foto para uma galeria específica
 * Armazena no Supabase Storage e registra na tabela 'fotos'
 *
 * @param {string} galeriaId - ID da galeria
 * @param {File} arquivo - Arquivo da imagem
 * @param {boolean} temMarcaDagua - se deve ter marca d'água (default: true)
 * @returns {Promise} { foto_id, url_preview, url_full }
 */
async function carregarImagemParaPreview(arquivo) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(arquivo);
        const imagem = new Image();
        imagem.onload = () => {
            URL.revokeObjectURL(url);
            resolve(imagem);
        };
        imagem.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Não foi possível ler a imagem para criar o preview.'));
        };
        imagem.src = url;
    });
}

async function criarArquivoPreview(arquivo) {
    const imagem = await carregarImagemParaPreview(arquivo);
    const maxLado = 2560;
    const qualidade = 0.90;
    const maiorLado = Math.max(imagem.naturalWidth, imagem.naturalHeight);
    const escala = Math.min(1, maxLado / maiorLado);
    const largura = Math.max(1, Math.round(imagem.naturalWidth * escala));
    const altura = Math.max(1, Math.round(imagem.naturalHeight * escala));
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext('2d');
    contexto.drawImage(imagem, 0, 0, largura, altura);

    const webp = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', qualidade));
    const blob = webp || await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', qualidade));
    if (!blob) throw new Error('Não foi possível criar o preview reduzido.');

    const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `preview-${Date.now()}.${extensao}`, { type: blob.type });
}

function obterUrlPublicaStorage(caminho) {
    return supabaseClient.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
}

async function enviarParaUrlAssinada(upload, arquivo) {
    const url = upload?.signedUrl || (upload?.token
        ? `${SUPABASE_URL}/storage/v1/object/upload/sign/fotos/${encodeURIComponent(upload.path).replace(/%2F/g, '/')}?token=${encodeURIComponent(upload.token)}`
        : '');
    if (!url) throw new Error('O servidor não retornou uma URL de upload válida.');
    const resposta = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': arquivo.type || 'application/octet-stream' },
        body: arquivo
    });
    if (!resposta.ok) throw new Error(`Falha no upload seguro (${resposta.status}).`);
}

async function uploadFoto(galeriaId, arquivo, temMarcaDagua = true) {
    const resolvida = await chamarMutacaoAdmin({ action: 'resolve-gallery', reference: galeriaId });
    galeriaId = resolvida.galeria_id;
    const timestamp = Date.now();
    const base = `${galeriaId}/${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
    const extensaoOriginal = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const caminhoOriginal = `${base}/original.${extensaoOriginal}`;
    let preview;
    let extensaoPreview = 'webp';
    try {
        try {
            preview = await criarArquivoPreview(arquivo);
        } catch (previewError) {
            // Alguns celulares fornecem HEIC/HEIF ou imagens que o navegador não decodifica.
            // O original ainda pode ser enviado com segurança; nesse caso ele é usado como preview.
            console.warn('Preview reduzido indisponível; usando o original:', previewError?.message || previewError);
            preview = arquivo;
            extensaoPreview = extensaoOriginal;
        }
        const caminhoPreview = `${base}/preview.${extensaoPreview}`;
        const [uploadOriginal, uploadPreview] = await Promise.all([
            chamarMutacaoAdmin({ action: 'prepare-upload', path: caminhoOriginal }),
            chamarMutacaoAdmin({ action: 'prepare-upload', path: caminhoPreview })
        ]);
        await Promise.all([
            enviarParaUrlAssinada(uploadOriginal, arquivo),
            enviarParaUrlAssinada(uploadPreview, preview)
        ]);
        const resposta = await chamarMutacaoAdmin({
            action: 'finalize-photo',
            galeriaId,
            originalPath: caminhoOriginal,
            previewPath: caminhoPreview
        });
        return {
            sucesso: true,
            foto_id: resposta.foto_id,
            url_preview: caminhoPreview,
            url_full: caminhoOriginal,
            mensagem: resposta.mensagem || 'Foto original e preview enviados com sucesso!'
        };
    } catch (erro) {
        console.error('Erro ao fazer upload seguro:', erro);
        throw erro;
    }
}

// ===== 5. MARCAR/DESMARCAR FAVORITA =====

/**
 * Cliente marca uma foto como favorita
 *
 * @param {string} fotoId - ID da foto
 * @param {boolean} favorita - true para marcar, false para desmarcar
 * @returns {Promise<boolean>} sucesso?
 *
 * @example
 * await marcarFavorita('abc123', true);
 * // Depois pode filtrar só favoritas
 */
async function marcarFavorita(fotoId, favorita = true) {
    try {
        const { data, error } = await supabaseClient.rpc('marcar_favorita_publica', {
            p_foto_id: fotoId,
            p_favorita: favorita
        });

        if (error) throw error;
        return data === true;

    } catch (erro) {
        console.error('Erro ao marcar favorita:', erro);
        return false;
    }
}

/**
 * Lista só as fotos marcadas como favoritas de uma galeria
 *
 * @param {string} galeriaId - ID da galeria
 * @returns {Promise<Array>} Fotos favoritas
 *
 * @example
 * const favoritas = await listarFavoritasDaGaleria('123e4567');
 */
async function listarFavoritasDaGaleria(galeriaId) {
    try {
        const { data: todas, error } = await consultarFotosPublicas(galeriaId);
        if (error) throw error;
        return (todas || []).filter(foto => foto.favorita);

    } catch (erro) {
        console.error('Erro ao listar favoritas:', erro);
        return [];
    }
}

// ===== 6. MURAL DE MENSAGENS =====

async function listarMensagensAlbum(galeriaId) {
    try {
        const { data, error } = await consultarMensagensPublicas(galeriaId);
        if (error) throw error;
        return data || [];
    } catch (erro) {
        console.error('Erro ao listar mensagens do álbum:', erro);
        return [];
    }
}

async function enviarMensagemAlbum(galeriaId, autor, mensagem) {
    const autorLimpo = String(autor || '').trim();
    const mensagemLimpa = String(mensagem || '').trim();

    if (autorLimpo.length < 1 || autorLimpo.length > 80) {
        throw new Error('Informe um nome com até 80 caracteres.');
    }
    if (mensagemLimpa.length < 1 || mensagemLimpa.length > 1000) {
        throw new Error('Escreva uma mensagem com até 1.000 caracteres.');
    }

    const { data, error } = await supabaseClient
        .from('mensagens_album')
        .insert({
            galeria_id: galeriaId,
            autor: autorLimpo,
            mensagem: mensagemLimpa,
            status: 'pendente'
        })
        .select('id, galeria_id, autor, mensagem, data_criacao')
        .single();

    if (error) {
        console.error('Erro ao enviar mensagem do álbum:', error);
        throw error;
    }
    return data;
}

async function listarMensagensAdmin(galeriaId) {
    const { data, error } = await supabaseClient
        .from('mensagens_album')
        .select('id, galeria_id, autor, mensagem, status, data_criacao')
        .eq('galeria_id', galeriaId)
        .order('data_criacao', { ascending: false });

    if (error) throw error;
    return data || [];
}

async function moderarMensagemAlbum(mensagemId, status) {
    if (!['pendente', 'aprovada', 'oculta'].includes(status)) {
        throw new Error('Status de mensagem inválido.');
    }
    const { error } = await supabaseClient
        .from('mensagens_album')
        .update({ status })
        .eq('id', mensagemId);
    if (error) throw error;
    return true;
}

async function excluirMensagemAlbum(mensagemId) {
    const { error } = await supabaseClient
        .from('mensagens_album')
        .delete()
        .eq('id', mensagemId);
    if (error) throw error;
    return true;
}

// ===== 7. DELETAR FOTO =====

/**
 * Admin deleta uma foto da galeria
 *
 * @param {string} fotoId - ID da foto
 * @param {string} nomeArquivoStorage - nome do arquivo no Storage
 * @returns {Promise<boolean>} sucesso?
 */
function extrairCaminhoStorage(referencia) {
    if (!referencia) return '';
    const valor = String(referencia);
    const marcador = '/storage/v1/object/public/fotos/';
    const indice = valor.indexOf(marcador);
    if (indice >= 0) {
        return decodeURIComponent(valor.slice(indice + marcador.length).split('?')[0]);
    }
    return valor.includes('/') ? valor : '';
}

async function regenerarPreviewFoto(foto) {
    if (!foto?.arquivo_full || !foto?.id || !foto?.galeria_id) {
        throw new Error('Foto sem arquivo original ou identificador válido.');
    }

    const resposta = await fetch(foto.arquivo_full, { cache: 'no-store' });
    if (!resposta.ok) throw new Error(`Original indisponível (HTTP ${resposta.status}).`);
    const blobOriginal = await resposta.blob();
    const arquivoOriginal = new File([blobOriginal], `original-${foto.id}.jpg`, { type: blobOriginal.type || 'image/jpeg' });
    const preview = await criarArquivoPreview(arquivoOriginal);
    const caminhoPreview = `${foto.galeria_id}/preview/${foto.id}.webp`;

    const { error: erroUpload } = await supabaseClient.storage.from('fotos').upload(caminhoPreview, preview, {
        contentType: preview.type,
        cacheControl: '31536000',
        upsert: true
    });
    if (erroUpload) throw erroUpload;

    const urlPreview = obterUrlPublicaStorage(caminhoPreview);
    const { error: erroBanco } = await supabaseClient
        .from('fotos')
        .update({ arquivo_preview: urlPreview })
        .eq('id', foto.id);
    if (erroBanco) throw erroBanco;

    const caminhoAntigo = extrairCaminhoStorage(foto.arquivo_preview);
    const caminhoOriginal = extrairCaminhoStorage(foto.arquivo_full);
    if (caminhoAntigo && caminhoAntigo !== caminhoOriginal && caminhoAntigo !== caminhoPreview) {
        await supabaseClient.storage.from('fotos').remove([caminhoAntigo]);
    }
    return { ...foto, arquivo_preview: urlPreview };
}

async function excluirFotoAdmin(fotoId) {
    const resposta = await supabaseClient.rpc('excluir_foto_admin', {
        p_foto_id: fotoId
    });

    if (!resposta.error) return resposta.data === true;
    if (!viewPublicaIndisponivel(resposta.error)) throw resposta.error;

    const { error } = await supabaseClient
        .from('fotos')
        .delete()
        .eq('id', fotoId);
    if (error) throw error;
    return true;
}

async function excluirGaleriaAdmin(galeriaId) {
    const resposta = await supabaseClient.rpc('excluir_galeria_admin', {
        p_galeria_id: galeriaId
    });

    if (!resposta.error) return resposta.data === true;
    if (!viewPublicaIndisponivel(resposta.error)) throw resposta.error;

    const { error: erroFotos } = await supabaseClient
        .from('fotos')
        .delete()
        .eq('galeria_id', galeriaId);
    if (erroFotos) throw erroFotos;

    const { error: erroGaleria } = await supabaseClient
        .from('galerias')
        .delete()
        .eq('id', galeriaId);
    if (erroGaleria) throw erroGaleria;
    return true;
}

async function deletarFoto(fotoId, ...referencias) {
    try {
        const caminhos = [...new Set(referencias.map(extrairCaminhoStorage).filter(Boolean))];

        // Primeiro remove o registro transacionalmente; o Storage é limpeza complementar.
        const removida = await excluirFotoAdmin(fotoId);
        if (!removida) return false;

        if (caminhos.length > 0) {
            const { error: erroStorage } = await supabaseClient.storage
                .from('fotos')
                .remove(caminhos);
            if (erroStorage) {
                console.warn('Registro excluído, mas não foi possível limpar o Storage:', erroStorage);
            }
        }
        return true;
    } catch (erro) {
        console.error('Erro ao deletar foto:', erro);
        return false;
    }
}

// ===== 7. ATUALIZAR STATUS DA GALERIA =====

/**
 * Admin pode bloquear/desbloquear uma galeria ou alterar seu status
 *
 * @param {string} galeriaId - ID da galeria
 * @param {string} novoStatus - 'ativa', 'bloqueada', 'expirada'
 * @returns {Promise<boolean>} sucesso?
 *
 * @example
 * await atualizarStatusGaleria('123e4567', 'bloqueada');
 */
async function atualizarStatusGaleria(galeriaId, novoStatus) {
    try {
        const { error } = await supabaseClient
            .from('galerias')
            .update({ status: novoStatus })
            .eq('id', galeriaId);

        if (error) throw error;
        return true;

    } catch (erro) {
        console.error('Erro ao atualizar status:', erro);
        return false;
    }
}

// ===== 8. OBTER INFO DA GALERIA =====

/**
 * Pega informações gerais da galeria (nome cliente, data, total de fotos)
 *
 * @param {string} galeriaId - ID da galeria
 * @returns {Promise<object>} { total_fotos, data_criacao, data_expiracao, status }
 */
async function obterInfoGaleria(galeriaId) {
    try {
        const { data: galeria, error } = await consultarGaleriaPublica(galeriaId);

        if (error) throw error;

        // Contar fotos
        const { data: fotos } = await consultarFotosPublicas(galeriaId);

        return {
            galeria_id: galeria.id,
            total_fotos: fotos?.length || 0,
            data_criacao: galeria.data_criacao,
            data_expiracao: galeria.data_expiracao,
            status: galeria.status,
            diasRestantes: Math.ceil(
                (new Date(galeria.data_expiracao) - new Date()) / (1000 * 60 * 60 * 24)
            )
        };

    } catch (erro) {
        console.error('Erro ao obter info da galeria:', erro);
        return null;
    }
}

// ===== EXPORTAR PARA USO =====
// Deixa disponível globalmente no window
window.GaleriaPrivada = {
    criarGaleria,
    validarGaleria,
    listarFotosDaGaleria,
    uploadFoto,
    regenerarPreviewFoto,
    marcarFavorita,
    listarFavoritasDaGaleria,
    listarMensagensAlbum,
    enviarMensagemAlbum,
    listarMensagensAdmin,
    moderarMensagemAlbum,
    excluirMensagemAlbum,
    excluirFotoAdmin,
    excluirGaleriaAdmin,
    extrairCaminhoStorage,
    obterEstadoGaleria,
    avaliarEstadoGaleria,
    registrarAcessoAlbum,
    registrarDownloadAlbum,
    listarHistoricoAcessosAdmin,
    listarHistoricoDownloadsAdmin,
    deletarFoto,
    atualizarStatusGaleria,
    obterInfoGaleria
};
