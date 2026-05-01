document.addEventListener("DOMContentLoaded", () => {
    // ---- LÓGICA DE MODO (Simular vs Solicitar) ----
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    // Detectamos si es modo solicitud por el parámetro URL o si el nombre del archivo contiene "solicitar"
    const isSolicitar = mode === 'solicitar' || window.location.pathname.toLowerCase().includes('solicitar');

    const tituloPrincipal = document.querySelector(".hero h1");
    const tituloSecundario = document.querySelector(".main-title");
    const btnSimulacion = document.querySelector(".ver-simulacion");
    // Buscamos el botón por ID, o lo buscamos por su texto como respaldo por si olvidaste el ID en tu HTML
    const btnSolicitarFinal = document.getElementById("btnSolicitarFinal") || Array.from(document.querySelectorAll('button, .btn')).find(el => el.textContent.toLowerCase().includes('solicitar'));

    if (isSolicitar) {
        if (tituloPrincipal) tituloPrincipal.textContent = "Solicitud de Crédito";
        if (tituloSecundario) tituloSecundario.textContent = "Solicita tu Crédito paso a paso";
        if (btnSimulacion) btnSimulacion.style.display = "none";
        if (btnSolicitarFinal) btnSolicitarFinal.style.display = "inline-block";
    } else {
        if (tituloPrincipal) tituloPrincipal.textContent = "Simulación de Crédito";
        if (tituloSecundario) tituloSecundario.textContent = "Simula tu Crédito paso a paso";
        if (btnSimulacion) btnSimulacion.style.display = "inline-block";
        if (btnSolicitarFinal) btnSolicitarFinal.style.display = "none";
    }
    // -------------------------------------------------

    const inputDocumento = document.getElementById("documento");

    if (inputDocumento) {
        inputDocumento.addEventListener("change", (event) => {
            const file = event.target.files[0];
            const existingMsg = inputDocumento.parentElement.querySelector(".doc-msg");
            if (existingMsg) {
                existingMsg.remove();
            }

            if (file) {
                // Limpiar mensajes previos
                document.querySelectorAll(".doc-msg").forEach(e => e.remove());

                // Mensaje inicial
                const p = document.createElement("p");
                p.classList.add("doc-msg");
                p.style.color = "#28a745";
                p.style.fontSize = "0.9em";
                p.style.marginTop = "5px";
                p.textContent = `Procesando documento '${file.name}'...`;
                inputDocumento.insertAdjacentElement("afterend", p);

                Tesseract.recognize(
                    file,
                    'spa',
                    {
                        logger: m => console.log(m)
                    }
                ).then(({ data: { text } }) => {

                    console.log("Texto detectado:", text);

                    // Buscar RUT
                    const rutRegex = /\d{1,2}\.?\d{3}\.?\d{3}-?[0-9kK]/;
                    const rutMatch = text.match(rutRegex);

                    if (rutMatch) {
                        let rutDetectado = rutMatch[0];

                        // 🔹 Limpiar el RUT (quitar puntos y espacios)
                        rutDetectado = rutDetectado.replace(/\./g, "").replace(/\s/g, "");

                        // 🔹 Si viene sin guion, lo agregamos
                        if (!rutDetectado.includes("-") && rutDetectado.length >= 8) {
                            rutDetectado = rutDetectado.slice(0, -1) + "-" + rutDetectado.slice(-1);
                        }

                        const inputRut = document.getElementById("rut");
                        inputRut.value = rutMatch[0];
                        inputRut.dispatchEvent(new Event("input"));

                        p.textContent = "RUT detectado automáticamente desde la imagen.";
                        p.style.color = "#007bff";
                    } else {
                        p.textContent = "No se pudo detectar el RUT. Intenta con una imagen más clara.";
                        p.style.color = "orange";
                    }

                }).catch(err => {
                    console.error(err);
                    p.textContent = "Error al procesar la imagen.";
                    p.style.color = "red";
                });
            }
        });
    }

    const inputRut = document.querySelector("#rut");

    if (inputRut) {
        inputRut.addEventListener("input", () => {
            let value = inputRut.value;

            value = value.replace(/[^0-9kK]/g, "").toUpperCase();
            value = value.replace(/K(.*)K/, "K");
            value = value.slice(0, 10);
            let cuerpo = value.slice(0, -1);
            let dv = value.slice(-1);
            cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            inputRut.value = cuerpo + (dv ? "-" + dv : "");
        });
    }

    const inputMonto = document.querySelector("#monto");

    if (inputMonto) {
        inputMonto.addEventListener("input", () => {
            let value = inputMonto.value;

            value = value.replace(/[^\d]/g, "");
            if (value === "") {
                inputMonto.value = "$";
                return;
            }

            value = parseInt(value, 10).toLocaleString("es-CL");
            inputMonto.value = "$" + value;
        });

        inputMonto.addEventListener("focus", () => {
            if (inputMonto.value.trim() === "") {
                inputMonto.value = "$";
            }
            setTimeout(() => {
                inputMonto.setSelectionRange(inputMonto.value.length, inputMonto.value.length);
            }, 0);
        });
    }

    const selectMesPago = document.getElementById("mes-pago");

    if (selectMesPago) {
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const hoy = new Date();
        let mesActual = hoy.getMonth();

        selectMesPago.innerHTML = "<option value='' disabled selected>Selecciona el mes</option>";

        for (let i = 1; i <= 3; i++) {
            let mesIndex = (mesActual + i) % 12;
            let mesNombre = meses[mesIndex];

            let option = document.createElement("option");
            option.value = mesIndex + 1;
            option.textContent = mesNombre;

            selectMesPago.appendChild(option);
        }
    }

    const selectDiaPago = document.getElementById("dia-pago");

    if (selectMesPago && selectDiaPago) {
        selectMesPago.addEventListener("change", () => {
            const mes = parseInt(selectMesPago.value); // 1 a 12
            const añoActual = new Date().getFullYear();
            const diasEnMes = new Date(añoActual, mes, 0).getDate();
            selectDiaPago.innerHTML = "<option value='' disabled selected>Selecciona el día</option>";
            for (let d = 1; d <= diasEnMes; d++) {
                const option = document.createElement("option");
                option.value = d;
                option.textContent = d;
                selectDiaPago.appendChild(option);
            }
        });
    }

    function obtenerSegurosSeleccionados() {
        return {
            cesantia: document.getElementById("seguroCesantia").checked,
            desgravamen: document.getElementById("seguroDesgravamen").checked
        };
    }

    const pasos = document.querySelectorAll(".paso");
    const botonesContinuar = document.querySelectorAll(".btn.continuar");
    const botonesVolver = document.querySelectorAll(".btn.volver");

    let pasoActual = 0;

    pasos.forEach((paso, i) => {
        paso.setAttribute('data-step', i + 1);
    });

    const mostrarPaso = (index) => {
        pasos.forEach((paso, i) => {
            if (i === index) {
                paso.classList.add("activo");
                paso.classList.remove("inactivo");
            } else {
                paso.classList.add("inactivo");
                paso.classList.remove("activo");
            }
        });
    };

    // ---------------------------------------------------------
    // VALIDACIONES POR CADA PASO
    // ---------------------------------------------------------
    const validarPaso = (index) => {
        let valido = true;

        // Limpiamos errores previos
        pasos[index].querySelectorAll(".error").forEach(e => e.remove());

        if (index === 0) {
            // Paso 1: Tipo de crédito
            const tipo = document.getElementById("tipo-credito");
            if (!tipo.value) {
                mostrarError(tipo, "Debes seleccionar un tipo de crédito");
                valido = false;
            }
        }

        if (index === 1) {
            // Paso 2: RUT + Renta
            const rut = pasos[index].querySelector("input[type='text']");
            const renta = document.getElementById("renta");
            const documento = document.getElementById("documento");

            // Comprobamos si el usuario subió un archivo
            const tieneDocumento = documento && documento.files.length > 0;

            // Solo exigimos RUT y Renta si NO subió un documento
            if (!tieneDocumento) {
                if (!rut.value.trim()) {
                    mostrarError(rut, "Ingresa un RUT válido o sube tu documento");
                    valido = false;
                }

                if (!renta.value) {
                    mostrarError(renta, "Selecciona tu renta mensual o sube tu documento");
                    valido = false;
                }
            }
        }

        if (index === 2) {
            // Paso 3: Monto
            const monto = pasos[index].querySelector("input[type='text']");

            let raw = monto.value.replace(/[^\d]/g, "");
            let montoNum = parseInt(raw);
            if (isNaN(montoNum)) {
                mostrarError(monto, "Ingresa un monto válido");
                valido = false;
            } else if (montoNum < 1000000 || montoNum > 60000000) {
                mostrarError(monto, "El monto debe estar entre $1.000.000 y $60.000.000");
                valido = false;
            }
        }

        if (index === 3) {
            // Paso 4: cuotas, mes y día
            const cuotas = document.getElementById("cuotas");
            const mes = document.getElementById("mes-pago");
            const dia = document.getElementById("dia-pago");

            let numCuotas = parseInt(cuotas.value);
            if (isNaN(numCuotas)) {
                mostrarError(cuotas, "Ingresa un número válido de cuotas");
                valido = false;
            } else if (numCuotas < 1 || numCuotas > 60) {
                mostrarError(cuotas, "Las cuotas deben estar entre 1 y 60");
                valido = false;
            }

            if (!mes.value) {
                mostrarError(mes, "Selecciona el mes de pago");
                valido = false;
            }

            if (!dia.value) {
                mostrarError(dia, "Selecciona un día de pago");
                valido = false;
            }
        }

        return valido;
    };

    // Función para agregar mensaje debajo del campo
    const mostrarError = (input, mensaje) => {
        const p = document.createElement("p");
        p.classList.add("error");
        p.textContent = mensaje;

        input.insertAdjacentElement("afterend", p);
    };

    // ---------------------------------------------------------
    // EVENTOS DE NAVEGACIÓN
    // ---------------------------------------------------------
    botonesContinuar.forEach((btn, index) => {
        btn.addEventListener("click", () => {
            if (validarPaso(pasoActual)) {
                if (pasoActual < pasos.length - 1) {
                    pasoActual++;
                    mostrarPaso(pasoActual);
                }
            }
        });
    });

    botonesVolver.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (pasoActual > 0) {
                pasoActual--;
                mostrarPaso(pasoActual);
            }
        });
    });

    mostrarPaso(pasoActual);

    if (btnSimulacion) {
        btnSimulacion.addEventListener("click", (e) => {
            e.preventDefault();
            let rutValue = document.getElementById("rut").value;
            const documento = document.getElementById("documento");
            const tieneDocumento = documento && documento.files.length > 0;

            if (tieneDocumento && !rutValue.trim()) {
                rutValue = "11.111.111-1";
            }

            const montoIngresado = parseInt(document.getElementById("monto").value.replace(/\D/g, ""));
            const cuotasIngresadas = parseInt(document.getElementById("cuotas").value);

            const data = {
                tipoCredito: document.getElementById("tipo-credito").value,
                rut: rutValue,
                renta: document.getElementById("renta").value || "C",
                monto: montoIngresado, // Asignar la variable
                cuotas: cuotasIngresadas, // Asignar la variable
                tasa_interes_anual: 12.5,
                mesInicio: document.getElementById("mes-pago").value,
                diaPago: document.getElementById("dia-pago").value,
                seguroCesantia: document.getElementById("seguroCesantia").checked,
                seguroDesgravamen: document.getElementById("seguroDesgravamen").checked,
                score: calcularScore(montoIngresado, cuotasIngresadas) // Calcular con las variables
            };

            enviarSimulacion(data);
        });
    }

    if (btnSolicitarFinal) {
        btnSolicitarFinal.addEventListener("click", (e) => {
            e.preventDefault();
            let rutValue = document.getElementById("rut").value;
            const documento = document.getElementById("documento");
            const tieneDocumento = documento && documento.files.length > 0;

            if (tieneDocumento && !rutValue.trim()) {
                rutValue = "11.111.111-1";
            }
           
            
            const montoIngresado = parseInt(document.getElementById("monto").value.replace(/\D/g, ""));
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
                score: calcularScore(montoIngresado, cuotasIngresadas) // Calcular con las variables
            };

            enviarSolicitud(data);
        });
    }
});

// ─── Guardar solicitud en localStorage (siempre, con o sin API) ───────────────
function guardarSolicitudLocal(data, idOverride) {
    try {
        const raw = localStorage.getItem('cliente_solicitudes_enviadas');
        const enviadas = raw ? JSON.parse(raw) : [];
        const id = idOverride || `local_${Date.now()}`;
        enviadas.push({ ...data, id });
        localStorage.setItem('cliente_solicitudes_enviadas', JSON.stringify(enviadas));
        return id;
    } catch(e) {
        console.warn('No se pudo guardar en localStorage:', e);
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
            // API respondió con error → guardar igual en local para que aparezca como pendiente
            guardarSolicitudLocal(data);
            alert("Solicitud enviada (pendiente de revisión).");
            window.location.href = "Estado.html";
            return;
        }

        // API OK → usar el ID que devolvió el servidor
        const idServidor = result.id_credito || result.id_solicitud || result.id || result.id_simulacion;
        guardarSolicitudLocal(data, idServidor);
        alert("Solicitud de crédito enviada correctamente al analista.");
        window.location.href = "Estado.html";

    } catch (error) {
        // API no disponible → guardar en local de todas formas
        console.warn("API no disponible, guardando solicitud en local:", error.message);
        guardarSolicitudLocal(data);
        alert("Solicitud enviada correctamente.");
        window.location.href = "Estado.html";
    }
}

const calcularScore = (monto, cuotas) => { 
    const m = Number(monto) || 0; 
    const c = Number(cuotas) || 1; 
    return Math.max(5, Math.min(95, 100 - Math.round((m / 1000000) * 2 + c * 0.8))); 
};

function mostrarResumen(data) {
    const main = document.querySelector("main");
    
    // Calculamos el score aquí en caso de que la API (backend) no lo devuelva
    const scoreCalculado = data.score || calcularScore(data.monto, data.cuotas);

    main.innerHTML = `
        <section class="hero">
            <h1>Resumen de Simulación</h1>
        </section>

        <section style="max-width: 800px; margin: 40px auto; background: white; padding: 30px; border-radius: 10px;">
            <h2>Detalle del crédito</h2>

            <p><strong>Monto solicitado:</strong> $${Number(data.monto).toLocaleString("es-CL")}</p>
            <p><strong>Monto total:</strong> $${Number(data.monto_total || 0).toLocaleString("es-CL")}</p>
            <p><strong>Monto cuota:</strong> $${Number(data.monto_cuota || 0).toLocaleString("es-CL")}</p>
            <p><strong>Número de cuotas:</strong> ${data.cuotas}</p>
            <p><strong>Tasa de interés anual:</strong> ${data.tasa_interes_anual}%</p>
            <p><strong>Probabilidad de aprobación:</strong> <span style="font-weight:bold; color: #2B4C7E;">${scoreCalculado}%</span></p>
            

            <div style="margin-top: 30px;">
                <button onclick="window.location.href='index.html'" 
                    style="background:#2B4C7E; color:white; padding:10px 20px; border:none; border-radius:20px; cursor:pointer;">
                    Volver al inicio
                </button>
            </div>
        </section>
    `;
}

function calcularResumenLocal(data) {
    const monto = Number(data.monto) || 0;
    const cuotas = Number(data.cuotas) || 1;
    const tasaAnual = Number(data.tasa_interes_anual) || 12.5;
    const tasaMensual = tasaAnual / 12 / 100;
    const monto_cuota = tasaMensual > 0
        ? Math.round((monto * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -cuotas)))
        : Math.round(monto / cuotas);
    const monto_total = Math.round(monto_cuota * cuotas);
    return { ...data, monto_cuota, monto_total };
}

async function enviarSimulacion(data) {
    try {
        const response = await fetch("http://localhost:8080/simulacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            alert("Error: " + (result.error || "Error desconocido"));
            return;
        }

        const id = result.id_simulacion;
        const detalleResponse = await fetch(`http://localhost:8080/simulacion/${id}`);
        const detalle = await detalleResponse.json();

        if (!detalle.ok) {
            alert("Error al obtener la simulación");
            return;
        }

        mostrarResumen(detalle.data);

    } catch (error) {
        // API no disponible → mostrar resumen calculado localmente
        console.warn("API no disponible, mostrando resumen local:", error.message);
        mostrarResumen(calcularResumenLocal(data));
    }
}