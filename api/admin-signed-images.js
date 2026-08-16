const BUCKET = 'fotos';
const MAX_PATHS = 100;
const EXPIRES_IN = 60 * 60;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function normalizePath(value, supabaseUrl) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  let path = input;
  try {
    if (/^https?:\/\//i.test(input)) {
      const url = new URL(input);
      const expected = new URL(supabaseUrl);
      if (url.origin !== expected.origin) return null;
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      if (!url.pathname.startsWith(marker)) return null;
      path = decodeURIComponent(url.pathname.slice(marker.length));
    }
  } catch {
    return null;
  }
  path = path.replace(/^\/+/, '');
  if (!path || path.includes('..') || path.includes('\\') || path.includes('\0')) return null;
  return path;
}

async function supabaseFetch(url, key, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
  return response;
}

module.exports = async function adminSignedImages(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método não permitido.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    !supabaseUrl ? 'SUPABASE_URL' : null,
    !serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null
  ].filter(Boolean);
  if (missing.length) return json(res, 503, { error: 'Serviço de imagens não configurado.', missing });

  const origin = req.headers.origin;
  const allowedOrigin = process.env.MOTAZT_ADMIN_ORIGIN;
  if (allowedOrigin && origin && origin !== allowedOrigin) return json(res, 403, { error: 'Origem não autorizada.' });

  const authorization = req.headers.authorization || '';
  const userToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!userToken) return json(res, 401, { error: 'Autenticação administrativa necessária.' });

  const userResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${userToken}` }
  });
  const user = await userResponse.json().catch(() => null);
  if (!userResponse.ok || user?.app_metadata?.role !== 'admin') return json(res, 403, { error: 'Acesso administrativo necessário.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const rawPaths = Array.isArray(body?.paths) ? body.paths : [];
  if (!rawPaths.length || rawPaths.length > MAX_PATHS) return json(res, 400, { error: 'Lista de imagens inválida.' });

  const originalByPath = new Map();
  const normalized = rawPaths.map(value => {
    const path = normalizePath(value, supabaseUrl);
    if (path) originalByPath.set(path, String(value).trim());
    return path;
  });
  const paths = [...new Set(normalized.filter(Boolean))];
  if (paths.length !== rawPaths.length) return json(res, 400, { error: 'Um ou mais caminhos de imagem são inválidos.' });

  try {
    const response = await supabaseFetch(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/sign/${BUCKET}`, serviceRoleKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: EXPIRES_IN, paths })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return json(res, 502, { error: 'Não foi possível assinar as imagens.' });

    const rawEntries = Array.isArray(data) ? data : (data?.data || data?.signed || []);
    const signed = (Array.isArray(rawEntries) ? rawEntries : []).map((entry, index) => {
      const returnedPath = typeof entry?.path === 'string' ? entry.path.replace(/^\/+/, '') : '';
      const path = returnedPath ? paths.find(item => item === returnedPath || item.endsWith(`/${returnedPath}`) || item.endsWith(`/fotos/${returnedPath}`)) : paths[index];
      const rawUrl = entry?.signedURL || entry?.signedUrl || entry?.url || '';
      const url = rawUrl.startsWith('/') ? `${supabaseUrl.replace(/\/$/, '')}${rawUrl.startsWith('/storage/v1/') ? rawUrl : `/storage/v1${rawUrl}`}` : rawUrl;
      return { path: originalByPath.get(path) || path || '', signedUrl: url };
    }).filter(item => item.path && item.signedUrl);

    return json(res, 200, { expiresIn: EXPIRES_IN, signed });
  } catch (error) {
    console.error('Admin signed image error:', error);
    return json(res, 502, { error: 'Serviço de imagens indisponível.' });
  }
};
