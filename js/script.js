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
   LOGIN
====================================== */

const LOGIN_GUARD_KEY = 'motazt_login_guard_v1';
const LOGIN_MAX_TENTATIVAS = 5;
const LOGIN_BLOQUEIO_MS = 15 * 60 * 1000;

function lerProtecaoLogin(){
    try { return JSON.parse(localStorage.getItem(LOGIN_GUARD_KEY) || '{"tentativas":0,"bloqueadoAte":0}'); }
    catch { return { tentativas: 0, bloqueadoAte: 0 }; }
}

function salvarProtecaoLogin(dados){
    localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(dados));
}

function formatarTempoBloqueio(ms){
    const minutos = Math.max(1, Math.ceil(ms / 60000));
    return `${minutos} minuto${minutos === 1 ? '' : 's'}`;
}

function verificarBloqueioLogin(status){
    const dados = lerProtecaoLogin();
    if (dados.bloqueadoAte && dados.bloqueadoAte > Date.now()) {
        status.innerHTML = `Muitas tentativas inválidas. Tente novamente em ${formatarTempoBloqueio(dados.bloqueadoAte - Date.now())}.`;
        return true;
    }
    if (dados.bloqueadoAte && dados.bloqueadoAte <= Date.now()) {
        salvarProtecaoLogin({ tentativas: 0, bloqueadoAte: 0 });
    }
    return false;
}

async function login(){

    const email =
    document.getElementById("email").value;

    const senha =
    document.getElementById("senha").value;

    const status =
    document.getElementById("status");

    if(verificarBloqueioLogin(status)) return;

    if(!email || !senha){

        status.innerHTML =
        "Preencha email e senha.";

        return;
    }

    status.innerHTML =
    "Entrando...";

    const {
        error
    } = await client.auth
    .signInWithPassword({

        email: email,
        password: senha

    });

    if(error){

        console.log(error);
        const protecao = lerProtecaoLogin();
        protecao.tentativas = Number(protecao.tentativas || 0) + 1;
        if(protecao.tentativas >= LOGIN_MAX_TENTATIVAS){
            protecao.bloqueadoAte = Date.now() + LOGIN_BLOQUEIO_MS;
            protecao.tentativas = 0;
            salvarProtecaoLogin(protecao);
            status.innerHTML = `Muitas tentativas inválidas. Login bloqueado por ${formatarTempoBloqueio(LOGIN_BLOQUEIO_MS)}.`;
        } else {
            salvarProtecaoLogin(protecao);
            const restantes = LOGIN_MAX_TENTATIVAS - protecao.tentativas;
            status.innerHTML = `Email ou senha inválidos. Restam ${restantes} tentativa${restantes === 1 ? '' : 's'}.`;
        }

        return;
    }

    localStorage.removeItem(LOGIN_GUARD_KEY);
    status.innerHTML =
    "Login realizado!";

    setTimeout(() => {

        window.location.href =
        "index.html";

    }, 1000);

}

/* ======================================
   REDEFINIR SENHA
====================================== */

async function redefinirSenha(){

    const email =
    document.getElementById("email").value;

    const status =
    document.getElementById("status");

    if(!email){

        status.innerHTML =
        "Digite seu email.";

        return;
    }

    status.innerHTML =
    "Enviando email...";

    const {
        error
    } = await client.auth
    .resetPasswordForEmail(
        email
    );

    if(error){

        console.log(error);

        status.innerHTML =
        "Erro ao enviar email.";

        return;
    }

    status.innerHTML =
    "Email enviado!";
}

/* =========================
VOLTAR HOME
========================= */

function voltarHome(){

    window.location.href =
    'login.html';

}