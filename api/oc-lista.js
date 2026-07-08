// api/oc-lista.js — Proxy a la lista de Órdenes de Compra de un día, filtrando por palabras clave
// EN EL SERVIDOR (para no transferir miles de registros livianos innecesarios al navegador).
const TICKET = process.env.MP_TICKET || '38366B56-462A-4B4F-9FEE-18F946D9F1B5';
const BASE   = 'https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { fecha, palabras } = req.query;
  if (!fecha) return res.status(400).json({ error: 'Falta parámetro fecha' });
  const words = (palabras || '').split('|').map(w => w.trim().toLowerCase()).filter(Boolean);

  try {
    const upstream = await fetch(`${BASE}?fecha=${fecha}&ticket=${TICKET}`);
    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: text });
    }
    const data = await upstream.json();
    const listado = data.Listado || [];

    const matches = [];
    if (words.length) {
      for (const item of listado) {
        const titulo = (item.Nombre || '').toLowerCase();
        const match = words.some(kw =>
          kw.split(' ').every(word => {
            if (word.length <= 2) return new RegExp('\\b' + word + '\\b', 'i').test(titulo);
            return titulo.includes(word);
          })
        );
        if (match) matches.push({ Codigo: item.Codigo, Nombre: item.Nombre, CodigoEstado: item.CodigoEstado });
      }
    }
    return res.status(200).json({ fecha, matches });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
