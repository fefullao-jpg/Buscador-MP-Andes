// api/detalle.js — Consulta el detalle de una Compra Ágil (API v2) e intenta extraer
// el proveedor ganador. Nota: hoy la API no expone el ganador (id_orden_compra suele
// venir null y no hay motivo_seleccion poblado), por eso el marcado Ganada/Perdida se
// hace manual; este endpoint queda listo por si la API empieza a entregar ese dato.
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
    const p = data?.payload || {};
    const ganador =
      p?.adjudicacion?.proveedor ||
      p?.motivos?.motivo_seleccion ||
      (Array.isArray(p?.proveedores_cotizando)
        ? (p.proveedores_cotizando.find(x => x.seleccionado || x.adjudicado)?.nombre || null)
        : null) ||
      null;
    return res.status(200).json({
      estado: p?.estado?.codigo || null,
      id_orden_compra: p?.id_orden_compra || null,
      ganador,
      payload: p,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
