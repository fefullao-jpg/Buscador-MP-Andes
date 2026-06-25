// api/buscar.js — Serverless function para Vercel
// Actúa como proxy: recibe la búsqueda del frontend y llama a api2.mercadopublico.cl
// con el ticket en el header (no expuesto al cliente)

const TICKET = process.env.MP_TICKET || '38366B56-462A-4B4F-9FEE-18F946D9F1B5';
const BASE    = 'https://api2.mercadopublico.cl';

export default async function handler(req, res) {
  // CORS: permitir llamadas desde cualquier origen (el propio dominio Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { q, estado = 'publicada', region, pagina = '1', tamano = '50' } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Falta parámetro q (palabra clave)' });
  }

  const params = new URLSearchParams({
    q,
    estado,
    numero_pagina: pagina,
    tamano_pagina: tamano,
    ordenar_por: 'FechaPublicacion',
  });
  if (region) params.set('region', region);

  try {
    const upstream = await fetch(`${BASE}/v2/compra-agil?${params.toString()}`, {
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
