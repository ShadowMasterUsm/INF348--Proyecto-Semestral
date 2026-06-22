/**
 * Controlador para el Servicio S002: Solicitud de Crédito (HU002)
 * POST /api/solicitudes
 * 
 * Registra una nueva solicitud formal de crédito con datos personales y documentación.
 * Requiere autenticación.
 */

const database = require('../db');

/**
 * Valida el formato de RUT chileno
 */
function validarRUT(rut) {
    return /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/.test(rut);
}

/**
 * Valida el formato de email
 */
function validarEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Valida teléfono (formato internacional)
 */
function validarTelefono(telefono) {
    return /^\+?[\d\s\-()]{10,}$/.test(telefono);
}

/**
 * POST /api/solicitudes
 * Crea una nueva solicitud de crédito
 * Requiere: Authorization: Bearer [token]
 */
exports.crearSolicitud = (req, res) => {
    const { cliente, credito, antecedentes } = req.body;

    // Validaciones de estructura
    if (!cliente || !credito || !antecedentes) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [
                { campo: 'body', mensaje: 'Debe proporcionar cliente, credito y antecedentes' }
            ]
        });
    }

    const errores = [];

    // Validar datos del cliente
    if (!cliente.rut || !validarRUT(cliente.rut)) {
        errores.push({ campo: 'cliente.rut', mensaje: 'RUT inválido (formato: XX.XXX.XXX-X)' });
    }

    if (!cliente.nombre || cliente.nombre.trim().length === 0 || cliente.nombre.length > 50) {
        errores.push({ campo: 'cliente.nombre', mensaje: 'Nombre requerido (máx 50 caracteres)' });
    }

    if (!cliente.apellido || cliente.apellido.trim().length === 0 || cliente.apellido.length > 50) {
        errores.push({ campo: 'cliente.apellido', mensaje: 'Apellido requerido (máx 50 caracteres)' });
    }

    if (!cliente.correo || !validarEmail(cliente.correo)) {
        errores.push({ campo: 'cliente.correo', mensaje: 'Correo inválido' });
    }

    if (!cliente.telefono || !validarTelefono(cliente.telefono)) {
        errores.push({ campo: 'cliente.telefono', mensaje: 'Teléfono inválido' });
    }

    if (!cliente.idRegion || cliente.idRegion <= 0) {
        errores.push({ campo: 'cliente.idRegion', mensaje: 'idRegion es requerido' });
    }

    if (!cliente.idComuna || cliente.idComuna <= 0) {
        errores.push({ campo: 'cliente.idComuna', mensaje: 'idComuna es requerido' });
    }

    // Validar datos del crédito
    if (!credito.montoSolicitado || credito.montoSolicitado < 1000000 || credito.montoSolicitado > 60000000) {
        errores.push({ campo: 'credito.montoSolicitado', mensaje: 'Monto debe estar entre 1,000,000 y 60,000,000' });
    }

    if (!credito.numeroCuotas || credito.numeroCuotas < 1 || credito.numeroCuotas > 60) {
        errores.push({ campo: 'credito.numeroCuotas', mensaje: 'Cuotas deben estar entre 1 y 60' });
    }

    if (!credito.fechaPrimerPago) {
        errores.push({ campo: 'credito.fechaPrimerPago', mensaje: 'Fecha de primer pago es requerida' });
    }

    if (!credito.idTipoCredito || credito.idTipoCredito <= 0) {
        errores.push({ campo: 'credito.idTipoCredito', mensaje: 'idTipoCredito es requerido' });
    }

    // Validar antecedentes
    if (typeof antecedentes.ingresos !== 'number' || antecedentes.ingresos <= 0) {
        errores.push({ campo: 'antecedentes.ingresos', mensaje: 'Ingresos deben ser mayor a 0' });
    }

    if (typeof antecedentes.deudas !== 'number' || antecedentes.deudas < 0) {
        errores.push({ campo: 'antecedentes.deudas', mensaje: 'Deudas no pueden ser negativas' });
    }

    if (typeof antecedentes.antiguedadLaboral !== 'number' || antecedentes.antiguedadLaboral < 0) {
        errores.push({ campo: 'antecedentes.antiguedadLaboral', mensaje: 'Antigüedad laboral no puede ser negativa' });
    }

    if (errores.length > 0) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: errores
        });
    }

    // Verificar que tipo de crédito existe
    database.query(
        'SELECT id_tipo_credito FROM tipo_credito WHERE id_tipo_credito = ?',
        [credito.idTipoCredito],
        (err, results) => {
            if (err) {
                console.error('Error al validar tipo de crédito:', err);
                return res.status(500).json({
                    error: 'ERROR_INTERNO',
                    mensaje: 'Error al procesar la solicitud'
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    error: 'TIPO_CREDITO_NO_ENCONTRADO',
                    mensaje: `No existe tipo de crédito con id ${credito.idTipoCredito}`
                });
            }

            // Verificar que RUT no esté duplicado
            database.query(
                'SELECT id_cliente FROM cliente WHERE rut = ?',
                [cliente.rut],
                (err, results) => {
                    if (err) {
                        console.error('Error al validar RUT:', err);
                        return res.status(500).json({
                            error: 'ERROR_INTERNO',
                            mensaje: 'Error al procesar la solicitud'
                        });
                    }

                    let idCliente;

                    if (results.length > 0) {
                        // Cliente existe, usar su ID
                        idCliente = results[0].id_cliente;
                        insertarSolicitud(idCliente);
                    } else {
                        // Crear nuevo cliente
                        const queryInsertCliente = `
                            INSERT INTO cliente (
                                id_region, id_comuna, rut, nombre, apellido,
                                telefono, correo, password
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `;

                        database.query(
                            queryInsertCliente,
                            [
                                cliente.idRegion,
                                cliente.idComuna,
                                cliente.rut,
                                cliente.nombre,
                                cliente.apellido,
                                cliente.telefono,
                                cliente.correo,
                                'password_hash' // Será actualizado por autenticación real
                            ],
                            (err, results) => {
                                if (err) {
                                    console.error('Error al crear cliente:', err);
                                    return res.status(500).json({
                                        error: 'ERROR_INTERNO',
                                        mensaje: 'Error al crear cliente'
                                    });
                                }

                                idCliente = results.insertId;
                                insertarSolicitud(idCliente);
                            }
                        );
                    }

                    function insertarSolicitud(idClienteParam) {
                        // Crear solicitud de crédito
                        const queryInsertCredito = `
                            INSERT INTO credito (
                                id_tipo_credito, id_cliente, monto_solicitado,
                                numero_cuotas, fecha_primer_pago, estado, fecha_solicitud
                            ) VALUES (?, ?, ?, ?, ?, 'PENDIENTE', NOW())
                        `;

                        database.query(
                            queryInsertCredito,
                            [
                                credito.idTipoCredito,
                                idClienteParam,
                                credito.montoSolicitado,
                                credito.numeroCuotas,
                                credito.fechaPrimerPago
                            ],
                            (err, resultsCredito) => {
                                if (err) {
                                    console.error('Error al crear crédito:', err);
                                    return res.status(500).json({
                                        error: 'ERROR_INTERNO',
                                        mensaje: 'Error al crear solicitud de crédito'
                                    });
                                }

                                const idCredito = resultsCredito.insertId;

                                // Crear trámite
                                const queryInsertTramite = `
                                    INSERT INTO tramite (
                                        id_credito, id_analista, etapa, fecha_inicio
                                    ) VALUES (?, 1, 'RECEPCION', NOW())
                                `;

                                database.query(
                                    queryInsertTramite,
                                    [idCredito],
                                    (err, resultsTramite) => {
                                        if (err) {
                                            console.error('Error al crear trámite:', err);
                                            return res.status(500).json({
                                                error: 'ERROR_INTERNO',
                                                mensaje: 'Error al crear trámite'
                                            });
                                        }

                                        const idTramite = resultsTramite.insertId;

                                        // Crear antecedentes financieros
                                        const queryInsertAntecedentes = `
                                            INSERT INTO antecedentes_financieros (
                                                id_cliente, ingresos, deudas,
                                                antiguedad_laboral, fecha_actualizacion
                                            ) VALUES (?, ?, ?, ?, NOW())
                                        `;

                                        database.query(
                                            queryInsertAntecedentes,
                                            [
                                                idClienteParam,
                                                antecedentes.ingresos,
                                                antecedentes.deudas,
                                                antecedentes.antiguedadLaboral
                                            ],
                                            (err) => {
                                                if (err) {
                                                    console.error('Error al crear antecedentes:', err);
                                                    return res.status(500).json({
                                                        error: 'ERROR_INTERNO',
                                                        mensaje: 'Error al crear antecedentes'
                                                    });
                                                }

                                                // Respuesta exitosa
                                                res.status(201).json({
                                                    idSolicitud: idCredito,
                                                    idTramite: idTramite,
                                                    estado: 'PENDIENTE_EVALUACION',
                                                    cliente: {
                                                        idCliente: idClienteParam,
                                                        rut: cliente.rut,
                                                        nombre: cliente.nombre,
                                                        apellido: cliente.apellido
                                                    },
                                                    credito: {
                                                        montoSolicitado: credito.montoSolicitado,
                                                        numeroCuotas: credito.numeroCuotas,
                                                        fechaPrimerPago: credito.fechaPrimerPago
                                                    },
                                                    fechaSolicitud: new Date().toISOString(),
                                                    mensaje: 'Solicitud registrada exitosamente. Será evaluada en máximo 24 horas.'
                                                });
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                }
            );
        }
    );
};

/**
 * GET /api/solicitudes/:idSolicitud
 * Obtiene los detalles de una solicitud
 */
exports.obtenerSolicitud = (req, res) => {
    const { idSolicitud } = req.params;

    if (!idSolicitud || idSolicitud <= 0) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'idSolicitud', mensaje: 'ID de solicitud inválido' }]
        });
    }

    const query = `
        SELECT 
            c.id_credito as idSolicitud,
            c.id_cliente as idCliente,
            cl.rut,
            cl.nombre,
            cl.apellido,
            c.id_tipo_credito as idTipoCredito,
            c.monto_solicitado as montoSolicitado,
            c.numero_cuotas as numeroCuotas,
            c.fecha_primer_pago as fechaPrimerPago,
            c.estado,
            c.fecha_solicitud as fechaSolicitud
        FROM credito c
        JOIN cliente cl ON c.id_cliente = cl.id_cliente
        WHERE c.id_credito = ?
    `;

    database.query(query, [idSolicitud], (err, results) => {
        if (err) {
            console.error('Error al obtener solicitud:', err);
            return res.status(500).json({
                error: 'ERROR_INTERNO',
                mensaje: 'Error al procesar la solicitud',
                detalles: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: 'SOLICITUD_NO_ENCONTRADA',
                mensaje: `No existe solicitud con id ${idSolicitud}`
            });
        }

        res.status(200).json(results[0]);
    });
};

/**
 * GET /api/solicitudes/cliente/:rut
 * Obtiene todas las solicitudes de un cliente
 */
exports.obtenerSolicitudesPorCliente = (req, res) => {
    const { rut } = req.params;

    if (!rut || !validarRUT(rut)) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'rut', mensaje: 'RUT inválido' }]
        });
    }

    const query = `
        SELECT 
            c.id_credito as idSolicitud,
            c.id_cliente as idCliente,
            cl.rut,
            cl.nombre,
            cl.apellido,
            c.id_tipo_credito as idTipoCredito,
            c.monto_solicitado as montoSolicitado,
            c.numero_cuotas as numeroCuotas,
            c.fecha_primer_pago as fechaPrimerPago,
            c.estado,
            c.fecha_solicitud as fechaSolicitud
        FROM credito c
        JOIN cliente cl ON c.id_cliente = cl.id_cliente
        WHERE cl.rut = ?
        ORDER BY c.fecha_solicitud DESC
    `;

    database.query(query, [rut], (err, results) => {
        if (err) {
            console.error('Error al obtener solicitudes:', err);
            return res.status(500).json({
                error: 'ERROR_INTERNO',
                mensaje: 'Error al obtener las solicitudes'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: 'NO_HAY_SOLICITUDES_PENDIENTES',
                mensaje: 'No hay solicitudes en proceso para este cliente'
            });
        }

        res.status(200).json({
            cantidad: results.length,
            solicitudes: results
        });
    });
};

module.exports = exports;
