/**
 * estado.js
 * Vista de estados de solicitudes del cliente.
 * Lee del mismo localStorage que usa analista_riesgo.js.
 *
 * Claves:
 *   'analista_riesgo_estado'       → { sin-firmar, aprobadas, procesados }
 *   'cliente_solicitudes_enviadas' → array de solicitudes enviadas por el cliente
 *   'cliente_firmadas'             → array de IDs ya firmados
 */

const STORAGE_ANALISTA  = 'analista_riesgo_estado';
const STORAGE_ENVIADAS  = 'cliente_solicitudes_enviadas';
const STORAGE_FIRMADAS  = 'cliente_firmadas';

// ─── Helpers de lectura ───────────────────────────────────────────────────────
const leerAnalista  = () => { try { const r = localStorage.getItem(STORAGE_ANALISTA);  return r ? JSON.parse(r) : null; } catch { return null; } };
const leerEnviadas  = () => { try { const r = localStorage.getItem(STORAGE_ENVIADAS);  return r ? JSON.parse(r) : []; }  catch { return []; } };
const leerFirmadas  = () => { try { const r = localStorage.getItem(STORAGE_FIRMADAS);  return r ? new Set(JSON.parse(r)) : new Set(); } catch { return new Set(); } };
const guardarFirmadas = (set) => { try { localStorage.setItem(STORAGE_FIRMADAS, JSON.stringify([...set])); } catch(e) { console.warn(e); } };

// ─── Normalización de ID (mismo criterio que analista_riesgo.js) ──────────────
// analista_riesgo.js usa: item.id_credito || item.id_solicitud || item.id || item.id_simulacion
const normId = (s) => String(
    s.id_credito || s.id_solicitud || s.id || s.id_simulacion || ''
);

// ─── Helpers de formato ───────────────────────────────────────────────────────
const fmt     = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;
const fmtTasa = (n) => `${Number(n || 0).toFixed(1)}%`;

const calcCuota = (monto, plazo, tasaAnual) => {
    const p = Number(monto) || 0;
    const m = Number(plazo) || 0;
    const ta = Number(tasaAnual) || 0;
    if (m <= 0) return 0;
    const tm = ta / 12 / 100;
    if (tm <= 0) return p / m;
    return (p * tm) / (1 - Math.pow(1 + tm, -m));
};

// ─── Escritura en estado del analista (al firmar) ─────────────────────────────
const guardarAnalista = (estado) => {
    try { localStorage.setItem(STORAGE_ANALISTA, JSON.stringify(estado)); }
    catch(e) { console.warn('No se pudo guardar estado analista:', e); }
};

// ─── Construir tabla ──────────────────────────────────────────────────────────
function buildTabla(solicitudes, conFirmar = false) {
    if (solicitudes.length === 0) {
        return `<div class="empty-state">
            <div class="empty-icon">📋</div>
            <p>No hay solicitudes en esta sección.</p>
        </div>`;
    }

    const filas = solicitudes.map(s => {
        const cuota = s.cuotaMensual || calcCuota(s.monto, s.plazo || s.cuotas, s.tasaInteres || s.tasa_interes_anual);
        const total = s.totalPagar || (cuota * (Number(s.plazo || s.cuotas) || 0));
        const seguros = [
            (s.incluye_seguro_desgravamen || s.seguroDesgravamen) ? 'Desgravamen' : null,
            (s.incluye_seguro_cesantia    || s.seguroCesantia)    ? 'Cesantía'    : null,
        ].filter(Boolean).join(', ') || '—';

        const idFirma = normId(s);
        const accion = conFirmar
            ? `<button class="btn-firmar" data-firma-id="${idFirma}">Firmar</button>`
            : `<span class="badge ${s.firmada ? 'badge-firmada' : 'badge-pendiente'}">${s.firmada ? 'Firmada' : 'Pendiente'}</span>`;

        return `<tr>
            <td data-label="RUT">${s.cliente || s.rut || '—'}</td>
            <td data-label="Monto">${fmt(s.monto)}</td>
            <td data-label="Plazo">${Number(s.plazo || s.cuotas) || 0} meses</td>
            <td data-label="Tasa">${fmtTasa(s.tasaInteres || s.tasa_interes_anual)}</td>
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

// ─── Cargar y renderizar los 3 paneles ───────────────────────────────────────
function renderTodo() {
    const analista  = leerAnalista();
    const enviadas  = leerEnviadas();
    const firmadas  = leerFirmadas();

    const sinFirmarAnalista = analista?.['sin-firmar'] ?? [];
    const aprobadasAnalista = analista?.aprobadas      ?? [];

    // IDs procesados por el analista (aprobados O rechazados)
    const idsProcesados = new Set((analista?.procesados ?? []).map(String));
    // IDs que ya están en la cola sin-firmar del analista
    const idsSinFirmar  = new Set(sinFirmarAnalista.map(s => String(normId(s))));
    // IDs que el cliente ya firmó
    const idsFirmados   = new Set([...firmadas].map(String));

    // ── DEBUG: descomentar si necesitas inspeccionar qué hay en cada set ──────
    // console.group('renderTodo debug');
    // console.log('enviadas:', enviadas);
    // console.log('idsProcesados:', [...idsProcesados]);
    // console.log('idsSinFirmar:', [...idsSinFirmar]);
    // console.log('idsFirmados:', [...idsFirmados]);
    // console.groupEnd();

    // ── Pendientes: enviadas por el cliente que el analista aún no procesó ───
    const pendientes = enviadas.filter(s => {
        const id = normId(s);
        // Si no tiene ningún ID reconocible, igual mostramos (sin id = nueva)
        if (id === '') return true;
        return !idsProcesados.has(id) && !idsSinFirmar.has(id) && !idsFirmados.has(id);
    });

    // ── Sin firmar: aprobadas por el analista, no firmadas aún ──────────────
    const sinFirmar = sinFirmarAnalista.filter(s => !idsFirmados.has(String(normId(s))));

    // ── Firmadas: aprobadas que el cliente ya firmó ──────────────────────────
    const firmadas_lista = aprobadasAnalista.filter(s => idsFirmados.has(String(normId(s))));

    document.getElementById('contenido-pendientes').innerHTML  = buildTabla(pendientes, false);
    document.getElementById('contenido-sin-firmar').innerHTML  = buildTabla(sinFirmar,  true);
    document.getElementById('contenido-firmadas').innerHTML    = buildTabla(firmadas_lista.map(s => ({...s, firmada: true})), false);
}

// ─── Firma ───────────────────────────────────────────────────────────────────
let idPendienteFirma = null;

function abrirModal(id) {
    idPendienteFirma = id;
    document.getElementById('modalFirma').classList.add('visible');
}

function cerrarModal() {
    idPendienteFirma = null;
    document.getElementById('modalFirma').classList.remove('visible');
}

function confirmarFirma() {
    if (idPendienteFirma === null) return;

    const idStr    = String(idPendienteFirma);
    const analista = leerAnalista();
    const firmadas = leerFirmadas();

    if (analista) {
        const solicitud = (analista['sin-firmar'] ?? []).find(s => String(normId(s)) === idStr);

        if (solicitud) {
            analista['sin-firmar'] = (analista['sin-firmar'] ?? []).filter(s => String(normId(s)) !== idStr);
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

    // Delegación de clic en botones Firmar
    document.addEventListener('click', (e) => {
        if (e.target.matches('.btn-firmar')) {
            abrirModal(e.target.dataset.firmaId);
        }
    });

    document.getElementById('modalCancelar').addEventListener('click', cerrarModal);
    document.getElementById('modalConfirmar').addEventListener('click', confirmarFirma);
    document.getElementById('modalFirma').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modalFirma')) cerrarModal();
    });

    renderTodo();
});