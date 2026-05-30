/**
 * pagos.js — Pago de cuotas de créditos aprobados.
 *
 * Fuente de verdad: API
 *   GET  /creditos?rut=        → créditos del cliente (tabla credito)
 *   GET  /pagos/:id_credito    → cuotas ya pagadas (tabla pago_cuota)
 *   POST /pagos                → registrar pago(s) de cuota(s)
 *
 * El RUT se lee de localStorage.clienteRut (guardado al hacer login).
 * Las fechas de MySQL llegan como ISO string "2026-07-16T03:00:00.000Z"
 * y se normalizan extrayendo solo la parte "YYYY-MM-DD".
 */

const API_BASE      = 'http://localhost:8080';
const STORAGE_FIRMADAS = 'cliente_firmadas';

// ─── localStorage helpers ─────────────────────────────────────────────────────
const leerJSON   = (key, def) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : def; } catch { return def; } };
const leerFirmadas = ()       => new Set(leerJSON(STORAGE_FIRMADAS, []));

// ─── Sesión ───────────────────────────────────────────────────────────────────
// Normaliza RUT: quita puntos, respeta el guión. Ej: "21.708.019-3" → "21708019-3"
const normalizarRut = (rut) => (rut || '').replace(/\./g, '').trim();

const obtenerRutSesion = () => normalizarRut(localStorage.getItem('clienteRut') || '') || null;

// ─── Normalizar fecha que viene de MySQL ──────────────────────────────────────
// MySQL DATE devuelve algo como "2026-07-16T03:00:00.000Z" o ya "2026-07-16"
// Extraemos siempre los primeros 10 caracteres para obtener "YYYY-MM-DD"
const normFecha = (val) => {
    if (!val) return null;
    const s = typeof val === 'string' ? val : val instanceof Date ? val.toISOString() : String(val);
    return s.slice(0, 10); // "YYYY-MM-DD"
};

// ─── Formato ──────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

// Suma n meses a una fecha "YYYY-MM-DD" y devuelve Date (sin desfase de zona)
const sumarMeses = (isoDate, n) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    // Construir con UTC para evitar desfase horario
    const fecha = new Date(Date.UTC(y, m - 1 + n, d));
    return fecha;
};

const fmtFecha = (d) => {
    if (!(d instanceof Date) || isNaN(d)) return '—';
    return d.toLocaleDateString('es-CL', {
        day: '2-digit', month: 'short', year: 'numeric',
        timeZone: 'UTC'   // mismo huso que usamos al construir
    });
};

// ─── API calls ────────────────────────────────────────────────────────────────
const apiGet = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
};

const cargarCreditos = async (rut) => {
    const d = await apiGet(`${API_BASE}/creditos?rut=${encodeURIComponent(rut)}`);
    return (d.ok && Array.isArray(d.data)) ? d.data : [];
};

const cargarPagos = async (idCredito) => {
    try {
        const d = await apiGet(`${API_BASE}/pagos/${idCredito}`);
        // Devuelve Set de números de cuota ya pagados
        if (d.ok && Array.isArray(d.data)) {
            return new Set(d.data.map(p => Number(p.numero_cuota)));
        }
    } catch { /* sin pagos previos */ }
    return new Set();
};

const enviarPago = async (idCredito, cuotasSeleccionadas) => {
    const body = {
        id_credito: idCredito,
        cuotas: cuotasSeleccionadas.map(c => ({
            numero_cuota: c.num,
            monto_pagado: c.monto
        }))
    };
    const r = await fetch(`${API_BASE}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return r.json();
};

// ─── Estado de una cuota ──────────────────────────────────────────────────────
const estadoCuota = (num, fechaVenc, pagadasSet) => {
    if (pagadasSet.has(num)) return 'pagada';
    if (!fechaVenc) return 'pendiente';
    const hoy  = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const venc = fechaVenc.getTime();        // ya es UTC por sumarMeses
    const diff = Math.round((venc - hoy) / 86400000);
    if (diff < 0)   return 'vencida';
    if (diff === 0) return 'hoy';
    return 'futura';
};

// ─── Build tarjeta de crédito ─────────────────────────────────────────────────
function buildTarjeta(cred, pagadasSet) {
    const id          = cred.id_credito;
    const monto       = Number(cred.monto || cred.monto_solicitado || 0);
    const plazo       = Number(cred.cuotas || cred.numero_cuotas || 0);
    const tasa        = Number(cred.tasa_interes_anual || 0);
    const montoCuota  = Number(cred.monto_cuota || 0);
    const fechaBase   = normFecha(cred.fecha_primer_pago); // "YYYY-MM-DD" o null

    const pagadas = pagadasSet.size;
    const pct     = plazo > 0 ? Math.round((pagadas / plazo) * 100) : 0;

    // Generar filas de cuotas
    const cuotas = Array.from({ length: plazo }, (_, i) => {
        const num   = i + 1;
        const fecha = fechaBase ? sumarMeses(fechaBase, i) : null;
        const est   = estadoCuota(num, fecha, pagadasSet);
        return { num, fecha, monto: montoCuota, est };
    });

    // Cuota "próxima" = primera futura no pagada
    const idxProxima = cuotas.findIndex(c => c.est === 'futura');

    const saldoPendiente = cuotas
        .filter(c => c.est !== 'pagada')
        .reduce((s, c) => s + c.monto, 0);

    const filas = cuotas.map(c => {
        const esProxima = c.num === (idxProxima >= 0 ? cuotas[idxProxima].num : -1);

        const badgeMap = {
            pagada:   `<span class="badge-cuota pagada">✓ Pagada</span>`,
            vencida:  `<span class="badge-cuota vencida">⚠ Vencida</span>`,
            hoy:      `<span class="badge-cuota hoy">⏰ Vence hoy</span>`,
            futura:   esProxima
                        ? `<span class="badge-cuota proxima">→ Próxima</span>`
                        : `<span class="badge-cuota futura">Futura</span>`,
            pendiente:`<span class="badge-cuota futura">Pendiente</span>`,
        };

        // Pre-marcar: vencidas, vence hoy, y la próxima futura
        const preChecked = c.est === 'vencida' || c.est === 'hoy' || esProxima;

        const checkHtml = c.est !== 'pagada'
            ? `<input type="checkbox" class="chk-cuota"
                 data-num="${c.num}" data-monto="${c.monto}" data-id="${id}"
                 ${preChecked ? 'checked' : ''}>`
            : `<span class="check-ok">✓</span>`;

        return `<tr class="fila-cuota ${c.est}${preChecked && c.est !== 'pagada' ? ' corresponde' : ''}">
          <td>${c.num}</td>
          <td>${fmtFecha(c.fecha)}</td>
          <td>${fmt(c.monto)}</td>
          <td>${badgeMap[c.est] || ''}</td>
          <td>${checkHtml}</td>
        </tr>`;
    }).join('');

    return `
<div class="credito-card" id="card-${id}">
  <div class="credito-header">
    <div>
      <span class="credito-titulo">Crédito #${id}</span>
      <span class="credito-rut">RUT ${cred.rut}</span>
    </div>
    <div class="credito-nums">
      <span>${fmt(monto)}</span>
      <span>${plazo} cuotas · ${tasa}% anual</span>
    </div>
  </div>

  <div class="progreso-wrap">
    <div class="prog-labels">
      <span>${pagadas} / ${plazo} cuotas pagadas</span><span>${pct}%</span>
    </div>
    <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
  </div>

  <div class="deuda-pendiente">
    Saldo pendiente: <strong>${fmt(saldoPendiente)}</strong>
    ${pagadas >= plazo ? ' · <span class="credito-pagado">🎉 ¡Crédito completamente pagado!</span>' : ''}
  </div>

  <div class="cuotas-wrap">
    <table class="cuotas-tabla">
      <thead><tr>
        <th>#</th><th>Vencimiento</th><th>Monto</th><th>Estado</th>
        <th><label class="chk-todos-label">
          <input type="checkbox" class="chk-todos" data-id="${id}"> Seleccionar
        </label></th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="pagar-seleccion-wrap">
      <span class="seleccion-info" id="sel-info-${id}">Ninguna cuota seleccionada</span>
      <button class="btn-pagar-sel" data-id="${id}" disabled>Pagar seleccionadas</button>
    </div>
  </div>
</div>`;
}

// ─── Render principal ─────────────────────────────────────────────────────────
async function renderPagos() {
    const cont = document.getElementById('pagos-contenedor');
    cont.innerHTML = '<p class="cargando">Cargando créditos...</p>';

    // FIX: si no hay sesión activa de cliente, redirigir al login con redirect de vuelta
    const loggedIn  = localStorage.getItem('loggedIn') === 'true';
    const userRole  = localStorage.getItem('userRole') || '';
    const rutSesion = obtenerRutSesion();

    if (!loggedIn || userRole !== 'cliente' || !rutSesion) {
        window.location.href = 'acceso.html?redirect=' + encodeURIComponent('pagos.html');
        return;
    }

    const firmadas = leerFirmadas();

    try {
        const todosCreditos = await cargarCreditos(rutSesion);

        const normEstado = (e) => (e || '').toString().trim().toUpperCase();

        // Solo créditos APROBADO
        const creditos = todosCreditos.filter(c => normEstado(c.estado) === 'APROBADO');

        if (todosCreditos.length > 0 && creditos.length === 0) {
            const enRevision = todosCreditos.filter(c => ['PENDIENTE','EN_REVISION'].includes(normEstado(c.estado))).length;
            cont.innerHTML = `
              <div class="empty-state">
                <div class="empty-icon">⏳</div>
                <p>Tienes ${enRevision} crédito${enRevision !== 1 ? 's' : ''} en revisión para RUT <strong>${rutSesion}</strong>.</p>
                <p class="empty-hint">Las cuotas aparecerán aquí una vez que el analista apruebe tu solicitud.</p>
                <p class="empty-hint"><a href="Estado.html">Ver estado de mis solicitudes →</a></p>
              </div>`;
            return;
        }

        if (creditos.length === 0) {
            cont.innerHTML = `
              <div class="empty-state">
                <div class="empty-icon">💳</div>
                <p>No hay créditos aprobados para RUT <strong>${rutSesion}</strong>.</p>
                <p class="empty-hint">Solicita un crédito en <a href="Estado.html">Estado de solicitudes</a>.</p>
              </div>`;
            return;
        }

        // Cargar pagos de cada crédito en paralelo
        const pagosMap = {};
        await Promise.all(creditos.map(async c => {
            pagosMap[c.id_credito] = await cargarPagos(c.id_credito);
        }));

        cont.innerHTML = creditos.map(c => buildTarjeta(c, pagosMap[c.id_credito])).join('');
        bindEventos(creditos, pagosMap);

    } catch (err) {
        console.error('Error cargando pagos:', err);
        cont.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <p>No se pudo conectar con el servidor. Verifica que el backend esté activo.</p>
          </div>`;
    }
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
function bindEventos(creditos, pagosMap) {
    document.querySelectorAll('.chk-cuota').forEach(chk => {
        chk.addEventListener('change', () => actualizarResumen(chk.closest('.credito-card')));
    });

    document.querySelectorAll('.chk-todos').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const card = chk.closest('.credito-card');
            card.querySelectorAll('.chk-cuota').forEach(c => { c.checked = e.target.checked; });
            actualizarResumen(card);
        });
    });

    document.querySelectorAll('.btn-pagar-sel').forEach(btn => {
        btn.addEventListener('click', () => abrirModal(btn.dataset.id));
    });

    // Inicializar resumen de cada tarjeta
    document.querySelectorAll('.credito-card').forEach(card => actualizarResumen(card));
}

function actualizarResumen(card) {
    const id    = card.id.replace('card-', '');
    const sel   = [...card.querySelectorAll('.chk-cuota:checked')];
    const total = sel.reduce((s, c) => s + Number(c.dataset.monto), 0);
    const info  = document.getElementById(`sel-info-${id}`);
    const btn   = card.querySelector('.btn-pagar-sel');
    if (sel.length === 0) {
        info.textContent = 'Ninguna cuota seleccionada';
        btn.disabled = true;
    } else {
        info.textContent = `${sel.length} cuota${sel.length > 1 ? 's' : ''} · Total: ${fmt(total)}`;
        btn.disabled = false;
    }
}

// ─── Modal ────────────────────────────────────────────────────────────────────
let idCreditoModal = null;
let cuotasModal    = [];

function abrirModal(idCred) {
    idCreditoModal = idCred;
    const card  = document.getElementById(`card-${idCred}`);
    const sel   = [...card.querySelectorAll('.chk-cuota:checked')];
    cuotasModal = sel.map(c => ({ num: Number(c.dataset.num), monto: Number(c.dataset.monto) }));
    const total = cuotasModal.reduce((s, c) => s + c.monto, 0);

    const detalle = cuotasModal
        .map(c => `Cuota ${c.num} · ${fmt(c.monto)}`)
        .join('<br>');

    document.getElementById('modal-detalle').innerHTML =
        `<strong>Crédito #${idCred}</strong><br><br>${detalle}<br><br>
         <span class="modal-total">Total: ${fmt(total)}</span>`;

    document.getElementById('modal-pago').classList.add('visible');
}

function cerrarModal() {
    idCreditoModal = null;
    cuotasModal    = [];
    document.getElementById('modal-pago').classList.remove('visible');
}

async function confirmarPago() {
    if (!idCreditoModal || cuotasModal.length === 0) return;

    const btnConfirmar = document.getElementById('modal-confirmar');
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Procesando…';

    try {
        const resp = await enviarPago(Number(idCreditoModal), cuotasModal);
        if (resp.ok) {
            cerrarModal();
            toast(`✅ ${resp.registrados?.length || cuotasModal.length} cuota(s) pagada(s) correctamente`);
            await renderPagos();
        } else {
            toast(`❌ Error: ${resp.error || 'No se pudo registrar el pago'}`);
        }
    } catch (e) {
        toast('❌ Sin conexión al servidor');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Confirmar pago';
    }
}

function toast(msg) {
    const t = document.getElementById('toast-pagos');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderPagos();
    document.getElementById('modal-cancelar').addEventListener('click', cerrarModal);
    document.getElementById('modal-confirmar').addEventListener('click', confirmarPago);
    document.getElementById('modal-pago').addEventListener('click', e => {
        if (e.target === document.getElementById('modal-pago')) cerrarModal();
    });
});