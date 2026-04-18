document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const API_SIMULACIONES = 'http://localhost:8080/simulacion';

  // datos estaticos, luego hay que reemplazar con llamadas a la API pero es para probar
  const mockData = {
    evaluacion: [],
    aprobadas: [
      { id: 3, cliente: 'Carlos Sanchez', monto: 15000000, plazo: 36 },
    ],
    'sin-firmar': [
      { id: 4, cliente: 'Ana Gomez', monto: 2000000, plazo: 6 },
    ],
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

  const cargarSolicitudesEvaluacion = async () => {
    try {
      const response = await fetch(API_SIMULACIONES);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const simulaciones = Array.isArray(payload.data) ? payload.data : [];

      mockData.evaluacion = simulaciones.map((simulacion) => ({
        id: simulacion.id_simulacion,
        cliente: simulacion.rut,
        monto: Number(simulacion.monto) || 0,
        plazo: Number(simulacion.cuotas) || 0,
        score: calcularScore(simulacion.monto, simulacion.cuotas)
      }));
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

    solicitudes.forEach(solicitud => {
      const solicitudDiv = document.createElement('div');
      solicitudDiv.classList.add('solicitud');

      let buttons = '';
      let scoreBadge = '';
      if (tab === 'evaluacion') {
        buttons = `
          <div class="actions">
            <button class="btn btn-primary" data-id="${solicitud.id}" data-action="aprobar">Aprobar</button>
            <button class="btn btn-secondary" data-id="${solicitud.id}" data-action="rechazar">Rechazar</button>
          </div>
        `;
        scoreBadge = `
          <div class="score">
            <strong>Puntaje de Riesgo</strong>
            <div class="score-badge ${getScoreClass(solicitud.score)}">${solicitud.score}</div>
          </div>
        `;
      }

      solicitudDiv.innerHTML = `
        <div class="solicitud-info">
          <p><strong>Cliente:</strong> ${solicitud.cliente}</p>
          <p><strong>Monto:</strong> $${solicitud.monto.toLocaleString('es-CL')}</p>
          <p><strong>Plazo:</strong> ${solicitud.plazo} meses</p>
        </div>
        <div class="solicitud-details">
          ${scoreBadge}
          ${buttons}
        </div>
      `;
      content.appendChild(solicitudDiv);
    });
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
      const id = e.target.dataset.id;

      // Simulación: Eliminar la solicitud de la lista de evaluación
      mockData.evaluacion = mockData.evaluacion.filter(s => s.id !== parseInt(id));

      // Volver a renderizar la pestaña actual para que se vea el cambio
      const activeTab = document.querySelector('.tab-button.active').dataset.tab;
      renderSolicitudes(activeTab);
    }
  });

  // Cargar la pestaña inicial
  handleTabClick('evaluacion');
});
