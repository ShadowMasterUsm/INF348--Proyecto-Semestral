document.addEventListener("DOMContentLoaded", () => {
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

            if (!rut.value.trim()) {
                mostrarError(rut, "Ingresa un RUT válido");
                valido = false;
            }

            if (!renta.value) {
                mostrarError(renta, "Selecciona tu renta mensual");
                valido = false;
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
            const cuotas = pasos[index].querySelector("input[type='text']");
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


    document.querySelector(".ver-simulacion").addEventListener("click", () => {
        const data = {
            tipoCredito: document.getElementById("tipo-credito").value,
            rut: document.getElementById("rut").value,
            renta: document.getElementById("renta").value,
            monto: parseInt(document.getElementById("monto").value.replace(/\D/g, "")),
            cuotas: parseInt(document.querySelector("#paso4 input[type='text']").value),
            tasa_interes_anual: 12.5,
            mesInicio: document.getElementById("mes-pago").value,
            diaPago: document.getElementById("dia-pago").value,
            seguroCesantia: document.getElementById("seguroCesantia").checked,
            seguroDesgravamen: document.getElementById("seguroDesgravamen").checked
        };

        enviarSimulacion(data);
    });
});

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