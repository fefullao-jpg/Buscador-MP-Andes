// api/oc-precios.js — Barrido de Órdenes de Compra por rango de días y palabras clave.
// Devuelve las filas de precio ya resueltas (producto, precio unitario, cantidad,
// comprador, vendedor, fecha, tipo, código) en formato compacto.
export const config = { maxDuration: 60 };

const TICKET = process.env.MP_TICKET || '38366B56-462A-4B4F-9FEE-18F946D9F1B5';
const BASE   = 'https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json';

function tipoOcLabel(t) {
  const map = { AG: 'Compra Ágil', LE: 'Licitación', LP: 'Licitación', LQ: 'Licitación',
                LR: 'Licitación', LS: 'Licitación', L1: 'Licitación', CM: 'Convenio Marco',
                E2: 'Trato Directo', TD: 'Trato Directo' };
  return map[t] || (t || '—');
}

async function pLimitAll(items, limit, worker) {
  let i = 0; const results = [];
  async function next() { while (i < items.length) { const idx = i++; results[idx] = await worker(items[idx], idx); } }
  await Promise.all(Array(Math.min(limit, items.length)).fill(0).map(next));
  return results;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { palabras, desde = '0', hasta = '30' } = req.query;
  const words = (palabras || '').split('|').map(w => w.trim().toLowerCase()).filter(Boolean);
  if (!words.length) return res.status(400).json({ error: 'Falta parámetro palabras' });

  const d0 = parseInt(desde, 10), d1 = parseInt(hasta, 10);
  const hoy = new Date();
  const fechas = [];
  for (let i = d0; i < d1; i++) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    fechas.push(`${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`);
  }

  try {
    const matches = [];
    await pLimitAll(fechas, 10, async (fecha) => {
      try {
        const r = await fetch(`${BASE}?fecha=${fecha}&ticket=${TICKET}`);
        if (!r.ok) return;
        const data = await r.json();
        (data.Listado || []).forEach(item => {
          const titulo = (item.Nombre || '').toLowerCase();
          const ok = words.some(kw => kw.split(' ').every(w =>
            w.length <= 2 ? new RegExp('\\b' + w + '\\b', 'i').test(titulo) : titulo.includes(w)
          ));
          if (ok && !matches.find(m => m.Codigo === item.Codigo)) matches.push({ Codigo: item.Codigo });
        });
      } catch (e) {}
    });

    const filas = [];
    await pLimitAll(matches, 10, async (m) => {
      try {
        const r = await fetch(`${BASE}?codigo=${encodeURIComponent(m.Codigo)}&ticket=${TICKET}`);
        if (!r.ok) return;
        const data = await r.json();
        const d = (data.Listado && data.Listado[0]) || null;
        if (!d?.Items?.Listado?.length) return;
        d.Items.Listado.forEach(it => {
          filas.push([
            it.EspecificacionProveedor || it.EspecificacionComprador || it.Producto || d.Nombre || '',
            it.PrecioNeto || 0,
            it.Cantidad || 0,
            d.Comprador?.NombreOrganismo || '',
            d.Proveedor?.Nombre || '',
            (d.Fechas?.FechaAceptacion || d.Fechas?.FechaCreacion || '').slice(0, 10),
            tipoOcLabel(d.Tipo),
            d.Codigo || '',
          ]);
        });
      } catch (e) {}
    });

    return res.status(200).json({ dias: fechas.length, coincidencias: matches.length, filas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
