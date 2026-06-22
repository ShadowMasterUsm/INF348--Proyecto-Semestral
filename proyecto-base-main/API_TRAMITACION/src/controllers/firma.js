/**
 * Controlador para el Servicio S005: Firma Digital (HU005)
 * POST /api/solicitudes/:idSolicitud/firma
 * 
 * Permite al cliente firmar digitalmente su contrato de crédito aprobado.
 * Tras la firma exitosa, se activa el préstamo y se generan las cuotas.
 */

const database = require('../db');

/**
 * POST /api/solicitudes/:idSolicitud/firma
 * Registra la firma digital y activa el préstamo
 * Requiere: Authorization: Bearer [token]
 */
exports.realizarFirmaDigital = (req, res) => {
    const { idSolicitud } = req.params;
    const {
        tokenFirma,
        ipCliente,
        navegador
    } = req.body;

    if (!idSolicitud || idSolicitud <= 0) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'idSolicitud', mensaje: 'ID de solicitud inválido' }]
        });
    }

    if (!tokenFirma || tokenFirma.trim().length === 0) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'tokenFirma', mensaje: 'Token de firma es requerido' }]
        });
    }

    // Obtener datos del crédito
    const queryCredito = `
        SELECT 
            c.id_credito,
            c.id_cliente,
            c.monto_solicitado,
            c.numero_cuotas,
            c.fecha_primer_pago,
            c.tasa_interes_anual,
            c.monto_total_pagar,
            c.monto_cuota,
            c.estado,
            cl.nombre,
            cl.apellido,
            cl.correo
        FROM credito c
        JOIN cliente cl ON c.id_cliente = cl.id_cliente
        WHERE c.id_credito = ?
    `;

    database.query(queryCredito, [idSolicitud], (err, resultsCredito) => {
        if (err) {
            console.error('Error al obtener crédito:', err);
            return res.status(500).json({
                error: 'ERROR_INTERNO',
                mensaje: 'Error al procesar la firma',
                detalles: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }

        if (!resultsCredito || resultsCredito.length === 0) {
            return res.status(404).json({
                error: 'SOLICITUD_NO_ENCONTRADA',
                mensaje: `No existe solicitud con id ${idSolicitud}`
            });
        }

        const credito = resultsCredito[0];

        // Verificar que está aprobado
        if (credito.estado !== 'APROBADO') {
            return res.status(400).json({
                error: 'SOLICITUD_NO_APROBADA',
                mensaje: 'La solicitud debe estar en estado APROBADO para firmar'
            });
        }

        // Simular validación de token (en producción sería más riguroso)
        if (tokenFirma === '' || tokenFirma.length < 5) {
            return res.status(400).json({
                error: 'TOKEN_FIRMA_INVALIDO',
                mensaje: 'El token de firma no es válido o ha expirado'
            });
        }

        // Crear préstamo
        const queryInsertPrestamo = `
            INSERT INTO prestamo (
                id_credito, estado, fecha_primer_pago, fecha_activacion
            ) VALUES (?, 'ACTIVADO', ?, NOW())
        `;

        database.query(
            queryInsertPrestamo,
            [idSolicitud, credito.fecha_primer_pago],
            (err, resultsPrestamo) => {
                if (err) {
                    console.error('Error al crear préstamo:', err);
                    return res.status(500).json({
                        error: 'ERROR_INTERNO',
                        mensaje: 'Error al activar el préstamo'
                    });
                }

                const idPrestamo = resultsPrestamo.insertId;

                // Generar cuotas
                generarCuotas(idPrestamo, credito, (errCuotas) => {
                    if (errCuotas) {
                        return res.status(500).json({
                            error: 'ERROR_INTERNO',
                            mensaje: 'Error al generar cuotas'
                        });
                    }

                    // Actualizar estado del crédito a ACTIVADO
                    const queryUpdateCredito = `
                        UPDATE credito
                        SET estado = 'ACTIVADO'
                        WHERE id_credito = ?
                    `;

                    database.query(queryUpdateCredito, [idSolicitud], (err) => {
                        if (err) {
                            console.error('Error al actualizar crédito:', err);
                            return res.status(500).json({
                                error: 'ERROR_INTERNO',
                                mensaje: 'Error al finalizar activación'
                            });
                        }

                        // Generar número de comprobante
                        const numeroComprobante = `FIRMA-${new Date().getFullYear()}-${String(idSolicitud).padStart(6, '0')}`;
                        const huella = Buffer.from(tokenFirma + Date.now()).toString('base64').substring(0, 20);

                        // Calcular fecha última cuota
                        const fechaPrimerPago = new Date(credito.fecha_primer_pago);
                        const fechaUltimaCuota = new Date(fechaPrimerPago);
                        fechaUltimaCuota.setMonth(fechaUltimaCuota.getMonth() + credito.numero_cuotas);

                        // Respuesta exitosa
                        res.status(200).json({
                            idSolicitud,
                            idPrestamo,
                            estado: 'ACTIVADO',
                            cliente: {
                                nombre: credito.nombre + ' ' + credito.apellido
                            },
                            prestamo: {
                                montoTotal: credito.monto_total_pagar || (credito.monto_solicitado * 1.1),
                                montoCuota: credito.monto_cuota,
                                numeroCuotas: credito.numero_cuotas,
                                fechaPrimerPago: credito.fecha_primer_pago,
                                fechaUltimaCuota: fechaUltimaCuota.toISOString().split('T')[0]
                            },
                            cuotas: [
                                {
                                    numeroCuota: 1,
                                    monto: credito.monto_cuota,
                                    fechaVencimiento: credito.fecha_primer_pago,
                                    estado: 'PENDIENTE'
                                },
                                {
                                    numeroCuota: 2,
                                    monto: credito.monto_cuota,
                                    fechaVencimiento: calcularFechaSiguiente(credito.fecha_primer_pago),
                                    estado: 'PENDIENTE'
                                }
                                // Las demás cuotas se generan en la BD
                            ],
                            comprobante: {
                                numeroComprobante,
                                fechaFirma: new Date().toISOString(),
                                huella
                            },
                            mensaje: '¡Crédito activado exitosamente! Recibirá el desembolso en máximo 48 horas.',
                            enlaceDescargarContrato: `https://banco.cl/descargar/${idSolicitud}`
                        });
                    });
                });
            }
        );
    });
};

/**
 * Genera todas las cuotas del préstamo
 */
function generarCuotas(idPrestamo, credito, callback) {
    let contadorCuotas = 0;
    const totalCuotas = credito.numero_cuotas;
    let fechaVencimiento = new Date(credito.fecha_primer_pago);

    const queryInsertCuota = `
        INSERT INTO cuota (
            id_prestamo, numero_cuota, monto, fecha_vencimiento, 
            estado, fecha_creacion
        ) VALUES (?, ?, ?, ?, 'PENDIENTE', NOW())
    `;

    // Generar cuotas una por una
    const insertarCuota = () => {
        contadorCuotas++;

        if (contadorCuotas > totalCuotas) {
            callback(null);
            return;
        }

        database.query(
            queryInsertCuota,
            [
                idPrestamo,
                contadorCuotas,
                credito.monto_cuota,
                fechaVencimiento.toISOString().split('T')[0]
            ],
            (err) => {
                if (err) {
                    callback(err);
                    return;
                }

                // Avanzar al siguiente mes
                fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
                insertarCuota();
            }
        );
    };

    insertarCuota();
}

/**
 * Calcula la fecha siguiente (mismo día del mes siguiente)
 */
function calcularFechaSiguiente(fechaString) {
    const fecha = new Date(fechaString);
    fecha.setMonth(fecha.getMonth() + 1);
    return fecha.toISOString().split('T')[0];
}

/**
 * GET /api/solicitudes/:idSolicitud/firma
 * Obtiene el estado de la firma de una solicitud
 */
exports.obtenerEstadoFirma = (req, res) => {
    const { idSolicitud } = req.params;

    if (!idSolicitud || idSolicitud <= 0) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'idSolicitud', mensaje: 'ID de solicitud inválido' }]
        });
    }

    const query = `
        SELECT 
            c.estado as estadoCredito,
            p.id_prestamo,
            p.estado as estadoPrestamo,
            p.fecha_activacion,
            COUNT(cu.id_cuota) as totalCuotas
        FROM credito c
        LEFT JOIN prestamo p ON c.id_credito = p.id_credito
        LEFT JOIN cuota cu ON p.id_prestamo = cu.id_prestamo
        WHERE c.id_credito = ?
        GROUP BY c.id_credito
    `;

    database.query(query, [idSolicitud], (err, results) => {
        if (err) {
            console.error('Error al obtener firma:', err);
            return res.status(500).json({
                error: 'ERROR_INTERNO',
                mensaje: 'Error al obtener estado de firma'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: 'SOLICITUD_NO_ENCONTRADA',
                mensaje: `No existe solicitud con id ${idSolicitud}`
            });
        }

        const firma = results[0];

        res.status(200).json({
            idSolicitud,
            estadoCredito: firma.estadoCredito,
            prestamo: firma.id_prestamo ? {
                idPrestamo: firma.id_prestamo,
                estado: firma.estadoPrestamo,
                fechaActivacion: firma.fecha_activacion,
                totalCuotasGeneradas: firma.totalCuotas
            } : null,
            firmado: firma.id_prestamo !== null,
            mensaje: firma.id_prestamo ? 
                'Crédito activado y cuotas generadas' :
                'Pendiente de firma digital'
        });
    });
};

module.exports = exports;
