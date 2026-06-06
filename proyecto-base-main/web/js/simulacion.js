/**
 * simulacion.js — Lógica exclusiva del SIMULADOR de crédito (4 pasos).
 * Completamente independiente de solicitud.js.
 *
 * Paso 1 → Ingresos (renta mensual)
 * Paso 2 → Monto + Cuotas
 * Paso 3 → Seguros opcionales
 * Paso 4 → Resultado de la simulación (cuadro)
 */

document.addEventListener("DOMContentLoaded", () => {

    // ═══════════════════════════════════════════════════════════
    // SESIÓN — Navbar (igual que index.html)
    // ═══════════════════════════════════════════════════════════
    const accesoBtn   = document.getElementById("accesoBtn");
    const profileMenu = document.getElementById("profileMenu");
    const profileBtn  = document.getElementById("profileBtn");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const logoutBtn   = document.getElementById("logoutBtn");

    const loggedIn      = localStorage.getItem("loggedIn") === "true";
    const clienteRut    = localStorage.getItem("clienteRut")    || "";
    const clienteNombre = localStorage.getItem("clienteNombre") || "";

    if (accesoBtn) {
        if (loggedIn) {
            accesoBtn.style.display = "none";
            if (profileMenu) {
                profileMenu.style.display = "flex";

                if (!profileMenu.querySelector(".user-chip")) {
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
    // PASOS
    // ═══════════════════════════════════════════════════════════
    const pasos = document.querySelectorAll(".paso");
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
    // FORMATEO DEL MONTO
    // ═══════════════════════════════════════════════════════════
    const inputMonto = document.getElementById("monto");
    if (inputMonto) {
        inputMonto.addEventListener("input", () => {
            let value = inputMonto.value.replace(/[^\d]/g, "");
            if (value === "") { inputMonto.value = "$"; return; }
            inputMonto.value = "$" + parseInt(value, 10).toLocaleString("es-CL");
        });
        inputMonto.addEventListener("focus", () => {
            if (!inputMonto.value.trim()) inputMonto.value = "$";
            setTimeout(() => inputMonto.setSelectionRange(inputMonto.value.length, inputMonto.value.length), 0);
        });
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

    function limpiarErrores(pasoEl) {
        pasoEl.querySelectorAll(".error").forEach(e => e.remove());
    }

    function validarPaso(index) {
        limpiarErrores(pasos[index]);
        let ok = true;

        if (index === 0) {
            // Paso 1: Renta
            const renta = document.getElementById("renta");
            if (!renta.value) {
                mostrarError(renta, "Selecciona tu renta mensual");
                ok = false;
            }
        }

        if (index === 1) {
            // Paso 2: Monto + Cuotas
            const monto  = document.getElementById("monto");
            const cuotas = document.getElementById("cuotas");

            const montoNum = parseInt(monto.value.replace(/[^\d]/g, ""));
            if (isNaN(montoNum)) {
                mostrarError(monto, "Ingresa un monto válido");
                ok = false;
            } else if (montoNum < 1_000_000 || montoNum > 60_000_000) {
                mostrarError(monto, "El monto debe estar entre $1.000.000 y $60.000.000");
                ok = false;
            }

            const numCuotas = parseInt(cuotas.value);
            if (isNaN(numCuotas) || numCuotas < 1 || numCuotas > 60) {
                mostrarError(cuotas, "Las cuotas deben estar entre 1 y 60");
                ok = false;
            }
        }

        // Paso 3 (seguros) no requiere validación, es todo opcional
        return ok;
    }

    // ═══════════════════════════════════════════════════════════
    // NAVEGACIÓN
    // ═══════════════════════════════════════════════════════════
    document.getElementById("btn-continuar-1").addEventListener("click", () => {
        if (validarPaso(0)) mostrarPaso(1);
    });

    document.getElementById("btn-volver-2").addEventListener("click",   () => mostrarPaso(0));
    document.getElementById("btn-continuar-2").addEventListener("click", () => {
        if (validarPaso(1)) mostrarPaso(2);
    });

    document.getElementById("btn-volver-3").addEventListener("click", () => mostrarPaso(1));

    document.getElementById("btn-ver-simulacion").addEventListener("click", () => {
        if (!validarPaso(2)) return; // seguros siempre válidos; esto es por si acaso
        ejecutarSimulacion();
    });

    document.getElementById("btn-volver-4").addEventListener("click", () => mostrarPaso(2));

    // Botón "Solicitar Crédito" desde el resultado de simulación
    document.getElementById("btn-solicitar-credito").addEventListener("click", () => {
        if (loggedIn) {
            window.location.href = "solicitud.html";
        } else {
            window.location.href = "acceso.html?redirect=solicitud.html";
        }
    });

    mostrarPaso(0);

    // ═══════════════════════════════════════════════════════════
    // CÁLCULO Y ENVÍO DE SIMULACIÓN
    // ═══════════════════════════════════════════════════════════
    function calcularScore(monto, cuotas) {
        const m = Number(monto) || 0;
        const c = Number(cuotas) || 1;
        return Math.max(5, Math.min(95, 100 - Math.round((m / 1_000_000) * 2 + c * 0.8)));
    }

    function calcularResumenLocal(data) {
        const monto      = Number(data.monto)  || 0;
        const cuotas     = Number(data.cuotas) || 1;
        const tasaAnual  = Number(data.tasa_interes_anual) || 12.5;
        const tasaMensual = tasaAnual / 12 / 100;
        const monto_cuota = tasaMensual > 0
            ? Math.round((monto * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -cuotas)))
            : Math.round(monto / cuotas);
        const monto_total = Math.round(monto_cuota * cuotas);
        return { ...data, monto_cuota, monto_total };
    }

    function mostrarResumen(data) {
        const scoreCalculado = data.score || calcularScore(data.monto, data.cuotas);

        // Seguros activos
        const seguros = [];
        if (data.seguroCesantia)    seguros.push("Seguro de Cesantía");
        if (data.seguroDesgravamen) seguros.push("Seguro de Desgravamen");
        const segurosTexto = seguros.length ? seguros.join(", ") : "Sin seguros adicionales";

        document.getElementById("resumen-simulacion").innerHTML = `
            <table class="tabla-resumen">
                <tbody>
                    <tr><th>Monto solicitado</th>   <td>$${Number(data.monto).toLocaleString("es-CL")}</td></tr>
                    <tr><th>Número de cuotas</th>   <td>${data.cuotas}</td></tr>
                    <tr><th>Tasa de interés anual</th><td>${data.tasa_interes_anual}%</td></tr>
                    <tr><th>Valor de cada cuota</th> <td>$${Number(data.monto_cuota || 0).toLocaleString("es-CL")}</td></tr>
                    <tr><th>Monto total a pagar</th> <td>$${Number(data.monto_total || 0).toLocaleString("es-CL")}</td></tr>
                    <tr><th>Seguros</th>             <td>${segurosTexto}</td></tr>
                    <tr><th>Probabilidad de aprobación</th>
                        <td><strong style="color:#2B4C7E;">${scoreCalculado}%</strong></td></tr>
                </tbody>
            </table>
        `;

        mostrarPaso(3);
    }

    async function ejecutarSimulacion() {
        const monto  = parseInt(document.getElementById("monto").value.replace(/[^\d]/g, ""));
        const cuotas = parseInt(document.getElementById("cuotas").value);
        const renta  = document.getElementById("renta").value;
        const seguroCesantia    = document.getElementById("seguroCesantia").checked;
        const seguroDesgravamen = document.getElementById("seguroDesgravamen").checked;

        const data = {
            tipoCredito: "consumo",
            rut: "00.000.000-0",   // simulación: no requiere RUT real
            renta,
            monto,
            cuotas,
            tasa_interes_anual: 12.5,
            seguroCesantia,
            seguroDesgravamen,
            score: calcularScore(monto, cuotas)
        };

        try {
            const response = await fetch("http://localhost:8080/simulacion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (!response.ok) {
                console.warn("API respondió con error, usando cálculo local.");
                mostrarResumen(calcularResumenLocal(data));
                return;
            }

            // Intentar obtener el detalle por ID si la API lo devuelve
            const id = result.id_simulacion;
            if (id) {
                try {
                    const detResp = await fetch(`http://localhost:8080/simulacion/${id}`);
                    const detalle = await detResp.json();
                    if (detalle.ok) { mostrarResumen(detalle.data); return; }
                } catch (_) { /* si falla, usamos el result directo */ }
            }

            // Usar lo que devolvió la API directamente
            mostrarResumen({ ...data, ...result });

        } catch (error) {
            console.warn("API no disponible, mostrando resumen local:", error.message);
            mostrarResumen(calcularResumenLocal(data));
        }
    }
});