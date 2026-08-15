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
      
      Authorization: autorizacao
        
    }
      
  });
  
  return resposta.ok;
  
}



module.exports = async function handler(req, res) {
  
  if (req.method === 'OPTIONS') {
    
    res.setHeader('Access-Control-Allow-Origin', process.env.MOTAZT_ADMIN_ORIGIN || '*');
    
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    
    res.statusCode = 204;
    
    res.end();
    
    return;
    
  }
  

  
  if (req.method !== 'POST') {
    
    responder(res, 405, { ok: false, erro: 'Método não permitido.' });
    
    return;
    
  }
  

  
  if (!origemPermitida(req)) {
    
    responder(res, 403, { ok: false, erro: 'Origem não autorizada.' });
    
    return;
    
  }
  

  
  try {
    
    if (!(await usuarioAutenticado(req))) {
      
      responder(res, 401, { ok: false, erro: 'Sessão administrativa inválida ou expirada.' });
      
      return;
      
    }
    

    
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) {
      
      responder(res, 500, { ok: false, erro: 'Telegram ainda não foi configurado no servidor.' });
      
      return;
      
    }
    

    
    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    
    const texto = String(corpo.text || '').trim();
    
    if (!texto) {
      
      responder(res, 400, { ok: false, erro: 'O relatório está vazio.' });
      
      return;
      
    }
    
    if (texto.length > 4096) {
      
      responder(res, 413, { ok: false, erro: 'O relatório excede o limite de 4096 caracteres do Telegram.' });
      
      return;
      
    }
    

    
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      
      method: 'POST',
      
      headers: { 'Content-Type': 'application/json' },
      
      body: JSON.stringify({
        
        chat_id: chatId,
        
        text: texto,
        
        disable_web_page_preview: true
          
      })
        
    });
    
    const telegramData = await telegramResponse.json();
    

    
    if (!telegramResponse.ok || !telegramData.ok) {
      
      console.error('Telegram recusou o relatório:', telegramData.description || telegramResponse.status);
      
      responder(res, 502, { ok: false, erro: 'O Telegram não aceitou o relatório. Verifique o bot e o chat de destino.' });
      
      return;
      
    }
    

    
    responder(res, 200, { ok: true, mensagem: 'Relatório enviado pelo Telegram.' });
    
  } catch (erro) {
    
    console.error('Erro no endpoint do Telegram:', erro);
    
    responder(res, 500, { ok: false, erro: 'Não foi possível enviar o relatório agora.' });
    
  }
  
};
























































































