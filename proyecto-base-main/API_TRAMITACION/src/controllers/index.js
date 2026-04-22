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

    /* NUEVO */
    const calcularCuota = (monto, cuotas, tasaAnual) => {
        const tasaMensual = tasaAnual / 12 / 100;

        if (tasaMensual === 0) {
            return monto / cuotas;
        }

        return (monto * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -cuotas));
    };

    const cuota = calcularCuota(monto, cuotas, tasaInteresAnual);
    const total = cuota * cuotas;
    /* NUEVO */

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
            'incluye_seguro_desgravamen, incluye_seguro_cesantia, fecha_primer_pago, ' +
            'monto_total, monto_cuota' +
            ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

        database.query(query, [
            rutNormalizado,
            idTipoCredito,
            monto,
            cuotas,
            tasaInteresAnual,
            seguroDesgravamen ? 1 : 0,
            seguroCesantia ? 1 : 0,
            fechaPrimerPago,
            total,
            cuota
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

const crearSolicitud = async (req, res) => {
    const promiseDb = database.promise();
    try {
        const { tipoCredito, rut, monto, cuotas, tasa_interes_anual, mesInicio, diaPago, seguroDesgravamen, seguroCesantia } = req.body;

        if (!tipoCredito || !rut || !monto || !cuotas) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        const rutNormalizado = String(rut).trim();
        const tipoCreditoNormalizado = String(tipoCredito).trim().toLowerCase();
        const tasaInteresAnual = Number(tasa_interes_anual) || 12.5;

        let fechaPrimerPago = null;
        if (mesInicio && diaPago) {
            const hoy = new Date();
            const mes = Number(mesInicio);
            const dia = Number(diaPago);
            if (!Number.isNaN(mes) && !Number.isNaN(dia)) {
                const anio = hoy.getMonth() + 1 <= mes ? hoy.getFullYear() : hoy.getFullYear() + 1;
                const fecha = new Date(anio, mes - 1, dia);
                if (!Number.isNaN(fecha.getTime())) {
                    fechaPrimerPago = fecha.toISOString().slice(0, 10);
                }
            }
        }
        if (!fechaPrimerPago) {
            fechaPrimerPago = new Date().toISOString().slice(0, 10);
        }

        // 1. Asegurar Region y Comuna
        await promiseDb.query("INSERT IGNORE INTO region (id_region, nombre) VALUES (1, 'Región Metropolitana')");
        await promiseDb.query("INSERT IGNORE INTO comuna (id_comuna, id_region, nombre) VALUES (1, 1, 'Santiago')");

        // 2. Asegurar Cliente
        const [clientes] = await promiseDb.query("SELECT id_cliente FROM cliente WHERE rut = ?", [rutNormalizado]);
        let id_cliente;
        if (clientes.length > 0) {
            id_cliente = clientes[0].id_cliente;
        } else {
            const [insertCliente] = await promiseDb.query(
                "INSERT INTO cliente (id_region, id_comuna, rut, nombre, apellido, telefono, correo) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [1, 1, rutNormalizado, 'Cliente', 'Único', '+56912345678', 'cliente@clarofin.cl']
            );
            id_cliente = insertCliente.insertId;
        }

        // 3. Asegurar Tipo de Credito
        const [tipos] = await promiseDb.query("SELECT id_tipo_credito FROM tipo_credito WHERE LOWER(nombre) = ?", [tipoCreditoNormalizado]);
        let id_tipo_credito;
        if (tipos.length > 0) {
            id_tipo_credito = tipos[0].id_tipo_credito;
        } else {
            const [insertTipo] = await promiseDb.query(
                "INSERT INTO tipo_credito (nombre, descripcion) VALUES (?, ?)",
                [tipoCreditoNormalizado, 'Creado desde solicitud']
            );
            id_tipo_credito = insertTipo.insertId;
        }

        // 4. Asegurar Analista
        const [analistas] = await promiseDb.query("SELECT id_analista FROM analista LIMIT 1");
        let id_analista;
        if (analistas.length > 0) {
            id_analista = analistas[0].id_analista;
        } else {
            const [insertAnalista] = await promiseDb.query(
                "INSERT INTO analista (rut, nombre, apellido, correo) VALUES (?, ?, ?, ?)",
                ['11111111-1', 'Analista', 'Principal', 'analista@clarofin.cl']
            );
            id_analista = insertAnalista.insertId;
        }

        // 5. Insertar Credito
        const [insertCredito] = await promiseDb.query(
            "INSERT INTO credito (id_tipo_credito, id_cliente, monto_solicitado, numero_cuotas, fecha_primer_pago, tasa_interes_anual) VALUES (?, ?, ?, ?, ?, ?)",
            [id_tipo_credito, id_cliente, monto, cuotas, fechaPrimerPago, tasaInteresAnual]
        );
        const id_credito = insertCredito.insertId;

        // 6. Insertar Tramite
        await promiseDb.query(
            "INSERT INTO tramite (id_credito, id_analista, etapa) VALUES (?, ?, 'RECEPCION')",
            [id_credito, id_analista]
        );

        // Guardar seguros en credito_seguro
        if (seguroDesgravamen) {
            await promiseDb.query("INSERT IGNORE INTO seguro (id_seguro, nombre, cobertura, tasa, monto_max_cobertura) VALUES (1, 'Seguro de Desgravamen', 'Fallecimiento', 0.05, 100000000)");
            await promiseDb.query("INSERT INTO credito_seguro (id_credito, id_seguro) VALUES (?, 1)", [id_credito]);
        }
        if (seguroCesantia) {
            await promiseDb.query("INSERT IGNORE INTO seguro (id_seguro, nombre, cobertura, tasa, monto_max_cobertura) VALUES (2, 'Seguro de Cesantía', 'Desempleo', 0.20, 50000000)");
            await promiseDb.query("INSERT INTO credito_seguro (id_credito, id_seguro) VALUES (?, 2)", [id_credito]);
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
            WHERE c.estado = 'PENDIENTE' OR c.estado = 'EN_REVISION'
            ORDER BY c.id_credito DESC
        `);
        
        res.status(200).json({ ok: true, total: rows.length, data: rows });
    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({ ok: false, error: 'Error al obtener solicitudes', detalle: error.message });
    }
};

module.exports = {
    createTable,
    crearSimulacion,
    obtenerSimulaciones,
    obtenerSimulacionPorId,
    crearSolicitud,
    obtenerSolicitudes
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