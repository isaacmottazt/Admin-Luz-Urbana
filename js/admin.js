/* ======================================
   SUPABASE
====================================== */

const supabaseUrl =
"https://tbwmsgztpyyratambgqs.supabase.co";

const supabaseKey =
"sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";

const client =
supabase.createClient(
    supabaseUrl,
    supabaseKey
);

const ADMIN_API_ORIGIN = 'https://motazt-studio.vercel.app';

async function obterDadosAdmin(resource) {
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão administrativa expirada.');
    const resposta = await fetch(`${ADMIN_API_ORIGIN}/api/admin-content?resource=${encodeURIComponent(resource)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: 'same-origin'
    });
    if (!resposta.ok) throw new Error(`Não foi possível carregar os dados do painel (HTTP ${resposta.status}).`);
    const payload = await resposta.json();
    return Array.isArray(payload.data) ? payload.data : [];
}

async function obterUrlsAssinadasAdmin(referencias) {
    const entradas = Array.isArray(referencias) ? referencias.filter(Boolean) : [referencias].filter(Boolean);
    if (!entradas.length) return new Map();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error('Sessão administrativa expirada.');
    const resposta = await fetch(`${ADMIN_API_ORIGIN}/api/signed-images`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
        },
        credentials: 'same-origin',
        body: JSON.stringify({ paths: entradas, admin: true })
    });
    if (!resposta.ok) throw new Error(`Não foi possível assinar as imagens do painel (HTTP ${resposta.status}).`);
    const payload = await resposta.json();
    const mapa = new Map();
    (Array.isArray(payload.signed) ? payload.signed : []).forEach(item => {
        if (item?.path && item?.signedUrl) mapa.set(item.path, item.signedUrl);
    });
    return new Map(entradas.map(item => [item, mapa.get(item) || '']));
}

/* ======================================
   VERIFICAR LOGIN
====================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

    const {
        data: { session }
    } = await client.auth.getSession();

    if(!session){

        window.location.href =
        "login.html";

        return;
    }

    carregarGaleria();
    carregarDestaques();

});

/* ======================================
   ELEMENTOS
====================================== */

const inputImagem =
document.getElementById(
    "imagem"
);

const status =
document.getElementById(
    "status"
);

const galeria =
document.getElementById(
    "galeria-admin"
);

const inputImagemDestaque =
document.getElementById(
    "imagemDestaque"
);

const statusDestaque =
document.getElementById(
    "statusDestaque"
);

const destaqueAdmin =
document.getElementById(
    "destaque-admin"
);

const LIMITE_DESTAQUES = 4;

const progressoUpload = {
    galeria: {
        barra: document.querySelector('#progressoGaleria .upload-progress-bar'),
        caixa: document.getElementById('progressoGaleria'),
        texto: document.getElementById('progressoGaleriaTexto')
    },
    destaques: {
        barra: document.querySelector('#progressoDestaques .upload-progress-bar'),
        caixa: document.getElementById('progressoDestaques'),
        texto: document.getElementById('progressoDestaquesTexto')
    }
};

function atualizarProgressoUpload(tipo, atual, total, mensagem = '') {
    const progresso = progressoUpload[tipo];
    if (!progresso?.caixa) return;

    const percentual = total > 0 ? Math.round((atual / total) * 100) : 0;
    progresso.caixa.hidden = total <= 0;
    progresso.caixa.setAttribute('aria-valuenow', String(percentual));
    progresso.barra.style.width = `${percentual}%`;
    progresso.texto.textContent = mensagem || `${percentual}% concluído`;
}

function resetarProgressoUpload(tipo) {
    const progresso = progressoUpload[tipo];
    if (!progresso?.caixa) return;

    progresso.caixa.hidden = true;
    progresso.caixa.setAttribute('aria-valuenow', '0');
    progresso.barra.style.width = '0%';
    progresso.texto.textContent = '';
}

/* ======================================
   COMPRESSÃO PARA EXIBIÇÃO
====================================== */

// A galeria pública usa cópias leves: qualidade suficiente para tela,
// sem enviar o arquivo original e desnecessariamente grande ao Storage.
const MAX_LADO_EXIBICAO = 2000;
const QUALIDADE_EXIBICAO = 0.82;

function carregarImagemParaReducao(arquivo) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(arquivo);
        const imagem = new Image();
        imagem.onload = () => {
            URL.revokeObjectURL(url);
            resolve(imagem);
        };
        imagem.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Não foi possível ler a imagem selecionada.'));
        };
        imagem.src = url;
    });
}

async function prepararImagemParaExibicao(arquivo) {
    if (!arquivo?.type?.startsWith('image/')) return null;

    const imagem = await carregarImagemParaReducao(arquivo);
    const maiorLado = Math.max(imagem.naturalWidth, imagem.naturalHeight);
    const escala = Math.min(1, MAX_LADO_EXIBICAO / maiorLado);
    const largura = Math.max(1, Math.round(imagem.naturalWidth * escala));
    const altura = Math.max(1, Math.round(imagem.naturalHeight * escala));

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext('2d');
    contexto.drawImage(imagem, 0, 0, largura, altura);

    const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', QUALIDADE_EXIBICAO);
    });

    // Fallback para navegadores que não suportam WebP via canvas.
    const blobFinal = blob || await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_EXIBICAO);
    });

    if (!blobFinal) throw new Error('Não foi possível reduzir a imagem.');

    const extensao = blobFinal.type === 'image/webp' ? 'webp' : 'jpg';
    return new File(
        [blobFinal],
        `motazt-display-${Date.now()}-${Math.floor(Math.random() * 100000)}.${extensao}`,
        { type: blobFinal.type }
    );
}

async function regenerarPreviewsGaleria() {
    const botao = document.getElementById('btnRegenerarPreviewsGaleria');
    const aviso = document.getElementById('statusGaleriaPreview');
    if (botao) botao.disabled = true;
    if (aviso) aviso.textContent = 'Verificando fotos sem preview...';

    try {
        const { data: fotos, error } = await client
            .from('galeria')
            .select('id, imagem_url, imagem_preview')
            .order('id', { ascending: false });
        if (error) throw error;

        const pendentes = (fotos || []).filter(foto => foto.imagem_url && (!foto.imagem_preview || foto.imagem_preview === foto.imagem_url));
        if (!pendentes.length) {
            if (aviso) aviso.textContent = 'Todas as fotos já possuem preview reduzido.';
            return;
        }

        if (!confirm(`Gerar previews leves para ${pendentes.length} foto(s)?`)) return;
        let concluidas = 0;
        for (const foto of pendentes) {
            try {
                const resposta = await fetch(foto.imagem_url, { cache: 'no-store' });
                if (!resposta.ok) throw new Error(`Imagem HTTP ${resposta.status}`);
                const blob = await resposta.blob();
                const arquivo = new File([blob], `galeria-${foto.id}.jpg`, { type: blob.type || 'image/jpeg' });
                const preview = await prepararImagemParaExibicao(arquivo);
                const caminho = `galeria-publica/previews/${foto.id}-${Date.now()}-${preview.name}`;
                const { error: erroUpload } = await client.storage.from('fotos').upload(caminho, preview, {
                    contentType: preview.type,
                    cacheControl: '31536000',
                    upsert: true
                });
                if (erroUpload) throw erroUpload;
                const { data: urlData } = client.storage.from('fotos').getPublicUrl(caminho);
                const { error: erroUpdate } = await client.from('galeria').update({ imagem_preview: urlData.publicUrl }).eq('id', foto.id);
                if (erroUpdate) throw erroUpdate;
                concluidas += 1;
                if (aviso) aviso.textContent = `Preview ${concluidas} de ${pendentes.length} concluído...`;
            } catch (erroFoto) {
                console.warn('Falha ao gerar preview da foto', foto.id, erroFoto);
            }
        }
        if (aviso) aviso.textContent = `${concluidas} de ${pendentes.length} preview(s) gerado(s).`;
        carregarGaleria();
    } catch (erro) {
        console.error(erro);
        if (aviso) aviso.textContent = `Não foi possível gerar previews: ${erro.message || 'erro desconhecido'}`;
    } finally {
        if (botao) botao.disabled = false;
    }
}

/* ======================================
   ENVIAR IMAGEM
====================================== */

async function enviarImagem(){

    const arquivos =
    inputImagem.files;

    if(arquivos.length === 0){

        status.innerHTML =
        "Selecione pelo menos 1 imagem.";

        return;
    }

    status.innerHTML =
    "Reduzindo imagens e enviando...";
    atualizarProgressoUpload('galeria', 0, arquivos.length, `Preparando ${arquivos.length} imagem(ns)...`);

    let enviados = 0;

    for(const [indice, arquivo] of Array.from(arquivos).entries()){
        atualizarProgressoUpload('galeria', indice, arquivos.length, `Processando imagem ${indice + 1} de ${arquivos.length}...`);

        try{

            /* VERIFICAR IMAGEM */

            if(
                !arquivo.type.startsWith(
                    "image/"
                )
            ){
                continue;
            }

            /* REDUZIR ANTES DO UPLOAD */
            const imagemReduzida = await prepararImagemParaExibicao(arquivo);
            if (!imagemReduzida) continue;

            /* NOME ÚNICO */

            const extensao =
            imagemReduzida.name
            .split(".")
            .pop();

            const nomeArquivo =

`${Date.now()}-${Math.floor(
Math.random() * 100000
)}.${extensao}`;

            /* UPLOAD DA CÓPIA REDUZIDA */

            const {
                error: erroUpload
            } = await client.storage
            .from("fotos")
            .upload(
                nomeArquivo,
                imagemReduzida,
                {
                    contentType: imagemReduzida.type,
                    cacheControl: "31536000",
                    upsert: false
                }
            );

            if(erroUpload){

                console.log(
                    erroUpload
                );

                continue;
            }

            /* URL */

            const {
                data
            } = client.storage
            .from("fotos")
            .getPublicUrl(
                nomeArquivo
            );

            /* SALVAR BANCO */

            const {
                error: erroBanco
            } = await client
            .from("galeria")
            .insert([
                {
                    imagem_url:
                    data.publicUrl
                }
            ]);

            if(erroBanco){

                console.log(
                    erroBanco
                );

                continue;
            }

            enviados++;
            atualizarProgressoUpload('galeria', indice + 1, arquivos.length, `Imagem ${indice + 1} de ${arquivos.length} concluída`);

        }catch(err){

            console.log(err);
            atualizarProgressoUpload('galeria', indice + 1, arquivos.length, `Imagem ${indice + 1} de ${arquivos.length} com erro`);

        }

    }

    atualizarProgressoUpload('galeria', arquivos.length, arquivos.length, `${enviados} de ${arquivos.length} imagem(ns) enviada(s)`);
    status.innerHTML =

`${enviados} imagem(ns) enviada(s)!`;

    inputImagem.value = "";

    carregarGaleria();

    if(enviados > 0){
        setTimeout(fecharModalUpload, 1200);
    }

}

/* ======================================
   MODAL DE UPLOAD
====================================== */

function abrirModalUpload(){

    document
    .getElementById("modalUpload")
    .classList.add("ativo");

}

function fecharModalUpload(){

    document
    .getElementById("modalUpload")
    .classList.remove("ativo");

    status.innerHTML = "";
    inputImagem.value = "";
    resetarProgressoUpload('galeria');

}

function fecharModalUploadFora(evento){

    if(evento.target.id === "modalUpload"){
        fecharModalUpload();
    }

}

/* ======================================
   CARREGAR GALERIA
====================================== */

async function carregarGaleria(){

    galeria.innerHTML =
    "<p>Carregando...</p>";

    let data;
    let error = null;
    try {
        data = await obterDadosAdmin('galeria');
    } catch (erroDados) {
        error = erroDados;
    }

    if(error){

        console.log(error);

        galeria.textContent = error?.message || 'Erro ao carregar.';

        return;
    }

    galeria.innerHTML = "";

    let urlsAssinadas = new Map();
    try {
        urlsAssinadas = await obterUrlsAssinadasAdmin(data.flatMap(imagem => [imagem.imagem_preview, imagem.imagem_url]));
    } catch (erroImagens) {
        console.error('Erro ao assinar imagens da galeria:', erroImagens);
        galeria.innerHTML = '<p>Não foi possível carregar as imagens com segurança.</p>';
        return;
    }

    data.forEach((imagem, index) => {

        const formatoAtual =
        imagem.formato || "auto";

        const div = document.createElement("div");
        div.className = "foto-card carregando";
        div.setAttribute("data-id", imagem.id);
        div.setAttribute("draggable", "true");

        div.innerHTML = `

            <div class="foto-arrastar" title="Arraste para reordenar">
                <span></span><span></span><span></span>
            </div>

            <div class="foto-wrap foto-wrap--${formatoAtual}">
                <img
                class="foto-imagem-admin"
                src="${urlsAssinadas.get(imagem.imagem_preview || imagem.imagem_url) || urlsAssinadas.get(imagem.imagem_url) || ''}"
                data-full="${urlsAssinadas.get(imagem.imagem_url) || ''}"
                alt="Foto"
                loading="lazy"
                decoding="async">
            </div>

            <div class="foto-controles">

                <select class="foto-formato" data-id="${imagem.id}">
                    <option value="auto"${formatoAtual === "auto" ? " selected" : ""}>Automático</option>
                    <option value="paisagem"${formatoAtual === "paisagem" ? " selected" : ""}>Paisagem</option>
                    <option value="retrato"${formatoAtual === "retrato" ? " selected" : ""}>Retrato</option>
                    <option value="quadrado"${formatoAtual === "quadrado" ? " selected" : ""}>Quadrado</option>
                </select>

            </div>

            <button
            class="btn-excluir"
            onclick="abrirModalExcluir(${imagem.id})">
            Excluir
            </button>

        `;

        galeria.appendChild(div);

        // Mesmo comportamento da galeria privada: shimmer, fade-in e sem corte.
        const imagemElemento = div.querySelector(".foto-wrap img");
        const marcarImagemCarregada = () => {
            imagemElemento.classList.add("carregada");
            div.classList.remove("carregando");
        };
        const marcarErroImagem = () => {
            if (imagemElemento.dataset.full && imagemElemento.src !== imagemElemento.dataset.full && !imagemElemento.dataset.fallback) {
                imagemElemento.dataset.fallback = '1';
                imagemElemento.src = imagemElemento.dataset.full;
                return;
            }
            div.classList.remove("carregando");
            div.classList.add("erro-carregamento");
        };
        imagemElemento.addEventListener("load", marcarImagemCarregada, { once: true });
        imagemElemento.addEventListener("error", marcarErroImagem, { once: true });
        if (imagemElemento.complete) {
            imagemElemento.naturalWidth > 0 ? marcarImagemCarregada() : marcarErroImagem();
        }

        // Abrir lightbox ao tocar/clicar na foto
        imagemElemento.addEventListener("click", () => {
            abrirLightbox(urlsAssinadas.get(imagem.imagem_url) || imagemElemento.dataset.full || '');
        });

        div.querySelector(".foto-formato")
        .addEventListener("change", (e) => {
            atualizarFormato(imagem.id, e.target.value);
        });

        ativarArrastar(div);

    });

    galeriaOrdenada = data;

}

/* ======================================
   FORMATO DA IMAGEM
====================================== */

async function atualizarFormato(id, formato){

    const { error } = await client
    .from("galeria")
    .update({ formato })
    .eq("id", id);

    if(error){
        console.log(error);
        return;
    }

    carregarGaleria();

}

/* ======================================
   REORDENAR (arrastar e soltar)
====================================== */

let galeriaOrdenada = [];
let itemArrastado = null;
let arrastoAtivo = false;
let scrollIntervalo = null;

function ativarArrastar(card){

    /* MOUSE / DESKTOP (HTML5 drag-and-drop) */

    card.addEventListener("dragstart", () => {
        itemArrastado = card;
        setTimeout(() => card.classList.add("arrastando"), 0);
    });

    card.addEventListener("dragend", () => {
        card.classList.remove("arrastando");
        itemArrastado = null;
        salvarNovaOrdem();
    });

    card.addEventListener("dragover", (e) => {
        e.preventDefault();
        const alvo = e.target.closest(".foto-card");
        if(!alvo || alvo === itemArrastado) return;
        trocarPosicao(alvo);
    });

    /* TOQUE / MOBILE */

    const alca = card.querySelector(".foto-arrastar");

    alca.addEventListener("touchstart", () => {
        itemArrastado = card;
        arrastoAtivo = true;
        card.classList.add("arrastando");
    }, { passive: true });

    alca.addEventListener("touchmove", (e) => {

        if(!arrastoAtivo || !itemArrastado) return;
        e.preventDefault();

        const toque = e.touches[0];

        verificarAutoScroll(toque.clientY);

        // Descobre sobre qual card o dedo está, ignorando o próprio card arrastado
        itemArrastado.style.pointerEvents = "none";
        const elementoAbaixo = document.elementFromPoint(toque.clientX, toque.clientY);
        itemArrastado.style.pointerEvents = "";

        const alvo = elementoAbaixo ? elementoAbaixo.closest(".foto-card") : null;

        if(alvo && alvo !== itemArrastado && alvo.parentNode === galeria){
            trocarPosicao(alvo);
        }

    }, { passive: false });

    alca.addEventListener("touchend", () => {

        pararAutoScroll();

        if(!itemArrastado) return;

        itemArrastado.classList.remove("arrastando");
        itemArrastado = null;
        arrastoAtivo = false;

        salvarNovaOrdem();

    });

    alca.addEventListener("touchcancel", () => {
        pararAutoScroll();
        if(itemArrastado){
            itemArrastado.classList.remove("arrastando");
        }
        itemArrastado = null;
        arrastoAtivo = false;
    });

}

// Rola a página automaticamente quando o dedo se aproxima do topo/rodapé da tela
function verificarAutoScroll(clienteY){

    const margem = 90;
    const velocidade = 14;
    const alturaJanela = window.innerHeight;

    pararAutoScroll();

    if(clienteY < margem){
        scrollIntervalo = setInterval(() => {
            window.scrollBy(0, -velocidade);
        }, 16);
    }else if(clienteY > alturaJanela - margem){
        scrollIntervalo = setInterval(() => {
            window.scrollBy(0, velocidade);
        }, 16);
    }

}

function pararAutoScroll(){
    if(scrollIntervalo){
        clearInterval(scrollIntervalo);
        scrollIntervalo = null;
    }
}

// Troca o card arrastado de lugar com o alvo, mantendo ambos no fluxo do grid
function trocarPosicao(alvo){

    const proximoDoAlvo = alvo.nextElementSibling;

    if(proximoDoAlvo === itemArrastado){
        alvo.parentNode.insertBefore(itemArrastado, alvo);
    }else{
        const referencia = itemArrastado.nextElementSibling;
        alvo.parentNode.insertBefore(itemArrastado, alvo);
        alvo.parentNode.insertBefore(alvo, referencia);
    }

}

async function salvarNovaOrdem(){

    const cards = [...galeria.querySelectorAll(".foto-card")];

    const atualizacoes = cards.map((card, i) => ({
        id: Number(card.getAttribute("data-id")),
        ordem: i
    }));

    // Uma única leva de updates, disparados juntos (mais rápido que sequencial)
    await Promise.all(
        atualizacoes.map(item =>
            client
            .from("galeria")
            .update({ ordem: item.ordem })
            .eq("id", item.id)
        )
    );

    galeriaOrdenada = atualizacoes;

}

/* ======================================
   LIGHTBOX (tela cheia)
====================================== */

function abrirLightbox(url){

    document.getElementById("lightboxImg").src = url;
    document.getElementById("lightbox").classList.add("ativo");

}

function fecharLightbox(){

    document.getElementById("lightbox").classList.remove("ativo");
    document.getElementById("lightboxImg").src = "";

}

function fecharLightboxFora(evento){

    if(evento.target.id === "lightbox"){
        fecharLightbox();
    }

}

/* ======================================
   DELETAR
====================================== */

let idParaExcluir = null;

function abrirModalExcluir(id){

    idParaExcluir = id;
    document.getElementById("modalExcluir").classList.add("ativo");

}

function fecharModalExcluir(){

    idParaExcluir = null;
    document.getElementById("modalExcluir").classList.remove("ativo");

}

function fecharModalExcluirFora(evento){

    if(evento.target.id === "modalExcluir"){
        fecharModalExcluir();
    }

}

async function confirmarExclusao(){

    if(idParaExcluir === null) return;

    const id = idParaExcluir;
    fecharModalExcluir();

    const {
        data
    } = await client
    .from("galeria")
    .select("*")
    .eq("id", id)
    .single();

    if(data){

        const partes =
        data.imagem_url.split("/");

        const nomeArquivo =
        partes[
            partes.length - 1
        ];

        await client.storage
        .from("fotos")
        .remove([
            nomeArquivo
        ]);
    }

    await client
    .from("galeria")
    .delete()
    .eq("id", id);

    carregarGaleria();

}

/* ======================================
   LOGOUT
====================================== */

async function logout(){

    await client.auth.signOut();

    window.location.href =
    "login.html";

}

/* ======================================
   MOMENTOS CAPTURADOS (DESTAQUES)
====================================== */

async function enviarImagemDestaque(){

    const arquivos =
    inputImagemDestaque.files;

    if(arquivos.length === 0){
        statusDestaque.innerHTML =
        "Selecione pelo menos 1 imagem.";
        return;
    }

    /* CONFERE LIMITE DE 4 */

    const { count, error: erroContagem } = await client
    .from("destaques")
    .select("*", { count: "exact", head: true });

    if(erroContagem){
        console.log(erroContagem);
        statusDestaque.innerHTML =
        "Erro ao verificar destaques atuais.";
        return;
    }

    const vagasRestantes = LIMITE_DESTAQUES - (count || 0);

    if(vagasRestantes <= 0){
        statusDestaque.innerHTML =
        `Limite de ${LIMITE_DESTAQUES} fotos atingido. Exclua uma para adicionar outra.`;
        return;
    }

    const arquivosValidos =
    Array.from(arquivos).slice(0, vagasRestantes);

    if(arquivos.length > vagasRestantes){
        statusDestaque.innerHTML =
        `Só há espaço para mais ${vagasRestantes} foto(s). Enviando essa quantidade...`;
    }else{
        statusDestaque.innerHTML =
        "Reduzindo imagens e enviando...";
    }

    atualizarProgressoUpload('destaques', 0, arquivosValidos.length, `Preparando ${arquivosValidos.length} destaque(s)...`);
    let enviados = 0;

    for(const [indice, arquivo] of arquivosValidos.entries()){
        atualizarProgressoUpload('destaques', indice, arquivosValidos.length, `Processando destaque ${indice + 1} de ${arquivosValidos.length}...`);

        try{

            if(
                !arquivo.type.startsWith(
                    "image/"
                )
            ){
                continue;
            }

            const imagemReduzida = await prepararImagemParaExibicao(arquivo);
            if (!imagemReduzida) continue;

            const extensao =
            imagemReduzida.name
            .split(".")
            .pop();

            const nomeArquivo =

`destaque-${Date.now()}-${Math.floor(
Math.random() * 100000
)}.${extensao}`;

            const {
                error: erroUpload
            } = await client.storage
            .from("fotos")
            .upload(
                nomeArquivo,
                imagemReduzida,
                {
                    contentType: imagemReduzida.type,
                    cacheControl: "31536000",
                    upsert: false
                }
            );

            if(erroUpload){
                console.log(erroUpload);
                continue;
            }

            const {
                data
            } = client.storage
            .from("fotos")
            .getPublicUrl(
                nomeArquivo
            );

            const {
                error: erroBanco
            } = await client
            .from("destaques")
            .insert([
                {
                    imagem_url:
                    data.publicUrl
                }
            ]);

            if(erroBanco){
                console.log(erroBanco);
                continue;
            }

            enviados++;
            atualizarProgressoUpload('destaques', indice + 1, arquivosValidos.length, `Destaque ${indice + 1} de ${arquivosValidos.length} concluído`);

        }catch(err){
            console.log(err);
            atualizarProgressoUpload('destaques', indice + 1, arquivosValidos.length, `Destaque ${indice + 1} com erro`);
        }

    }

    atualizarProgressoUpload('destaques', arquivosValidos.length, arquivosValidos.length, `${enviados} de ${arquivosValidos.length} destaque(s) enviado(s)`);
    statusDestaque.innerHTML =

`${enviados} imagem(ns) enviada(s)!`;

    inputImagemDestaque.value = "";

    carregarDestaques();

    if(enviados > 0){
        setTimeout(fecharModalUploadDestaque, 1200);
    }

}

function abrirModalUploadDestaque(){

    document
    .getElementById("modalUploadDestaque")
    .classList.add("ativo");

}

function fecharModalUploadDestaque(){

    document
    .getElementById("modalUploadDestaque")
    .classList.remove("ativo");

    statusDestaque.innerHTML = "";
    inputImagemDestaque.value = "";
    resetarProgressoUpload('destaques');

}

function fecharModalUploadDestaqueFora(evento){

    if(evento.target.id === "modalUploadDestaque"){
        fecharModalUploadDestaque();
    }

}

async function carregarDestaques(){

    destaqueAdmin.innerHTML =
    "<p>Carregando...</p>";

    let data;
    let error = null;
    try {
        data = await obterDadosAdmin('destaques');
    } catch (erroDados) {
        error = erroDados;
    }

    if(error){
        console.log(error);
        destaqueAdmin.textContent = error?.message || 'Erro ao carregar.';
        return;
    }

    if(!data || data.length === 0){
        destaqueAdmin.innerHTML =
        "<p>Nenhuma foto em destaque ainda. Envie até 4 fotos para aparecerem no site.</p>";
        return;
    }

    destaqueAdmin.innerHTML = "";

    let urlsAssinadas = new Map();
    try {
        urlsAssinadas = await obterUrlsAssinadasAdmin(data.map(imagem => imagem.imagem_url));
    } catch (erroImagens) {
        console.error('Erro ao assinar destaques:', erroImagens);
        destaqueAdmin.innerHTML = '<p>Não foi possível carregar os destaques com segurança.</p>';
        return;
    }

    data.forEach((imagem) => {

        const div = document.createElement("div");
        div.className = "foto-card";
        div.setAttribute("data-id", imagem.id);
        div.setAttribute("draggable", "true");

        div.innerHTML = `

            <div class="foto-arrastar" title="Arraste para reordenar">
                <span></span><span></span><span></span>
            </div>

            <div class="foto-wrap foto-wrap--quadrado">
                <img
                src="${urlsAssinadas.get(imagem.imagem_url) || ''}"
                data-full="${urlsAssinadas.get(imagem.imagem_url) || ''}"
                alt="Foto em destaque"
                loading="lazy">
            </div>

            <button
            class="btn-excluir"
            onclick="abrirModalExcluirDestaque(${imagem.id})">
            Excluir
            </button>

        `;

        destaqueAdmin.appendChild(div);

        div.querySelector(".foto-wrap img")
        .addEventListener("click", () => {
            abrirLightbox(urlsAssinadas.get(imagem.imagem_url) || '');
        });

        ativarArrastarDestaque(div);

    });

    destaquesOrdenados = data;

}

/* ======================================
   REORDENAR DESTAQUES (arrastar e soltar)
====================================== */

let destaquesOrdenados = [];
let itemArrastadoDestaque = null;

function ativarArrastarDestaque(card){

    card.addEventListener("dragstart", () => {
        itemArrastadoDestaque = card;
        setTimeout(() => card.classList.add("arrastando"), 0);
    });

    card.addEventListener("dragend", () => {
        card.classList.remove("arrastando");
        itemArrastadoDestaque = null;
        salvarNovaOrdemDestaque();
    });

    card.addEventListener("dragover", (e) => {
        e.preventDefault();
        const alvo = e.target.closest(".foto-card");
        if(!alvo || alvo === itemArrastadoDestaque || alvo.parentNode !== destaqueAdmin) return;
        trocarPosicaoDestaque(alvo);
    });

    const alca = card.querySelector(".foto-arrastar");

    alca.addEventListener("touchstart", () => {
        itemArrastadoDestaque = card;
        card.classList.add("arrastando");
    }, { passive: true });

    alca.addEventListener("touchmove", (e) => {

        if(!itemArrastadoDestaque) return;
        e.preventDefault();

        const toque = e.touches[0];

        itemArrastadoDestaque.style.pointerEvents = "none";
        const elementoAbaixo = document.elementFromPoint(toque.clientX, toque.clientY);
        itemArrastadoDestaque.style.pointerEvents = "";

        const alvo = elementoAbaixo ? elementoAbaixo.closest(".foto-card") : null;

        if(alvo && alvo !== itemArrastadoDestaque && alvo.parentNode === destaqueAdmin){
            trocarPosicaoDestaque(alvo);
        }

    }, { passive: false });

    alca.addEventListener("touchend", () => {

        if(!itemArrastadoDestaque) return;

        itemArrastadoDestaque.classList.remove("arrastando");
        itemArrastadoDestaque = null;

        salvarNovaOrdemDestaque();

    });

    alca.addEventListener("touchcancel", () => {
        if(itemArrastadoDestaque){
            itemArrastadoDestaque.classList.remove("arrastando");
        }
        itemArrastadoDestaque = null;
    });

}

function trocarPosicaoDestaque(alvo){

    const proximoDoAlvo = alvo.nextElementSibling;

    if(proximoDoAlvo === itemArrastadoDestaque){
        alvo.parentNode.insertBefore(itemArrastadoDestaque, alvo);
    }else{
        const referencia = itemArrastadoDestaque.nextElementSibling;
        alvo.parentNode.insertBefore(itemArrastadoDestaque, alvo);
        alvo.parentNode.insertBefore(alvo, referencia);
    }

}

async function salvarNovaOrdemDestaque(){

    const cards = [...destaqueAdmin.querySelectorAll(".foto-card")];

    const atualizacoes = cards.map((card, i) => ({
        id: Number(card.getAttribute("data-id")),
        ordem: i
    }));

    await Promise.all(
        atualizacoes.map(item =>
            client
            .from("destaques")
            .update({ ordem: item.ordem })
            .eq("id", item.id)
        )
    );

    destaquesOrdenados = atualizacoes;

}

/* ======================================
   EXCLUIR DESTAQUE
====================================== */

let idDestaqueParaExcluir = null;

function abrirModalExcluirDestaque(id){

    idDestaqueParaExcluir = id;
    document.getElementById("modalExcluir").classList.add("ativo");

    // Reaproveita o modal de exclusão da galeria, mas com callback próprio
    const botaoConfirmar = document.querySelector("#modalExcluir .btn-confirmar-excluir");
    botaoConfirmar.setAttribute("onclick", "confirmarExclusaoDestaque()");

}

async function confirmarExclusaoDestaque(){

    if(idDestaqueParaExcluir === null) return;

    const id = idDestaqueParaExcluir;
    idDestaqueParaExcluir = null;
    fecharModalExcluir();

    const {
        data
    } = await client
    .from("destaques")
    .select("*")
    .eq("id", id)
    .single();

    if(data){

        const partes =
        data.imagem_url.split("/");

        const nomeArquivo =
        partes[
            partes.length - 1
        ];

        await client.storage
        .from("fotos")
        .remove([
            nomeArquivo
        ]);
    }

    await client
    .from("destaques")
    .delete()
    .eq("id", id);

    // Restaura o botão de exclusão padrão da galeria principal
    const botaoConfirmar = document.querySelector("#modalExcluir .btn-confirmar-excluir");
    botaoConfirmar.setAttribute("onclick", "confirmarExclusao()");

    carregarDestaques();

}