/**
 * Controlador para el Servicio S001: Simulación de Crédito (HU001)
 * POST /api/simulaciones
 * 
 * Permite calcular la cuota mensual, interés total y costo final de un préstamo
 * sin registrar una solicitud formal.
 */

const database = require('../db');

/**
 * Calcula la cuota mensual usando fórmula de amortización francesa
 * i = tasa mensual
 * cuotaMensual = monto * (i * (1 + i)^n) / ((1 + i)^n - 1)
 */
function calcularCuotaMensual(monto, tasaAnual, numeroCuotas) {
    const tasaMensual = tasaAnual / 12 / 100;
    
    if (tasaMensual === 0) {
        return monto / numeroCuotas;
    }
    
    const numerador = tasaMensual * Math.pow(1 + tasaMensual, numeroCuotas);
    const denominador = Math.pow(1 + tasaMensual, numeroCuotas) - 1;
    
    return Math.round((monto * numerador / denominador) * 100) / 100;
}

/**
 * POST /api/simulaciones
 * Crea una simulación de crédito y retorna el cálculo de cuotas e intereses
 */
exports.crearSimulacion = (req, res) => {
    const {
        rut,
        idTipoCredito,
        monto,
        cuotas,
        tasaInteresAnual,
        incluyeSeguroDesgravamen = false,
        incluyeSeguroCesantia = false
    } = req.body;

    // Validaciones de entrada
    const errores = [];

    if (!rut || !/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/.test(rut)) {
        errores.push({ campo: 'rut', mensaje: 'RUT debe tener formato XX.XXX.XXX-X' });
    }

    if (!idTipoCredito || idTipoCredito <= 0) {
        errores.push({ campo: 'idTipoCredito', mensaje: 'idTipoCredito es requerido y debe ser positivo' });
    }

    if (!monto || monto < 1000000 || monto > 60000000) {
        errores.push({ campo: 'monto', mensaje: 'El monto debe estar entre 1,000,000 y 60,000,000' });
    }

    if (!cuotas || cuotas < 1 || cuotas > 60) {
        errores.push({ campo: 'cuotas', mensaje: 'Las cuotas deben estar entre 1 y 60' });
    }

    if (typeof tasaInteresAnual !== 'number' || tasaInteresAnual <= 0) {
        errores.push({ campo: 'tasaInteresAnual', mensaje: 'La tasa de interés debe ser mayor a 0' });
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
        [idTipoCredito],
        (err, results) => {
            if (err) {
                console.error('Error al validar tipo de crédito:', err);
                return res.status(500).json({
                    error: 'ERROR_INTERNO',
                    mensaje: 'Error al procesar la simulación'
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    error: 'TIPO_CREDITO_NO_ENCONTRADO',
                    mensaje: `No existe tipo de crédito con id ${idTipoCredito}`
                });
            }

            // Calcular cuota mensual
            const cuotaMensual = calcularCuotaMensual(monto, tasaInteresAnual, cuotas);
            const interesTotal = Math.round((cuotaMensual * cuotas - monto) * 100) / 100;
            
            // Calcular costos de seguros (porcentaje del monto)
            let costoSeguroDesgravamen = 0;
            let costoSeguroCesantia = 0;
            
            if (incluyeSeguroDesgravamen) {
                costoSeguroDesgravamen = Math.round(monto * 0.005 * 100) / 100; // 0.5%
            }
            if (incluyeSeguroCesantia) {
                costoSeguroCesantia = Math.round(monto * 0.003 * 100) / 100; // 0.3%
            }

            const costoTotal = monto + interesTotal + costoSeguroDesgravamen + costoSeguroCesantia;
            
            // Calcular probabilidad de aprobación (indicativo)
            let probabilidadAprobacion = 75; // Base
            if (cuotas <= 12) probabilidadAprobacion += 10;
            if (monto <= 5000000) probabilidadAprobacion += 5;
            if (tasaInteresAnual <= 10) probabilidadAprobacion += 5;
            probabilidadAprobacion = Math.min(probabilidadAprobacion, 99);

            // Calcular fecha primer pago (30 días desde hoy)
            const fechaPrimerPago = new Date();
            fechaPrimerPago.setDate(fechaPrimerPago.getDate() + 30);

            // Insertar simulación en BD
            const query = `
                INSERT INTO simulacion (
                    rut, id_tipo_credito, monto, cuotas, tasa_interes_anual,
                    incluye_seguro_desgravamen, incluye_seguro_cesantia,
                    monto_total, monto_cuota, fecha_primer_pago,
                    probabilidad_aprobacion, tipo_simulacion, fecha
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            database.query(
                query,
                [
                    rut, idTipoCredito, monto, cuotas, tasaInteresAnual,
                    incluyeSeguroDesgravamen ? 1 : 0,
                    incluyeSeguroCesantia ? 1 : 0,
                    costoTotal, cuotaMensual,
                    fechaPrimerPago.toISOString().split('T')[0],
                    probabilidadAprobacion, 'normal'
                ],
                (err, results) => {
                    if (err) {
                        console.error('Error al crear simulación:', err);
                        return res.status(500).json({
                            error: 'ERROR_INTERNO',
                            mensaje: 'Error al crear la simulación'
                        });
                    }

                    res.status(200).json({
                        idSimulacion: results.insertId,
                        monto,
                        cuotas,
                        tasaInteresAnual,
                        cuotaMensual,
                        interesTotal,
                        costoTotal,
                        costoSeguroDesgravamen,
                        costoSeguroCesantia,
                        probabilidadAprobacion,
                        fechaCreacion: new Date().toISOString()
                    });
                }
            );
        }
    );
};

/**
 * GET /api/simulaciones/:idSimulacion
 * Obtiene los detalles de una simulación
 */
exports.obtenerSimulacion = (req, res) => {
    const { idSimulacion } = req.params;

    if (!idSimulacion || idSimulacion <= 0) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'idSimulacion', mensaje: 'ID de simulación inválido' }]
        });
    }

    const query = `
        SELECT 
            id_simulacion as idSimulacion,
            rut,
            id_tipo_credito as idTipoCredito,
            monto,
            cuotas,
            tasa_interes_anual as tasaInteresAnual,
            monto_total as costoTotal,
            monto_cuota as cuotaMensual,
            fecha_primer_pago as fechaPrimerPago,
            probabilidad_aprobacion as probabilidadAprobacion,
            tipo_simulacion as tipoSimulacion,
            fecha
        FROM simulacion
        WHERE id_simulacion = ?
    `;

    database.query(query, [idSimulacion], (err, results) => {
        if (err) {
            console.error('Error al obtener simulación:', err);
            return res.status(500).json({
                error: 'ERROR_INTERNO',
                mensaje: 'Error al obtener la simulación'
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                error: 'SIMULACION_NO_ENCONTRADA',
                mensaje: `No existe simulación con id ${idSimulacion}`
            });
        }

        res.status(200).json(results[0]);
    });
};

/**
 * GET /api/simulaciones/cliente/:rut
 * Obtiene todas las simulaciones de un cliente por RUT
 */
exports.obtenerSimulacionesPorRut = (req, res) => {
    const { rut } = req.params;

    if (!rut || !/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/.test(rut)) {
        return res.status(400).json({
            error: 'VALIDACION_FALLIDA',
            detalles: [{ campo: 'rut', mensaje: 'RUT debe tener formato XX.XXX.XXX-X' }]
        });
    }

    const query = `
        SELECT 
            id_simulacion as idSimulacion,
            rut,
            id_tipo_credito as idTipoCredito,
            monto,
            cuotas,
            tasa_interes_anual as tasaInteresAnual,
            monto_total as costoTotal,
            monto_cuota as cuotaMensual,
            fecha_primer_pago as fechaPrimerPago,
            probabilidad_aprobacion as probabilidadAprobacion,
            tipo_simulacion as tipoSimulacion,
            fecha
        FROM simulacion
        WHERE rut = ?
        ORDER BY fecha DESC
        LIMIT 10
    `;

    database.query(query, [rut], (err, results) => {
        if (err) {
            console.error('Error al obtener simulaciones:', err);
            return res.status(500).json({
                error: 'ERROR_INTERNO',
                mensaje: 'Error al obtener las simulaciones'
            });
        }

        res.status(200).json({
            cantidad: results.length,
            simulaciones: results
        });
    });
};

module.exports = exports;
