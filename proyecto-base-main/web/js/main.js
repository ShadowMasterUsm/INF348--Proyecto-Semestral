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
      // Usuario con sesión → puede solicitar
      window.location.href = "simulacion.html?mode=solicitar";
    } else {
      // Usuario sin sesión → enviarlo a iniciar sesión
      window.location.href = "acceso.html";
    }
  });
}

// ========= SESIÓN EN INDEX.HTML =========

document.addEventListener("DOMContentLoaded", () => {
    const accesoBtn = document.getElementById("accesoBtn");
    const profileMenu = document.getElementById("profileMenu");
    const profileBtn = document.getElementById("profileBtn");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const logoutBtn = document.getElementById("logoutBtn");

    // Si estamos en una página que NO tiene estos elementos, no seguir
    if (accesoBtn) {
        // Si hay sesión
        if (localStorage.getItem("loggedIn") === "true") {
            accesoBtn.style.display = "none";
            profileMenu.style.display = "flex";
        } else {
            accesoBtn.style.display = "block";
            profileMenu.style.display = "none";
        }
    }

    // Abrir menú del icono
    if (profileBtn) {
        profileBtn.addEventListener("click", () => {
            dropdownMenu.classList.toggle("show");
        });
    }

    // Cerrar sesión
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("loggedIn");
            window.location.href = "index.html";
        });
    }

    // ========= BOTONES DE acceso.html =========

    const clienteBtn = document.getElementById("clienteBtn");
    const analistaBtn = document.getElementById("analistaBtn");

    if (clienteBtn) {
        clienteBtn.addEventListener("click", () => {
            localStorage.setItem("loggedIn", "true");
            window.location.href = "index.html";
        });
    }

    // Botón "Estados de solicitud" en el dropdown del perfil
    const estUSU = document.getElementById("estUSU");
    if (estUSU) {
        estUSU.addEventListener("click", () => {
            window.location.href = "Estado.html";
        });
    }

    if (analistaBtn) {
        analistaBtn.addEventListener("click", () => {
            window.location.href = "analista_riesgo.html";
        });
    }

    const pagosbtn = document.getElementById("pagosbtn");
    if (pagosbtn) {
        pagosbtn.addEventListener("click", () => {
            window.location.href = "pagos.html";
        });
    }
});