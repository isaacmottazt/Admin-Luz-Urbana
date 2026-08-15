function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
}

function origemPermitida(req) {
  const configurada = process.env.MOTAZT_ADMIN_ORIGIN;
  const origem = req.headers.origin;
  return !configurada || !origem || origem === configurada;
}

async function usuarioAutenticado(req) {
  const autorizacao = req.headers.authorization || '';
  if (!autorizacao.startsWith('Bearer ')) return false;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return false;

  const resposta = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: autorizacao,
    },
  });
  return resposta.ok;
}

function chamadaCronPermitida(req) {
  const userAgent = req.headers['user-agent'] || '';
  const autorizacao = req.headers.authorization || '';
  const segredo = process.env.CRON_SECRET;
  return userAgent.includes('vercel-cron/1.0') || Boolean(segredo && autorizacao === `Bearer ${segredo}`);
}

function dataPtBr(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? '—'
    : new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(data);
}

function diasRestantes(valor, agora) {
  if (!valor) return null;
  return Math.ceil((new Date(valor) - agora) / 86400000);
}

function montarRelatorio(galerias, agora = new Date()) {
  const inicioSemana = new Date(agora);
  inicioSemana.setDate(inicioSemana.getDate() - 7);
  const classificadas = galerias.map((galeria) => {
    const expiracao = galeria.data_expiracao ? new Date(galeria.data_expiracao) : null;
    const publicacao = galeria.data_publicacao ? new Date(galeria.data_publicacao) : null;
    const expirada = Boolean(expiracao && agora >= expiracao) || galeria.status !== 'ativa';
    const agendada = (galeria.status_publicacao || 'publicado') === 'agendado' && publicacao && publicacao > agora;
    const bloqueada = (galeria.status_publicacao || 'publicado') === 'bloqueado';
    return { galeria, disponivel: !expirada && !agendada && !bloqueada, expirada, agendada };
  });
  const expirando = classificadas
    .filter(({ galeria, disponivel }) => {
      const dias = diasRestantes(galeria.data_expiracao, agora);
      return disponivel && dias !== null && dias >= 0 && dias <= 7;
    })
    .sort((a, b) => new Date(a.galeria.data_expiracao) - new Date(b.galeria.data_expiracao));

  return {
    ativos: classificadas.filter((item) => item.disponivel).length,
    expirados: classificadas.filter((item) => item.expirada).length,
    agendados: classificadas.filter((item) => item.agendada).length,
    criados: galerias.filter((galeria) => galeria.data_criacao && new Date(galeria.data_criacao) >= inicioSemana).length,
    fotos: galerias.reduce((total, galeria) => total + Number(galeria.total_fotos || 0), 0),
    expirando,
    agora,
    inicioSemana,
  };
}

function textoRelatorio(relatorio) {
  const linhas = [
    'Resumo semanal — Motazt Studio',
    '',
    `Álbuns ativos: ${relatorio.ativos}`,
    `Álbuns expirados: ${relatorio.expirados}`,
    `Álbuns agendados: ${relatorio.agendados}`,
    `Álbuns criados na semana: ${relatorio.criados}`,
    `Total de fotos: ${relatorio.fotos}`,
    `Expiram em até 7 dias: ${relatorio.expirando.length}`,
    '',
    `Período: ${dataPtBr(relatorio.inicioSemana)} a ${dataPtBr(relatorio.agora)}`,
  ];

  if (relatorio.expirando.length) {
    linhas.push('', 'Álbuns próximos da expiração:');
    for (const item of relatorio.expirando) {
      const galeria = item.galeria;
      const dias = diasRestantes(galeria.data_expiracao, relatorio.agora);
      linhas.push(`• ${galeria.titulo || galeria.cliente_nome || 'Álbum sem título'} — ${dias} ${dias === 1 ? 'dia' : 'dias'} — ${dataPtBr(galeria.data_expiracao)} — código ${galeria.codigo_curto || '—'}`);
    }
  }
  return linhas.join('\n');
}

async function buscarGalerias() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  const campos = ['codigo_curto', 'cliente_nome', 'titulo', 'status', 'status_publicacao', 'data_criacao', 'data_expiracao', 'data_publicacao', 'total_fotos'].join(',');
  const resposta = await fetch(`${process.env.SUPABASE_URL}/rest/v1/galerias?select=${encodeURIComponent(campos)}&order=data_criacao.desc`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!resposta.ok) throw new Error(`Supabase respondeu ${resposta.status}.`);
  return resposta.json();
}

async function enviarTelegram(texto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || '6520427340';
  if (!token || !chatId) throw new Error('Telegram não configurado no servidor.');
  const resposta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, disable_web_page_preview: true }),
  });
  const dados = await resposta.json();
  if (!resposta.ok || !dados.ok) throw new Error(dados.description || 'Telegram recusou a mensagem.');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', process.env.MOTAZT_ADMIN_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      if (!chamadaCronPermitida(req)) return responder(res, 401, { ok: false, erro: 'Não autorizado.' });
      const relatorio = montarRelatorio(await buscarGalerias());
      await enviarTelegram(textoRelatorio(relatorio));
      return responder(res, 200, { ok: true, mensagem: 'Relatório automático enviado pelo Telegram.' });
    }

    if (req.method !== 'POST') return responder(res, 405, { ok: false, erro: 'Método não permitido.' });
    if (!origemPermitida(req)) return responder(res, 403, { ok: false, erro: 'Origem não autorizada.' });
    if (!(await usuarioAutenticado(req))) return responder(res, 401, { ok: false, erro: 'Sessão administrativa inválida ou expirada.' });

    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const texto = String(corpo.text || '').trim();
    if (!texto) return responder(res, 400, { ok: false, erro: 'O relatório está vazio.' });
    if (texto.length > 4096) return responder(res, 413, { ok: false, erro: 'O relatório excede o limite do Telegram.' });

    await enviarTelegram(texto);
    return responder(res, 200, { ok: true, mensagem: 'Relatório enviado pelo Telegram.' });
  } catch (erro) {
    console.error('Erro no endpoint do Telegram:', erro.message);
    return responder(res, 500, { ok: false, erro: 'Não foi possível enviar o relatório agora.' });
  }
};
