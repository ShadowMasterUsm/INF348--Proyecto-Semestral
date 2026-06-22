/**
 * Controlador para el Servicio S004: Consulta de Estado (HU004)
 * GET /api/solicitudes/:idSolicitud/estado
 * 
 * Retorna el estado actual de una solicitud permitiendo que el cliente
 * consulte su progreso en el proceso de tramitación.
 */

const database = require('../db');

// Constantes de tablas
const TABLES = {
    CREDITO: 'credito',
    TRAMITE: 'tramite',
    EVALUATION_RIESGO: 'evaluation_riesgo',
    CLIENTE: 'cliente',
    TIPO_CREDITO: 'tipo_credito'
};

/**
 * GET /api/solicitudes/:idSolicitud/estado
 * Obtiene el estado actual y timeline de una solicitud
 * Requiere: Authorization: Bearer [token]
 */
exports.obtenerEstado = (req, res) => {
    const { idSolicitud } = req.params;

    if (!idSolicitud || idSolicitud <= 0) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'idSolicitud', mensaje: 'ID de solicitud inválido' }]
        });
    }

    // Obtener datos principales de la solicitud
    const querySolicitud = `
        SELECT 
            c.id_credito,
            c.id_cliente,
            c.estado,
            c.monto_solicitado,
            c.numero_cuotas,
            c.fecha_solicitud,
            cl.rut,
            cl.nombre,
            cl.apellido,
            tc.nombre as tipo_credito
        FROM credito c
        JOIN cliente cl ON c.id_cliente = cl.id_cliente
        JOIN tipo_credito tc ON c.id_tipo_credito = tc.id_tipo_credito
        WHERE c.id_credito = ?
    `;

    database.query(querySolicitud, [idSolicitud], (err, resultsSolicitud) => {
        if (err) {
            console.error('Error al obtener solicitud:', err);
            return res.status(500).json({
                error: 'ERROR_INTERNO',
                mensaje: 'Error al obtener el estado'
            });
        }

        if (resultsSolicitud.length === 0) {
            return res.status(404).json({
                error: 'NO_HAY_SOLICITUDES_PENDIENTES',
                mensaje: 'No hay solicitudes en proceso para este cliente'
            });
        }

        const solicitud = resultsSolicitud[0];

        // Obtener información del trámite
        const queryTramite = `
            SELECT 
                id_tramite,
                etapa,
                fecha_inicio,
                fecha_ultima_actualizacion
            FROM tramite
            WHERE id_credito = ?
        `;

        database.query(queryTramite, [idSolicitud], (err, resultsTramite) => {
            if (err) {
                console.error('Error al obtener trámite:', err);
                return res.status(500).json({
                    error: 'ERROR_INTERNO',
                    mensaje: 'Error al obtener el estado'
                });
            }

            let idTramite = null;
            let etapaActual = 'RECEPCION';

            if (resultsTramite.length > 0) {
                idTramite = resultsTramite[0].id_tramite;
                etapaActual = resultsTramite[0].etapa;
            }

            // Obtener evaluación si existe
            const queryEvaluacion = `
                SELECT 
                    puntaje,
                    estado,
                    observaciones,
                    fecha_evaluacion
                FROM evaluation_riesgo
                WHERE id_credito = ?
                ORDER BY fecha_evaluacion DESC
                LIMIT 1
            `;

            database.query(queryEvaluacion, [idSolicitud], (err, resultsEvaluacion) => {
                if (err) {
                    console.error('Error al obtener evaluación:', err);
                    return res.status(500).json({
                        error: 'ERROR_INTERNO',
                        mensaje: 'Error al obtener el estado'
                    });
                }

                // Construir timeline
                const timeline = [];
                
                // Etapa RECEPCION
                timeline.push({
                    etapa: 'RECEPCION',
                    estado: 'COMPLETADO',
                    fecha: solicitud.fecha_solicitud
                });

                // Etapa REVISION
                if (solicitud.estado === 'EN_REVISION' || 
                    solicitud.estado === 'APROBADO' || 
                    solicitud.estado === 'RECHAZADO') {
                    timeline.push({
                        etapa: 'REVISION',
                        estado: 'COMPLETADO',
                        fecha: resultsEvaluacion.length > 0 ? resultsEvaluacion[0].fecha_evaluacion : null
                    });
                } else {
                    timeline.push({
                        etapa: 'REVISION',
                        estado: 'EN_PROCESO',
                        fecha: null
                    });
                }

                // Etapa VALIDACION
                if (solicitud.estado === 'APROBADO' || solicitud.estado === 'RECHAZADO') {
                    timeline.push({
                        etapa: 'VALIDACION',
                        estado: 'COMPLETADO',
                        fecha: null
                    });
                } else {
                    timeline.push({
                        etapa: 'VALIDACION',
                        estado: 'PENDIENTE',
                        fecha: null
                    });
                }

                // Respuesta base
                let respuesta = {
                    idSolicitud,
                    estado: solicitud.estado,
                    cliente: {
                        rut: solicitud.rut,
                        nombre: solicitud.nombre + ' ' + solicitud.apellido
                    },
                    credito: {
                        montoSolicitado: solicitud.monto_solicitado,
                        numeroCuotas: solicitud.numero_cuotas,
                        tipoCredito: solicitud.tipo_credito
                    },
                    timeline: timeline
                };

                // Agregar información según el estado
                if (solicitud.estado === 'APROBADO' && resultsEvaluacion.length > 0) {
                    respuesta.evaluacion = {
                        puntaje: resultsEvaluacion[0].puntaje,
                        estado: resultsEvaluacion[0].estado,
                        tasaAsignada: 0.085,
                        montoAprobado: solicitud.monto_solicitado
                    };
                    respuesta.proximoPaso = 'Realizar firma digital del contrato';
                    respuesta.enlaceFirma = `https://banco.cl/firmar/${idSolicitud}`;
                    
                    // Calcular fecha de validez (30 días)
                    const fechaValidez = new Date(resultsEvaluacion[0].fecha_evaluacion);
                    fechaValidez.setDate(fechaValidez.getDate() + 30);
                    respuesta.validoHasta = fechaValidez.toISOString();

                } else if (solicitud.estado === 'RECHAZADO' && resultsEvaluacion.length > 0) {
                    respuesta.evaluacion = {
                        puntaje: resultsEvaluacion[0].puntaje,
                        estado: resultsEvaluacion[0].estado,
                        razonRechazo: resultsEvaluacion[0].observaciones
                    };
                    respuesta.proximoPaso = 'Puede reintentar en 6 meses';

                } else if (solicitud.estado === 'PENDIENTE' || solicitud.estado === 'EN_REVISION') {
                    respuesta.proximaActualizacion = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                    respuesta.mensajeEstado = 'Su solicitud está siendo revisada. Le notificaremos cuando la evaluación esté lista.';
                }

                res.status(200).json(respuesta);
            });
        });
    });
};

/**
 * GET /api/solicitudes/cliente/:rut/estado
 * Obtiene el estado de todas las solicitudes de un cliente
 */
exports.obtenerEstadoPorCliente = (req, res) => {
    const { rut } = req.params;

    if (!rut || !/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/.test(rut)) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'rut', mensaje: 'RUT inválido' }]
        });
    }

    const query = `
        SELECT 
            c.id_credito as idSolicitud,
            c.estado,
            c.monto_solicitado as montoSolicitado,
            c.numero_cuotas as numeroCuotas,
            c.fecha_solicitud as fechaSolicitud,
            tc.nombre as tipoCredito
        FROM credito c
        JOIN cliente cl ON c.id_cliente = cl.id_cliente
        JOIN tipo_credito tc ON c.id_tipo_credito = tc.id_tipo_credito
        WHERE cl.rut = ?
        ORDER BY c.fecha_solicitud DESC
    `;

    database.query(query, [rut], (err, results) => {
        if (err) {
            console.error('Error al obtener solicitudes:', err);
            return res.status(500).json({
                error: 'ERROR_INTERNO',
                mensaje: 'Error al obtener el estado'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: 'NO_HAY_SOLICITUDES_PENDIENTES',
                mensaje: 'No hay solicitudes en proceso para este cliente'
            });
        }

        res.status(200).json({
            rut,
            cantidad: results.length,
            solicitudes: results
        });
    });
};

module.exports = exports;
