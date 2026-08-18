// api/oc-precios.js — Barrido de Órdenes de Compra por rango de días y palabras clave.
// Devuelve las filas de precio ya resueltas (producto, precio unitario, cantidad,
// comprador, vendedor, fecha, tipo, codigo OC, codigo de licitacion/compra agil origen)
// en formato compacto. Reintenta cada llamada porque la API de Mercado Publico falla
// de forma intermitente bajo concurrencia.
export const config = { maxDuration: 60 };

const TICKET = process.env.MP_TICKET || '38366B56-462A-4B4F-9FEE-18F946D9F1B5';
const BASE   = 'https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json';

function tipoOcLabel(t) {
  const map = { AG: 'Compra Ágil', LE: 'Licitación', LP: 'Licitación', LQ: 'Licitación',
                LR: 'Licitación', LS: 'Licitación', L1: 'Licitación', CM: 'Convenio Marco',
                E2: 'Trato Directo', TD: 'Trato Directo' };
  return map[t] || (t || '—');
}

// La API de ChileCompra falla de forma intermitente (timeouts/errores transitorios)
// bajo concurrencia. Reintenta antes de descartar el dia u OC.
async function fetchRetry(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (i < tries - 1) await new Promise(res => setTimeout(res, 300 + i * 300));
  }
  throw lastErr;
}

async function pLimitAll(items, limit, worker) {
  let i = 0; const results = [];
  async function next() { while (i < items.length) { const idx = i++; results[idx] = await worker(items[idx], idx); } }
  await Promise.all(Array(Math.min(limit, items.length)).fill(0).map(next));
  return results;
}

// Intenta identificar el codigo de la licitacion/compra agil que origino la OC.
// El campo CodigoLicitacion suele venir poblado para licitaciones; para Compra Agil
// suele venir vacio, pero el codigo de la solicitud (formato ...-COT##) a veces
// aparece mencionado dentro del texto libre de Descripcion.
function codigoProceso(d) {
  if (d.CodigoLicitacion) return d.CodigoLicitacion;
  const texto = d.Descripcion || '';
  const re = /\b\d{2,7}-\d{1,6}-(COT|AG|LE|LP|LQ|LR|LS|L1|CM|E2|TD)\d{2}\b/gi;
  const encontrados = texto.match(re) || [];
  const distinto = encontrados.find(c => c.toUpperCase() !== (d.Codigo || '').toUpperCase());
  return distinto || '';
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
    const diasFallidos = [];
    await pLimitAll(fechas, 8, async (fecha) => {
      try {
        const r = await fetchRetry(`${BASE}?fecha=${fecha}&ticket=${TICKET}`);
        const data = await r.json();
        (data.Listado || []).forEach(item => {
          const titulo = (item.Nombre || '').toLowerCase();
          const ok = words.some(kw => kw.split(' ').every(w =>
            w.length <= 2 ? new RegExp('\\b' + w + '\\b', 'i').test(titulo) : titulo.includes(w)
          ));
          if (ok && !matches.find(m => m.Codigo === item.Codigo)) matches.push({ Codigo: item.Codigo });
        });
      } catch (e) { diasFallidos.push(fecha); }
    });

    const filas = [];
    const ocFallidas = [];
    await pLimitAll(matches, 8, async (m) => {
      try {
        const r = await fetchRetry(`${BASE}?codigo=${encodeURIComponent(m.Codigo)}&ticket=${TICKET}`);
        const data = await r.json();
        const d = (data.Listado && data.Listado[0]) || null;
        if (!d?.Items?.Listado?.length) return;
        const proceso = codigoProceso(d);
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
            proceso,
          ]);
        });
      } catch (e) { ocFallidas.push(m.Codigo); }
    });

    return res.status(200).json({
      dias: fechas.length,
      diasFallidos,
      coincidencias: matches.length,
      codigos: matches.map(m => m.Codigo),
      ocFallidas,
      filas,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
