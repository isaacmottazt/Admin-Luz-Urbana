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
   UTILITÁRIOS DE FORMATAÇÃO (padrão brasileiro)
====================================== */

function formatarDataBR(dataISO) {
    if (!dataISO) return '—';
    const partes = dataISO.split('-');
    if (partes.length !== 3) return dataISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarHoraBR(horaISO) {
    if (!horaISO) return '—';
    const partes = horaISO.split(':');
    if (partes.length < 2) return horaISO;
    return `${partes[0]}:${partes[1]}`;
}

/* ======================================
   INICIALIZAÇÃO
====================================== */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
} else {
    inicializar();
}

async function inicializar() {
    console.log('🟢 Inicializando painel...');
    try {
        const { data: { session }, error } = await client.auth.getSession();
        if (error || !session) {
            console.warn('Sem sessão, redirecionando para login...');
            window.location.href = 'login.html';
            return;
        }
        console.log('✅ Autenticado como:', session.user.email);
        await carregarAgendamentos();
    } catch (e) {
        console.error('Erro na inicialização:', e);
    }
}

/* ======================================
   CARREGAR AGENDAMENTOS
====================================== */

async function carregarAgendamentos() {
    try {
        const { data, error } = await client
            .from('agendamentos')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

        // Finalizar automaticamente os vencidos
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const vencidos = [];

        for (const item of data || []) {
            const status = item.status || 'pendente';
            if (status === 'pendente' || status === 'andamento') {
                const dataItem = parseDataAgendamento(item.data);
                if (dataItem) {
                    dataItem.setHours(0, 0, 0, 0);
                    if (dataItem < hoje) {
                        vencidos.push(item.id);
                    }
                }
            }
        }

        if (vencidos.length > 0) {
            for (const id of vencidos) {
                await client.from('agendamentos').update({ status: 'finalizado' }).eq('id', id);
            }
            // Recarregar após atualizar
            await carregarAgendamentos();
            return;
        }

        todosAgendamentosCache = data || [];
        renderizarCardsDeStatus(todosAgendamentosCache);
        atualizarCards(todosAgendamentosCache);

    } catch (e) {
        console.error('Erro ao carregar agendamentos:', e);
        renderizarCardsDeStatus([]);
        atualizarCards([]);
    }
}

/* ======================================
   RENDERIZAR CARDS DE STATUS
====================================== */

function renderizarCardsDeStatus(agendamentos) {
    const pendentes = agendamentos.filter(a => a.status === 'pendente');
    const andamento = agendamentos.filter(a => a.status === 'andamento');
    const finalizados = agendamentos.filter(a => a.status === 'finalizado');

    // PENDENTES
    const pendenteHTML = pendentes.length === 0
        ? '<div class="sem-agendamentos">Nenhum pendente</div>'
        : pendentes.map(item => `
            <div class="card-agendamento" onclick="abrirDetalhesAgendamento(${item.id})">
                <div class="card-status-top">
                    <div class="card-id">#${item.id}</div>
                    <span class="card-status-badge pendente-badge">Pendente</span>
                </div>
                <h4>${item.nome}</h4>
                <p class="card-data">${formatarDataBR(item.data)} · ${formatarHoraBR(item.horario)}</p>
                <p class="card-ensaio">${item.ensaio}</p>
                <div class="card-acoes">
                    <button onclick="aceitarAgendamento(event, ${item.id})" class="btn-aceitar">✅ Aceitar</button>
                    <button onclick="mostrarExcluir(${item.id})" class="btn-excluir">🗑️ Excluir</button>
                </div>
            </div>
        `).join('');

    // EM ANDAMENTO
    const andamentoHTML = andamento.length === 0
        ? '<div class="sem-agendamentos">Nenhum em andamento</div>'
        : andamento.map(item => `
            <div class="card-agendamento" onclick="abrirDetalhesAgendamento(${item.id})">
                <div class="card-status-top">
                    <div class="card-id">#${item.id}</div>
                    <span class="card-status-badge andamento-badge">Em Andamento</span>
                </div>
                <h4>${item.nome}</h4>
                <p class="card-data">${formatarDataBR(item.data)} · ${formatarHoraBR(item.horario)}</p>
                <p class="card-ensaio">${item.ensaio}</p>
                <div class="card-acoes">
                    <button onclick="finalizarAgendamento(event, ${item.id})" class="btn-finalizar">🎬 Finalizar</button>
                    <button onclick="mostrarExcluir(${item.id})" class="btn-excluir">🗑️ Excluir</button>
                </div>
            </div>
        `).join('');

    // FINALIZADOS
    const finalizadosHTML = finalizados.length === 0
        ? '<div class="sem-agendamentos">Nenhum finalizado</div>'
        : finalizados.map(item => `
            <div class="card-agendamento" onclick="abrirDetalhesAgendamento(${item.id})">
                <div class="card-status-top">
                    <div class="card-id">#${item.id}</div>
                    <span class="card-status-badge finalizado-badge">Finalizado</span>
                </div>
                <h4>${item.nome}</h4>
                <p class="card-data">${formatarDataBR(item.data)} · ${formatarHoraBR(item.horario)}</p>
                <p class="card-ensaio">${item.ensaio}</p>
                <div class="card-acoes">
                    <button onclick="mostrarExcluir(${item.id})" class="btn-excluir">🗑️ Excluir</button>
                </div>
            </div>
        `).join('');

    document.getElementById('pendentes-lista').innerHTML = pendenteHTML;
    document.getElementById('andamento-lista').innerHTML = andamentoHTML;
    document.getElementById('finalizados-lista').innerHTML = finalizadosHTML;

    document.getElementById('totalPendentes').textContent = pendentes.length;
    document.getElementById('totalAndamento').textContent = andamento.length;
    document.getElementById('totalFinalizados').textContent = finalizados.length;
}

/* ======================================
   ATUALIZAR CARDS SUPERIORES
====================================== */

function atualizarCards(agendamentos) {
    const total = agendamentos.length;
    const aceitos = agendamentos.filter(a => a.status === 'andamento').length;

    document.getElementById('totalAgendamentos').textContent = total;
    document.getElementById('totalAceitos').textContent = aceitos;
    document.getElementById('totalClientes').textContent = total;

    renderizarGraficoMensal(agendamentos);
    renderizarCalendario();
}

/* ======================================
   AÇÕES: ACEITAR, FINALIZAR, EXCLUIR
====================================== */

async function aceitarAgendamento(event, id) {
    event.stopPropagation();
    try {
        await client.from('agendamentos').update({ status: 'andamento' }).eq('id', id);
        await carregarAgendamentos();
    } catch (e) {
        console.error(e);
    }
}

async function finalizarAgendamento(event, id) {
    event.stopPropagation();
    try {
        await client.from('agendamentos').update({ status: 'finalizado' }).eq('id', id);
        await carregarAgendamentos();
    } catch (e) {
        console.error(e);
    }
}

function mostrarExcluir(id) {
    event?.stopPropagation?.();
    agendamentoParaExcluir = id;
    document.getElementById('modalExcluirAgendamento').style.display = 'block';
}

function fecharModalExcluirAgendamento() {
    document.getElementById('modalExcluirAgendamento').style.display = 'none';
    agendamentoParaExcluir = null;
}

async function confirmarExclusaoAgendamento() {
    if (!agendamentoParaExcluir) return;
    const id = agendamentoParaExcluir;
    try {
        await client.from('agendamentos').delete().eq('id', id);
        fecharModalExcluirAgendamento();
        await carregarAgendamentos();
    } catch (e) {
        console.error(e);
    }
}

function abrirDetalhesAgendamento(id) {
    const agendamento = todosAgendamentosCache.find(a => a.id === id);
    if (agendamento) console.log('Detalhes:', agendamento);
}

/* ======================================
   MODAIS
====================================== */

function verTodosAgendamentos() {
    const modal = document.getElementById('modalLista');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalConteudo = document.getElementById('modalListaConteudo');

    modalTitulo.innerHTML = '📋 Todos os Agendamentos';
    if (todosAgendamentosCache.length === 0) {
        modalConteudo.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento encontrado</div>';
    } else {
        modalConteudo.innerHTML = todosAgendamentosCache.map(item => `
            <div class="modal-agendamento">
                <div class="agendamento-id-badge">#${item.id}</div>
                <h4>${item.nome}</h4>
                <p><strong>📞 Telefone:</strong> ${item.telefone}</p>
                <p><strong>✉️ Email:</strong> ${item.email}</p>
                <p><strong>📸 Ensaio:</strong> ${item.ensaio}</p>
                <p><strong>📅 Data:</strong> ${formatarDataBR(item.data)}</p>
                <p><strong>⏰ Horário:</strong> ${formatarHoraBR(item.horario)}</p>
                <p><strong>📝 Status:</strong> ${item.status === 'pendente' ? 'Pendente' : item.status === 'andamento' ? 'Em Andamento' : 'Finalizado'}</p>
            </div>
        `).join('');
    }
    modal.style.display = 'block';
}

function verAgendamentosAceitos() {
    const modal = document.getElementById('modalLista');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalConteudo = document.getElementById('modalListaConteudo');

    modalTitulo.innerHTML = '✅ Agendamentos Aceitos';
    const aceitos = todosAgendamentosCache.filter(a => a.status === 'andamento');
    if (aceitos.length === 0) {
        modalConteudo.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento aceito</div>';
    } else {
        modalConteudo.innerHTML = aceitos.map(item => `
            <div class="modal-agendamento">
                <div class="agendamento-id-badge">#${item.id}</div>
                <h4>${item.nome}</h4>
                <p><strong>📞 Telefone:</strong> ${item.telefone}</p>
                <p><strong>✉️ Email:</strong> ${item.email}</p>
                <p><strong>📸 Ensaio:</strong> ${item.ensaio}</p>
                <p><strong>📅 Data:</strong> ${formatarDataBR(item.data)}</p>
                <p><strong>⏰ Horário:</strong> ${formatarHoraBR(item.horario)}</p>
                <p><strong>📝 Status:</strong> Em Andamento</p>
            </div>
        `).join('');
    }
    modal.style.display = 'block';
}

function fecharModal() {
    document.getElementById('modalLista').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('modalLista');
    if (event.target === modal) modal.style.display = 'none';
    const modalExcluir = document.getElementById('modalExcluirAgendamento');
    if (event.target === modalExcluir) fecharModalExcluirAgendamento();
};

function toggleLista(idLista) {
    const lista = document.getElementById(idLista);
    if (lista) lista.classList.toggle('active');
}

/* ======================================
   CALENDÁRIO
====================================== */

const GRAFICO_MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function calendarioMesAnterior() {
    calendarioMesAtual.setMonth(calendarioMesAtual.getMonth() - 1);
    renderizarCalendario();
}

function calendarioIrParaHoje() {
    calendarioMesAtual = new Date();
    renderizarCalendario();
}

function calendarioMesSeguinte() {
    calendarioMesAtual.setMonth(calendarioMesAtual.getMonth() + 1);
    renderizarCalendario();
}

function renderizarCalendario() {
    const ano = calendarioMesAtual.getFullYear();
    const mes = calendarioMesAtual.getMonth();
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    document.getElementById('calendarioMesAno').textContent = `${meses[mes]} ${ano}`;

    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diaSemanaPrimeiro = primeiroDia.getDay();
    const diasNoMes = ultimoDia.getDate();

    const grid = document.getElementById('calendarioGrid');
    grid.innerHTML = '';

    for (let i = 0; i < diaSemanaPrimeiro; i++) {
        const div = document.createElement('div');
        div.className = 'calendario-dia calendario-dia--vazio';
        grid.appendChild(div);
    }

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
            document.getElementById('calendarioDiaSelecionado').innerHTML = '';
        }
    }
}

function selecionarDiaCalendario(dataStr) {
    const [ano, mes, dia] = dataStr.split('-');
    const tituloData = `${dia}/${mes}/${ano}`;
    const itensDoDia = todosAgendamentosCache.filter(a => normalizarDataParaChave(a.data) === dataStr);
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
            const statusText = item.status === 'pendente' ? 'Pendente' :
                               item.status === 'andamento' ? 'Em Andamento' : 'Finalizado';
            return `
                <div class="modal-agendamento">
                    <div class="agendamento-id-badge">#${item.id}</div>
                    <h4>${item.nome}</h4>
                    <p><strong>📞 Telefone:</strong> ${item.telefone}</p>
                    <p><strong>⏰ Horário:</strong> ${formatarHoraBR(item.horario)}</p>
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
    document.getElementById('calendarioDiaSelecionado').innerHTML = '';
    renderizarCalendario();
}

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

        const cardsHtml = itensOrdenados.map(item => `
            <div class="modal-agendamento">
                <div class="agendamento-id-badge">#${item.id}</div>
                <h4>${item.nome}</h4>
                <p><strong>📞 Telefone:</strong> ${item.telefone}</p>
                <p><strong>✉️ Email:</strong> ${item.email}</p>
                <p><strong>📸 Ensaio:</strong> ${item.ensaio}</p>
                <p><strong>⏰ Horário:</strong> ${formatarHoraBR(item.horario)}</p>
                <p><strong>📝 Status:</strong> ${item.status === 'pendente' ? 'Pendente' : item.status === 'andamento' ? 'Em Andamento' : 'Finalizado'}</p>
            </div>
        `).join('');

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
    if (dataStr.includes('-')) {
        const [ano, mes, dia] = dataStr.split('-');
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    }
    if (dataStr.includes('/')) {
        const [dia, mes, ano] = dataStr.split('/');
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    }
    return null;
}

function normalizarDataParaChave(dataStr) {
    if (!dataStr) return null;
    if (dataStr.includes('-')) {
        const [ano, mes, dia] = dataStr.split('-');
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    if (dataStr.includes('/')) {
        const [dia, mes, ano] = dataStr.split('/');
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
   LOGOUT
====================================== */

async function logout() {
    try {
        await client.auth.signOut();
        window.location.href = 'login.html';
    } catch (e) {
        console.error('Erro ao logout:', e);
    }
}

console.log('✅ painel.js carregado com sucesso');