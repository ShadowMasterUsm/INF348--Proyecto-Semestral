const express = require('express');
const router = new express.Router();

const index = require('../controllers/index');

router.get('/', (req, res) => res.json({ message: 'API_Tramitacion OK' }));

// Rutas existentes
router.get('/createTable', index.createTable);
router.post('/simulacion', index.crearSimulacion);
router.get('/simulacion', index.obtenerSimulaciones);
router.get('/simulacion/:id', index.obtenerSimulacionPorId);
router.post('/solicitud', index.crearSolicitud);
router.get('/solicitudes', index.obtenerSolicitudes);

// Nuevas rutas
router.put('/solicitudes/:id/estado', index.actualizarEstadoSolicitud);
router.get('/creditos', index.obtenerCreditosPorRut);

// Validación y registro de cliente por RUT
router.get('/cliente/validar',    index.validarCliente);
router.post('/cliente/registrar', index.registrarCliente);

// Pagos de cuotas
router.post('/pagos', index.registrarPago);
router.get('/pagos/:id_credito', index.obtenerPagosPorCredito);

module.exports = router;