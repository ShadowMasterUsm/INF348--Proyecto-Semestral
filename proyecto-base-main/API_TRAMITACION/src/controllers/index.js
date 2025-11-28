const database = require('../db');


//Esta tabla es solo un ejemplo para que puedan ver como se hacen querys a la bdd, después puede ser eliminada
const createTable = (req, res) => {
    const query =  'CREATE TABLE IF NOT EXISTS user(id int AUTO_INCREMENT, firstname VARCHAR(50), lastname VARCHAR(50), email VARCHAR(50), PRIMARY KEY(id))';

    database.query(query, (err) => {
        if (err) throw err;
        res.send('Tabla creada')
    });
};

const crearSimulacion = (req, res) => {
    const { rut, monto, cuotas } = req.body;

    const query = `
        INSERT INTO simulacion (rut, monto, cuotas)
        VALUES (?, ?, ?)
    `;

    database.query(query, [rut, monto, cuotas], (err, result) => {
        if (err) {
            console.error("Error al guardar simulación:", err);
            return res.status(500).json({
                ok: false,
                error: "Error al guardar en la BD"
            });
        }

        return res.status(201).json({
            ok: true,
            mensaje: "Simulación guardada correctamente",
            id_simulacion: result.insertId
        });
    });
};

module.exports = {
    createTable,
    crearSimulacion
};









/*
const crearSimulacion = (req, res) => {
    try {
        console.log("Simulación recibida:", req.body);
        
        res.status(201).json({
            ok: true,
            mensaje: "Simulación recibida correctamente",
            data: req.body
        });

    } catch (error) {
        console.error("Error al guardar simulación:", error);

        res.status(500).json({
            ok: false,
            error: "Error interno al guardar la simulación"
        });
    }
}

module.exports = {
    createTable,
    crearSimulacion
};
*/