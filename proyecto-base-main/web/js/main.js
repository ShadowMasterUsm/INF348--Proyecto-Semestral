// --- Interacciones principales ---
const btnSimular = document.querySelector('.btn-outline');
const btnSolicitar = document.querySelector('.btn-primary');

if (btnSimular) {
  btnSimular.addEventListener('click', () => {
    window.location.href = "simulacion.html?mode=simular";
  });
}

if (btnSolicitar) {
  btnSolicitar.addEventListener('click', () => {
    if (localStorage.getItem("loggedIn") === "true") {
      window.location.href = "simulacion.html?mode=solicitar";
    } else {
      window.location.href = "acceso.html?redirect=" + encodeURIComponent("simulacion.html?mode=solicitar");
    }
  });
}

// ========= SESIÓN =========

document.addEventListener("DOMContentLoaded", () => {
    const accesoBtn   = document.getElementById("accesoBtn");
    const profileMenu = document.getElementById("profileMenu");
    const profileBtn  = document.getElementById("profileBtn");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const logoutBtn   = document.getElementById("logoutBtn");

    const loggedIn  = localStorage.getItem("loggedIn") === "true";
    const userRole  = localStorage.getItem("userRole") || "cliente";
    const clienteRut = localStorage.getItem("clienteRut") || "";

    // Mostrar RUT del cliente en la imagen de perfil como tooltip / aria-label
    if (loggedIn && profileBtn && clienteRut) {
        profileBtn.title = `RUT: ${clienteRut}`;
    }

    if (accesoBtn) {
        if (loggedIn) {
            accesoBtn.style.display = "none";
            if (profileMenu) profileMenu.style.display = "flex";
        } else {
            accesoBtn.style.display = "block";
            if (profileMenu) profileMenu.style.display = "none";
        }
    }

    // Abrir/cerrar menú del icono de perfil
    if (profileBtn) {
        profileBtn.addEventListener("click", () => {
            dropdownMenu.classList.toggle("show");
        });
        // Cerrar al hacer click fuera
        document.addEventListener("click", (e) => {
            if (!profileBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove("show");
            }
        });
    }

    // Cerrar sesión — limpiar TODO
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("loggedIn");
            localStorage.removeItem("userRole");
            localStorage.removeItem("clienteRut");
            window.location.href = "index.html";
        });
    }

    // Botón "Estados de solicitud"
    const estUSU = document.getElementById("estUSU");
    if (estUSU) {
        estUSU.addEventListener("click", () => {
            window.location.href = "Estado.html";
        });
    }

    // Botón "Pagos cuotas"
    const pagosbtn = document.getElementById("pagosbtn");
    if (pagosbtn) {
        pagosbtn.addEventListener("click", () => {
            window.location.href = "pagos.html";
        });
    }

    // ── Botones de acceso.html (por si acaso se usa main.js allí) ──
    const clienteBtn  = document.getElementById("clienteBtn");
    const analistaBtn = document.getElementById("analistaBtn");

    if (clienteBtn && !clienteBtn.dataset.bound) {
        clienteBtn.dataset.bound = "1";
        // acceso.html maneja esto internamente
    }
    if (analistaBtn && !analistaBtn.dataset.bound) {
        analistaBtn.dataset.bound = "1";
    }
});