/**
 * estado.js - Vista de estados de solicitudes del cliente.
 * Lee desde la API (fuente de verdad) con fallback a localStorage.
 */

const API_BASE = 'http://localhost:8080';
const STORAGE_ANALISTA = 'analista_riesgo_estado';
const STORAGE_ENVIADAS = 'cliente_solicitudes_enviadas';
const STORAGE_FIRMADAS = 'cliente_firmadas';

let creditosAPI = [];

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

// MySQL DATE puede llegar como "2026-07-16T03:00:00.000Z" — extraer solo YYYY-MM-DD
const normFecha = (val) => {
  if (!val) return '—';
  const s = typeof val === 'string' ? val : val instanceof Date ? val.toISOString() : String(val);
  return s.slice(0, 10);
};

const calcCuota = (monto, plazo, tasaAnual) => {
  const p = Number(monto) || 0; const m = Number(plazo) || 0; const ta = Number(tasaAnual) || 0;
  if (m <= 0) return 0;
  const tm = ta / 12 / 100;
  if (tm <= 0) return p / m;
  return (p * tm) / (1 - Math.pow(1 + tm, -m));
};

const calcularScore = (monto, cuotas) => { 
    const m = Number(monto) || 0; 
    const c = Number(cuotas) || 1; 
    return Math.max(5, Math.min(95, 100 - Math.round((m / 1000000) * 2 + c * 0.8))); 
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

    const scoreCalculado = s.score || calcularScore(monto, plazo);
    const idFirma = String(s.id_credito || normId(s));
    const accion = conFirmar
      ? `<button class="btn-firmar" data-firma-id="${idFirma}">Firmar</button>`
      : s.firmada
        ? `
           <button class="btn-ir-pagos" data-rut="${rut}" onclick="irAPagos('${rut}')">💳 Ir a Pagos</button>`
        : `<span class="badge badge-pendiente">Pendiente</span>`;

    return `<tr>
      <td data-label="RUT">${rut}</td>
      <td data-label="Monto">${fmt(monto)}</td>
      <td data-label="Plazo">${Number(plazo) || 0} meses</td>
      <td data-label="Tasa">${fmtTasa(tasa)}</td>
      <td data-label="Cuota estimada">${fmt(cuota)}</td>
      <td data-label="Total a pagar">${fmt(total)}</td>
      <td data-label="Seguros">${seguros}</td>
      <td data-label="Prob. de aprobación"><span style="font-weight:bold; color: #2B4C7E;">${scoreCalculado}%</span></td>
      <td data-label="Acción">${accion}</td>
    </tr>`;
  }).join('');

  return `<table class="est-table">
    <thead><tr>
      <th>RUT</th><th>Monto</th><th>Plazo</th><th>Tasa anual</th>
      <th>Cuota estimada</th><th>Total a pagar</th><th>Seguros</th><th>Prob. de Aprobación</th><th>Acción</th>
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
  const rutSesion = localStorage.getItem("clienteRut") || "";
  creditosAPI = [];

  if (rutSesion) {
    creditosAPI = await cargarCreditosDesdeAPI([rutSesion]);
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
    console.warn('API no disponible o sin RUT, usando localStorage como fallback.');
    const activeRutClean = rutSesion.replace(/[^0-9kK]/ig, '').toUpperCase();

    const analista = leerAnalista();
    const enviadas  = leerEnviadas();

    // Filtrar solicitudes enviadas locales por la sesión activa
    const enviadasFiltradas = enviadas.filter(s => {
      const rutS = (s.rut_sesion || s.rut || '').replace(/[^0-9kK]/ig, '').toUpperCase();
      return rutS === activeRutClean;
    });

    const sinFirmarAnalista = (analista?.['sin-firmar'] ?? []).filter(s => {
      const rutS = (s.rut_sesion || s.cliente || '').replace(/[^0-9kK]/ig, '').toUpperCase();
      return rutS === activeRutClean;
    });
    const aprobadasAnalista = (analista?.aprobadas ?? []).filter(s => {
      const rutS = (s.rut_sesion || s.cliente || '').replace(/[^0-9kK]/ig, '').toUpperCase();
      return rutS === activeRutClean;
    });

    const idsProcesados = new Set((analista?.procesados ?? []).map(String));
    const idsSinFirmar  = new Set(sinFirmarAnalista.map(s => String(normId(s))));
    const idsFirmados   = new Set([...firmadas].map(String));

    const pendientes = enviadasFiltradas.filter(s => {
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

function abrirModal(id) { 
  idPendienteFirma = id; 
  const fileInput = document.getElementById('documentoFirma');
  if (fileInput) fileInput.value = '';
  const msgOcr = document.getElementById('msgFirmaOcr');
  if (msgOcr) {
      msgOcr.textContent = '';
      msgOcr.style.color = '#7f7f7f';
  }
  document.getElementById('modalFirma').classList.add('visible'); 
}

function cerrarModal()  { 
  idPendienteFirma = null; 
  document.getElementById('modalFirma').classList.remove('visible'); 
}

async function confirmarFirma() {
  if (idPendienteFirma === null) return;
  const idStr   = String(idPendienteFirma);

  const fileInput = document.getElementById('documentoFirma');
  const msgOcr = document.getElementById('msgFirmaOcr');
  
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      if (msgOcr) {
          msgOcr.textContent = "Error: Debes subir la foto de tu carnet para firmar.";
          msgOcr.style.color = "red";
      }
      return;
  }

  const file = fileInput.files[0];
  if (msgOcr) {
      msgOcr.textContent = "Procesando firma y verificando carnet (OCR)...";
      msgOcr.style.color = "#007bff";
  }

  const confirmBtn = document.getElementById('modalConfirmar');
  const cancelBtn = document.getElementById('modalCancelar');
  if (confirmBtn) confirmBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;

  try {
      const result = await Tesseract.recognize(file, "spa", { logger: m => console.log(m) });
      const rawText = result.data.text || "";
      // Normalizar texto: eliminar acentos/diacríticos para soportar variantes como NÚMERO vs NUMERO, CÉDULA vs CEDULA, etc.
      const text = rawText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const rutRegex = /\d{1,2}\.?\d{3}\.?\d{3}-?[0-9kK]/;
      const rutMatch = text.match(rutRegex);

      // Find all 9-character alphanumeric blocks and filter out common words
      const matches = text.match(/\b[A-Z0-9]{3}[.-]?[A-Z0-9]{3}[.-]?[A-Z0-9]{3}\b/gi) || [];
      const blacklist = ["IDENTIDAD", "DOCUMENTO", "NUMERO", "REPUBLICA", "APELLIDOS", "PROFESION", "CATEGORIA", "SIGNATURE"];
      const docMatch = matches.find(m => {
          const cleaned = m.replace(/[^A-Z0-9]/ig, "").toUpperCase();
          const esPalabraComun = /^[A-Z]+$/.test(cleaned) && blacklist.includes(cleaned);
          const tieneNumeros = /\d/.test(cleaned);
          const tieneSeparadores = /[.-]/.test(m);
          return !esPalabraComun && (tieneNumeros || tieneSeparadores);
      });

      const scannedRut = rutMatch ? rutMatch[0].replace(/[^0-9kK]/g, "").toUpperCase() : "";
      const scannedDoc = docMatch ? docMatch.replace(/[^A-Z0-9]/ig, "").toUpperCase() : "";

      const creditObj = creditosAPI.find(c => String(c.id_credito) === idStr);
      let storedRut = "";
      let storedDoc = "";

      if (creditObj) {
          storedRut = creditObj.rut ? creditObj.rut.replace(/[^0-9kK]/g, "").toUpperCase() : "";
          storedDoc = creditObj.num_documento ? creditObj.num_documento.replace(/[^A-Z0-9]/ig, "").toUpperCase() : "";
      } else {
          const analista = leerAnalista();
          const enviadas = leerEnviadas();
          const solicitud = (analista?.['sin-firmar'] ?? []).find(s => String(normId(s)) === idStr) || 
                            enviadas.find(s => String(normId(s)) === idStr);
          if (solicitud) {
              storedRut = solicitud.rut ? solicitud.rut.replace(/[^0-9kK]/g, "").toUpperCase() : "";
              storedDoc = solicitud.num_documento ? solicitud.num_documento.replace(/[^A-Z0-9]/ig, "").toUpperCase() : "";
          }
      }

      console.log("OCR Resultados - RUT escaneado:", scannedRut, "Doc escaneado:", scannedDoc);
      console.log("Datos Guardados - RUT guardado:", storedRut, "Doc guardado:", storedDoc);

      const rutCoincide = scannedRut && storedRut && scannedRut === storedRut;
      const docCoincide = scannedDoc && storedDoc && scannedDoc === storedDoc;

      if (rutCoincide || docCoincide) {
          const firmadas = leerFirmadas();

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

          await renderTodo();
          activarTab('firmadas');
      } else {
          if (msgOcr) {
              msgOcr.textContent = "Error: El carnet no coincide con el RUT ni el número de documento registrado.";
              msgOcr.style.color = "red";
          }
          mostrarModalInfo(
              "Validación Fallida",
              "La cédula de identidad no coincide con el registro del crédito.",
              false
          );
      }
  } catch (error) {
      console.error("Error en OCR:", error);
      if (msgOcr) {
          msgOcr.textContent = "Error al procesar la verificación OCR de la imagen.";
          msgOcr.style.color = "red";
      }
  } finally {
      if (confirmBtn) confirmBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
  }
}

function mostrarToast() {
  const t = document.getElementById('toastFirma');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

// FIX: función reutilizable para activar un tab por nombre
function activarTab(nombre) {
  document.querySelectorAll('.estado-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === nombre);
  });
  document.querySelectorAll('.estado-panel').forEach(p => {
    p.classList.toggle('active', p.id === `panel-${nombre}`);
  });
}

// ─── Ir a Pagos: guardar RUT en sesión y navegar ──────────────────────────────
function irAPagos(rut) {
  // Asegurarse de que haya sesión de cliente con el RUT correcto
  // para que pagos.js no redirija al inicio
  const rutLimpio = (rut || '').replace(/\./g, '').trim();
  if (rutLimpio) {
    localStorage.setItem('clienteRut', rutLimpio);
    localStorage.setItem('loggedIn', 'true');
    // Solo sobreescribir el rol si no hay uno ya activo
    if (!localStorage.getItem('userRole')) {
      localStorage.setItem('userRole', 'cliente');
    }
  }
  window.location.href = 'pagos.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const tabs   = document.querySelectorAll('.estado-tab');
  const panels = document.querySelectorAll('.estado-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activarTab(tab.dataset.tab));
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

// ═══════════════════════════════════════════════════════════
// MODAL PERSONALIZADO (POPUP)
// ═══════════════════════════════════════════════════════════
function mostrarModalInfo(titulo, mensaje, esExito, callback) {
    const overlay = document.createElement("div");
    overlay.className = "custom-modal-overlay";
    
    const iconBg = esExito ? "#eafaf1" : "#fff8e6";
    const iconColor = esExito ? "#28a745" : "#f0ad4e";
    const btnText = "Entendido";
    
    const svgIcon = esExito 
        ? `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
        : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;

    overlay.innerHTML = `
        <div class="custom-modal-card">
            <div class="custom-modal-icon-container" style="background: ${iconBg};">
                ${svgIcon}
            </div>
            <h3 class="custom-modal-title">${titulo}</h3>
            <p class="custom-modal-message">${mensaje}</p>
            <button class="custom-modal-btn">${btnText}</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Forzar reflow para animación
    overlay.offsetHeight;
    
    // Activar animación
    overlay.classList.add("active");
    
    const btn = overlay.querySelector(".custom-modal-btn");
    const closeModal = () => {
        overlay.classList.remove("active");
        setTimeout(() => {
            overlay.remove();
            if (callback) callback();
        }, 300);
    };
    
    btn.addEventListener("click", closeModal);
    
    const keyHandler = (e) => {
        if (e.key === "Enter" || e.key === "Escape") {
            document.removeEventListener("keydown", keyHandler);
            closeModal();
        }
    };
    document.addEventListener("keydown", keyHandler);
}