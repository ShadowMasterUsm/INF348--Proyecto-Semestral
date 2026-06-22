const database = require('../db');

// ─── Motor de recomendaciones de crédito (basado en reglas) ──────────────────
// Toma la renta (banda A-E) y un historial simple de créditos del cliente
// (cantidad, estados, monto máximo aprobado) y entrega varias opciones de
// CANTIDAD DE DINERO a solicitar (no tipos de producto): para distintos
// plazos, calcula el rango de monto [mínimo, máximo] que mantiene la
// probabilidad de aprobación (score) sobre un umbral mínimo (60%).

// Bandas de renta declaradas en el formulario de solicitud:
// A: < 500.000 | B: 500.001 - 1.000.000 | C: 1.000.001 - 2.000.000
// D: 2.000.001 - 3.500.000 | E: > 3.500.000
const RENTA_REFERENCIA = {
    A: 400000,
    B: 750000,
    C: 1500000,
    D: 2750000,
    E: 4000000
};

// Límites genéricos de crédito (no dependen de un tipo de producto) y tasa
// base de referencia, usada como punto de partida antes de los ajustes por
// historial del cliente.
const LIMITES_CREDITO = {
    montoMin: 200000,
    montoMax: 10000000,
    tasaBase: 8.5
};

// Plazos en meses que se evalúan como opciones de recomendación.
const PLAZOS_CANDIDATOS = [12, 24, 36, 48, 60];

// Cálculo de cuota (sistema francés) — misma fórmula que crearSolicitud
function calcularCuotaRecomendacion(monto, cuotas, tasaAnual) {
    const tasaMensual = tasaAnual / 12 / 100;
    if (tasaMensual === 0) return monto / cuotas;
    return (monto * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -cuotas));
}

// Capacidad de pago estimada: como máximo el 30% de la renta mensual puede ir a la cuota.
function capacidadPagoMensual(renta) {
    const rentaNum = RENTA_REFERENCIA[renta] || RENTA_REFERENCIA.C;
    return Math.round(rentaNum * 0.3);
}

// Historial del cliente → ajustes al score y a la tasa
// historial: { totalCreditos, aprobados, rechazados, pagados, montoMaxAprobado }
function evaluarHistorial(historial) {
    const h = historial || { totalCreditos: 0, aprobados: 0, rechazados: 0, pagados: 0, montoMaxAprobado: 0 };
    let ajusteScore = 0;
    let ajusteTasa = 0;
    let perfil = 'nuevo';

    if (h.totalCreditos === 0) {
        perfil = 'nuevo';
    } else {
        const tasaAprobacion = h.aprobados / h.totalCreditos;
        if (h.pagados > 0) {
            ajusteScore += Math.min(15, h.pagados * 5);
            ajusteTasa -= Math.min(1.5, h.pagados * 0.5);
            perfil = 'cliente_cumplidor';
        }
        if (h.rechazados > 0 && tasaAprobacion < 0.5) {
            ajusteScore -= Math.min(20, h.rechazados * 8);
            ajusteTasa += Math.min(2, h.rechazados * 0.7);
            perfil = 'riesgo_alto';
        } else if (h.aprobados > 0 && perfil !== 'cliente_cumplidor') {
            ajusteScore += 5;
            perfil = 'cliente_recurrente';
        }
    }

    return { ajusteScore, ajusteTasa, perfil };
}

// Score de elegibilidad (0-100) para una cuota dada
function calcularScoreRecomendacion({ cuota, capacidadPago, ajusteScore }) {
    const ratioCuotaCapacidad = capacidadPago > 0 ? cuota / capacidadPago : 1;
    let base = 100 - Math.round(ratioCuotaCapacidad * 60);
    base += ajusteScore;
    return Math.max(5, Math.min(98, Math.round(base)));
}

// Umbral mínimo de probabilidad de aprobación que debe cumplir el rango recomendado.
const SCORE_MINIMO_RECOMENDADO = 60;

// A partir de una cuota mensual, calcula el monto máximo que esa cuota
// alcanza a financiar a un plazo y tasa dados (anualidad inversa).
function montoDesdeCuota(cuota, plazo, tasaAnual) {
    const tasaMensual = tasaAnual / 12 / 100;
    if (tasaMensual === 0) return cuota * plazo;
    return cuota * (1 - Math.pow(1 + tasaMensual, -plazo)) / tasaMensual;
}

// Calcula el rango de monto [mínimo, máximo que mantiene el score sobre
// SCORE_MINIMO_RECOMENDADO] para un plazo dado. Despeje: score = 100 -
// round(ratio*60) + ajusteScore, con ratio = cuota/capacidadPago. Para
// score >= scoreMinimo:  ratio <= (100 + ajusteScore - scoreMinimo) / 60
// Esa cuota máxima se traduce a un monto máximo según plazo y tasa.
function calcularRangoPorPlazo(capacidadPago, tasaAnual, ajusteScore, plazo) {
    const ratioMax = Math.max(0, (100 + ajusteScore - SCORE_MINIMO_RECOMENDADO) / 60);
    const cuotaMaxima = ratioMax * capacidadPago;

    const montoMaximoCalculado = montoDesdeCuota(cuotaMaxima, plazo, tasaAnual);
    const montoMaximo = Math.min(
        LIMITES_CREDITO.montoMax,
        Math.max(LIMITES_CREDITO.montoMin, Math.round(montoMaximoCalculado / 50000) * 50000)
    );
    const montoMinimo = Math.min(LIMITES_CREDITO.montoMin, montoMaximo);

    const cuotaEnMontoMaximo = calcularCuotaRecomendacion(montoMaximo, plazo, tasaAnual);
    const cuotaEnMontoMinimo = calcularCuotaRecomendacion(montoMinimo, plazo, tasaAnual);

    const scoreEnMontoMaximo = calcularScoreRecomendacion({ cuota: cuotaEnMontoMaximo, capacidadPago, ajusteScore });

    return {
        plazo,
        montoMinimo,
        montoMaximo,
        tasaAnual,
        cuotaEnMontoMaximo: Math.round(cuotaEnMontoMaximo),
        cuotaEnMontoMinimo: Math.round(cuotaEnMontoMinimo),
        scoreElegibilidad: scoreEnMontoMaximo,
        cumpleScoreMinimo: scoreEnMontoMaximo >= SCORE_MINIMO_RECOMENDADO
    };
}

// Genera recomendaciones de CANTIDAD DE DINERO para un cliente (sin tipo de
// producto): una opción por cada plazo evaluado, cada una con su rango de
// monto recomendado y su probabilidad de aprobación estimada.
// params: { renta: 'A'..'E', historial }
// devuelve: { capacidadPagoMensual, perfilCliente, scoreMinimoObjetivo, recomendaciones: [...] }
function generarRecomendaciones({ renta, historial }) {
    const capacidadPago = capacidadPagoMensual(renta);
    const { ajusteScore, ajusteTasa, perfil } = evaluarHistorial(historial);
    const tasaAnual = Math.max(1, Math.round((LIMITES_CREDITO.tasaBase + ajusteTasa) * 10) / 10);

    const recomendaciones = PLAZOS_CANDIDATOS.map((plazo) => {
        const rango = calcularRangoPorPlazo(capacidadPago, tasaAnual, ajusteScore, plazo);
        return {
            montoMinimoRecomendado: rango.montoMinimo,
            montoMaximoRecomendado: rango.montoMaximo,
            plazoSugerido: rango.plazo,
            tasaInteresAnual: rango.tasaAnual,
            cuotaEnMontoMaximo: rango.cuotaEnMontoMaximo,
            cuotaEnMontoMinimo: rango.cuotaEnMontoMinimo,
            scoreElegibilidad: rango.scoreElegibilidad,
            cumpleScoreMinimo: rango.cumpleScoreMinimo,
            mensaje: `Te recomendamos un crédito entre $${rango.montoMinimo.toLocaleString('es-CL')} y $${rango.montoMaximo.toLocaleString('es-CL')}, en ${rango.plazo} cuotas, con ${rango.scoreElegibilidad}% de probabilidad de aprobación.`
        };
    })
    // Solo se muestran opciones que efectivamente cumplen el umbral de aprobación;
    // si ninguna lo cumple (caso extremo de renta muy baja + alto riesgo), se
    // muestra igual la mejor disponible para no dejar al cliente sin información.
    .filter((r, _, arr) => r.cumpleScoreMinimo || !arr.some(x => x.cumpleScoreMinimo));

    recomendaciones.sort((a, b) => a.plazoSugerido - b.plazoSugerido);

    return {
        capacidadPagoMensual: capacidadPago,
        perfilCliente: perfil,
        scoreMinimoObjetivo: SCORE_MINIMO_RECOMENDADO,
        recomendaciones
    };
}

// ─── Ejemplo de tabla (se puede eliminar) ─────────────────────────────────────
const createTable = (req, res) => {
    const query = 'CREATE TABLE IF NOT EXISTS user(id int AUTO_INCREMENT, firstname VARCHAR(50), lastname VARCHAR(50), email VARCHAR(50), PRIMARY KEY(id))';
    database.query(query, (err) => {
        if (err) throw err;
        res.send('Tabla creada');
    });
};

// ─── Simulación ───────────────────────────────────────────────────────────────
const crearSimulacion = (req, res) => {
    const { tipoCredito, rut, monto, cuotas, tasa_interes_anual, seguroDesgravamen, seguroCesantia, mesInicio, diaPago } = req.body;
    if (!tipoCredito || !rut || !monto || !cuotas) {
        return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios: tipoCredito, rut, monto y cuotas' });
    }
    const montoNum = Number(monto);
    if (montoNum < 1_000_000 || montoNum > 60_000_000) {
        return res.status(400).json({ ok: false, error: 'El monto debe estar entre $1.000.000 y $60.000.000' });
    }
    const tasaInteresAnual = Number(tasa_interes_anual) || 12.5;
    const calcularCuota = (monto, cuotas, tasaAnual) => {
        const tasaMensual = tasaAnual / 12 / 100;
        if (tasaMensual === 0) return monto / cuotas;
        return (monto * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -cuotas));
    };
    const cuota = calcularCuota(monto, cuotas, tasaInteresAnual);
    const total = cuota * cuotas;
    const tipoCreditoNormalizado = String(tipoCredito).trim().toLowerCase();
    const rutNormalizado = String(rut).trim();
    let fechaPrimerPago = null;
    if (mesInicio && diaPago) {
        const hoy = new Date();
        const mes = Number(mesInicio);
        const dia = Number(diaPago);
        if (!Number.isNaN(mes) && !Number.isNaN(dia) && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
            const anio = hoy.getMonth() + 1 <= mes ? hoy.getFullYear() : hoy.getFullYear() + 1;
            const fecha = new Date(anio, mes - 1, dia);
            if (!Number.isNaN(fecha.getTime())) fechaPrimerPago = fecha.toISOString().slice(0, 10);
        }
    }
    const guardarSimulacion = (idTipoCredito) => {
        const query = 'INSERT INTO simulacion (rut, id_tipo_credito, monto, cuotas, tasa_interes_anual, incluye_seguro_desgravamen, incluye_seguro_cesantia, fecha_primer_pago, monto_total, monto_cuota) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        database.query(query, [rutNormalizado, idTipoCredito, monto, cuotas, tasaInteresAnual, seguroDesgravamen ? 1 : 0, seguroCesantia ? 1 : 0, fechaPrimerPago, total, cuota], (err, result) => {
            if (err) { console.error('Error al guardar simulación:', err); return res.status(500).json({ ok: false, error: 'Error al guardar en la BD', detalle: err.message }); }
            return res.status(200).json({ ok: true, mensaje: 'Simulación guardada correctamente', id_simulacion: result.insertId });
        });
    };
    database.query('SELECT id_tipo_credito FROM tipo_credito WHERE LOWER(nombre) = ? LIMIT 1', [tipoCreditoNormalizado], (err, result) => {
        if (err) return res.status(500).json({ ok: false, error: 'Error al consultar tipo de crédito', detalle: err.message });
        if (result.length > 0) return guardarSimulacion(result[0].id_tipo_credito);
        database.query('INSERT INTO tipo_credito (nombre, descripcion) VALUES (?, ?)', [tipoCreditoNormalizado, 'Tipo de crédito creado automáticamente desde simulación'], (insertErr, insertResult) => {
            if (insertErr) return res.status(500).json({ ok: false, error: 'Error al crear tipo de crédito', detalle: insertErr.message });
            return guardarSimulacion(insertResult.insertId);
        });
    });
};

const obtenerSimulaciones = (req, res) => {
    const { rut } = req.query;
    let query = 'SELECT id_simulacion, rut, monto, cuotas, tasa_interes_anual, incluye_seguro_desgravamen, incluye_seguro_cesantia, monto_total, monto_cuota, fecha_primer_pago, fecha FROM simulacion';
    const params = [];
    if (rut) { query += ' WHERE rut = ?'; params.push(rut); }
    query += ' ORDER BY id_simulacion DESC';
    database.query(query, params, (err, result) => {
        if (err) return res.status(500).json({ ok: false, error: 'Error al consultar simulaciones', detalle: err.message });
        return res.status(200).json({ ok: true, total: result.length, data: result });
    });
};

const obtenerSimulacionPorId = (req, res) => {
    const { id } = req.params;
    database.query('SELECT id_simulacion, rut, monto, cuotas, tasa_interes_anual, incluye_seguro_desgravamen, incluye_seguro_cesantia, monto_total, monto_cuota, fecha_primer_pago, fecha FROM simulacion WHERE id_simulacion = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ ok: false, error: 'Error al consultar simulación', detalle: err.message });
        if (result.length === 0) return res.status(404).json({ ok: false, error: 'Simulación no encontrada' });
        return res.status(200).json({ ok: true, data: result[0] });
    });
};

// ─── Helpers para crearSolicitud ──────────────────────────────────────────────
function calcularFechaPrimerPago(mesInicio, diaPago) {
    if (!mesInicio || !diaPago) return new Date().toISOString().slice(0, 10);
    const hoy = new Date();
    const mes = Number(mesInicio);
    const dia = Number(diaPago);
    if (Number.isNaN(mes) || Number.isNaN(dia)) return new Date().toISOString().slice(0, 10);
    const anio = hoy.getMonth() + 1 <= mes ? hoy.getFullYear() : hoy.getFullYear() + 1;
    const fecha = new Date(anio, mes - 1, dia);
    if (Number.isNaN(fecha.getTime())) return new Date().toISOString().slice(0, 10);
    return fecha.toISOString().slice(0, 10);
}

async function obtenerOCrearCliente(promiseDb, rut, num_documento) {
    const [clientes] = await promiseDb.query("SELECT id_cliente FROM cliente WHERE rut = ?", [rut]);
    if (clientes.length > 0) {
        if (num_documento) {
            await promiseDb.query("UPDATE cliente SET num_documento = ? WHERE id_cliente = ?", [num_documento, clientes[0].id_cliente]);
        }
        return clientes[0].id_cliente;
    }
    const [insertCliente] = await promiseDb.query(
        "INSERT INTO cliente (id_region, id_comuna, rut, nombre, apellido, telefono, correo, num_documento) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [1, 1, rut, 'Cliente', 'Único', '+56912345678', 'cliente@clarofin.cl', num_documento || null]
    );
    return insertCliente.insertId;
}

async function obtenerOCrearTipoCredito(promiseDb, tipoCredito) {
    const [tipos] = await promiseDb.query("SELECT id_tipo_credito FROM tipo_credito WHERE LOWER(nombre) = ?", [tipoCredito]);
    if (tipos.length > 0) return tipos[0].id_tipo_credito;
    const [insertTipo] = await promiseDb.query(
        "INSERT INTO tipo_credito (nombre, descripcion) VALUES (?, ?)",
        [tipoCredito, 'Creado desde solicitud']
    );
    return insertTipo.insertId;
}

async function obtenerOCrearAnalista(promiseDb) {
    const [analistas] = await promiseDb.query("SELECT id_analista FROM analista LIMIT 1");
    if (analistas.length > 0) return analistas[0].id_analista;
    const [insertAnalista] = await promiseDb.query(
        "INSERT INTO analista (rut, nombre, apellido, correo) VALUES (?, ?, ?, ?)",
        ['11111111-1', 'Analista', 'Principal', 'analista@clarofin.cl']
    );
    return insertAnalista.insertId;
}

async function aplicarSeguro(promiseDb, id_credito, id_seguro, nombre, cobertura, tasa, monto_max) {
    await promiseDb.query(
        "INSERT IGNORE INTO seguro (id_seguro, nombre, cobertura, tasa, monto_max_cobertura) VALUES (?, ?, ?, ?, ?)",
        [id_seguro, nombre, cobertura, tasa, monto_max]
    );
    await promiseDb.query("INSERT INTO credito_seguro (id_credito, id_seguro) VALUES (?, ?)", [id_credito, id_seguro]);
    await promiseDb.query("CALL calcular_costo_seguro(?, ?)", [id_credito, id_seguro]);
    await promiseDb.query("CALL actualizar_monto_total(?)", [id_credito]);
}

// ─── Solicitud ────────────────────────────────────────────────────────────────
const crearSolicitud = async (req, res) => {
    const promiseDb = database.promise();
    try {
        const { tipoCredito, rut, monto, cuotas, tasa_interes_anual, mesInicio, diaPago, seguroDesgravamen, seguroCesantia, num_documento } = req.body;
        if (!tipoCredito || !rut || !monto || !cuotas) return res.status(400).json({ error: 'Faltan campos obligatorios' });

        const rutNormalizado = String(rut).trim();
        const tipoCreditoNormalizado = String(tipoCredito).trim().toLowerCase();
        const tasaInteresAnual = Number(tasa_interes_anual) || 12.5;
        const fechaPrimerPago = calcularFechaPrimerPago(mesInicio, diaPago);

        await promiseDb.query("INSERT IGNORE INTO region (id_region, nombre) VALUES (1, 'Región Metropolitana')");
        await promiseDb.query("INSERT IGNORE INTO comuna (id_comuna, id_region, nombre) VALUES (1, 1, 'Santiago')");

        const id_cliente = await obtenerOCrearCliente(promiseDb, rutNormalizado, num_documento);
        const id_tipo_credito = await obtenerOCrearTipoCredito(promiseDb, tipoCreditoNormalizado);
        const id_analista = await obtenerOCrearAnalista(promiseDb);

        const tasaMensual = tasaInteresAnual / 12 / 100;
        const montoNum = Number(monto);
        const cuotasNum = Number(cuotas);
        const montoCuota = tasaMensual > 0
            ? (montoNum * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -cuotasNum))
            : montoNum / cuotasNum;
        const montoTotalPagar = montoCuota * cuotasNum;

        const [insertCredito] = await promiseDb.query(
            "INSERT INTO credito (id_tipo_credito, id_cliente, monto_solicitado, numero_cuotas, fecha_primer_pago, tasa_interes_anual, monto_cuota, monto_total_pagar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [id_tipo_credito, id_cliente, monto, cuotas, fechaPrimerPago, tasaInteresAnual, montoCuota, montoTotalPagar]
        );
        const id_credito = insertCredito.insertId;
        await promiseDb.query("INSERT INTO tramite (id_credito, id_analista, etapa) VALUES (?, ?, 'RECEPCION')", [id_credito, id_analista]);

        if (seguroDesgravamen) {
            await aplicarSeguro(promiseDb, id_credito, 1, 'Seguro de Desgravamen', 'Fallecimiento', 0.05, 100000000);
        }
        if (seguroCesantia) {
            await aplicarSeguro(promiseDb, id_credito, 2, 'Seguro de Cesantía', 'Desempleo', 0.20, 50000000);
        }

        res.status(201).json({ ok: true, mensaje: 'Solicitud creada correctamente', id_credito });
    } catch (error) {
        console.error('Error al crear solicitud:', error);
        res.status(500).json({ ok: false, error: 'Error al crear solicitud', detalle: error.message });
    }
};

const obtenerSolicitudes = async (req, res) => {
    const promiseDb = database.promise();
    try {
        const [rows] = await promiseDb.query(`
            SELECT
                c.id_credito as id_simulacion,
                cl.rut,
                c.monto_solicitado as monto,
                c.numero_cuotas as cuotas,
                c.tasa_interes_anual,
                c.monto_total_pagar as monto_total,
                c.monto_cuota,
                (SELECT COUNT(*) FROM credito_seguro cs JOIN seguro s ON cs.id_seguro = s.id_seguro WHERE cs.id_credito = c.id_credito AND s.nombre LIKE '%Desgravamen%') > 0 as incluye_seguro_desgravamen,
                (SELECT COUNT(*) FROM credito_seguro cs JOIN seguro s ON cs.id_seguro = s.id_seguro WHERE cs.id_credito = c.id_credito AND s.nombre LIKE '%Cesantía%') > 0 as incluye_seguro_cesantia
            FROM credito c
            JOIN cliente cl ON c.id_cliente = cl.id_cliente
            WHERE c.estado IN ('PENDIENTE', 'EN_REVISION')
            ORDER BY c.id_credito DESC
        `);
        res.status(200).json({ ok: true, total: rows.length, data: rows });
    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener solicitudes', detalle: error.message });
    }
};

// ─── Actualizar estado de un crédito ────────────────────────────────────
const actualizarEstadoSolicitud = async (req, res) => {
    const promiseDb = database.promise();
    try {
        const id = Number(req.params.id);
        const { estado } = req.body;

        const estadosValidos = ['PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'PAGADO'];
        if (!estado || !estadosValidos.includes(estado)) {
            return res.status(400).json({ ok: false, error: `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}` });
        }
        if (!id || isNaN(id)) {
            return res.status(400).json({ ok: false, error: 'ID de crédito inválido' });
        }

        const [resultCredito] = await promiseDb.query(
            'UPDATE credito SET estado = ? WHERE id_credito = ?',
            [estado, id]
        );

        if (resultCredito.affectedRows === 0) {
            return res.status(404).json({ ok: false, error: `Crédito con id ${id} no encontrado` });
        }

        // Actualizar etapa del trámite
        let nuevaEtapa = null;
        if (estado === 'APROBADO')  nuevaEtapa = 'APROBACION';
        if (estado === 'RECHAZADO') nuevaEtapa = 'FINALIZADO';

        if (nuevaEtapa) {
            await promiseDb.query(
                'UPDATE tramite SET etapa = ? WHERE id_credito = ?',
                [nuevaEtapa, id]
            );
        }

        return res.status(200).json({ ok: true, mensaje: `Crédito ${id} actualizado a estado ${estado}` });

    } catch (error) {
        console.error('Error al actualizar estado del crédito:', error);
        return res.status(500).json({ ok: false, error: 'Error interno al actualizar el estado', detalle: error.message });
    }
};

// ─── Obtener todos los créditos de un RUT (todos los estados) ──────────
const obtenerCreditosPorRut = async (req, res) => {
    const promiseDb = database.promise();
    try {
        const { rut } = req.query;
        if (!rut) return res.status(400).json({ ok: false, error: 'Falta el parámetro rut' });

        const [rows] = await promiseDb.query(`
            SELECT
                c.id_credito,
                cl.rut,
                cl.num_documento,
                c.monto_solicitado as monto,
                c.numero_cuotas as cuotas,
                c.tasa_interes_anual,
                c.monto_total_pagar as monto_total,
                c.monto_cuota,
                c.estado,
                c.fecha_solicitud,
                c.fecha_primer_pago,
                (SELECT COUNT(*) FROM credito_seguro cs JOIN seguro s ON cs.id_seguro = s.id_seguro WHERE cs.id_credito = c.id_credito AND s.nombre LIKE '%Desgravamen%') > 0 as incluye_seguro_desgravamen,
                (SELECT COUNT(*) FROM credito_seguro cs JOIN seguro s ON cs.id_seguro = s.id_seguro WHERE cs.id_credito = c.id_credito AND s.nombre LIKE '%Cesantía%') > 0 as incluye_seguro_cesantia
            FROM credito c
            JOIN cliente cl ON c.id_cliente = cl.id_cliente
            WHERE REPLACE(cl.rut, '.', '') = ?
            ORDER BY c.id_credito DESC
        `, [rut.replace(/\./g, '').trim()]);

        res.status(200).json({ ok: true, total: rows.length, data: rows });
    } catch (error) {
        console.error('Error al obtener créditos por rut:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener créditos', detalle: error.message });
    }
};

// ─── Registrar nuevo cliente ──────────────────────────────────────────────────
const registrarCliente = async (req, res) => {
    const promiseDb = database.promise();
    try {
        const { rut, nombre, apellido, telefono, correo, password } = req.body;

        if (!rut || !nombre || !apellido || !telefono || !correo) {
            return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios: rut, nombre, apellido, telefono, correo' });
        }

        // Asegurarse de que región y comuna por defecto existan
        await promiseDb.query("INSERT IGNORE INTO region (id_region, nombre) VALUES (1, 'Región Metropolitana')");
        await promiseDb.query("INSERT IGNORE INTO comuna (id_comuna, id_region, nombre) VALUES (1, 1, 'Santiago')");

        const [result] = await promiseDb.query(
            'INSERT INTO cliente (id_region, id_comuna, rut, nombre, apellido, telefono, correo, password) VALUES (1, 1, ?, ?, ?, ?, ?, ?)',
            [rut.trim(), nombre.trim(), apellido.trim(), telefono.trim(), correo.trim(), password ? password.trim() : null]
        );

        return res.status(201).json({
            ok: true,
            mensaje: 'Cliente registrado correctamente',
            id_cliente: result.insertId
        });
    } catch (error) {
        // Duplicate entry = RUT ya registrado
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ ok: false, error: 'Este RUT ya está registrado. Inicia sesión directamente.' });
        }
        // Trigger de correo inválido
        if (error.sqlState === '45000') {
            return res.status(400).json({ ok: false, error: error.message });
        }
        console.error('Error al registrar cliente:', error);
        return res.status(500).json({ ok: false, error: 'Error interno al registrar', detalle: error.message });
    }
};

// ─── Validar si un RUT existe como cliente en la BD ──────────────────────────
const validarCliente = async (req, res) => {
    const promiseDb = database.promise();
    try {
        const { rut, password } = req.query;
        if (!rut) return res.status(400).json({ ok: false, error: 'Falta el parámetro rut' });

        const [rows] = await promiseDb.query(
            'SELECT id_cliente, rut, nombre, apellido, password FROM cliente WHERE REPLACE(rut, \'.\', \'\') = ? LIMIT 1',
            [rut.replace(/\./g, '').trim()]
        );

        if (rows.length === 0) {
            return res.status(404).json({ ok: false, existe: false, error: 'RUT no encontrado' });
        }

        // FIX: verificar contraseña si el cliente tiene una registrada
        const cliente = rows[0];
        if (cliente.password !== null && cliente.password !== undefined) {
            if (!password) {
                return res.status(401).json({ ok: false, existe: true, error: 'Contraseña requerida' });
            }
            if (cliente.password.trim() !== password.trim()) {
                return res.status(401).json({ ok: false, existe: true, error: 'RUT o contraseña incorrectos' });
            }
        }

        return res.status(200).json({
            ok: true,
            existe: true,
            cliente: { id: cliente.id_cliente, rut: cliente.rut, nombre: cliente.nombre, apellido: cliente.apellido }
        });
    } catch (error) {
        console.error('Error al validar cliente:', error);
        return res.status(500).json({ ok: false, error: 'Error interno', detalle: error.message });
    }
};

// ─── Registrar pago de una o más cuotas ──────────────────────────────────────
const registrarPago = async (req, res) => {
    const promiseDb = database.promise();
    try {
        const { id_credito, cuotas } = req.body;
        // cuotas: [{ numero_cuota, monto_pagado }, ...]

        if (!id_credito || !Array.isArray(cuotas) || cuotas.length === 0) {
            return res.status(400).json({ ok: false, error: 'Faltan campos: id_credito y cuotas[]' });
        }

        // Verificar que el crédito existe y está APROBADO
        const [creds] = await promiseDb.query(
            'SELECT id_credito, numero_cuotas, estado FROM credito WHERE id_credito = ?',
            [id_credito]
        );
        if (creds.length === 0) {
            return res.status(404).json({ ok: false, error: 'Crédito no encontrado' });
        }
        if (creds[0].estado !== 'APROBADO') {
            return res.status(400).json({ ok: false, error: `El crédito no está en estado APROBADO (estado actual: ${creds[0].estado})` });
        }

        const totalCuotas = creds[0].numero_cuotas;
        const registrados = [];
        const errores     = [];

        for (const c of cuotas) {
            const num   = Number(c.numero_cuota);
            const monto = Number(c.monto_pagado);
            if (!num || num < 1 || num > totalCuotas || !monto || monto <= 0) {
                errores.push(`Cuota ${num} inválida`);
                continue;
            }
            try {
                await promiseDb.query(
                    'INSERT INTO pago_cuota (id_credito, numero_cuota, monto_pagado) VALUES (?, ?, ?)',
                    [id_credito, num, monto]
                );
                registrados.push(num);
            } catch (e) {
                // Duplicate entry = ya estaba pagada
                errores.push(`Cuota ${num} ya registrada`);
            }
        }

        // Verificar si todas las cuotas están pagadas → marcar crédito como PAGADO
        const [pagadas] = await promiseDb.query(
            'SELECT COUNT(*) as total FROM pago_cuota WHERE id_credito = ?',
            [id_credito]
        );
        if (pagadas[0].total >= totalCuotas) {
            await promiseDb.query(
                "UPDATE credito SET estado = 'PAGADO' WHERE id_credito = ?",
                [id_credito]
            );
            await promiseDb.query(
                "UPDATE tramite SET etapa = 'FINALIZADO' WHERE id_credito = ?",
                [id_credito]
            );
        }

        return res.status(200).json({
            ok: true,
            registrados,
            errores,
            mensaje: `${registrados.length} cuota(s) registrada(s)${errores.length ? `, ${errores.length} error(es)` : ''}`
        });
    } catch (error) {
        console.error('Error al registrar pago:', error);
        return res.status(500).json({ ok: false, error: 'Error interno', detalle: error.message });
    }
};

// ─── Obtener pagos registrados de un crédito ──────────────────────────────────
const obtenerPagosPorCredito = async (req, res) => {
    const promiseDb = database.promise();
    try {
        const { id_credito } = req.params;
        const [rows] = await promiseDb.query(
            'SELECT numero_cuota, monto_pagado, fecha_pago FROM pago_cuota WHERE id_credito = ? ORDER BY numero_cuota',
            [id_credito]
        );
        return res.status(200).json({ ok: true, total: rows.length, data: rows });
    } catch (error) {
        return res.status(500).json({ ok: false, error: 'Error interno', detalle: error.message });
    }
};

// ─── Recomendaciones personalizadas de crédito ───────────────────────────────
// GET /recomendaciones?rut=...&renta=A..E
const obtenerRecomendaciones = async (req, res) => {
    const promiseDb = database.promise();
    try {
        const { rut, renta } = req.query;

        const rentasValidas = ['A', 'B', 'C', 'D', 'E'];
        const rentaNormalizada = (renta || '').toUpperCase();
        if (!rentasValidas.includes(rentaNormalizada)) {
            return res.status(400).json({ ok: false, error: `Renta inválida. Valores permitidos: ${rentasValidas.join(', ')}` });
        }

        // Historial del cliente (si entrega RUT): cantidad de créditos por estado
        // y el monto máximo que alguna vez le aprobaron, para ajustar tasa y score.
        let historial = { totalCreditos: 0, aprobados: 0, rechazados: 0, pagados: 0, montoMaxAprobado: 0 };
        if (rut) {
            const rutNormalizado = rut.replace(/\./g, '').trim();
            const [rows] = await promiseDb.query(`
                SELECT c.estado, c.monto_solicitado
                FROM credito c
                JOIN cliente cl ON c.id_cliente = cl.id_cliente
                WHERE REPLACE(cl.rut, '.', '') = ?
            `, [rutNormalizado]);

            historial.totalCreditos = rows.length;
            historial.aprobados = rows.filter(r => r.estado === 'APROBADO' || r.estado === 'PAGADO').length;
            historial.rechazados = rows.filter(r => r.estado === 'RECHAZADO').length;
            historial.pagados = rows.filter(r => r.estado === 'PAGADO').length;
            historial.montoMaxAprobado = rows
                .filter(r => r.estado === 'APROBADO' || r.estado === 'PAGADO')
                .reduce((max, r) => Math.max(max, Number(r.monto_solicitado) || 0), 0);
        }

        const resultado = generarRecomendaciones({ renta: rentaNormalizada, historial });

        return res.status(200).json({
            ok: true,
            rut: rut || null,
            renta: rentaNormalizada,
            ...resultado
        });
    } catch (error) {
        console.error('Error al generar recomendaciones:', error);
        return res.status(500).json({ ok: false, error: 'Error interno al generar recomendaciones', detalle: error.message });
    }
};

module.exports = {
    createTable,
    crearSimulacion,
    obtenerSimulaciones,
    obtenerSimulacionPorId,
    crearSolicitud,
    obtenerSolicitudes,
    actualizarEstadoSolicitud,
    obtenerCreditosPorRut,
    validarCliente,
    registrarCliente,
    registrarPago,
    obtenerPagosPorCredito,
    obtenerRecomendaciones
};







/*
const crearSimulacion = (req, res) => {
    try {
        console.log('Simulación recibida:', req.body);

        res.status(201).json({
            ok: true,
            mensaje: 'Simulación recibida correctamente',
            data: req.body
        });

    } catch (error) {
        console.error('Error al guardar simulación:', error);

        res.status(500).json({
            ok: false,
            error: 'Error interno al guardar la simulación'
        });
    }
}

module.exports = {
    createTable,
    crearSimulacion
};
*/