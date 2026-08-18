// api/estado.js — Combina vistos.js y oportunidades.js (mismo patron GET/SET sobre KV,
// solo cambia la clave y el nombre del campo) en un solo endpoint para no exceder el
// limite de 12 Serverless Functions del plan Hobby de Vercel. Las rutas publicas
// /api/vistos y /api/oportunidades se mantienen igual gracias a los rewrites en vercel.json.
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const CONFIG = {
  vistos:        { key: 'mp_vistos',        field: 'codigos' },
  oportunidades: { key: 'mp_oportunidades', field: 'items' },
};

async function kvGet(key) {
  const res  = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : [];
}

async function kvSet(key, value) {
  // Upstash REST API: SET key value via URL path
  const encoded = encodeURIComponent(JSON.stringify(value));
  await fetch(`${KV_URL}/set/${key}/${encoded}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const cfg = CONFIG[req.query.tipo];
  if (!cfg) return res.status(400).json({ error: 'Parametro tipo invalido (vistos|oportunidades)' });

  if (req.method === 'GET') {
    try {
      const value = await kvGet(cfg.key);
      return res.status(200).json({ [cfg.field]: value });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const value = req.body?.[cfg.field];
      if (!Array.isArray(value)) return res.status(400).json({ error: `${cfg.field} debe ser array` });
      await kvSet(cfg.key, value);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Metodo no permitido' });
}
