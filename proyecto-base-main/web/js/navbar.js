// Menú hamburguesa
const burger = document.querySelector('.burger');
const nav = document.querySelector('.nav-links');
if (burger && nav) {
  burger.addEventListener('click', () => {
    const open = nav.getAttribute('data-open') === 'true';
    nav.setAttribute('data-open', String(!open));
    burger.setAttribute('aria-expanded', String(!open));
  });
}

// Botón que prueba la API
const pingBtn = document.getElementById('ping');
const out = document.getElementById('out');
if (pingBtn && out) {
  pingBtn.addEventListener('click', async () => {
    out.textContent = 'Consultando /api/createTable ...';
    try {
      const r = await fetch('/api/createTable');
      const t = await r.text();
      out.textContent = t;
    } catch (e) {
      out.textContent = 'Error: ' + e?.message;
    }
  });
}
