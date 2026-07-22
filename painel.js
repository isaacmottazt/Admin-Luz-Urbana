/* ======================================
   SUPABASE - CONFIGURAÇÃO
====================================== */

const supabaseUrl = "https://tbwmsgztpyyratambgqs.supabase.co";
const supabaseKey = "sb_publishable_yqH30kXsSD7nmwdlgPj93Q_pw1QrcQd";

const client = supabase.createClient(supabaseUrl, supabaseKey);

/* ======================================
   VARIÁVEIS GLOBAIS
====================================== */

let todosAgendamentosCache = [];
let agendamentoParaExcluir = null;
let calendarioMesAtual = new Date();
let calendarioDiaSelecionadoStr = null;

/* ======================================
   INICIALIZAÇÃO - ESPERAR DOM
====================================== */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
} else {
    inicializar();
}

async function inicializar() {
    console.log('🟢 DOM Carregado, iniciando verificação...');
    
    try {
        mostrarDiagnostico('🔐 Verificando autenticação...', false);
        
        const { data: { session }, error } = await client.auth.getSession();
        
        if (error) {
            console.error('Erro de sessão:', error);
            mostrarDiagnostico('❌ Erro de autenticação: ' + error.message, true);
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        if (!session) {
            console.warn('Sem sessão ativa');
            mostrarDiagnostico('🔐 Redirecionando para login...', false);
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            return;
        }
        
        console.log('✅ Autenticado como:', session.user.email);
        mostrarDiagnostico('✅ Autenticado! Carregando dados...', false);
        
        // Aguardar um pouco e depois carregar
        await new Promise(resolve => setTimeout(resolve, 500));
        await carregarAgendamentos();
        
    } catch (e) {
        console.error('Erro Fatal:', e);
        mostrarDiagnostico('💥 Erro Fatal: ' + e.message, true);
    }
}

/* ======================================
   CARREGAR AGENDAMENTOS DO SUPABASE
====================================== */

async function carregarAgendamentos() {
    console.log('📡 Iniciando carregamento de agendamentos...');
    mostrarDiagnostico('📡 Buscando agendamentos...', false);
    
    try {
        // Consulta ao Supabase
        const { data, error } = await client
            .from('agendamentos')
            .select('*')
            .order('id', { ascending: false });
        
        // Verificar erros
        if (error) {
            console.error('Erro Supabase:', error);
            mostrarDiagnostico('❌ Erro: ' + error.message, true);
            
            // Renderizar interface vazia
            renderizarCardsDeStatus([]);
            atualizarCards([]);
            return;
        }
        
        // Se não há dados
        if (!data) {
            console.warn('Nenhum dado retornado');
            renderizarCardsDeStatus([]);
            atualizarCards([]);
            mostrarDiagnostico('⚠️ Nenhum agendamento encontrado', false);
            return;
        }
        
        console.log('✅ Dados recebidos:', data.length, 'agendamentos');
        
        // Processar dados recebidos
        processarAgendamentos(data);
        
    } catch (e) {
        console.error('Erro ao carregar:', e);
        mostrarDiagnostico('❌ Erro ao carregar: ' + e.message, true);
    }
}

async function processarAgendamentos(agendamentos) {
    console.log('🔄 Processando', agendamentos.length, 'agendamentos...');
    
    try {
        // Encerrar automaticamente os vencidos
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const vencidos = [];
        
        for (const item of agendamentos) {
            const statusAtual = item.status || 'pendente';
            
            // Só processar se não foi finalizado
            if (statusAtual === 'pendente' || statusAtual === 'andamento') {
                const dataItem = parseDataAgendamento(item.data);
                
                if (dataItem) {
                    dataItem.setHours(0, 0, 0, 0);
                    
                    // Se passou da data, marcar como finalizado
                    if (dataItem < hoje) {
                        vencidos.push(item.id);
                    }
                }
            }
        }
        
        // Atualizar os vencidos
        if (vencidos.length > 0) {
            console.log('⏰ Finalizando', vencidos.length, 'agendamentos vencidos...');
            
            for (const id of vencidos) {
                await client
                    .from('agendamentos')
                    .update({ status: 'finalizado' })
                    .eq('id', id)
                    .catch(e => console.error('Erro ao finalizar:', e));
            }
            
            // Recarregar após atualizar
            console.log('🔄 Recarregando após atualizar vencidos...');
            await new Promise(resolve => setTimeout(resolve, 500));
            await carregarAgendamentos();
            return;
        }
        
        // Cache global
        todosAgendamentosCache = [...agendamentos];
        
        console.log('📊 Renderizando cards...');
        renderizarCardsDeStatus(agendamentos);
        
        console.log('📈 Atualizando interface...');
        atualizarCards(agendamentos);
        
        console.log('✅ Carregamento completo!');
        mostrarDiagnostico('✅ ' + agendamentos.length + ' agendamento(s) carregado(s)', false);
        
    } catch (e) {
        console.error('Erro ao processar:', e);
        mostrarDiagnostico('❌ Erro ao processar: ' + e.message, true);
    }
}

/* ======================================
   RENDERIZAR CARDS DE STATUS
====================================== */

function renderizarCardsDeStatus(agendamentos) {
    // Separar por status
    const pendentes = agendamentos.filter(a => a.status === 'pendente');
    const andamento = agendamentos.filter(a => a.status === 'andamento');
    const finalizados = agendamentos.filter(a => a.status === 'finalizado');
    
    console.log('Cards: Pendentes=' + pendentes.length + ', Andamento=' + andamento.length + ', Finalizados=' + finalizados.length);
    
    // Renderizar PENDENTES
    const pendenteHTML = pendentes.length === 0
        ? '<div class="sem-agendamentos">Nenhum pendente</div>'
        : pendentes.map(item => `
            <div class="card-agendamento" onclick="abrirDetalhesAgendamento(${item.id})">
                <div class="card-status-top">
                    <div class="card-id">#${item.id}</div>
                    <span class="card-status-badge pendente-badge">Pendente</span>
                </div>
                <h4>${item.nome}</h4>
                <p class="card-data">${item.data} · ${item.horario}</p>
                <p class="card-ensaio">${item.ensaio}</p>
                <div class="card-acoes">
                    <button onclick="aceitarAgendamento(event, ${item.id})" class="btn-aceitar">✅ Aceitar</button>
                    <button onclick="mostrarExcluir(${item.id})" class="btn-excluir">🗑️ Excluir</button>
                </div>
            </div>
        `).join('');
    
    // Renderizar EM ANDAMENTO
    const andamentoHTML = andamento.length === 0
        ? '<div class="sem-agendamentos">Nenhum em andamento</div>'
        : andamento.map(item => `
            <div class="card-agendamento" onclick="abrirDetalhesAgendamento(${item.id})">
                <div class="card-status-top">
                    <div class="card-id">#${item.id}</div>
                    <span class="card-status-badge andamento-badge">Em Andamento</span>
                </div>
                <h4>${item.nome}</h4>
                <p class="card-data">${item.data} · ${item.horario}</p>
                <p class="card-ensaio">${item.ensaio}</p>
                <div class="card-acoes">
                    <button onclick="finalizarAgendamento(event, ${item.id})" class="btn-finalizar">🎬 Finalizar</button>
                    <button onclick="mostrarExcluir(${item.id})" class="btn-excluir">🗑️ Excluir</button>
                </div>
            </div>
        `).join('');
    
    // Renderizar FINALIZADOS
    const finalizadosHTML = finalizados.length === 0
        ? '<div class="sem-agendamentos">Nenhum finalizado</div>'
        : finalizados.map(item => `
            <div class="card-agendamento" onclick="abrirDetalhesAgendamento(${item.id})">
                <div class="card-status-top">
                    <div class="card-id">#${item.id}</div>
                    <span class="card-status-badge finalizado-badge">Finalizado</span>
                </div>
                <h4>${item.nome}</h4>
                <p class="card-data">${item.data} · ${item.horario}</p>
                <p class="card-ensaio">${item.ensaio}</p>
                <div class="card-acoes">
                    <button onclick="mostrarExcluir(${item.id})" class="btn-excluir">🗑️ Excluir</button>
                </div>
            </div>
        `).join('');
    
    // Atualizar DOM
    const pendList = document.getElementById('pendentes-lista');
    const andList = document.getElementById('andamento-lista');
    const finList = document.getElementById('finalizados-lista');
    
    if (pendList) pendList.innerHTML = pendenteHTML;
    if (andList) andList.innerHTML = andamentoHTML;
    if (finList) finList.innerHTML = finalizadosHTML;
    
    // Atualizar contadores
    const elemPend = document.getElementById('totalPendentes');
    const elemAnd = document.getElementById('totalAndamento');
    const elemFin = document.getElementById('totalFinalizados');
    
    if (elemPend) elemPend.textContent = pendentes.length;
    if (elemAnd) elemAnd.textContent = andamento.length;
    if (elemFin) elemFin.textContent = finalizados.length;
    
    console.log('✅ Cards renderizados com sucesso');
}

/* ======================================
   ATUALIZAR CARDS SUPERIORES
====================================== */

function atualizarCards(agendamentos) {
    const total = agendamentos.length;
    const aceitos = agendamentos.filter(a => a.status === 'andamento').length;
    
    // Atualizar elementos
    const elemTotal = document.getElementById('totalAgendamentos');
    const elemAceitos = document.getElementById('totalAceitos');
    const elemClientes = document.getElementById('totalClientes');
    
    if (elemTotal) elemTotal.textContent = total;
    if (elemAceitos) elemAceitos.textContent = aceitos;
    if (elemClientes) elemClientes.textContent = total;
    
    console.log('📊 Cards superiores atualizados: Total=' + total);
    
    // Atualizar gráfico
    renderizarGraficoMensal(agendamentos);
    
    // Renderizar calendário
    renderizarCalendario();
}

/* ======================================
   AÇÕES: ACEITAR, FINALIZAR, EXCLUIR
====================================== */

async function aceitarAgendamento(event, id) {
    event.stopPropagation();
    
    console.log('✅ Aceitando agendamento #' + id);
    mostrarDiagnostico('Aceitando agendamento #' + id + '...', false);
    
    try {
        const { error } = await client
            .from('agendamentos')
            .update({ status: 'andamento' })
            .eq('id', id);
        
        if (error) throw error;
        
        console.log('✅ Agendamento aceito');
        mostrarDiagnostico('✅ Agendamento #' + id + ' aceito!', false);
        
        await new Promise(r => setTimeout(r, 500));
        await carregarAgendamentos();
        
    } catch (e) {
        console.error('Erro:', e);
        mostrarDiagnostico('❌ Erro: ' + e.message, true);
    }
}

async function finalizarAgendamento(event, id) {
    event.stopPropagation();
    
    console.log('🎬 Finalizando agendamento #' + id);
    mostrarDiagnostico('Finalizando agendamento #' + id + '...', false);
    
    try {
        const { error } = await client
            .from('agendamentos')
            .update({ status: 'finalizado' })
            .eq('id', id);
        
        if (error) throw error;
        
        console.log('✅ Agendamento finalizado');
        mostrarDiagnostico('✅ Agendamento #' + id + ' finalizado!', false);
        
        await new Promise(r => setTimeout(r, 500));
        await carregarAgendamentos();
        
    } catch (e) {
        console.error('Erro:', e);
        mostrarDiagnostico('❌ Erro: ' + e.message, true);
    }
}

function mostrarExcluir(id) {
    event?.stopPropagation?.();
    agendamentoParaExcluir = id;
    const modal = document.getElementById('modalExcluirAgendamento');
    if (modal) modal.style.display = 'block';
    console.log('🗑️ Mostrando confirmação de exclusão para #' + id);
}

function fecharModalExcluirAgendamento() {
    const modal = document.getElementById('modalExcluirAgendamento');
    if (modal) modal.style.display = 'none';
    agendamentoParaExcluir = null;
}

async function confirmarExclusaoAgendamento() {
    if (!agendamentoParaExcluir) return;
    
    const id = agendamentoParaExcluir;
    console.log('🗑️ Excluindo agendamento #' + id);
    mostrarDiagnostico('Excluindo agendamento #' + id + '...', false);
    
    try {
        const { error } = await client
            .from('agendamentos')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        console.log('✅ Agendamento excluído');
        mostrarDiagnostico('✅ Agendamento #' + id + ' excluído!', false);
        
        fecharModalExcluirAgendamento();
        
        await new Promise(r => setTimeout(r, 500));
        await carregarAgendamentos();
        
    } catch (e) {
        console.error('Erro:', e);
        mostrarDiagnostico('❌ Erro: ' + e.message, true);
    }
}

function abrirDetalhesAgendamento(id) {
    const agendamento = todosAgendamentosCache.find(a => a.id === id);
    if (agendamento) {
        console.log('📋 Detalhes do agendamento #' + id, agendamento);
    }
}

/* ======================================
   MODAIS
====================================== */

function verTodosAgendamentos() {
    const modal = document.getElementById('modalLista');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalConteudo = document.getElementById('modalListaConteudo');
    
    if (!modal) return;
    
    modalTitulo.innerHTML = '📋 Todos os Agendamentos';
    
    if (todosAgendamentosCache.length === 0) {
        modalConteudo.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento encontrado</div>';
    } else {
        modalConteudo.innerHTML = todosAgendamentosCache.map(item => {
            const statusText = item.status === 'pendente' ? 'Pendente' : 
                               item.status === 'andamento' ? 'Em Andamento' : 'Finalizado';
            return `
            <div class="modal-agendamento">
                <div class="agendamento-id-badge">#${item.id}</div>
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

function verAgendamentosAceitos() {
    const modal = document.getElementById('modalLista');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalConteudo = document.getElementById('modalListaConteudo');
    
    if (!modal) return;
    
    modalTitulo.innerHTML = '✅ Agendamentos Aceitos (Em Andamento)';
    
    const aceitos = todosAgendamentosCache.filter(a => a.status === 'andamento');
    
    if (aceitos.length === 0) {
        modalConteudo.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento aceito encontrado</div>';
    } else {
        modalConteudo.innerHTML = aceitos.map(item => `
            <div class="modal-agendamento">
                <div class="agendamento-id-badge">#${item.id}</div>
                <h4>${item.nome}</h4>
                <p><strong>📞 Telefone:</strong> ${item.telefone}</p>
                <p><strong>✉️ Email:</strong> ${item.email}</p>
                <p><strong>📸 Ensaio:</strong> ${item.ensaio}</p>
                <p><strong>📅 Data:</strong> ${item.data}</p>
                <p><strong>⏰ Horário:</strong> ${item.horario}</p>
                <p><strong>📝 Status:</strong> Em Andamento</p>
            </div>
        `).join('');
    }
    
    modal.style.display = 'block';
}

function fecharModal() {
    const modal = document.getElementById('modalLista');
    if (modal) modal.style.display = 'none';
}

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

function toggleLista(idLista) {
    const lista = document.getElementById(idLista);
    if (lista) {
        lista.classList.toggle('active');
    }
}

/* ======================================
   CALENDÁRIO
====================================== */

const GRAFICO_MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function calendarioMesAnterior() {
    calendarioMesAtual = new Date(calendarioMesAtual.getFullYear(), calendarioMesAtual.getMonth() - 1, 1);
    renderizarCalendario();
}

function calendarioIrParaHoje() {
    calendarioMesAtual = new Date();
    renderizarCalendario();
}

function calendarioMesSeguinte() {
    calendarioMesAtual = new Date(calendarioMesAtual.getFullYear(), calendarioMesAtual.getMonth() + 1, 1);
    renderizarCalendario();
}

function renderizarCalendario() {
    const ano = calendarioMesAtual.getFullYear();
    const mes = calendarioMesAtual.getMonth();
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const titulo = document.getElementById('calendarioMesAno');
    if (titulo) titulo.textContent = `${meses[mes]} ${ano}`;
    
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diaSemanaPrimeiro = primeiroDia.getDay();
    const diasNoMes = ultimoDia.getDate();
    
    const grid = document.getElementById('calendarioGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Dias vazios
    for (let i = 0; i < diaSemanaPrimeiro; i++) {
        const div = document.createElement('div');
        div.className = 'calendario-dia calendario-dia--vazio';
        grid.appendChild(div);
    }
    
    // Dias do mês
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const div = document.createElement('div');
        const dataStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        
        const agendamentosNoDia = todosAgendamentosCache.filter(a => normalizarDataParaChave(a.data) === dataStr).length;
        
        if (agendamentosNoDia > 0) {
            div.className = 'calendario-dia calendario-dia--comAgendamento';
            div.innerHTML = `<span>${dia}</span><span class="calendario-ponto"></span>`;
        } else {
            div.className = 'calendario-dia';
            div.innerHTML = `<span>${dia}</span>`;
        }
        
        const agora = new Date();
        if (dia === agora.getDate() && mes === agora.getMonth() && ano === agora.getFullYear()) {
            div.classList.add('calendario-dia--hoje');
        }
        
        if (calendarioDiaSelecionadoStr === dataStr) {
            div.classList.add('calendario-dia--selecionado');
        }
        
        div.onclick = () => {
            calendarioDiaSelecionadoStr = dataStr;
            selecionarDiaCalendario(dataStr);
        };
        
        grid.appendChild(div);
    }
    
    if (calendarioDiaSelecionadoStr) {
        const partes = calendarioDiaSelecionadoStr.split('-');
        if (parseInt(partes[0]) === ano && parseInt(partes[1]) === mes + 1) {
            selecionarDiaCalendario(calendarioDiaSelecionadoStr);
        } else {
            const container = document.getElementById('calendarioDiaSelecionado');
            if (container) container.innerHTML = '';
        }
    }
}

function selecionarDiaCalendario(dataStr) {
    const [ano, mes, dia] = dataStr.split('-');
    const tituloData = `${dia}/${mes}/${ano}`;
    const itensDoDia = todosAgendamentosCache.filter(a => normalizarDataParaChave(a.data) === dataStr);
    const container = document.getElementById('calendarioDiaSelecionado');
    
    if (!container) return;
    
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
            const statusText = item.status === 'pendente' ? 'Pendente' : 
                               item.status === 'andamento' ? 'Em Andamento' : 'Finalizado';
            return `
                <div class="modal-agendamento">
                    <div class="agendamento-id-badge">#${item.id}</div>
                    <h4>${item.nome}</h4>
                    <p><strong>📞 Telefone:</strong> ${item.telefone}</p>
                    <p><strong>⏰ Horário:</strong> ${item.horario}</p>
                    <p><strong>📝 Status:</strong> ${statusText}</p>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="calendario-dia-selecionado-topo">
                <h3>${tituloData} · ${itensDoDia.length} agendamento(s)</h3>
                <span class="calendario-dia-fechar" onclick="fecharDiaCalendario()">&times;</span>
            </div>
            ${cardsHtml}
        `;
    }
}

function fecharDiaCalendario() {
    calendarioDiaSelecionadoStr = null;
    const container = document.getElementById('calendarioDiaSelecionado');
    if (container) container.innerHTML = '';
    renderizarCalendario();
}

function verTodosPorData() {
    const modal = document.getElementById('modalLista');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalConteudo = document.getElementById('modalListaConteudo');
    
    if (!modal) return;
    
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
            const statusText = item.status === 'pendente' ? 'Pendente' : 
                               item.status === 'andamento' ? 'Em Andamento' : 'Finalizado';
            return `
                <div class="modal-agendamento">
                    <div class="agendamento-id-badge">#${item.id}</div>
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
   GRÁFICO
====================================== */

function contarAgendamentosPorMes(agendamentos) {
    const hoje = new Date();
    const meses = [];
    
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
        
        if (m.total > 0) {
            ctx.fillStyle = ehMesAtual ? '#e8c07d' : '#ccc';
            ctx.font = '600 12px Poppins, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(m.total, x + larguraBarra / 2, y - 8);
        }
    });
    
    legenda.innerHTML = meses.map((m, i) => {
        const classeExtra = (i === meses.length - 1) ? ' grafico-legenda-item--atual' : '';
        return `<span class="grafico-legenda-item${classeExtra}">${m.label}</span>`;
    }).join('');
    
    const mesAtualTotal = meses[meses.length - 1].total;
    const mesAnteriorTotal = meses[meses.length - 2].total;
    
    if (tagVariacao) {
        if (mesAnteriorTotal === 0 && mesAtualTotal === 0) {
            tagVariacao.textContent = 'Sem dados ainda';
        } else if (mesAnteriorTotal === 0) {
            tagVariacao.textContent = `▲ Novo (${mesAtualTotal})`;
            tagVariacao.className = 'tag-variacao tag-variacao--alta';
        } else {
            const variacao = ((mesAtualTotal - mesAnteriorTotal) / mesAnteriorTotal) * 100;
            const variacaoArred = Math.round(variacao);
            
            if (variacaoArred > 0) {
                tagVariacao.textContent = `▲ ${variacaoArred}% ↑`;
                tagVariacao.className = 'tag-variacao tag-variacao--alta';
            } else if (variacaoArred < 0) {
                tagVariacao.textContent = `▼ ${Math.abs(variacaoArred)}% ↓`;
                tagVariacao.className = 'tag-variacao tag-variacao--baixa';
            } else {
                tagVariacao.textContent = '= Igual';
            }
        }
    }
}

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

window.addEventListener('resize', () => {
    if (todosAgendamentosCache.length > 0) {
        renderizarGraficoMensal(todosAgendamentosCache);
    }
});

/* ======================================
   UTILITÁRIOS
====================================== */

function parseDataAgendamento(dataStr) {
    if (!dataStr) return null;
    
    // Formato ISO: AAAA-MM-DD
    if (dataStr.includes('-')) {
        const partes = dataStr.split('-');
        if (partes.length !== 3) return null;
        const [ano, mes, dia] = partes;
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    }
    
    // Formato BR: DD/MM/AAAA
    const partes = dataStr.split('/');
    if (partes.length !== 3) return null;
    const [dia, mes, ano] = partes;
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
}

// Converte qualquer formato de data (BR ou ISO) para a chave ISO "AAAA-MM-DD",
// usada internamente para agrupar e comparar agendamentos por dia.
function normalizarDataParaChave(dataStr) {
    if (!dataStr) return null;
    
    if (dataStr.includes('-')) {
        const [ano, mes, dia] = dataStr.split('-');
        if (!ano || !mes || !dia) return null;
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    
    if (dataStr.includes('/')) {
        const [dia, mes, ano] = dataStr.split('/');
        if (!ano || !mes || !dia) return null;
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    
    return null;
}

function agruparAgendamentosPorData() {
    const grupos = {};
    todosAgendamentosCache.forEach(item => {
        const chave = normalizarDataParaChave(item.data);
        if (!chave) return;
        if (!grupos[chave]) grupos[chave] = [];
        grupos[chave].push(item);
    });
    return grupos;
}

/* ======================================
   DIAGNÓSTICO
====================================== */

function mostrarDiagnostico(mensagem, ehErro = false) {
    console.log((ehErro ? '❌' : '✅') + ' ' + mensagem);
    
    let diag = document.getElementById('diagnostico');
    if (!diag) {
        diag = document.createElement('div');
        diag.id = 'diagnostico';
        document.body.appendChild(diag);
    }
    
    diag.textContent = mensagem;
    diag.className = ehErro ? 'erro' : 'sucesso';
    diag.style.display = 'block';
    
    if (diag.timeoutId) clearTimeout(diag.timeoutId);
    diag.timeoutId = setTimeout(() => {
        diag.style.display = 'none';
    }, 4000);
}

/* ======================================
   LOGOUT
====================================== */

async function logout() {
    try {
        mostrarDiagnostico('Desconectando...', false);
        const { error } = await client.auth.signOut();
        if (error) throw error;
        
        console.log('Logout bem-sucedido');
        window.location.href = 'login.html';
    } catch (e) {
        console.error('Erro ao logout:', e);
        mostrarDiagnostico('❌ Erro ao logout: ' + e.message, true);
    }
}

console.log('✅ painel.js carregado com sucesso');
