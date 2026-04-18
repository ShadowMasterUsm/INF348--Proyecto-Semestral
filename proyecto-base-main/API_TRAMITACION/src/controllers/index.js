const database = require('../db');


//Esta tabla es solo un ejemplo para que puedan ver como se hacen querys a la bdd, después puede ser eliminada
const createTable = (req, res) => {
    const query = 'CREATE TABLE IF NOT EXISTS user(id int AUTO_INCREMENT, firstname VARCHAR(50), lastname VARCHAR(50), email VARCHAR(50), PRIMARY KEY(id))';

    database.query(query, (err) => {
        if (err) throw err;
        res.send('Tabla creada');
    });
};

const crearSimulacion = (req, res) => {
    const {
        tipoCredito,
        rut,
        monto,
        cuotas,
        tasa_interes_anual,
        seguroDesgravamen,
        seguroCesantia,
        mesInicio,
        diaPago
    } = req.body;

    if (!tipoCredito || !rut || !monto || !cuotas) {
        return res.status(400).json({
            ok: false,
            error: 'Faltan campos obligatorios: tipoCredito, rut, monto y cuotas'
        });
    }

    const tasaInteresAnual = Number(tasa_interes_anual) || 12.5;
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

            if (!Number.isNaN(fecha.getTime())) {
                fechaPrimerPago = fecha.toISOString().slice(0, 10);
            }
        }
    }

    const guardarSimulacion = (idTipoCredito) => {
        const query =
            'INSERT INTO simulacion (' +
            'rut, id_tipo_credito, monto, cuotas, tasa_interes_anual, ' +
            'incluye_seguro_desgravamen, incluye_seguro_cesantia, fecha_primer_pago' +
            ') VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

        database.query(query, [
            rutNormalizado,
            idTipoCredito,
            monto,
            cuotas,
            tasaInteresAnual,
            seguroDesgravamen ? 1 : 0,
            seguroCesantia ? 1 : 0,
            fechaPrimerPago
        ], (err, result) => {
            if (err) {
                console.error('Error al guardar simulación:', err);
                return res.status(500).json({
                    ok: false,
                    error: 'Error al guardar en la BD',
                    detalle: err.message
                });
            }

            return res.status(201).json({
                ok: true,
                mensaje: 'Simulación guardada correctamente',
                id_simulacion: result.insertId
            });
        });
    };

    const buscarTipoCreditoQuery =
        'SELECT id_tipo_credito FROM tipo_credito WHERE LOWER(nombre) = ? LIMIT 1';

    database.query(buscarTipoCreditoQuery, [tipoCreditoNormalizado], (err, result) => {
        if (err) {
            console.error('Error al buscar tipo de crédito:', err);
            return res.status(500).json({
                ok: false,
                error: 'Error al consultar tipo de crédito',
                detalle: err.message
            });
        }

        if (result.length > 0) {
            return guardarSimulacion(result[0].id_tipo_credito);
        }

        const crearTipoCreditoQuery =
            'INSERT INTO tipo_credito (nombre, descripcion) VALUES (?, ?)';

        database.query(
            crearTipoCreditoQuery,
            [tipoCreditoNormalizado, 'Tipo de crédito creado automáticamente desde simulación'],
            (insertErr, insertResult) => {
                if (insertErr) {
                    console.error('Error al crear tipo de crédito:', insertErr);
                    return res.status(500).json({
                        ok: false,
                        error: 'Error al crear tipo de crédito',
                        detalle: insertErr.message
                    });
                }

                return guardarSimulacion(insertResult.insertId);
            }
        );
    });
};

const obtenerSimulaciones = (req, res) => {
    const { rut } = req.query;

    let query =
        'SELECT ' +
        'id_simulacion, ' +
        'rut, ' +
        'monto, ' +
        'cuotas, ' +
        'tasa_interes_anual, ' +
        'incluye_seguro_desgravamen, ' +
        'incluye_seguro_cesantia, ' +
        'monto_total, ' +
        'monto_cuota, ' +
        'fecha_primer_pago, ' +
        'fecha ' +
        'FROM simulacion';

    const params = [];
    if (rut) {
        query += ' WHERE rut = ?';
        params.push(rut);
    }

    query += ' ORDER BY id_simulacion DESC';

    database.query(query, params, (err, result) => {
        if (err) {
            console.error('Error al obtener simulaciones:', err);
            return res.status(500).json({
                ok: false,
                error: 'Error al consultar simulaciones',
                detalle: err.message
            });
        }

        return res.status(200).json({
            ok: true,
            total: result.length,
            data: result
        });
    });
};

const obtenerSimulacionPorId = (req, res) => {
    const { id } = req.params;

    const query =
        'SELECT ' +
        'id_simulacion, ' +
        'rut, ' +
        'monto, ' +
        'cuotas, ' +
        'tasa_interes_anual, ' +
        'incluye_seguro_desgravamen, ' +
        'incluye_seguro_cesantia, ' +
        'monto_total, ' +
        'monto_cuota, ' +
        'fecha_primer_pago, ' +
        'fecha ' +
        'FROM simulacion ' +
        'WHERE id_simulacion = ?';

    database.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error al obtener simulación por id:', err);
            return res.status(500).json({
                ok: false,
                error: 'Error al consultar simulación',
                detalle: err.message
            });
        }

        if (result.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'Simulación no encontrada'
            });
        }

        return res.status(200).json({
            ok: true,
            data: result[0]
        });
    });
};

module.exports = {
    createTable,
    crearSimulacion,
    obtenerSimulaciones,
    obtenerSimulacionPorId
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