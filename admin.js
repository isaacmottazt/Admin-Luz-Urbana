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

    data.forEach(imagem => {

        galeria.innerHTML += `

        <div class="foto-card">

            <div class="foto-wrap">
                <img
                src="${imagem.imagem_url}"
                alt="Foto">
            </div>

            <button
            onclick="
            deletarImagem(
                ${imagem.id}
            )">

            Excluir

            </button>

        </div>

        `;

    });

}

/* ======================================
   DELETAR
====================================== */

async function deletarImagem(id){

    const confirmar =
    confirm(
        "Deseja excluir?"
    );

    if(!confirmar){
        return;
    }

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