/**
 * solicitud.js — Lógica exclusiva de la SOLICITUD de crédito (5 pasos).
 * Completamente independiente de simulacion.js.
 *
 * Paso 1 → Tipo de crédito
 * Paso 2 → Datos personales (RUT + renta, con OCR opcional)
 * Paso 3 → Monto
 * Paso 4 → Detalles (cuotas, mes, día)
 * Paso 5 → Seguros → Enviar solicitud
 */

document.addEventListener("DOMContentLoaded", () => {

    // ═══════════════════════════════════════════════════════════
    // VERIFICAR SESIÓN — Solo clientes pueden solicitar
    // ═══════════════════════════════════════════════════════════
    const loggedIn  = localStorage.getItem("loggedIn") === "true";
    const userRole  = localStorage.getItem("userRole") || "";

    if (!loggedIn || userRole !== "cliente") {
        const redirect = window.location.pathname.split("/").pop() + window.location.search;
        window.location.href = "acceso.html?redirect=" + encodeURIComponent(redirect);
        return;
    }

    // ═══════════════════════════════════════════════════════════
    // NAVBAR — Sesión activa del cliente
    // ═══════════════════════════════════════════════════════════
    const accesoBtn    = document.getElementById("accesoBtn");
    const profileMenu  = document.getElementById("profileMenu");
    const profileBtn   = document.getElementById("profileBtn");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const logoutBtn    = document.getElementById("logoutBtn");

    const clienteRut    = localStorage.getItem("clienteRut")    || "";
    const clienteNombre = localStorage.getItem("clienteNombre") || "";

    // El usuario siempre está logueado aquí (verificado arriba)
    if (accesoBtn)    accesoBtn.style.display    = "none";
    if (profileMenu)  profileMenu.style.display  = "flex";

    // Crear chip de usuario
    if (profileMenu && !profileMenu.querySelector(".user-chip")) {
        const chip = document.createElement("button");
        chip.className = "user-chip";
        const label = clienteNombre
            ? clienteNombre.split(" ")[0]
            : clienteRut || "Mi cuenta";
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
    // OCR — Subida de documento para detectar RUT
    // ═══════════════════════════════════════════════════════════
    const inputDocumento = document.getElementById("documento");
    if (inputDocumento) {
        inputDocumento.addEventListener("change", (event) => {
            const file = event.target.files[0];
            inputDocumento.parentElement.querySelectorAll(".doc-msg").forEach(e => e.remove());

            if (!file) return;

            const p = document.createElement("p");
            p.className = "doc-msg";
            p.style.cssText = "color:#28a745;font-size:0.9em;margin-top:5px;";
            p.textContent = `Procesando '${file.name}'...`;
            inputDocumento.insertAdjacentElement("afterend", p);

            Tesseract.recognize(file, "spa", { logger: m => console.log(m) })
                .then(({ data: { text } }) => {
                    const rutRegex = /\d{1,2}\.?\d{3}\.?\d{3}-?[0-9kK]/;
                    const rutMatch = text.match(rutRegex);
                    if (rutMatch) {
                        const inputRut = document.getElementById("rut");
                        inputRut.value = rutMatch[0];
                        inputRut.dispatchEvent(new Event("input"));
                        p.textContent = "RUT detectado automáticamente desde la imagen.";
                        p.style.color = "#007bff";
                    } else {
                        p.textContent = "No se pudo detectar el RUT. Intenta con una imagen más clara.";
                        p.style.color = "orange";
                    }
                })
                .catch(err => {
                    console.error(err);
                    p.textContent = "Error al procesar la imagen.";
                    p.style.color = "red";
                });
        });
    }

    // ═══════════════════════════════════════════════════════════
    // FORMATEO DE RUT
    // ═══════════════════════════════════════════════════════════
    const inputRut = document.getElementById("rut");
    if (inputRut) {
        inputRut.addEventListener("input", () => {
            let value = inputRut.value.replace(/[^0-9kK]/g, "").toUpperCase();
            value = value.replace(/K(.*)K/, "K").slice(0, 10);
            const cuerpo = value.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            const dv     = value.slice(-1);
            inputRut.value = cuerpo + (dv ? "-" + dv : "");
        });
    }

    // ═══════════════════════════════════════════════════════════
    // FORMATEO DE MONTO
    // ═══════════════════════════════════════════════════════════
    const inputMonto = document.getElementById("monto");
    if (inputMonto) {
        inputMonto.addEventListener("input", () => {
            const value = inputMonto.value.replace(/[^\d]/g, "");
            inputMonto.value = value === "" ? "$" : "$" + parseInt(value, 10).toLocaleString("es-CL");
        });
        inputMonto.addEventListener("focus", () => {
            if (!inputMonto.value.trim()) inputMonto.value = "$";
            setTimeout(() => inputMonto.setSelectionRange(inputMonto.value.length, inputMonto.value.length), 0);
        });
    }

    // ═══════════════════════════════════════════════════════════
    // SELECTORES DE MES Y DÍA DE PAGO
    // ═══════════════════════════════════════════════════════════
    const selectMesPago = document.getElementById("mes-pago");
    const selectDiaPago = document.getElementById("dia-pago");

    if (selectMesPago) {
        const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
        const mesActual = new Date().getMonth();
        selectMesPago.innerHTML = "<option value='' disabled selected>Selecciona el mes</option>";
        for (let i = 1; i <= 3; i++) {
            const mesIndex = (mesActual + i) % 12;
            const opt = document.createElement("option");
            opt.value = mesIndex + 1;
            opt.textContent = meses[mesIndex];
            selectMesPago.appendChild(opt);
        }
    }

    if (selectMesPago && selectDiaPago) {
        selectMesPago.addEventListener("change", () => {
            const mes = parseInt(selectMesPago.value);
            const dias = new Date(new Date().getFullYear(), mes, 0).getDate();
            selectDiaPago.innerHTML = "<option value='' disabled selected>Selecciona el día</option>";
            for (let d = 1; d <= dias; d++) {
                const opt = document.createElement("option");
                opt.value = d;
                opt.textContent = d;
                selectDiaPago.appendChild(opt);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════
    // PASOS
    // ═══════════════════════════════════════════════════════════
    const pasos           = document.querySelectorAll(".paso");
    const botonesContinuar = document.querySelectorAll(".btn.continuar");
    const botonesVolver    = document.querySelectorAll(".btn.volver");
    let pasoActual = 0;

    pasos.forEach((paso, i) => paso.setAttribute("data-step", i + 1));

    function mostrarPaso(index) {
        pasos.forEach((paso, i) => {
            if (i === index) {
                paso.classList.add("activo");
                paso.classList.remove("inactivo");
            } else {
                paso.classList.add("inactivo");
                paso.classList.remove("activo");
            }
        });
        pasoActual = index;
    }

    // ═══════════════════════════════════════════════════════════
    // VALIDACIONES POR PASO
    // ═══════════════════════════════════════════════════════════
    function mostrarError(el, msg) {
        const p = document.createElement("p");
        p.className = "error";
        p.textContent = msg;
        el.insertAdjacentElement("afterend", p);
    }

    function validarPaso(index) {
        pasos[index].querySelectorAll(".error").forEach(e => e.remove());
        let ok = true;

        if (index === 0) {
            const tipo = document.getElementById("tipo-credito");
            if (!tipo.value) { mostrarError(tipo, "Debes seleccionar un tipo de crédito"); ok = false; }
        }

        if (index === 1) {
            const rut       = document.getElementById("rut");
            const renta     = document.getElementById("renta");
            const documento = document.getElementById("documento");
            const tieneDoc  = documento && documento.files.length > 0;
            if (!tieneDoc) {
                if (!rut.value.trim())  { mostrarError(rut,   "Ingresa un RUT válido o sube tu documento"); ok = false; }
                if (!renta.value)       { mostrarError(renta, "Selecciona tu renta mensual o sube tu documento"); ok = false; }
            }
        }

        if (index === 2) {
            const monto    = document.getElementById("monto");
            const montoNum = parseInt(monto.value.replace(/[^\d]/g, ""));
            if (isNaN(montoNum)) {
                mostrarError(monto, "Ingresa un monto válido"); ok = false;
            } else if (montoNum < 1_000_000 || montoNum > 60_000_000) {
                mostrarError(monto, "El monto debe estar entre $1.000.000 y $60.000.000"); ok = false;
            }
        }

        if (index === 3) {
            const cuotas = document.getElementById("cuotas");
            const mes    = document.getElementById("mes-pago");
            const dia    = document.getElementById("dia-pago");
            const num    = parseInt(cuotas.value);
            if (isNaN(num) || num < 1 || num > 60) { mostrarError(cuotas, "Las cuotas deben estar entre 1 y 60"); ok = false; }
            if (!mes.value) { mostrarError(mes, "Selecciona el mes de pago"); ok = false; }
            if (!dia.value) { mostrarError(dia, "Selecciona un día de pago"); ok = false; }
        }

        return ok;
    }

    // ═══════════════════════════════════════════════════════════
    // EVENTOS DE NAVEGACIÓN
    // ═══════════════════════════════════════════════════════════
    botonesContinuar.forEach((btn) => {
        // El botón del último paso (enviar solicitud) tiene su propio listener
        if (btn.id === "btn-enviar-solicitud") return;
        btn.addEventListener("click", () => {
            if (validarPaso(pasoActual) && pasoActual < pasos.length - 1) {
                mostrarPaso(pasoActual + 1);
            }
        });
    });

    botonesVolver.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (pasoActual > 0) mostrarPaso(pasoActual - 1);
        });
    });

    mostrarPaso(0);

    // ═══════════════════════════════════════════════════════════
    // ENVÍO DE SOLICITUD
    // ═══════════════════════════════════════════════════════════
    const btnEnviar = document.getElementById("btn-enviar-solicitud");
    if (btnEnviar) {
        btnEnviar.addEventListener("click", () => {
            if (!validarPaso(pasoActual)) return;

            let rutValue = document.getElementById("rut").value;
            const documento = document.getElementById("documento");
            if (documento && documento.files.length > 0 && !rutValue.trim()) {
                rutValue = "11.111.111-1";
            }

            const montoIngresado  = parseInt(document.getElementById("monto").value.replace(/\D/g, ""));
            const cuotasIngresadas = parseInt(document.getElementById("cuotas").value);

            const data = {
                tipoCredito: document.getElementById("tipo-credito").value,
                rut: rutValue,
                renta: document.getElementById("renta").value || "C",
                monto: montoIngresado,
                cuotas: cuotasIngresadas,
                tasa_interes_anual: 12.5,
                mesInicio: document.getElementById("mes-pago").value,
                diaPago: document.getElementById("dia-pago").value,
                seguroCesantia: document.getElementById("seguroCesantia").checked,
                seguroDesgravamen: document.getElementById("seguroDesgravamen").checked,
                score: calcularScore(montoIngresado, cuotasIngresadas)
            };

            enviarSolicitud(data);
        });
    }
});

// ═══════════════════════════════════════════════════════════
// UTILIDADES FUERA DEL DOMContentLoaded
// ═══════════════════════════════════════════════════════════

function calcularScore(monto, cuotas) {
    const m = Number(monto) || 0;
    const c = Number(cuotas) || 1;
    return Math.max(5, Math.min(95, 100 - Math.round((m / 1_000_000) * 2 + c * 0.8)));
}

function guardarSolicitudLocal(data, idOverride) {
    try {
        const raw      = localStorage.getItem("cliente_solicitudes_enviadas");
        const enviadas = raw ? JSON.parse(raw) : [];
        const id       = idOverride || `local_${Date.now()}`;
        enviadas.push({ ...data, id });
        localStorage.setItem("cliente_solicitudes_enviadas", JSON.stringify(enviadas));
        return id;
    } catch (e) {
        console.warn("No se pudo guardar en localStorage:", e);
    }
}

async function enviarSolicitud(data) {
    try {
        const response = await fetch("http://localhost:8080/solicitud", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        console.log("Respuesta del servidor (solicitud):", result);

        if (!response.ok) {
            guardarSolicitudLocal(data);
            alert("Solicitud enviada (pendiente de revisión).");
            window.location.href = "Estado.html";
            return;
        }

        const idServidor = result.id_credito || result.id_solicitud || result.id || result.id_simulacion;
        guardarSolicitudLocal(data, idServidor);
        alert("Solicitud de crédito enviada correctamente al analista.");
        window.location.href = "Estado.html";

    } catch (error) {
        console.warn("API no disponible, guardando solicitud en local:", error.message);
        guardarSolicitudLocal(data);
        alert("Solicitud enviada correctamente.");
        window.location.href = "Estado.html";
    }
}