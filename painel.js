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
   VARIÁVEIS GLOBAIS
====================================== */

let todosAgendamentosCache = [];

/* ======================================
   VERIFICAR LOGIN
====================================== */

document.addEventListener(
    "DOMContentLoaded",

    async ()=>{

        try {

            mostrarDiagnostico('Verificando login...');

            const {
                data:{ session },
                error: erroSessao
            } =
            await client.auth.getSession();

            if (erroSessao) {
                mostrarDiagnostico('ERRO ao verificar sessão: ' + erroSessao.message, true);
                return;
            }

            if(!session){

                mostrarDiagnostico('Sem sessão ativa, redirecionando para login.html');

                window.location.href =
                "login.html";

                return;
            }

            mostrarDiagnostico('Sessão OK, carregando agendamentos...');

            carregarAgendamentos();

        } catch (erroInicial) {
            mostrarDiagnostico('ERRO FATAL no carregamento inicial: ' + erroInicial.message, true);
        }

    }
);

/* ======================================
   FUNÇÕES DOS CARDS
====================================== */

// Ver todos os agendamentos
function verTodosAgendamentos() {
    const modal = document.getElementById('modalLista');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalConteudo = document.getElementById('modalListaConteudo');
    
    modalTitulo.innerHTML = '📋 Todos os Agendamentos';
    
    if (todosAgendamentosCache.length === 0) {
        modalConteudo.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento encontrado</div>';
    } else {
        modalConteudo.innerHTML = todosAgendamentosCache.map(item => {
            let statusText = item.status === 'pendente' ? 'Pendente' : 'Em Andamento (Aceito)';
            return `
            <div class="modal-agendamento">
                <h4>${item.nome}</h4>
                <p><strong>📞 Telefone:</strong> ${item.telefone}</p>
                <p><strong>✉️ Email:</strong> ${item.email}</p>
                <p><strong>📸 Ensaio:</strong> ${item.ensaio}</p>
                <p><strong>📅 Data:</strong> ${item.data}</p>
                <p><strong>⏰ Horário:</strong> ${item.horario}</p>
                <p><strong>📝 Status:</strong> ${statusText}</p>
            </div>
        `}).join('');
    }
    
    modal.style.display = 'block';
}

// Ver apenas agendamentos aceitos (EM ANDAMENTO)
function verAgendamentosAceitos() {
    const modal = document.getElementById('modalLista');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalConteudo = document.getElementById('modalListaConteudo');
    
    modalTitulo.innerHTML = '✅ Agendamentos Aceitos (Em Andamento)';
    
    const aceitos = todosAgendamentosCache.filter(item => item.status === 'andamento');
    
    if (aceitos.length === 0) {
        modalConteudo.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento aceito encontrado</div>';
    } else {
        modalConteudo.innerHTML = aceitos.map(item => `
            <div class="modal-agendamento">
                <h4>${item.nome}</h4>
                <p><strong>📞 Telefone:</strong> ${item.telefone}</p>
                <p><strong>✉️ Email:</strong> ${item.email}</p>
                <p><strong>📸 Ensaio:</strong> ${item.ensaio}</p>
                <p><strong>📅 Data:</strong> ${item.data}</p>
                <p><strong>⏰ Horário:</strong> ${item.horario}</p>
                <p><strong>📝 Status:</strong> Aceito (Em Andamento)</p>
            </div>
        `).join('');
    }
    
    modal.style.display = 'block';
}

// Fechar modal
function fecharModal() {
    const modal = document.getElementById('modalLista');
    modal.style.display = 'none';
}

// Fechar modal clicando fora
window.onclick = function(event) {
    const modal = document.getElementById('modalLista');
    if (event.target === modal) {
        modal.style.display = 'none';
    }

    const modalExcluir = document.getElementById('modalExcluirAgendamento');
    if (event.target === modalExcluir) {
        fecharModalExcluirAgendamento();
    }
}

/* ======================================
   FUNÇÃO PARA ATUALIZAR CARDS
====================================== */

function atualizarCards(agendamentos) {
    // Total de agendamentos
    const total = agendamentos.length;
    document.getElementById('totalAgendamentos').innerHTML = total;
    
    // Total de aceitos (EM ANDAMENTO)
    const aceitos = agendamentos.filter(item => item.status === 'andamento').length;
    document.getElementById('totalAceitos').innerHTML = aceitos;
    
    // Total de clientes (mesmo que total de agendamentos)
    document.getElementById('totalClientes').innerHTML = total;
    
    // Cache para os modais
    todosAgendamentosCache = [...agendamentos];

    // Atualizar gráfico de agendamentos por mês
    renderizarGraficoMensal(agendamentos);

    // Atualizar calendário com os pontinhos de agendamento
    renderizarCalendario();
}

/* ======================================
   CARREGAR AGENDAMENTOS
====================================== */

async function carregarAgendamentos() {

    mostrarDiagnostico('Consultando banco de dados...');

    let data, error;

    try {
        const resposta = await client
            .from("agendamentos")
            .select("*")
            .order("id", { ascending: false });

        data = resposta.data;
        error = resposta.error;

    } catch (erroFatal) {
        mostrarDiagnostico('ERRO FATAL na consulta: ' + erroFatal.message, true);
        return;
    }

    console.log(data);
    console.log(error);

    if (error) {
        mostrarDiagnostico('ERRO do Supabase: ' + error.message, true);
        alert(error.message);
        return;
    }

    if (!data) {
        mostrarDiagnostico('A consulta retornou "data" vazio/undefined, sem erro explícito.', true);
        return;
    }

    mostrarDiagnostico(`OK: ${data.length} agendamento(s) recebido(s) do banco.`);

    /* ENCERRAR AUTOMATICAMENTE OS QUE JÁ PASSARAM DA DATA */
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const vencidos = data.filter(item => {
            const statusAtual = item.status || "pendente";
            if (statusAtual !== "pendente" && statusAtual !== "andamento") return false;

            const dataItem = parseDataAgendamento(item.data);
            if (!dataItem) return false;

            dataItem.setHours(0, 0, 0, 0);
            return dataItem < hoje;
        });

        if (vencidos.length > 0) {
            await Promise.all(
                vencidos.map(item =>
                    client.from("agendamentos").update({ status: "finalizado" }).eq("id", item.id)
                )
            );

            // Refletir a mudança nos dados já carregados, sem precisar buscar de novo
            vencidos.forEach(item => { item.status = "finalizado"; });
        }
    } catch (erroAutoFinalizar) {
        mostrarDiagnostico('ERRO ao encerrar automaticamente vencidos: ' + erroAutoFinalizar.message, true);
    }

    try {

        /* LISTAS */
        const pendentesLista = document.getElementById("pendentes-lista");
        const andamentoLista = document.getElementById("andamento-lista");
        const finalizadosLista = document.getElementById("finalizados-lista");

        /* LIMPAR */
        pendentesLista.innerHTML = "";
        andamentoLista.innerHTML = "";
        finalizadosLista.innerHTML = "";

        /* CONTADORES */
        let pendentes = 0;
        let andamento = 0;
        let finalizados = 0;

        /* LOOP */
        data.forEach(item => {
            const statusAtual = item.status || "pendente";

            if (statusAtual === "pendente" || statusAtual === "andamento") {
                const card = `
                <div class="agendamento">
                    <h3>${item.nome}</h3>
                    <p><strong>Telefone:</strong> ${item.telefone}</p>
                    <p><strong>Email:</strong> ${item.email}</p>
                    <p><strong>Ensaio:</strong> ${item.ensaio}</p>
                    <p><strong>Data:</strong> ${item.data}</p>
                    <p><strong>Horário:</strong> ${item.horario}</p>
                    <p><strong>Mensagem:</strong> ${item.mensagem || "Sem mensagem"}</p>
                    <p><strong>Status:</strong> ${statusAtual === 'pendente' ? 'Pendente' : 'Em Andamento (Aceito)'}</p>
                    <div class="botoes">
                        <button class="btn-pendente" onclick="atualizarStatus(${item.id}, 'pendente')">Pendente</button>
                        <button class="btn-andamento" onclick="atualizarStatus(${item.id}, 'andamento')">Aceitar (Andamento)</button>
                        <button class="btn-finalizado" onclick="atualizarStatus(${item.id}, 'finalizado')">Encerrar</button>
                        <button class="btn-excluir" onclick="excluirAgendamento(${item.id})">Excluir</button>
                    </div>
                </div>
                `;

                if (statusAtual === "pendente") {
                    pendentes++;
                    pendentesLista.innerHTML += card;
                } else if (statusAtual === "andamento") {
                    andamento++;
                    andamentoLista.innerHTML += card;
                }
            } else if (statusAtual === "finalizado" || statusAtual === "concluido") {
                finalizados++;

                const dataItem = parseDataAgendamento(item.data);
                const hojeCheck = new Date();
                hojeCheck.setHours(0, 0, 0, 0);
                if (dataItem) dataItem.setHours(0, 0, 0, 0);

                const dataJaPassou = dataItem && dataItem < hojeCheck;

                const botaoReabrir = dataJaPassou
                    ? ''
                    : `<button class="btn-andamento" onclick="atualizarStatus(${item.id}, 'andamento')">Reabrir (Andamento)</button>`;

                finalizadosLista.innerHTML += `
                <div class="agendamento agendamento--finalizado">
                    <h3>${item.nome}</h3>
                    <p><strong>Telefone:</strong> ${item.telefone}</p>
                    <p><strong>Email:</strong> ${item.email}</p>
                    <p><strong>Ensaio:</strong> ${item.ensaio}</p>
                    <p><strong>Data:</strong> ${item.data}</p>
                    <p><strong>Horário:</strong> ${item.horario}</p>
                    <p><strong>Mensagem:</strong> ${item.mensagem || "Sem mensagem"}</p>
                    <p><strong>Status:</strong> Finalizado</p>
                    <div class="botoes">
                        ${botaoReabrir}
                        <button class="btn-excluir" onclick="excluirAgendamento(${item.id})">Excluir</button>
                    </div>
                </div>
                `;
            }
        });

        /* CONTADORES */
        document.getElementById("totalPendentes").innerHTML = pendentes;
        document.getElementById("totalAndamento").innerHTML = andamento;
        document.getElementById("totalFinalizados").innerHTML = finalizados;

        mostrarDiagnostico(`Renderizado: ${pendentes} pendente(s), ${andamento} em andamento, ${finalizados} finalizado(s).`);

    } catch (erroRender) {
        mostrarDiagnostico('ERRO ao renderizar as listas: ' + erroRender.message, true);
        return;
    }

    /* ATUALIZAR NOVOS CARDS, GRÁFICO E CALENDÁRIO */
    try {
        atualizarCards(data);
        mostrarDiagnostico(`Tudo carregado com sucesso (${data.length} agendamento(s)).`);
    } catch (erroCards) {
        mostrarDiagnostico('ERRO ao atualizar cards/gráfico/calendário: ' + erroCards.message, true);
    }
}

/* ======================================
   DIAGNÓSTICO VISÍVEL NA TELA
   (temporário, para identificar onde o
   carregamento está travando/falhando)
====================================== */

function mostrarDiagnostico(mensagem, ehErro) {
    // Diagnóstico visual desativado.
    return;
}

/* ======================================
   ATUALIZAR STATUS
====================================== */

async function atualizarStatus(id, status) {

    // Não permitir reabrir (voltar para pendente/andamento) um ensaio cuja data já passou
    if (status === "pendente" || status === "andamento") {
        const item = todosAgendamentosCache.find(a => a.id === id);
        if (item) {
            const dataItem = parseDataAgendamento(item.data);
            if (dataItem) {
                const hojeCheck = new Date();
                hojeCheck.setHours(0, 0, 0, 0);
                dataItem.setHours(0, 0, 0, 0);

                if (dataItem < hojeCheck) {
                    alert("Este ensaio já passou da data e não pode ser reaberto.");
                    return;
                }
            }
        }
    }

    const {
        error
    } = await client

    .from("agendamentos")

    .update({
        status: status
    })

    .eq("id", id);

    if (error) {
        alert(error.message);
        return;
    }

    carregarAgendamentos();
}

/* ======================================
   EXCLUIR
====================================== */

let idAgendamentoParaExcluir = null;

function excluirAgendamento(id) {
    idAgendamentoParaExcluir = id;
    document.getElementById("modalExcluirAgendamento").style.display = "block";
}

function fecharModalExcluirAgendamento() {
    idAgendamentoParaExcluir = null;
    document.getElementById("modalExcluirAgendamento").style.display = "none";
}

async function confirmarExclusaoAgendamento() {

    if (idAgendamentoParaExcluir === null) return;

    const id = idAgendamentoParaExcluir;
    fecharModalExcluirAgendamento();

    const {
        error
    } = await client

    .from("agendamentos")

    .delete()

    .eq("id", id);

    if (error) {
        alert(error.message);
        return;
    }

    carregarAgendamentos();
}

/* ======================================
   LOGOUT
====================================== */

async function logout() {
    await client.auth.signOut();
    window.location.href = "login.html";
}

/* ======================================
   ABRIR / FECHAR LISTA
====================================== */

function toggleLista(id) {
    const lista = document.getElementById(id);
    lista.classList.toggle("active");
}

/* ======================================
   CALENDÁRIO
====================================== */

let calendarioMesAtualIndex = new Date().getMonth();
let calendarioAnoAtual = new Date().getFullYear();
let calendarioDiaSelecionadoStr = null;

const CALENDARIO_MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Converte item.data (dd/mm/aaaa ou aaaa-mm-dd) em objeto Date, igual à lógica usada em getProximosHorarios
function parseDataAgendamento(dataStr) {
    if (!dataStr) return null;

    let dataObj = null;

    if (dataStr.includes('/')) {
        const partes = dataStr.split('/');
        if (partes.length === 3) {
            dataObj = new Date(partes[2], partes[1] - 1, partes[0]);
        }
    } else if (dataStr.includes('-')) {
        dataObj = new Date(dataStr);
    } else {
        dataObj = new Date(dataStr);
    }

    if (!dataObj || isNaN(dataObj.getTime())) return null;

    return dataObj;
}

function chaveData(dataObj) {
    const ano = dataObj.getFullYear();
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const dia = String(dataObj.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function calendarioMesAnterior() {
    calendarioMesAtualIndex--;
    if (calendarioMesAtualIndex < 0) {
        calendarioMesAtualIndex = 11;
        calendarioAnoAtual--;
    }
    renderizarCalendario();
}

function calendarioMesSeguinte() {
    calendarioMesAtualIndex++;
    if (calendarioMesAtualIndex > 11) {
        calendarioMesAtualIndex = 0;
        calendarioAnoAtual++;
    }
    renderizarCalendario();
}

function calendarioMesAtual() {
    const hoje = new Date();
    calendarioMesAtualIndex = hoje.getMonth();
    calendarioAnoAtual = hoje.getFullYear();
    renderizarCalendario();
}

// Agrupa os agendamentos ativos (pendente/andamento) por chave de data (aaaa-mm-dd)
function agruparAgendamentosPorData() {
    const grupos = {};

    todosAgendamentosCache.forEach(item => {
        if (item.status !== 'pendente' && item.status !== 'andamento') return;

        const dataObj = parseDataAgendamento(item.data);
        if (!dataObj) return;

        const chave = chaveData(dataObj);
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push(item);
    });

    return grupos;
}

function renderizarCalendario() {
    const grid = document.getElementById('calendarioGrid');
    const tituloEl = document.getElementById('calendarioMesAno');
    if (!grid || !tituloEl) return;

    tituloEl.textContent = `${CALENDARIO_MESES[calendarioMesAtualIndex]} ${calendarioAnoAtual}`;

    const grupos = agruparAgendamentosPorData();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const chaveHoje = chaveData(hoje);

    const primeiroDiaSemana = new Date(calendarioAnoAtual, calendarioMesAtualIndex, 1).getDay();
    const totalDias = new Date(calendarioAnoAtual, calendarioMesAtualIndex + 1, 0).getDate();

    let html = '';

    for (let i = 0; i < primeiroDiaSemana; i++) {
        html += `<div class="calendario-dia calendario-dia--vazio"></div>`;
    }

    for (let dia = 1; dia <= totalDias; dia++) {
        const dataObj = new Date(calendarioAnoAtual, calendarioMesAtualIndex, dia);
        const chave = chaveData(dataObj);
        const itensDoDia = grupos[chave] || [];

        let classes = 'calendario-dia';
        if (chave === chaveHoje) classes += ' calendario-dia--hoje';
        if (chave === calendarioDiaSelecionadoStr) classes += ' calendario-dia--selecionado';

        let pontosHtml = '';
        if (itensDoDia.length > 0) {
            const temPendente = itensDoDia.some(i => i.status === 'pendente');
            const temAndamento = itensDoDia.some(i => i.status === 'andamento');
            pontosHtml = '<div class="calendario-dia-pontos">';
            if (temPendente) pontosHtml += '<span class="calendario-ponto"></span>';
            if (temAndamento) pontosHtml += '<span class="calendario-ponto calendario-ponto--azul"></span>';
            pontosHtml += '</div>';
        }

        html += `
            <div class="${classes}" onclick="selecionarDiaCalendario('${chave}')">
                ${dia}
                ${pontosHtml}
            </div>
        `;
    }

    grid.innerHTML = html;

    // Se o dia selecionado não pertence mais ao mês visível, limpa a seleção
    if (calendarioDiaSelecionadoStr) {
        const [anoSel, mesSel] = calendarioDiaSelecionadoStr.split('-').map(Number);
        if (anoSel !== calendarioAnoAtual || (mesSel - 1) !== calendarioMesAtualIndex) {
            document.getElementById('calendarioDiaSelecionado').innerHTML = '';
        }
    }
}

function selecionarDiaCalendario(chave) {
    if (calendarioDiaSelecionadoStr === chave) {
        // Clicar de novo no mesmo dia fecha a seleção
        calendarioDiaSelecionadoStr = null;
        document.getElementById('calendarioDiaSelecionado').innerHTML = '';
        renderizarCalendario();
        return;
    }

    calendarioDiaSelecionadoStr = chave;

    const grupos = agruparAgendamentosPorData();
    const itensDoDia = grupos[chave] || [];

    const [ano, mes, dia] = chave.split('-');
    const tituloData = `${dia}/${mes}/${ano}`;

    const container = document.getElementById('calendarioDiaSelecionado');

    if (itensDoDia.length === 0) {
        container.innerHTML = `
            <div class="calendario-dia-selecionado-topo">
                <h3>${tituloData}</h3>
                <span class="calendario-dia-fechar" onclick="fecharDiaCalendario()">&times;</span>
            </div>
            <div class="sem-agendamentos">Nenhum agendamento neste dia</div>
        `;
    } else {
        const cardsHtml = itensDoDia.map(item => {
            const statusText = item.status === 'pendente' ? 'Pendente' : 'Em Andamento (Aceito)';
            return `
                <div class="modal-agendamento">
                    <h4>${item.nome}</h4>
                    <p><strong>📞 Telefone:</strong> ${item.telefone}</p>
                    <p><strong>⏰ Horário:</strong> ${item.horario}</p>
                    <p><strong>📝 Status:</strong> ${statusText}</p>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="calendario-dia-selecionado-topo">
                <h3>${tituloData} &middot; ${itensDoDia.length} agendamento(s)</h3>
                <span class="calendario-dia-fechar" onclick="fecharDiaCalendario()">&times;</span>
            </div>
            ${cardsHtml}
        `;
    }

    renderizarCalendario();
}

function fecharDiaCalendario() {
    calendarioDiaSelecionadoStr = null;
    document.getElementById('calendarioDiaSelecionado').innerHTML = '';
    renderizarCalendario();
}

/* ======================================
   VER TODOS ORGANIZADOS POR DATA
====================================== */

function verTodosPorData() {
    const modal = document.getElementById('modalLista');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalConteudo = document.getElementById('modalListaConteudo');

    modalTitulo.innerHTML = '🗓️ Agendamentos por Data';

    const grupos = agruparAgendamentosPorData();
    const chaves = Object.keys(grupos).sort();

    if (chaves.length === 0) {
        modalConteudo.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento encontrado</div>';
        modal.style.display = 'block';
        return;
    }

    modalConteudo.innerHTML = chaves.map(chave => {
        const [ano, mes, dia] = chave.split('-');
        const tituloData = `${dia}/${mes}/${ano}`;

        const itensOrdenados = grupos[chave].slice().sort((a, b) => a.horario.localeCompare(b.horario));

        const cardsHtml = itensOrdenados.map(item => {
            const statusText = item.status === 'pendente' ? 'Pendente' : 'Em Andamento (Aceito)';
            return `
                <div class="modal-agendamento">
                    <h4>${item.nome}</h4>
                    <p><strong>📞 Telefone:</strong> ${item.telefone}</p>
                    <p><strong>✉️ Email:</strong> ${item.email}</p>
                    <p><strong>📸 Ensaio:</strong> ${item.ensaio}</p>
                    <p><strong>⏰ Horário:</strong> ${item.horario}</p>
                    <p><strong>📝 Status:</strong> ${statusText}</p>
                </div>
            `;
        }).join('');

        return `
            <div class="data-grupo">
                <div class="data-grupo-titulo">${tituloData}</div>
                ${cardsHtml}
            </div>
        `;
    }).join('');

    modal.style.display = 'block';
}

/* ======================================
   GRÁFICO DE AGENDAMENTOS POR MÊS
====================================== */

const GRAFICO_MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Conta quantos agendamentos existem em cada um dos últimos 6 meses (incluindo o atual)
function contarAgendamentosPorMes(agendamentos) {
    const hoje = new Date();
    const meses = [];

    // Monta os últimos 6 meses, do mais antigo para o mais recente
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        meses.push({
            ano: d.getFullYear(),
            mes: d.getMonth(),
            label: GRAFICO_MESES_ABREV[d.getMonth()],
            total: 0
        });
    }

    agendamentos.forEach(item => {
        const dataObj = parseDataAgendamento(item.data);
        if (!dataObj) return;

        const alvo = meses.find(m => m.ano === dataObj.getFullYear() && m.mes === dataObj.getMonth());
        if (alvo) alvo.total++;
    });

    return meses;
}

function renderizarGraficoMensal(agendamentos) {
    const canvas = document.getElementById('graficoMensalCanvas');
    const legenda = document.getElementById('graficoLegenda');
    const tagVariacao = document.getElementById('graficoVariacao');
    if (!canvas || !legenda) return;

    const meses = contarAgendamentosPorMes(agendamentos);

    // Ajustar resolução do canvas ao tamanho real exibido (evita ficar borrado)
    const wrap = canvas.parentElement;
    const larguraCss = wrap.clientWidth;
    const alturaCss = wrap.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = larguraCss * dpr;
    canvas.height = alturaCss * dpr;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, larguraCss, alturaCss);

    const maiorValor = Math.max(...meses.map(m => m.total), 1);

    const padInferior = 26;
    const padSuperior = 14;
    const alturaUtil = alturaCss - padInferior - padSuperior;

    const qtdBarras = meses.length;
    const gap = 14;
    const larguraBarra = (larguraCss - gap * (qtdBarras + 1)) / qtdBarras;

    meses.forEach((m, i) => {
        const alturaBarra = m.total === 0 ? 3 : Math.max(6, (m.total / maiorValor) * alturaUtil);
        const x = gap + i * (larguraBarra + gap);
        const y = padSuperior + (alturaUtil - alturaBarra);

        const ehMesAtual = (i === meses.length - 1);

        const grad = ctx.createLinearGradient(0, y, 0, y + alturaBarra);
        if (ehMesAtual) {
            grad.addColorStop(0, '#e8c07d');
            grad.addColorStop(1, '#b88536');
        } else {
            grad.addColorStop(0, 'rgba(255,255,255,0.22)');
            grad.addColorStop(1, 'rgba(255,255,255,0.08)');
        }

        ctx.fillStyle = grad;
        roundRect(ctx, x, y, larguraBarra, alturaBarra, 6);
        ctx.fill();

        // Número acima da barra
        if (m.total > 0) {
            ctx.fillStyle = ehMesAtual ? '#e8c07d' : '#ccc';
            ctx.font = '600 12px Poppins, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(m.total, x + larguraBarra / 2, y - 8);
        }
    });

    // Legenda com os meses abaixo do gráfico
    legenda.innerHTML = meses.map((m, i) => {
        const classeExtra = (i === meses.length - 1) ? ' grafico-legenda-item--atual' : '';
        return `<span class="grafico-legenda-item${classeExtra}">${m.label}</span>`;
    }).join('');

    // Variação percentual: mês atual vs mês anterior
    const mesAtualTotal = meses[meses.length - 1].total;
    const mesAnteriorTotal = meses[meses.length - 2].total;

    if (!tagVariacao) return;

    if (mesAnteriorTotal === 0 && mesAtualTotal === 0) {
        tagVariacao.textContent = 'Sem dados ainda';
        tagVariacao.className = 'tag-variacao';
    } else if (mesAnteriorTotal === 0) {
        tagVariacao.textContent = `▲ Novo neste mês (${mesAtualTotal})`;
        tagVariacao.className = 'tag-variacao tag-variacao--alta';
    } else {
        const variacao = ((mesAtualTotal - mesAnteriorTotal) / mesAnteriorTotal) * 100;
        const variacaoArred = Math.round(variacao);

        if (variacaoArred > 0) {
            tagVariacao.textContent = `▲ ${variacaoArred}% a mais que o mês anterior`;
            tagVariacao.className = 'tag-variacao tag-variacao--alta';
        } else if (variacaoArred < 0) {
            tagVariacao.textContent = `▼ ${Math.abs(variacaoArred)}% a menos que o mês anterior`;
            tagVariacao.className = 'tag-variacao tag-variacao--baixa';
        } else {
            tagVariacao.textContent = 'Igual ao mês anterior';
            tagVariacao.className = 'tag-variacao';
        }
    }
}

// Utilitário para desenhar retângulo com cantos arredondados no canvas
function roundRect(ctx, x, y, largura, altura, raio) {
    const r = Math.min(raio, largura / 2, altura / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + largura - r, y);
    ctx.arcTo(x + largura, y, x + largura, y + r, r);
    ctx.lineTo(x + largura, y + altura);
    ctx.lineTo(x, y + altura);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

// Redesenha o gráfico ao redimensionar a tela (ex: rotação do celular)
window.addEventListener('resize', () => {
    if (todosAgendamentosCache.length > 0 || document.getElementById('graficoMensalCanvas')) {
        renderizarGraficoMensal(todosAgendamentosCache);
    }
});