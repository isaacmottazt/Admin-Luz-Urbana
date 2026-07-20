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
    "Enviando imagens...";

    let enviados = 0;

    for(const arquivo of arquivos){

        try{

            /* VERIFICAR IMAGEM */

            if(
                !arquivo.type.startsWith(
                    "image/"
                )
            ){
                continue;
            }

            /* NOME ÚNICO */

            const extensao =
            arquivo.name
            .split(".")
            .pop();

            const nomeArquivo =

`${Date.now()}-${Math.floor(
Math.random() * 100000
)}.${extensao}`;

            /* UPLOAD */

            const {
                error: erroUpload
            } = await client.storage
            .from("fotos")
            .upload(
                nomeArquivo,
                arquivo
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

        }catch(err){

            console.log(err);

        }

    }

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

    const {
        data,
        error
    } = await client
    .from("galeria")
    .select("*")
    .order("ordem", {
        ascending:true,
        nullsFirst:false
    })
    .order("id", {
        ascending:false
    });

    if(error){

        console.log(error);

        galeria.innerHTML =
        "<p>Erro ao carregar.</p>";

        return;
    }

    galeria.innerHTML = "";

    data.forEach((imagem, index) => {

        const formatoAtual =
        imagem.formato || "auto";

        const div = document.createElement("div");
        div.className = "foto-card";
        div.setAttribute("data-id", imagem.id);
        div.setAttribute("draggable", "true");

        div.innerHTML = `

            <div class="foto-arrastar" title="Arraste para reordenar">
                <span></span><span></span><span></span>
            </div>

            <div class="foto-wrap foto-wrap--${formatoAtual}">
                <img
                src="${imagem.imagem_url}"
                alt="Foto"
                loading="lazy">
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

        // Abrir lightbox ao tocar/clicar na foto
        div.querySelector(".foto-wrap img")
        .addEventListener("click", () => {
            abrirLightbox(imagem.imagem_url);
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