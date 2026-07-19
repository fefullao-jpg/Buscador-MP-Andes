// api/compra-agil-detalle.js — Proxy al detalle de una Compra Ágil (API v2)
const TICKET = process.env.MP_TICKET || '38366B56-462A-4B4F-9FEE-18F946D9F1B5';
const BASE   = 'https://api2.mercadopublico.cl';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { codigo } = req.query;
  if (!codigo) return res.status(400).json({ error: 'Falta parámetro codigo' });

  try {
    const upstream = await fetch(`${BASE}/v2/compra-agil/${encodeURIComponent(codigo)}`, {
      headers: { ticket: TICKET },
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: text });
    }
    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
