/**
 * estado.js - Vista de estados de solicitudes del cliente.
 * Lee desde la API (fuente de verdad) con fallback a localStorage.
 */

const API_BASE = 'http://localhost:8080';
const STORAGE_ANALISTA = 'analista_riesgo_estado';
const STORAGE_ENVIADAS = 'cliente_solicitudes_enviadas';
const STORAGE_FIRMADAS = 'cliente_firmadas';

// ─── Helpers de localStorage ──────────────────────────────────────────────────
const leerAnalista  = () => { try { const r = localStorage.getItem(STORAGE_ANALISTA); return r ? JSON.parse(r) : null; } catch { return null; } };
const leerEnviadas  = () => { try { const r = localStorage.getItem(STORAGE_ENVIADAS); return r ? JSON.parse(r) : []; }  catch { return []; } };
const leerFirmadas  = () => { try { const r = localStorage.getItem(STORAGE_FIRMADAS); return r ? new Set(JSON.parse(r)) : new Set(); } catch { return new Set(); } };
const guardarFirmadas = (set) => { try { localStorage.setItem(STORAGE_FIRMADAS, JSON.stringify([...set])); } catch(e) { console.warn(e); } };
const guardarAnalista = (estado) => { try { localStorage.setItem(STORAGE_ANALISTA, JSON.stringify(estado)); } catch(e) { console.warn(e); } };

const normId = (s) => String(s.id_credito || s.id_solicitud || s.id || s.id_simulacion || '');

// ─── Helpers de formato ───────────────────────────────────────────────────────
const fmt     = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;
const fmtTasa = (n) => `${Number(n || 0).toFixed(1)}%`;

const calcCuota = (monto, plazo, tasaAnual) => {
  const p = Number(monto) || 0; const m = Number(plazo) || 0; const ta = Number(tasaAnual) || 0;
  if (m <= 0) return 0;
  const tm = ta / 12 / 100;
  if (tm <= 0) return p / m;
  return (p * tm) / (1 - Math.pow(1 + tm, -m));
};

// ─── Extraer RUTs únicos del localStorage ─────────────────────────────────────
const obtenerRutsDesdeLocalStorage = () => {
  const enviadas = leerEnviadas();
  const ruts = new Set();
  enviadas.forEach(s => { if (s.rut) ruts.add(s.rut.trim()); });
  // También desde el estado del analista
  const analista = leerAnalista();
  const todas = [
    ...(analista?.['sin-firmar'] ?? []),
    ...(analista?.aprobadas ?? [])
  ];
  todas.forEach(s => { if (s.cliente) ruts.add(s.cliente.trim()); });
  return [...ruts];
};

// ─── Cargar créditos desde la API ─────────────────────────────────────────────
const cargarCreditosDesdeAPI = async (ruts) => {
  const todos = [];
  for (const rut of ruts) {
    try {
      const resp = await fetch(`${API_BASE}/creditos?rut=${encodeURIComponent(rut)}`);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.ok && Array.isArray(data.data)) {
        todos.push(...data.data);
      }
    } catch (e) {
      console.warn(`No se pudo obtener créditos para rut ${rut}:`, e.message);
    }
  }
  return todos;
};

// ─── Construir tabla ──────────────────────────────────────────────────────────
function buildTabla(solicitudes, conFirmar = false) {
  if (solicitudes.length === 0) {
    return `<div class="empty-state"><div class="empty-icon">📋</div><p>No hay solicitudes en esta sección.</p></div>`;
  }

  const filas = solicitudes.map(s => {
    const monto  = s.monto || s.monto_solicitado || 0;
    const plazo  = s.cuotas || s.numero_cuotas || s.plazo || 0;
    const tasa   = s.tasa_interes_anual || s.tasaInteres || 0;
    const cuota  = s.monto_cuota || s.cuotaMensual || calcCuota(monto, plazo, tasa);
    const total  = s.monto_total || s.monto_total_pagar || s.totalPagar || (cuota * Number(plazo));
    const rut    = s.rut || s.cliente || '—';
    const seguros = [
      (s.incluye_seguro_desgravamen || s.seguroDesgravamen) ? 'Desgravamen' : null,
      (s.incluye_seguro_cesantia    || s.seguroCesantia)    ? 'Cesantía'    : null,
    ].filter(Boolean).join(', ') || '—';

    const idFirma = String(s.id_credito || normId(s));
    const accion = conFirmar
      ? `<button class="btn-firmar" data-firma-id="${idFirma}">Firmar</button>`
      : `<span class="badge ${s.firmada ? 'badge-firmada' : 'badge-pendiente'}">${s.firmada ? 'Firmada' : 'Pendiente'}</span>`;

    return `<tr>
      <td data-label="RUT">${rut}</td>
      <td data-label="Monto">${fmt(monto)}</td>
      <td data-label="Plazo">${Number(plazo) || 0} meses</td>
      <td data-label="Tasa">${fmtTasa(tasa)}</td>
      <td data-label="Cuota estimada">${fmt(cuota)}</td>
      <td data-label="Total a pagar">${fmt(total)}</td>
      <td data-label="Seguros">${seguros}</td>
      <td data-label="Acción">${accion}</td>
    </tr>`;
  }).join('');

  return `<table class="est-table">
    <thead><tr>
      <th>RUT</th><th>Monto</th><th>Plazo</th><th>Tasa anual</th>
      <th>Cuota estimada</th><th>Total a pagar</th><th>Seguros</th><th>Acción</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>`;
}

// ─── Render principal ─────────────────────────────────────────────────────────
async function renderTodo() {
  // Mostrar loading
  ['pendientes', 'sin-firmar', 'firmadas'].forEach(id => {
    document.getElementById(`contenido-${id}`).innerHTML = '<p>Cargando...</p>';
  });

  const firmadas = leerFirmadas();

  // Intentar cargar desde la API
  const ruts = obtenerRutsDesdeLocalStorage();
  let creditosAPI = [];

  if (ruts.length > 0) {
    creditosAPI = await cargarCreditosDesdeAPI(ruts);
  }

  if (creditosAPI.length > 0) {
    // ── Fuente de verdad: la BD ──────────────────────────────────────────
    const pendientes  = creditosAPI.filter(c => c.estado === 'PENDIENTE' || c.estado === 'EN_REVISION');
    const aprobadas   = creditosAPI.filter(c => c.estado === 'APROBADO');
    const sinFirmar   = aprobadas.filter(c => !firmadas.has(String(c.id_credito)));
    const yaFirmadas  = aprobadas.filter(c =>  firmadas.has(String(c.id_credito)));

    document.getElementById('contenido-pendientes').innerHTML  = buildTabla(pendientes, false);
    document.getElementById('contenido-sin-firmar').innerHTML  = buildTabla(sinFirmar,  true);
    document.getElementById('contenido-firmadas').innerHTML    = buildTabla(yaFirmadas.map(s => ({...s, firmada: true})), false);

  } else {
    // ── Fallback: localStorage (sin conexión al backend) ─────────────────
    console.warn('API no disponible o sin RUTs, usando localStorage como fallback.');
    const analista = leerAnalista();
    const enviadas  = leerEnviadas();

    const sinFirmarAnalista = analista?.['sin-firmar'] ?? [];
    const aprobadasAnalista = analista?.aprobadas ?? [];
    const idsProcesados = new Set((analista?.procesados ?? []).map(String));
    const idsSinFirmar  = new Set(sinFirmarAnalista.map(s => String(normId(s))));
    const idsFirmados   = new Set([...firmadas].map(String));

    const pendientes = enviadas.filter(s => {
      const id = normId(s);
      if (id === '') return true;
      return !idsProcesados.has(id) && !idsSinFirmar.has(id) && !idsFirmados.has(id);
    });
    const sinFirmar = sinFirmarAnalista.filter(s => !idsFirmados.has(String(normId(s))));
    const firmadas_lista = aprobadasAnalista.filter(s => idsFirmados.has(String(normId(s))));

    document.getElementById('contenido-pendientes').innerHTML  = buildTabla(pendientes, false);
    document.getElementById('contenido-sin-firmar').innerHTML  = buildTabla(sinFirmar,  true);
    document.getElementById('contenido-firmadas').innerHTML    = buildTabla(firmadas_lista.map(s => ({...s, firmada: true})), false);
  }
}

// ─── Firma ────────────────────────────────────────────────────────────────────
let idPendienteFirma = null;

function abrirModal(id) { idPendienteFirma = id; document.getElementById('modalFirma').classList.add('visible'); }
function cerrarModal()  { idPendienteFirma = null; document.getElementById('modalFirma').classList.remove('visible'); }

function confirmarFirma() {
  if (idPendienteFirma === null) return;
  const idStr   = String(idPendienteFirma);
  const firmadas = leerFirmadas();

  // También actualizar localStorage del analista para consistencia
  const analista = leerAnalista();
  if (analista) {
    const solicitud = (analista['sin-firmar'] ?? []).find(s => String(normId(s)) === idStr || String(s.id_credito) === idStr);
    if (solicitud) {
      analista['sin-firmar'] = (analista['sin-firmar'] ?? []).filter(s => String(normId(s)) !== idStr && String(s.id_credito) !== idStr);
      if (!Array.isArray(analista.aprobadas)) analista.aprobadas = [];
      analista.aprobadas.push({ ...solicitud, firmada: true });
      guardarAnalista(analista);
    }
  }

  firmadas.add(idStr);
  guardarFirmadas(firmadas);
  cerrarModal();
  mostrarToast();
  renderTodo();
}

function mostrarToast() {
  const t = document.getElementById('toastFirma');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const tabs   = document.querySelectorAll('.estado-tab');
  const panels = document.querySelectorAll('.estado-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });

  document.addEventListener('click', (e) => {
    if (e.target.matches('.btn-firmar')) abrirModal(e.target.dataset.firmaId);
  });

  document.getElementById('modalCancelar').addEventListener('click', cerrarModal);
  document.getElementById('modalConfirmar').addEventListener('click', confirmarFirma);
  document.getElementById('modalFirma').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalFirma')) cerrarModal();
  });

  renderTodo();
});