// api/licitaciones-detalle.js — Proxy al detalle de una licitación por código (Mercado Público API v1)
const TICKET = process.env.MP_TICKET || '38366B56-462A-4B4F-9FEE-18F946D9F1B5';
const BASE   = 'https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { codigo } = req.query;
  if (!codigo) return res.status(400).json({ error: 'Falta parámetro codigo' });

  try {
    const upstream = await fetch(`${BASE}?codigo=${encodeURIComponent(codigo)}&ticket=${TICKET}`);
    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: text });
    }
    const data = await upstream.json();
    const item = (data.Listado && data.Listado[0]) || null;
    return res.status(200).json({ item });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
