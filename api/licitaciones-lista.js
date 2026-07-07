// api/licitaciones-lista.js — Proxy a la lista liviana de licitaciones activas (Mercado Público API v1)
// Se usa una sola llamada (independiente de la cantidad de palabras clave) y el filtro por
// palabra clave se hace en el frontend, igual que en Compra Ágil.
const TICKET = process.env.MP_TICKET || '38366B56-462A-4B4F-9FEE-18F946D9F1B5';
const BASE   = 'https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const upstream = await fetch(`${BASE}?estado=activas&ticket=${TICKET}`);
    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: text });
    }
    const data = await upstream.json();
    return res.status(200).json({ listado: data.Listado || [], cantidad: data.Cantidad || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
