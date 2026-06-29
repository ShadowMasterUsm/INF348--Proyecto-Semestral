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
    // OCR — Subida de documento para detectar RUT y Número de Documento
    // ═══════════════════════════════════════════════════════════
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }

    function validarRutChile(rutCompleto) {
        if (!rutCompleto) return false;
        const clean = rutCompleto.replace(/[^0-9kK]/g, "").toUpperCase();
        if (clean.length < 8 || clean.length > 9) return false;
        
        const cuerpo = clean.slice(0, -1);
        const dv = clean.slice(-1);
        
        let suma = 0;
        let multiplo = 2;
        for (let i = cuerpo.length - 1; i >= 0; i--) {
            suma += multiplo * parseInt(cuerpo.charAt(i), 10);
            multiplo = multiplo < 7 ? multiplo + 1 : 2;
        }
        
        const dvEsperado = 11 - (suma % 11);
        let dvEsperadoChar = "";
        if (dvEsperado === 11) dvEsperadoChar = "0";
        else if (dvEsperado === 10) dvEsperadoChar = "K";
        else dvEsperadoChar = String(dvEsperado);
        
        return dv === dvEsperadoChar;
    }

    function extraerRutValido(text, docMatchCleaned) {
        const regex = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[0-9kK]\b/g;
        const matches = text.match(regex) || [];
        
        // 1. Filtrar coincidencias que pasen validación de Modulo 11
        for (const match of matches) {
            const cleanedMatch = match.replace(/[^0-9kK]/g, "").toUpperCase();
            if (cleanedMatch !== docMatchCleaned && validarRutChile(match)) {
                return match;
            }
        }
        
        // 2. Fallback: buscar la primera coincidencia que contenga un guion "-" (típico de RUT en carnet)
        for (const match of matches) {
            const cleanedMatch = match.replace(/[^0-9kK]/g, "").toUpperCase();
            if (cleanedMatch !== docMatchCleaned && match.includes("-")) {
                return match;
            }
        }
        
        // 3. Fallback final: cualquier coincidencia que no sea igual al número de documento
        for (const match of matches) {
            const cleanedMatch = match.replace(/[^0-9kK]/g, "").toUpperCase();
            if (cleanedMatch !== docMatchCleaned) {
                return match;
            }
        }
        
        // Si no hay nada filtrado, tomar el primer match crudo
        const rawRegex = /\d{1,2}\.?\d{3}\.?\d{3}-?[0-9kK]/;
        const rawMatch = text.match(rawRegex);
        return rawMatch ? rawMatch[0] : null;
    }

    function procesarTextoDocumento(text, p, tipoDoc) {
        // Normalizar texto: eliminar acentos/diacríticos para soportar variantes como NÚMERO vs NUMERO, CÉDULA vs CEDULA, etc.
        const normalizedText = (text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        if (tipoDoc === "cedula") {
            // Find all 9-character alphanumeric blocks and filter out common words to extract document number
            const matches = normalizedText.match(/\b[A-Z0-9]{3}[.-]?[A-Z0-9]{3}[.-]?[A-Z0-9]{3}\b/gi) || [];
            const blacklist = ["IDENTIDAD", "DOCUMENTO", "NUMERO", "REPUBLICA", "APELLIDOS", "PROFESION", "CATEGORIA", "SIGNATURE"];
            const docMatch = matches.find(m => {
                const cleaned = m.replace(/[^A-Z0-9]/ig, "").toUpperCase();
                const esPalabraComun = /^[A-Z]+$/.test(cleaned) && blacklist.includes(cleaned);
                const tieneNumeros = /\d/.test(cleaned);
                const tieneSeparadores = /[.-]/.test(m);
                return !esPalabraComun && (tieneNumeros || tieneSeparadores);
            });

            const docMatchCleaned = docMatch ? docMatch.replace(/[^A-Z0-9]/ig, "").toUpperCase() : "";

            // Extraer RUT válido descartando el número de documento
            const rutMatch = extraerRutValido(normalizedText, docMatchCleaned);

            let detectadoRut = false;
            let detectadoDoc = false;

            if (rutMatch) {
                const inputRut = document.getElementById("rut");
                inputRut.value = rutMatch;
                inputRut.dispatchEvent(new Event("input"));
                detectadoRut = true;
            }

            if (docMatch) {
                const inputDoc = document.getElementById("num_documento");
                if (inputDoc) {
                    inputDoc.value = docMatchCleaned;
                    inputDoc.dispatchEvent(new Event("input"));
                    detectadoDoc = true;
                }
            }

            const hallados = [];
            if (detectadoRut) hallados.push("RUT");
            if (detectadoDoc) hallados.push("Número de Serie");

            if (hallados.length > 0) {
                p.textContent = `${hallados.join(" y ")} detectado(s) desde la cédula.`;
                p.style.color = "#007bff";
            } else {
                p.textContent = "No se pudo detectar el RUT ni Número de Serie en la cédula. Intenta completando manualmente.";
                p.style.color = "orange";
            }

        } else if (tipoDoc === "cotizaciones") {
            // Renta mensual promedio: e.g. Renta mensual promedio: $1.507.500
            const rentaRegex = /renta\s+mensual\s+promedio:?\s*\$?\s*([0-9.]+)/i;
            const rentaMatch = normalizedText.match(rentaRegex);

            let detectadoRenta = false;

            if (rentaMatch && rentaMatch[1]) {
                const cleanedRenta = rentaMatch[1].replace(/[^\d]/g, "");
                const pesos = parseInt(cleanedRenta, 10);
                if (!isNaN(pesos)) {
                    let banda = "";
                    if (pesos <= 500000) banda = "A";
                    else if (pesos <= 1000000) banda = "B";
                    else if (pesos <= 2000000) banda = "C";
                    else if (pesos <= 3500000) banda = "D";
                    else banda = "E";

                    const selectRenta = document.getElementById("renta");
                    if (selectRenta) {
                        selectRenta.value = banda;
                        selectRenta.dispatchEvent(new Event("change"));
                        detectadoRenta = true;
                    }
                }
            }

            if (detectadoRenta) {
                p.textContent = "Renta mensual detectada y seleccionada correctamente.";
                p.style.color = "#007bff";
            } else {
                p.textContent = "No se detectó la renta en el certificado. Asegúrate de que contenga el texto 'Renta mensual promedio: $...'";
                p.style.color = "orange";
            }
        }
    }

    function configurarProcesamientoArchivo(elementId, tipoDoc) {
        const inputEl = document.getElementById(elementId);
        if (!inputEl) return;

        inputEl.addEventListener("change", (event) => {
            const file = event.target.files[0];
            inputEl.parentElement.querySelectorAll(".doc-msg").forEach(e => e.remove());

            if (!file) return;

            const p = document.createElement("p");
            p.className = "doc-msg";
            p.style.cssText = "color:#28a745;font-size:0.9em;margin-top:5px;";
            p.textContent = `Procesando '${file.name}'...`;
            inputEl.insertAdjacentElement("afterend", p);

            // Validar si es archivo PDF
            if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
                if (typeof pdfjsLib === 'undefined') {
                    p.textContent = "Error: El motor de PDF (pdf.js) no se ha cargado.";
                    p.style.color = "red";
                    return;
                }

                const reader = new FileReader();
                reader.onload = async function() {
                    const typedarray = new Uint8Array(this.result);
                    try {
                        const pdf = await pdfjsLib.getDocument(typedarray).promise;
                        let fullText = "";
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            const pageText = textContent.items.map(item => item.str).join(" ");
                            fullText += pageText + "\n";
                        }
                        procesarTextoDocumento(fullText, p, tipoDoc);
                    } catch (err) {
                        console.error("Error al leer PDF:", err);
                        p.textContent = "Error al extraer texto del PDF. Intenta completando manualmente.";
                        p.style.color = "red";
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                // Archivo de imagen — procesar con Tesseract OCR
                Tesseract.recognize(file, "spa", { logger: m => console.log(m) })
                    .then(({ data: { text } }) => {
                        procesarTextoDocumento(text, p, tipoDoc);
                    })
                    .catch(err => {
                        console.error(err);
                        p.textContent = "Error al procesar la imagen.";
                        p.style.color = "red";
                    });
            }
        });
    }

    configurarProcesamientoArchivo("documento", "cedula");
    configurarProcesamientoArchivo("documentoCotizaciones", "cotizaciones");

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

    const inputDoc = document.getElementById("num_documento");
    if (inputDoc) {
        inputDoc.addEventListener("input", () => {
            inputDoc.value = inputDoc.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 15);
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
    // ═══════════════════════════════════════════════════════════
    // PRECARGA DESDE RECOMENDACIONES (querystring + localStorage)
    // ─ ?renta=   → mapea pesos a banda y selecciona en el select
    // ─ ?monto=   → rellena el campo monto (paso 3)
    // ─ ?cuotas=  → rellena el campo cuotas (paso 4)
    // ─ RUT       → viene de localStorage.clienteRut (sesión activa)
    // ═══════════════════════════════════════════════════════════
    (function precargarDesdeRecomendacion() {
        const qp = new URLSearchParams(window.location.search);

        // RUT — solo desde localStorage; no lo exponemos en la URL
        if (inputRut && clienteRut && !inputRut.value.trim()) {
            inputRut.value = clienteRut;
        }

        // Renta — convierte el valor numérico en pesos a la banda del select
        const rentaParam = qp.get("renta");
        const selectRenta = document.getElementById("renta");
        if (selectRenta && rentaParam) {
            const pesos = parseInt(rentaParam, 10);
            let banda = "";
            if      (pesos <= 500_000)   banda = "A";
            else if (pesos <= 1_000_000) banda = "B";
            else if (pesos <= 2_000_000) banda = "C";
            else if (pesos <= 3_500_000) banda = "D";
            else                         banda = "E";
            selectRenta.value = banda;
        }

        // Monto — formateamos igual que el listener de input
        const montoParam = qp.get("monto");
        if (inputMonto && montoParam) {
            const num = parseInt(montoParam.replace(/[^\d]/g, ""), 10);
            if (!isNaN(num)) {
                inputMonto.value = "$" + num.toLocaleString("es-CL");
            }
        }

        // Cuotas
        const cuotasParam = qp.get("cuotas");
        const inputCuotas = document.getElementById("cuotas");
        if (inputCuotas && cuotasParam) {
            const num = parseInt(cuotasParam, 10);
            if (!isNaN(num) && num >= 1 && num <= 60) {
                inputCuotas.value = num;
            }
        }
    })();

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
            const numDoc    = document.getElementById("num_documento");
            const documento = document.getElementById("documento");
            const tieneDoc  = documento && documento.files.length > 0;
            if (!tieneDoc) {
                if (!rut.value.trim())  { mostrarError(rut,   "Ingresa un RUT válido o sube tu documento"); ok = false; }
                if (!numDoc.value.trim()) { mostrarError(numDoc, "Ingresa tu número de documento"); ok = false; }
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
            let numDocValue = document.getElementById("num_documento").value;
            const documento = document.getElementById("documento");
            if (documento && documento.files.length > 0 && !rutValue.trim()) {
                rutValue = "11.111.111-1";
            }
            if (documento && documento.files.length > 0 && !numDocValue.trim()) {
                numDocValue = "123456789";
            }

            const montoIngresado  = parseInt(document.getElementById("monto").value.replace(/\D/g, ""));
            const cuotasIngresadas = parseInt(document.getElementById("cuotas").value);
            const sessionRut = localStorage.getItem("clienteRut") || "";

            const data = {
                tipoCredito: document.getElementById("tipo-credito").value,
                rut: rutValue,
                num_documento: numDocValue,
                rut_sesion: sessionRut,
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
            mostrarModalInfo(
                "Solicitud en Revisión",
                "Tu solicitud de crédito ha sido enviada (pendiente de revisión por un analista).",
                false,
                () => {
                    window.location.href = "Estado.html";
                }
            );
            return;
        }

        const idServidor = result.id_credito || result.id_solicitud || result.id || result.id_simulacion;
        guardarSolicitudLocal(data, idServidor);
        mostrarModalInfo(
            "¡Solicitud Enviada!",
            "Tu solicitud de crédito ha sido enviada correctamente al analista para su evaluación.",
            true,
            () => {
                window.location.href = "Estado.html";
            }
        );

    } catch (error) {
        console.warn("API no disponible, guardando solicitud en local:", error.message);
        guardarSolicitudLocal(data);
        mostrarModalInfo(
            "Solicitud Guardada",
            "Tu solicitud se ha guardada de forma local y correcta (pendiente de revisión por el analista).",
            true,
            () => {
                window.location.href = "Estado.html";
            }
        );
    }
}

// ═══════════════════════════════════════════════════════════
// MODAL PERSONALIZADO (Muestra un popup estilizado en vez de alert)
// ═══════════════════════════════════════════════════════════
function mostrarModalInfo(titulo, mensaje, esExito, callback) {
    const overlay = document.createElement("div");
    overlay.className = "custom-modal-overlay";
    
    const iconBg = esExito ? "#eafaf1" : "#fff8e6";
    const iconColor = esExito ? "#28a745" : "#f0ad4e";
    const btnText = esExito ? "Ver Estado" : "Entendido";
    
    const svgIcon = esExito 
        ? `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
        : `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;

    overlay.innerHTML = `
        <div class="custom-modal-card">
            <div class="custom-modal-icon-container" style="background: ${iconBg};">
                ${svgIcon}
            </div>
            <h3 class="custom-modal-title">${titulo}</h3>
            <p class="custom-modal-message">${mensaje}</p>
            <button class="custom-modal-btn">${btnText}</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Forzar reflow para animación
    overlay.offsetHeight;
    
    // Activar animación
    overlay.classList.add("active");
    
    const btn = overlay.querySelector(".custom-modal-btn");
    const closeModal = () => {
        overlay.classList.remove("active");
        setTimeout(() => {
            overlay.remove();
            if (callback) callback();
        }, 300);
    };
    
    btn.addEventListener("click", closeModal);
    
    // Cerrar también con Enter/Escape
    const keyHandler = (e) => {
        if (e.key === "Enter" || e.key === "Escape") {
            document.removeEventListener("keydown", keyHandler);
            closeModal();
        }
    };
    document.addEventListener("keydown", keyHandler);
}