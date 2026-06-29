document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const API_BASE = 'http://localhost:8080';
  const API_SOLICITUDES = `${API_BASE}/solicitudes`;

  // ─── Persistencia localStorage ────────────────────────────────────────────
  const STORAGE_KEY = 'analista_riesgo_estado';

  const cargarEstadoGuardado = () => {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  };

  const guardarEstado = () => {
    try {
      const estadoActual = cargarEstadoGuardado();
      const aprobadasExistentes = estadoActual?.aprobadas ?? [];
      const aprobadasMerge = [...aprobadasExistentes];
      for (const ap of mockData['aprobadas']) {
        const yaExiste = aprobadasMerge.some(a => String(a.id) === String(ap.id));
        if (!yaExiste) aprobadasMerge.push(ap);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        'sin-firmar': mockData['sin-firmar'],
        aprobadas: aprobadasMerge,
        procesados: [...idsYaProcesados],
      }));
    } catch (e) { console.warn('No se pudo guardar el estado:', e); }
  };

  const estadoGuardado = cargarEstadoGuardado();
  const idsYaProcesados = new Set((estadoGuardado?.procesados ?? []).map(String));

  const mockData = {
    evaluacion: [],
    aprobadas: [],
    'sin-firmar': estadoGuardado?.['sin-firmar'] ?? [],
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getScoreClass = (score) => { if (score > 70) return 'score-high'; if (score > 50) return 'score-medium'; return 'score-low'; };
  const calcularScore = (monto, cuotas) => { const m = Number(monto) || 0; const c = Number(cuotas) || 1; return Math.max(5, Math.min(95, 100 - Math.round((m / 1000000) * 2 + c * 0.8))); };
  const formatearMoneda = (valor) => `$${Number(valor || 0).toLocaleString('es-CL')}`;
  const formatearTasa = (valor) => `${Number(valor || 0).toFixed(1)}%`;
  const calcularCuotaMensualEstimada = (monto, plazo, tasaInteresAnual) => {
    const principal = Number(monto) || 0; const meses = Number(plazo) || 0; const tasaAnual = Number(tasaInteresAnual) || 0;
    if (meses <= 0) return 0;
    const tasaMensual = tasaAnual / 12 / 100;
    if (tasaMensual <= 0) return principal / meses;
    return (principal * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -meses));
  };

  const obtenerConllevaSolicitud = (solicitud) => {
    const seguros = [];
    if (solicitud.incluye_seguro_desgravamen) seguros.push('desgravamen');
    if (solicitud.incluye_seguro_cesantia) seguros.push('cesantía');
    const detalleSeguros = seguros.length > 0 ? `, seguros ${seguros.join(' y ')}` : '';
    return `Monto ${formatearMoneda(solicitud.monto)}, plazo ${Number(solicitud.plazo) || 0} meses, tasa ${formatearTasa(solicitud.tasaInteres)}${detalleSeguros}`;
  };

  // ─── Cargar desde localStorage (fallback) ─────────────────────────────────
  const leerDesdeLocalStorage = () => {
    try {
      const raw = localStorage.getItem('cliente_solicitudes_enviadas');
      const enviadas = raw ? JSON.parse(raw) : [];
      const idsSinFirmar = new Set((mockData['sin-firmar'] ?? []).map(s => String(s.id)));
      const idsAprobadas = new Set((mockData['aprobadas'] ?? []).map(s => String(s.id)));
      return enviadas
        .filter(item => {
          const id = String(item.id || item.id_simulacion || '');
          return id !== '' && !idsYaProcesados.has(id) && !idsSinFirmar.has(id) && !idsAprobadas.has(id);
        })
        .map(item => {
          const monto = Number(item.monto) || 0;
          const plazo = Number(item.cuotas) || 0;
          const tasaInteres = Number(item.tasa_interes_anual) || 12.5;
          const cuotaCalculada = calcularCuotaMensualEstimada(monto, plazo, tasaInteres);
          return {
            id: item.id || item.id_simulacion, cliente: item.rut, rutSesion: item.rut_sesion, monto, plazo, tasaInteres,
            cuotaMensual: Number(item.monto_cuota) || cuotaCalculada,
            totalPagar: Number(item.monto_total) || cuotaCalculada * plazo,
            incluye_seguro_desgravamen: Boolean(item.seguroDesgravamen || item.incluye_seguro_desgravamen),
            incluye_seguro_cesantia: Boolean(item.seguroCesantia || item.incluye_seguro_cesantia),
            score: calcularScore(monto, plazo)
          };
        });
    } catch(e) { return []; }
  };

  // ─── Cargar solicitudes para evaluación ───────────────────────────────────
  const cargarSolicitudesEvaluacion = async () => {
    let listaDatos = [];
    try {
      const response = await fetch(API_SOLICITUDES);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const datosAPI = Array.isArray(payload.data) ? payload.data : [];
      listaDatos = datosAPI
        .filter(item => {
          const idUnico = item.id_credito || item.id_solicitud || item.id || item.id_simulacion;
          return idUnico != null && !idsYaProcesados.has(String(idUnico));
        })
        .map(item => {
          const idUnico = item.id_credito || item.id_solicitud || item.id || item.id_simulacion;
          const monto = Number(item.monto) || 0;
          const plazo = Number(item.cuotas) || 0;
          const tasaInteres = Number(item.tasa_interes_anual) || 12.5;
          const cuotaCalculada = calcularCuotaMensualEstimada(monto, plazo, tasaInteres);
          return {
            id: idUnico, cliente: item.rut, rutSesion: item.rut_sesion, monto, plazo, tasaInteres,
            cuotaMensual: Number(item.monto_cuota) || cuotaCalculada,
            totalPagar: Number(item.monto_total) || cuotaCalculada * plazo,
            incluye_seguro_desgravamen: Boolean(item.incluye_seguro_desgravamen),
            incluye_seguro_cesantia: Boolean(item.incluye_seguro_cesantia),
            score: calcularScore(item.monto, item.cuotas)
          };
        });
    } catch (error) {
      console.warn('API no disponible, usando localStorage:', error.message);
    }
    const desdeLS = leerDesdeLocalStorage();
    const idsAPI = new Set(listaDatos.map(s => String(s.id)));
    mockData.evaluacion = [...listaDatos, ...desdeLS.filter(s => !idsAPI.has(String(s.id)))];
  };

  // ─── Renderizar tabla ─────────────────────────────────────────────────────
  const renderSolicitudes = (tab) => {
    const content = document.getElementById(`${tab}-content`);
    content.innerHTML = '';
    const solicitudes = mockData[tab] || [];
    if (solicitudes.length === 0) { content.innerHTML = '<p>No hay solicitudes para mostrar.</p>'; return; }

    const tabla = document.createElement('table');
    tabla.className = 'solicitudes-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>Cliente</th><th>Monto</th><th>Plazo</th><th>Tasa anual</th><th>Cuota mensual</th><th>Total a pagar</th><th>Qué conlleva</th><th>Puntaje</th><th>Acciones</th></tr>`;
    const tbody = document.createElement('tbody');

    solicitudes.forEach((solicitud) => {
      const fila = document.createElement('tr');
      const botones = tab === 'evaluacion'
        ? `<div class="actions"><button class="btn btn-primary" data-id="${solicitud.id}" data-action="aprobar">Aprobar</button><button class="btn btn-secondary" data-id="${solicitud.id}" data-action="rechazar">Rechazar</button></div>`
        : '<span class="table-muted">Sin acciones</span>';
      const puntaje = tab === 'evaluacion'
        ? `<div class="score-badge ${getScoreClass(solicitud.score)}">${solicitud.score}</div>`
        : '<span class="table-muted">-</span>';
      const cuotaMensual = Number(solicitud.cuotaMensual) || calcularCuotaMensualEstimada(solicitud.monto, solicitud.plazo, solicitud.tasaInteres);
      const totalPagar = Number(solicitud.totalPagar) || (cuotaMensual * (Number(solicitud.plazo) || 0));
      const tasaMensual = (Number(solicitud.tasaInteres) || 0) / 12;

      // Detect mismatch between session RUT and requested RUT
      const cleanSessionRut = (solicitud.rutSesion || '').replace(/[^0-9kK]/ig, '').toUpperCase();
      const cleanClientRut = (solicitud.cliente || '').replace(/[^0-9kK]/ig, '').toUpperCase();
      const isMismatch = cleanSessionRut && cleanClientRut && cleanSessionRut !== cleanClientRut;
      const alertaHtml = isMismatch
        ? `<br><span class="badge-fraude" style="background-color: #ffebeb; color: #d9534f; border: 1px solid #d9534f; border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: bold; display: inline-block; margin-top: 5px;">⚠️ Posible Fraude</span>`
        : '';

      fila.innerHTML = `
        <td data-label="Cliente">
          <strong>Solicitado:</strong> ${solicitud.cliente}<br>
          <strong>Sesión:</strong> ${solicitud.rutSesion || '—'}
          ${alertaHtml}
        </td>
        <td data-label="Monto">${formatearMoneda(solicitud.monto)}</td>
        <td data-label="Plazo">${Number(solicitud.plazo) || 0} meses</td>
        <td data-label="Tasa anual">${formatearTasa(solicitud.tasaInteres)} <span class="table-muted">(${formatearTasa(tasaMensual)} mensual aprox.)</span></td>
        <td data-label="Cuota mensual">${formatearMoneda(cuotaMensual)}</td>
        <td data-label="Total a pagar">${formatearMoneda(totalPagar)}</td>
        <td data-label="Qué conlleva">${obtenerConllevaSolicitud(solicitud)}</td>
        <td data-label="Puntaje">${puntaje}</td>
        <td data-label="Acciones">${botones}</td>
      `;
      tbody.appendChild(fila);
    });

    tabla.appendChild(thead);
    tabla.appendChild(tbody);
    content.appendChild(tabla);
  };

  // ─── Tabs ─────────────────────────────────────────────────────────────────
  const handleTabClick = async (tab) => {
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab=${tab}]`).classList.add('active');
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    if (tab === 'evaluacion') await cargarSolicitudesEvaluacion();
    if (tab === 'aprobadas') { const estadoFresh = cargarEstadoGuardado(); mockData.aprobadas = estadoFresh?.aprobadas ?? []; }
    renderSolicitudes(tab);
  };

  tabs.forEach(tab => { tab.addEventListener('click', async () => { await handleTabClick(tab.dataset.tab); }); });

  // ─── ACCIÓN: Aprobar / Rechazar ────────────────────────────────────────────
  document.addEventListener('click', async (e) => {
    if (!e.target.matches('[data-action="aprobar"]') && !e.target.matches('[data-action="rechazar"]')) return;

    const idStr  = String(e.target.dataset.id);
    const accion = e.target.dataset.action;
    const nuevoEstado = accion === 'aprobar' ? 'APROBADO' : 'RECHAZADO';

    // Deshabilitar botones mientras se procesa
    const fila = e.target.closest('tr');
    if (fila) fila.querySelectorAll('button').forEach(b => b.disabled = true);

    // 1. Llamar al backend primero
    let backendOk = false;
    try {
      const resp = await fetch(`${API_BASE}/solicitudes/${idStr}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      const data = await resp.json();
      if (resp.ok && data.ok) {
        backendOk = true;
      } else {
        console.error('Respuesta error del backend:', data);
        mostrarModalInfo(
            "Error de Servidor",
            `No se pudo ${accion} la solicitud: ${data.error || data.detalle || resp.status}`,
            false
        );
      }
    } catch (fetchErr) {
      console.error('No se pudo conectar al backend:', fetchErr);
      mostrarModalInfo(
          "Sin Conexión",
          "No se pudo conectar al backend. Verifica que el servidor esté corriendo en el puerto 8080.",
          false
      );
    }

    // 2. Si el backend respondió OK (o si es localStorage-only), actualizar UI
    if (backendOk) {
      const solicitud = mockData.evaluacion.find(s => String(s.id) === idStr);
      mockData.evaluacion = mockData.evaluacion.filter(s => String(s.id) !== idStr);
      idsYaProcesados.add(idStr);
      if (accion === 'aprobar' && solicitud) {
        mockData['sin-firmar'].push(solicitud);
      }
      guardarEstado();
      const activeTab = document.querySelector('.tab-button.active').dataset.tab;
      renderSolicitudes(activeTab);
    } else {
      // Rehabilitar botones si falló
      if (fila) fila.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  });

  // Cargar tab inicial
  handleTabClick('evaluacion');
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