document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  // Nota: Si en tu API creaste una nueva ruta para leer créditos, actualiza esto (ej. '/creditos')
  const API_SOLICITUDES = 'http://localhost:8080/solicitudes';

  // ─── Persistencia ─────────────────────────────────────────────────────────────
  const STORAGE_KEY = 'analista_riesgo_estado';

  const cargarEstadoGuardado = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const guardarEstado = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        'sin-firmar': mockData['sin-firmar'],
        procesados: mockData['sin-firmar'].map(s => s.id),
      }));
    } catch (e) { console.warn('No se pudo guardar el estado:', e); }
  };

  const estadoGuardado = cargarEstadoGuardado();
  const idsYaProcesados = new Set((estadoGuardado?.procesados ?? []).map(String));

  // datos estaticos, luego hay que reemplazar con llamadas a la API pero es para probar
  const mockData = {
    evaluacion: [],
    aprobadas: [],
    'sin-firmar': estadoGuardado?.['sin-firmar'] ?? [],
  };

  const getScoreClass = (score) => {
    if (score > 70) return 'score-high';
    if (score > 50) return 'score-medium';
    return 'score-low';
  };

  const calcularScore = (monto, cuotas) => {
    const montoNum = Number(monto) || 0;
    const cuotasNum = Number(cuotas) || 1;
    const scoreBruto = 100 - Math.round((montoNum / 1000000) * 2 + cuotasNum * 0.8);
    return Math.max(5, Math.min(95, scoreBruto));
  };

  const formatearMoneda = (valor) => `$${Number(valor || 0).toLocaleString('es-CL')}`;

  const formatearTasa = (valor) => `${Number(valor || 0).toFixed(1)}%`;

  const calcularCuotaMensualEstimada = (monto, plazo, tasaInteresAnual) => {
    const principal = Number(monto) || 0;
    const meses = Number(plazo) || 0;
    const tasaAnual = Number(tasaInteresAnual) || 0;

    if (meses <= 0) return 0;

    const tasaMensual = tasaAnual / 12 / 100;
    if (tasaMensual <= 0) {
      return principal / meses;
    }

    return (principal * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -meses));
  };

  const obtenerConllevaSolicitud = (solicitud) => {
    const seguros = [];

    if (solicitud.incluye_seguro_desgravamen) {
      seguros.push('desgravamen');
    }

    if (solicitud.incluye_seguro_cesantia) {
      seguros.push('cesantía');
    }

    const detalleSeguros = seguros.length > 0 ? `, seguros ${seguros.join(' y ')}` : '';

    return `Monto ${formatearMoneda(solicitud.monto)}, plazo ${Number(solicitud.plazo) || 0} meses, tasa ${formatearTasa(solicitud.tasaInteres)}${detalleSeguros}`;
  };

  const cargarSolicitudesEvaluacion = async () => {
    try {
      const response = await fetch(API_SOLICITUDES);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const listaDatos = Array.isArray(payload.data) ? payload.data : [];

      mockData.evaluacion = listaDatos
        .filter((item) => {
          const idUnico = item.id_credito || item.id_solicitud || item.id || item.id_simulacion;
          return idUnico != null && !idsYaProcesados.has(String(idUnico));
        })
        .map((item) => {
          const idUnico = item.id_credito || item.id_solicitud || item.id || item.id_simulacion;
          const monto = Number(item.monto) || 0;
          const plazo = Number(item.cuotas) || 0;
          const tasaInteres = Number(item.tasa_interes_anual) || 12.5;
          const cuotaCalculada = calcularCuotaMensualEstimada(monto, plazo, tasaInteres);

          return {
            id: idUnico,
            cliente: item.rut,
            monto,
            plazo,
            tasaInteres,
            cuotaMensual: Number(item.monto_cuota) || cuotaCalculada,
            totalPagar: Number(item.monto_total) || cuotaCalculada * plazo,
            incluye_seguro_desgravamen: Boolean(item.incluye_seguro_desgravamen),
            incluye_seguro_cesantia: Boolean(item.incluye_seguro_cesantia),
            score: calcularScore(item.monto, item.cuotas)
          };
        });
    } catch (error) {
      console.error('Error al cargar simulaciones para evaluación:', error);
      mockData.evaluacion = [];
    }
  };

  const renderSolicitudes = (tab) => {
    const content = document.getElementById(`${tab}-content`);
    content.innerHTML = '';
    const solicitudes = mockData[tab] || [];

    if (solicitudes.length === 0) {
      content.innerHTML = '<p>No hay solicitudes para mostrar.</p>';
      return;
    }

    const tabla = document.createElement('table');
    tabla.className = 'solicitudes-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>Cliente</th>
        <th>Monto</th>
        <th>Plazo</th>
        <th>Tasa anual</th>
        <th>Cuota mensual</th>
        <th>Total a pagar</th>
        <th>Qué conlleva</th>
        <th>Puntaje</th>
        <th>Acciones</th>
      </tr>
    `;

    const tbody = document.createElement('tbody');

    solicitudes.forEach((solicitud) => {
      const fila = document.createElement('tr');

      const botones = tab === 'evaluacion'
        ? `
          <div class="actions">
            <button class="btn btn-primary" data-id="${solicitud.id}" data-action="aprobar">Aprobar</button>
            <button class="btn btn-secondary" data-id="${solicitud.id}" data-action="rechazar">Rechazar</button>
          </div>
        `
        : '<span class="table-muted">Sin acciones</span>';

      const puntaje = tab === 'evaluacion'
        ? `<div class="score-badge ${getScoreClass(solicitud.score)}">${solicitud.score}</div>`
        : '<span class="table-muted">-</span>';

      const cuotaMensual = Number(solicitud.cuotaMensual)
        || calcularCuotaMensualEstimada(solicitud.monto, solicitud.plazo, solicitud.tasaInteres);
      const totalPagar = Number(solicitud.totalPagar) || (cuotaMensual * (Number(solicitud.plazo) || 0));
      const tasaMensual = (Number(solicitud.tasaInteres) || 0) / 12;

      fila.innerHTML = `
        <td data-label="Cliente">${solicitud.cliente}</td>
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

  const handleTabClick = async (tab) => {
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab=${tab}]`).classList.add('active');

    tabContents.forEach(content => {
      content.classList.remove('active');
    });

    document.getElementById(tab).classList.add('active');

    if (tab === 'evaluacion') {
      await cargarSolicitudesEvaluacion();
    }

    renderSolicitudes(tab);
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      await handleTabClick(tab.dataset.tab);
    });
  });

  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-action="aprobar"]') || e.target.matches('[data-action="rechazar"]')) {
      const id = parseInt(e.target.dataset.id);
      const accion = e.target.dataset.action;

      // Buscar la solicitud antes de eliminarla
      const solicitud = mockData.evaluacion.find(s => s.id === id);

      // Eliminar la solicitud de la lista de evaluación
      mockData.evaluacion = mockData.evaluacion.filter(s => s.id !== id);

      // Si se aprueba, mover a sin-firmar y persistir
      if (accion === 'aprobar' && solicitud) {
        mockData['sin-firmar'].push(solicitud);
        idsYaProcesados.add(String(id));
        guardarEstado();
      }

      // Volver a renderizar la pestaña actual para que se vea el cambio
      const activeTab = document.querySelector('.tab-button.active').dataset.tab;
      renderSolicitudes(activeTab);
    }
  });

  // Cargar la pestaña inicial
  handleTabClick('evaluacion');
});