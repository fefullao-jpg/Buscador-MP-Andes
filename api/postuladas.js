// api/postuladas.js — Guarda y lee las cotizaciones en las que Andes Medikeep postuló.
// Cada elemento conserva los datos de la cotización + resultado (pendiente/ganada/perdida)
// y precios (ofertado / del ganador) anotados manualmente.
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY      = 'mp_postuladas';

async function kvGet() {
  const res  = await fetch(`${KV_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : [];
}

async function kvSet(value) {
  const encoded = encodeURIComponent(JSON.stringify(value));
  await fetch(`${KV_URL}/set/${KEY}/${encoded}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method === 'GET') {
    try {
      const items = await kvGet();
      return res.status(200).json({ items });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ error: 'items debe ser array' });
      await kvSet(items);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
