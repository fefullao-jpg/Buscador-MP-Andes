// api/cotizacion.js — Genera la Cotización AMK en Excel a partir de una licitación o compra ágil.
// Usa la plantilla original de Andes Medikeep (logo, estilos y fórmulas intactos) y solo
// completa los datos del organismo solicitante. El detalle de productos y el plazo de entrega
// quedan en blanco para llenarlos manualmente.
import ExcelJS from 'exceljs';
import { PLANTILLA_B64 } from './_lib/plantilla-cotizacion.js';

const TICKET  = process.env.MP_TICKET || '38366B56-462A-4B4F-9FEE-18F946D9F1B5';
const BASE_V1 = 'https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json';
const BASE_V2 = 'https://api2.mercadopublico.cl';

function limpiar(v) {
  return (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
}

// Arma una dirección legible a partir de calle / comuna / región
function armarDireccion(calle, comuna, region) {
  const partes = [limpiar(calle), limpiar(comuna), limpiar(region)].filter(Boolean);
  // evita repetir comuna o región si ya vienen dentro de la calle
  const vistos = [];
  for (const p of partes) {
    if (!vistos.some(v => v.toLowerCase() === p.toLowerCase())) vistos.push(p);
  }
  return vistos.join(', ');
}

async function datosLicitacion(codigo) {
  const r = await fetch(`${BASE_V1}?codigo=${encodeURIComponent(codigo)}&ticket=${TICKET}`);
  if (!r.ok) throw new Error(`Licitación ${codigo}: ${r.status}`);
  const data = await r.json();
  const it   = (data.Listado && data.Listado[0]) || null;
  if (!it) throw new Error(`No se encontró la licitación ${codigo}`);
  const c = it.Comprador || {};
  return {
    organismo: limpiar(c.NombreOrganismo || c.NombreUnidad),
    rut:       limpiar(c.RutUnidad),
    direccion: armarDireccion(c.DireccionUnidad, c.ComunaUnidad, c.RegionUnidad),
    // si la licitación indica un lugar de entrega distinto, se usa ese
    direccionEntrega: limpiar(it.DireccionEntrega),
  };
}

async function datosCompraAgil(codigo) {
  // 1) intenta el detalle (trae la dirección de entrega del proceso)
  try {
    const r = await fetch(`${BASE_V2}/v2/compra-agil/${encodeURIComponent(codigo)}`, {
      headers: { ticket: TICKET },
    });
    if (r.ok) {
      const data = await r.json();
      const p    = data?.payload || data;
      const ins  = p?.institucion || {};
      const org  = limpiar(ins.organismo_comprador || ins.unidad_compra);
      if (org) {
        // En Compra Ágil la institución no trae dirección propia: la única dirección
        // del proceso es la de entrega, así que esa se usa como dirección del cliente
        // y el lugar de despacho la refleja mediante la fórmula =C19 de la plantilla.
        const dirEntrega = limpiar(p?.entrega?.direccion_entrega);
        return {
          organismo: org,
          rut:       limpiar(ins.rut),
          direccion: dirEntrega || armarDireccion('', '', ins.nombre_region),
          direccionEntrega: '',
        };
      }
    }
  } catch (e) { /* si falla el detalle, se cae al buscador */ }

  // 2) respaldo: busca por código en el listado de compra ágil
  const r2 = await fetch(`${BASE_V2}/v2/compra-agil?q=${encodeURIComponent(codigo)}&tamano_pagina=50`, {
    headers: { ticket: TICKET },
  });
  if (!r2.ok) throw new Error(`Compra Ágil ${codigo}: ${r2.status}`);
  const d2   = await r2.json();
  const item = (d2?.payload?.items || []).find(x => x.codigo === codigo) || (d2?.payload?.items || [])[0];
  if (!item) throw new Error(`No se encontró la compra ágil ${codigo}`);
  const ins = item.institucion || {};
  return {
    organismo: limpiar(ins.organismo_comprador || ins.unidad_compra),
    rut:       limpiar(ins.rut),
    direccion: armarDireccion('', '', ins.nombre_region),
    direccionEntrega: '',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { codigo, tipo } = req.query;
  if (!codigo) return res.status(400).json({ error: 'Falta parámetro codigo' });

  try {
    const info = tipo === 'lic' ? await datosLicitacion(codigo) : await datosCompraAgil(codigo);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(PLANTILLA_B64, 'base64'));
    const ws = wb.getWorksheet('Cotización') || wb.worksheets[0];

    // --- Datos del cliente / solicitud ---
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    ws.getCell('C16').value = hoy;                       // Fecha de emisión (fecha del día)
    ws.getCell('C16').numFmt = 'dd-mm-yyyy';
    ws.getCell('C17').value = info.organismo || '';      // Dirigido a
    ws.getCell('C18').value = info.rut || '';            // RUT
    ws.getCell('C19').value = info.direccion || '';      // Dirección del organismo
    ws.getCell('C20').value = codigo;                    // ID de la solicitud
    // C21 (vigencia) se mantiene tal cual viene en la plantilla

    // --- Detalle de productos: se deja en blanco para completar a mano ---
    // (D25 descripción, E25 cantidad, F25 precio unitario). Las fórmulas de
    // subtotal, neto, IVA y total se conservan intactas.
    ['D25', 'E25', 'F25'].forEach(ref => { ws.getCell(ref).value = null; });

    // --- Condiciones comerciales ---
    ws.getCell('C32').value = null;                      // Plazo de entrega: manual
    if (info.direccionEntrega) {
      ws.getCell('C33').value = info.direccionEntrega;   // lugar de despacho indicado en el proceso
    }
    // si no viene indicado, C33 mantiene la fórmula =C19 (dirección de la institución)

    const buffer = await wb.xlsx.writeBuffer();
    const nombre = `Cotizacion ${codigo}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"; filename*=UTF-8''${encodeURIComponent(nombre)}`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
