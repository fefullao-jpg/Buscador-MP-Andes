// api/buscar.js — Serverless function para Vercel
// Actúa como proxy: recibe la búsqueda del frontend y llama a api2.mercadopublico.cl
// con el ticket en el header (no expuesto al cliente)

// Margen para respuestas lentas de ChileCompra (el gateway corta a ~30s); 2 intentos caben en 60s.
export const config = { maxDuration: 60 };

const TICKET = process.env.MP_TICKET || '38366B56-462A-4B4F-9FEE-18F946D9F1B5';
const BASE    = 'https://api2.mercadopublico.cl';

// Reintenta ante errores transitorios (504/503/502 o de red). La API de Compra Ágil
// de ChileCompra es propensa a timeouts esporádicos; sin esto, una sola palabra clave
// lenta hacía fallar esa búsqueda aunque un segundo intento normalmente sí responde.
async function fetchConReintento(url, opciones = {}, intentos = 2, esperaMs = 700) {
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url, opciones);
      if (!r.ok && [502, 503, 504].includes(r.status) && i < intentos - 1) {
        ultimoError = new Error(`HTTP ${r.status}`);
        await new Promise(res => setTimeout(res, esperaMs * (i + 1)));
        continue;
      }
      return r;
    } catch (e) {
      ultimoError = e;
      if (i < intentos - 1) {
        await new Promise(res => setTimeout(res, esperaMs * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw ultimoError;
}

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
    const upstream = await fetchConReintento(`${BASE}/v2/compra-agil?${params.toString()}`, {
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
