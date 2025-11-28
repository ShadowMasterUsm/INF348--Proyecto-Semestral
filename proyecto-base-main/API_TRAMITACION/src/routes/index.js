const express = require('express');
const router = new express.Router();

const index = require('../controllers/index');

// Esto es un ejemplo - SE PUEDE BORRAR
router.get('/', (req, res) => res.json({message: 'Probando... La prueba de API_Tramitacion fue un éxito!'}));

//==========================endpoints(Routes)============================//
// Esto es un ejemplo para endpoints
router.get('/createTable', index.createTable);
router.post('/simulacion', index.crearSimulacion);

module.exports = router;