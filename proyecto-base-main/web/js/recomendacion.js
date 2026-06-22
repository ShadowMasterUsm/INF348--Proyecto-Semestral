/**
 * recomendacion.js — Página de recomendaciones personalizadas de crédito.
 *
 * Flujo:
 *   1. El cliente selecciona su renta mensual (no requiere estar logueado).
 *   2. Se consulta GET /recomendaciones?renta=...&rut=... (rut opcional,
 *      se toma de localStorage.clienteRut si hay sesión activa, para que
 *      el historial crediticio del cliente ajuste el score y la tasa).
 *   3. Se renderiza una tarjeta por cada plazo evaluado (12-60 meses), cada
 *      una con un RANGO de monto recomendado y su probabilidad de
 *      aprobación. No se muestra "tipo de crédito": la recomendación es
 *      puramente de cuánto dinero pedir y en cuántas cuotas.
 *   4. "Solicitar este crédito" navega a solicitud.html con monto y cuotas
 *      precargados vía querystring (?renta=&monto=&cuotas=); el tipo de
 *      crédito se sigue eligiendo en el propio formulario de solicitud.
 */

const API_BASE = 'http://localhost:8080';

// ─── Sesión — navbar (mismo patrón que el resto del sitio) ───────────────────
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
                if (!profileMenu.querySelector(".user-chip")) {
                    const chip = document.createElement("button");
                    chip.className = "user-chip";
                    const label = clienteNombre ? clienteNombre.split(" ")[0] : clienteRut || "Mi cuenta";
                    chip.innerHTML = `<span class="user-chip-icon">👤</span><span class="user-chip-label">${label}</span><span class="user-chip-arrow">▾</span>`;
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

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("loggedIn");
            localStorage.removeItem("userRole");
            localStorage.removeItem("clienteRut");
            localStorage.removeItem("clienteNombre");
            window.location.href = "index.html";
        });
    }
    const estUSU = document.getElementById("estUSU");
    if (estUSU) estUSU.addEventListener("click", () => { window.location.href = "Estado.html"; });
    const pagosbtn = document.getElementById("pagosbtn");
    if (pagosbtn) pagosbtn.addEventListener("click", () => { window.location.href = "pagos.html"; });

    // ═══════════════════════════════════════════════════════════
    // LÓGICA DE RECOMENDACIONES
    // ═══════════════════════════════════════════════════════════
    const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

    const claseScore = (score) => {
        if (score >= 65) return 'score-alto';
        if (score >= 40) return 'score-medio';
        return 'score-bajo';
    };

    const rentaSelect   = document.getElementById('renta-select');
    const btnVer        = document.getElementById('btnVerRecomendaciones');
    const rentaError     = document.getElementById('rentaError');
    const loadingEl      = document.getElementById('recoLoading');
    const errorEstadoEl  = document.getElementById('recoErrorEstado');
    const resultadosEl   = document.getElementById('recoResultados');
    const cardsEl        = document.getElementById('recoCards');
    const capacidadTexto = document.getElementById('recoCapacidadTexto');

    function ocultarTodosLosEstados() {
        loadingEl.hidden = true;
        errorEstadoEl.hidden = true;
        resultadosEl.hidden = true;
    }

    function renderCards(data) {
        const recomendaciones = data.recomendaciones || [];
        capacidadTexto.textContent = `Con tu renta, podrías destinar hasta ${fmt(data.capacidadPagoMensual)} al mes en cuotas, manteniendo un presupuesto sano.`;

        // La tarjeta destacada es la de mejor score (mayor probabilidad de aprobación).
        const mejorScore = Math.max(...recomendaciones.map(r => r.scoreElegibilidad));

        cardsEl.innerHTML = recomendaciones.map((r) => {
            const esDestacada = r.scoreElegibilidad === mejorScore;
            // Al solicitar, precargamos el monto máximo del rango y el plazo:
            // es la combinación que mantiene la probabilidad de aprobación
            // en el umbral recomendado. El tipo de crédito se elige después,
            // en el propio formulario de solicitud.
            const params = new URLSearchParams({
                renta: data.renta,
                monto: r.montoMaximoRecomendado,
                cuotas: r.plazoSugerido
            });

            return `
                <div class="reco-card ${esDestacada ? 'destacada' : ''}">
                    ${esDestacada ? '<span class="reco-card-badge">Mejor opción para ti</span>' : ''}
                    <span class="reco-card-icon">📅</span>
                    <h3>${r.plazoSugerido} cuotas</h3>

                    <div class="reco-card-titular">
                        <span class="reco-card-titular-label">Te recomendamos estos créditos entre</span>
                        <span class="reco-card-titular-monto">${fmt(r.montoMinimoRecomendado)} y ${fmt(r.montoMaximoRecomendado)}</span>
                        <span class="reco-card-titular-plazo">en ${r.plazoSugerido} cuotas</span>
                    </div>

                    <div class="reco-card-score">
                        <span class="reco-card-score-label">Probabilidad de aprobación</span>
                        <span class="reco-card-score-valor ${claseScore(r.scoreElegibilidad)}">${r.scoreElegibilidad}%</span>
                    </div>

                    <ul class="reco-card-specs">
                        <li><span>Tasa anual</span><span>${r.tasaInteresAnual}%</span></li>
                        <li><span>Cuota mensual aprox.</span><span>${fmt(r.cuotaEnMontoMaximo)}</span></li>
                    </ul>
                    <a class="reco-card-btn" href="solicitud.html?${params.toString()}">Solicitar este crédito</a>
                </div>
            `;
        }).join('');

        ocultarTodosLosEstados();
        resultadosEl.hidden = false;
    }

    async function obtenerRecomendaciones(renta) {
        ocultarTodosLosEstados();
        loadingEl.hidden = false;
        btnVer.disabled = true;

        const params = new URLSearchParams({ renta });
        const rutSesion = localStorage.getItem('clienteRut');
        if (rutSesion) params.set('rut', rutSesion);

        try {
            const resp = await fetch(`${API_BASE}/recomendaciones?${params.toString()}`);
            const data = await resp.json();
            if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
            renderCards(data);
        } catch (error) {
            console.warn('No se pudieron obtener recomendaciones:', error.message);
            ocultarTodosLosEstados();
            const detalle = errorEstadoEl.querySelector('.reco-error-detalle');
            if (detalle) detalle.textContent = error.message;
            errorEstadoEl.hidden = false;
        } finally {
            btnVer.disabled = false;
        }
    }

    if (btnVer) {
        btnVer.addEventListener('click', () => {
            const renta = rentaSelect.value;
            if (!renta) {
                rentaError.hidden = false;
                return;
            }
            rentaError.hidden = true;
            obtenerRecomendaciones(renta);
        });
    }
});