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
    const accesoBtn    = document.getElementById("accesoBtn");
    const profileMenu  = document.getElementById("profileMenu");
    const profileBtn   = document.getElementById("profileBtn");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const logoutBtn    = document.getElementById("logoutBtn");

    const loggedIn   = localStorage.getItem("loggedIn") === "true";
    const clienteRut = localStorage.getItem("clienteRut") || "";
    const clienteNombre = localStorage.getItem("clienteNombre") || "";

    if (accesoBtn) {
        if (loggedIn) {
            accesoBtn.style.display = "none";
            if (profileMenu) {
                profileMenu.style.display = "flex";

                // Crear chip de usuario si no existe
                if (!profileMenu.querySelector(".user-chip")) {
                    const chip = document.createElement("button");
                    chip.className = "user-chip";
                    // Mostrar nombre si existe, si no el RUT
                    const label = clienteNombre
                        ? clienteNombre.split(" ")[0]   // solo primer nombre
                        : clienteRut || "Mi cuenta";
                    chip.innerHTML = `<span class="user-chip-icon">👤</span><span class="user-chip-label">${label}</span><span class="user-chip-arrow">▾</span>`;

                    // Ocultar foto de perfil y poner el chip antes del dropdown
                    if (profileBtn) profileBtn.style.display = "none";
                    profileMenu.insertBefore(chip, dropdownMenu);

                    chip.addEventListener("click", (e) => {
                        e.stopPropagation();
                        dropdownMenu.classList.toggle("show");
                    });

                    document.addEventListener("click", (e) => {
                        if (!chip.contains(e.target) && dropdownMenu && !dropdownMenu.contains(e.target)) {
                            dropdownMenu.classList.remove("show");
                        }
                    });
                }
            }
        } else {
            accesoBtn.style.display = "block";
            if (profileMenu) profileMenu.style.display = "none";
        }
    }

    // Cerrar sesión
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("loggedIn");
            localStorage.removeItem("userRole");
            localStorage.removeItem("clienteRut");
            localStorage.removeItem("clienteNombre");
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
});