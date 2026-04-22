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

            //if (file) {
            //    const p = document.createElement("p");
            //    p.classList.add("doc-msg");
            //    p.style.color = "#28a745";
            //    p.style.fontSize = "0.9em";
            //    p.style.marginTop = "5px";
            //    p.textContent = `Archivo '${file.name}' seleccionado con éxito.`;
            //    inputDocumento.insertAdjacentElement("afterend", p);
            //}


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

            // Si se subió un documento y ademas se dejó el RUT vacío, usamos uno artificial para que la API no falle
            if (tieneDocumento && !rutValue.trim()) {
                rutValue = "11.111.111-1";
            }

            const data = {
                tipoCredito: document.getElementById("tipo-credito").value,
                rut: rutValue,
                renta: document.getElementById("renta").value || "C", // Valor por defecto si no lo llenó
                monto: parseInt(document.getElementById("monto").value.replace(/\D/g, "")),
                cuotas: parseInt(document.getElementById("cuotas").value),
                tasa_interes_anual: 12.5,
                mesInicio: document.getElementById("mes-pago").value,
                diaPago: document.getElementById("dia-pago").value,
                seguroCesantia: document.getElementById("seguroCesantia").checked,
                seguroDesgravamen: document.getElementById("seguroDesgravamen").checked
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

            const data = {
                tipoCredito: document.getElementById("tipo-credito").value,
                rut: rutValue,
                renta: document.getElementById("renta").value || "C",
                monto: parseInt(document.getElementById("monto").value.replace(/\D/g, "")),
                cuotas: parseInt(document.getElementById("cuotas").value),
                tasa_interes_anual: 12.5,
                mesInicio: document.getElementById("mes-pago").value,
                diaPago: document.getElementById("dia-pago").value,
                seguroCesantia: document.getElementById("seguroCesantia").checked,
                seguroDesgravamen: document.getElementById("seguroDesgravamen").checked
            };

            enviarSolicitud(data);
        });
    }
});

async function enviarSolicitud(data) {
    try {
        const response = await fetch("http://localhost:8080/solicitud", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        console.log("Respuesta del servidor (solicitud):", result);

        if (!response.ok) {
            alert("Ocurrió un error en el servidor: " + (result.error || "Error desconocido"));
            return;
        }

        alert("Solicitud de crédito enviada correctamente al analista.");
    } catch (error) {
        console.error("Error al enviar la solicitud:", error);
        alert("Error al enviar la solicitud.");
    }
}

async function enviarSimulacion(data) {
    try {
        const response = await fetch("http://localhost:8080/simulacion", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        console.log("Respuesta del servidor:", result);

        if (!response.ok) {
            alert("Ocurrió un error en el servidor: " + (result.error || "Error desconocido"));
            return;
        }

        alert("Simulación enviada correctamente.");
    } catch (error) {
        console.error("Error al enviar la simulación:", error);
        alert("Error al enviar la simulación.");
    }
}


/*
document.addEventListener("DOMContentLoaded", () => {
    // 1) Seleccionar todos los elementos con clase ".paso"
    const pasos = document.querySelectorAll(".paso");

    // 2) Seleccionar todos los botones de la clase "btn continuar"
    const botonesContinuar = document.querySelectorAll(".btn.continuar");

    // 3) Seleccionar todos los botones de la clase "btn volver"
    const botonesVolver = document.querySelectorAll(".btn.volver");

    // 4) Varieble que guarda el índice del paso actualmente visible
    let pasoActual = 0;

    pasos.forEach((paso, i) => {
        paso.setAttribute('data-step', i + 1);
    });

    // 5) Función que muestra el paso del índice que recibe y oculta los demás
    const mostrarPaso = (index) => {
        pasos.forEach((paso, i) => {
            if (i == index) {
                paso.classList.add("activo");
                paso.classList.remove("inactivo");
            } else {
                paso.classList.add("inactivo");
                paso.classList.remove("activo");
            }
        });
    };

    // 6) Añade el evento click a cada botón "CONTINUAR"
    botonesContinuar.forEach((btn) => {
        btn.addEventListener("click", () => {
            // 6.1) Si no estamos en el último paso, avanzamos
            if (pasoActual < pasos.length - 1) {
                pasoActual++;
                mostrarPaso(pasoActual);
            }
        });
    });

    // 7) Añade el evento click a cada botón "VOLVER"
    botonesVolver.forEach((btn) => {
        btn.addEventListener("click", () => {
            // 7.1) Si no estamos en el primer paso, retrocedemos
            if (pasoActual > 0) {
                pasoActual--;
                mostrarPaso(pasoActual);
            }
        });
    });

    // 8) Al cargar, mostramos el primer paso
    mostrarPaso(pasoActual);
});
*/
