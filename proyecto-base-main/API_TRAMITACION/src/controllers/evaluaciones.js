/**
 * Controlador para el Servicio S003: Evaluación de Riesgo (HU003)
 * POST /api/evaluaciones/:idSolicitud
 * 
 * Ejecuta automáticamente un análisis de riesgo sobre una solicitud de crédito.
 * Calcula un puntaje de riesgo (0-100) y toma decisión de aprobación/rechazo.
 */

const database = require('../db');

/**
 * Determina el estado y razón de rechazo basado en el puntaje
 */
function determinarDecision(puntaje, scoringDeudas, scoringIngresos) {
    if (puntaje >= 70) {
        return { estado: 'APROBADO', razonRechazo: null };
    }
    
    if (puntaje >= 50) {
        return { estado: 'APROBADO_MANUAL', razonRechazo: null };
    }
    
    // Puntaje < 50 → RECHAZADO
    let razonRechazo = 'No cumple criterios de evaluación de riesgo';
    if (scoringDeudas < 40) {
        razonRechazo = 'Deudas superiores al 70% de ingresos';
    } else if (scoringIngresos < 50) {
        razonRechazo = 'Ingresos insuficientes para el monto solicitado';
    }
    
    return { estado: 'RECHAZADO', razonRechazo };
}

/**
 * Calcula el scoring de ingresos basado en relación ingresos/monto
 * Mayor relación = mejor puntaje
 */
function calcularScoringIngresos(ingresos, monto) {
    const relacion = ingresos / monto;
    
    if (relacion >= 0.5) return 95;
    if (relacion >= 0.4) return 85;
    if (relacion >= 0.3) return 75;
    if (relacion >= 0.25) return 65;
    if (relacion >= 0.2) return 55;
    if (relacion >= 0.15) return 45;
    return 30;
}

/**
 * Calcula el scoring de deudas basado en relación deudas/ingresos
 * Menor relación = mejor puntaje
 */
function calcularScoringDeudas(ingresos, deudas) {
    if (ingresos === 0) return 30;
    
    const relacion = deudas / ingresos;
    
    if (relacion <= 0.2) return 100;
    if (relacion <= 0.3) return 90;
    if (relacion <= 0.4) return 80;
    if (relacion <= 0.5) return 70;
    if (relacion <= 0.6) return 55;
    if (relacion <= 0.7) return 40;
    return 20;
}

/**
 * Calcula el scoring de antigüedad laboral
 * Mayor antigüedad = mejor puntaje
 */
function calcularScoringAntiguedad(meses) {
    if (meses >= 60) return 100; // 5+ años
    if (meses >= 36) return 90;  // 3+ años
    if (meses >= 24) return 80;  // 2+ años
    if (meses >= 12) return 70;  // 1+ años
    if (meses >= 6) return 50;   // 6 meses
    return 30;
}

/**
 * POST /api/evaluaciones/:idSolicitud
 * Ejecuta la evaluación de riesgo de una solicitud
 */
exports.evaluarRiesgo = (req, res) => {
    const { idSolicitud } = req.params;
    const { fuentesExternas = false, incluyeValidacionDocumentos = true } = req.body;

    if (!idSolicitud || idSolicitud <= 0) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'idSolicitud', mensaje: 'ID de solicitud inválido' }]
        });
    }

    // Obtener datos de la solicitud
    const querySolicitud = `
        SELECT 
            c.id_credito,
            c.id_cliente,
            c.monto_solicitado,
            c.numero_cuotas,
            c.estado,
            af.ingresos,
            af.deudas,
            af.antiguedad_laboral,
            tc.nombre as tipo_credito
        FROM credito c
        JOIN antecedentes_financieros af ON c.id_cliente = af.id_cliente
        JOIN tipo_credito tc ON c.id_tipo_credito = tc.id_tipo_credito
        WHERE c.id_credito = ?
    `;

    database.query(querySolicitud, [idSolicitud], (err, results) => {
        if (err) {
            console.error('Error al obtener solicitud:', err);
            return res.status(500).json({
                error: 'ERROR_INTERNO',
                mensaje: 'Error al procesar la evaluación'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: 'SOLICITUD_NO_ENCONTRADA',
                mensaje: `No existe solicitud con id ${idSolicitud}`
            });
        }

        const solicitud = results[0];

        // Verificar que está en estado PENDIENTE
        if (solicitud.estado !== 'PENDIENTE' && solicitud.estado !== 'EN_REVISION') {
            return res.status(400).json({
                error: 'ESTADO_INVALIDO',
                mensaje: 'La solicitud debe estar en estado PENDIENTE_EVALUACION para evaluar'
            });
        }

        // Calcular puntajes parciales
        const scoringIngresos = calcularScoringIngresos(solicitud.ingresos, solicitud.monto_solicitado);
        const scoringDeudas = calcularScoringDeudas(solicitud.ingresos, solicitud.deudas);
        const scoringAntiguedad = calcularScoringAntiguedad(solicitud.antiguedad_laboral);
        const scoringDocumentos = incluyeValidacionDocumentos ? 85 : 50; // Por ahora, valor fijo

        // Calcular puntaje final usando ponderación
        const puntaje = Math.round(
            (scoringIngresos * 0.25) +
            (scoringDeudas * 0.35) +
            (scoringAntiguedad * 0.20) +
            (scoringDocumentos * 0.20)
        );

        // Determinar estado y razón
        const { estado, razonRechazo } = determinarDecision(puntaje, scoringDeudas, scoringIngresos);

        // Actualizar estado de la solicitud
        const queryUpdateCredito = `
            UPDATE credito
            SET estado = ?
            WHERE id_credito = ?
        `;

        database.query(
            queryUpdateCredito,
            [estado === 'APROBADO' ? 'APROBADO' : (estado === 'RECHAZADO' ? 'RECHAZADO' : 'EN_REVISION'), idSolicitud],
            (err) => {
                if (err) {
                    console.error('Error al actualizar crédito:', err);
                    return res.status(500).json({
                        error: 'ERROR_INTERNO',
                        mensaje: 'Error al guardar resultado de evaluación'
                    });
                }

                // Insertar registro de evaluación
                const queryInsertEvaluacion = `
                    INSERT INTO evaluation_riesgo (
                        id_credito, id_analista, puntaje, estado,
                        observaciones, fecha_evaluacion
                    ) VALUES (?, NULL, ?, ?, ?, NOW())
                `;

                const observaciones = estado === 'RECHAZADO' ? razonRechazo : 
                    (estado === 'APROBADO' ? 'Cliente presenta buen perfil' : 'Requiere revisión manual por analista');

                database.query(
                    queryInsertEvaluacion,
                    [idSolicitud, puntaje, estado, observaciones],
                    (err, resultsEval) => {
                        if (err) {
                            console.error('Error al insertar evaluación:', err);
                            return res.status(500).json({
                                error: 'ERROR_INTERNO',
                                mensaje: 'Error al registrar evaluación'
                            });
                        }

                        // Respuesta
                        const respuesta = {
                            idSolicitud,
                            idEvaluacion: resultsEval.insertId,
                            estado,
                            puntaje,
                            detalleEvaluacion: {
                                scoringIngresos,
                                scoringDeudas,
                                scoringAntiguedad,
                                scoringDocumentos,
                                factorRiesgo: ((100 - puntaje) / 100).toFixed(2)
                            },
                            montoAprobado: solicitud.monto_solicitado,
                            tasaAsignada: 0.085, // Tasa base
                            observaciones,
                            fechaEvaluacion: new Date().toISOString()
                        };

                        if (estado === 'RECHAZADO') {
                            respuesta.razonRechazo = razonRechazo;
                            respuesta.proximoIntento = '6 meses';
                        } else if (estado === 'APROBADO_MANUAL') {
                            respuesta.asignadoA = 'juan.garcia@banco.cl';
                            respuesta.proximoPaso = 'Revisión manual por analista';
                        } else {
                            respuesta.proximoPaso = 'Esperar firma digital del cliente';
                        }

                        res.status(200).json(respuesta);
                    }
                );
            }
        );
    });
};

/**
 * GET /api/evaluaciones/:idSolicitud
 * Obtiene el resultado de evaluación de una solicitud
 */
exports.obtenerEvaluacion = (req, res) => {
    const { idSolicitud } = req.params;

    if (!idSolicitud || idSolicitud <= 0) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'idSolicitud', mensaje: 'ID de solicitud inválido' }]
        });
    }

    const query = `
        SELECT 
            e.id_evaluacion as idEvaluacion,
            e.id_credito as idSolicitud,
            e.puntaje,
            e.estado,
            e.observaciones,
            e.fecha_evaluacion as fechaEvaluacion,
            c.monto_solicitado as montoAprobado
        FROM evaluation_riesgo e
        JOIN credito c ON e.id_credito = c.id_credito
        WHERE e.id_credito = ?
        ORDER BY e.fecha_evaluacion DESC
        LIMIT 1
    `;

    database.query(query, [idSolicitud], (err, results) => {
        if (err) {
            console.error('Error al obtener evaluación:', err);
            return res.status(500).json({
                error: 'ERROR_INTERNO',
                mensaje: 'Error al obtener la evaluación'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: 'EVALUACION_NO_ENCONTRADA',
                mensaje: 'No existe evaluación para esta solicitud'
            });
        }

        res.status(200).json(results[0]);
    });
};

module.exports = exports;
