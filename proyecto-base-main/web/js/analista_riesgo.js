document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // datos estaticos, luego hay que reemplazar con llamadas a la API pero es para probar
  const mockData = {
    evaluacion: [
      { id: 1, cliente: 'Juan Perez', monto: 1000000, plazo: 24, score: 55 },
      { id: 2, cliente: 'Maria Lopez', monto: 5000000, plazo: 12, score: 40 },
      { id: 5, cliente: 'Pedro Rodriguez', monto: 30000000, plazo: 48, score: 95 },
    ],
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

  const handleTabClick = (tab) => {
    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab=${tab}]`).classList.add('active');

    tabContents.forEach(content => {
      content.classList.remove('active');
    });

    document.getElementById(tab).classList.add('active');
    renderSolicitudes(tab);
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      handleTabClick(tab.dataset.tab);
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
