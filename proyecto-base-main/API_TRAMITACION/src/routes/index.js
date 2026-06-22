const express = require('express');
const router = new express.Router();

const index = require('../controllers/index');
const simulaciones = require('../controllers/simulaciones');
const solicitudes = require('../controllers/solicitudes');
const evaluaciones = require('../controllers/evaluaciones');
const estado = require('../controllers/estado');
const firma = require('../controllers/firma');

// Health check
router.get('/', (req, res) => res.json({ message: 'API_Tramitacion OK' }));

// ========================================
// NUEVAS RUTAS ESPECIFICADAS (FASE 2)
// ========================================

// S001: Simulación de Crédito (HU001)
router.post('/api/simulaciones', simulaciones.crearSimulacion);
router.get('/api/simulaciones/:idSimulacion', simulaciones.obtenerSimulacion);
router.get('/api/simulaciones/cliente/:rut', simulaciones.obtenerSimulacionesPorRut);

// S002: Solicitud de Crédito (HU002)
router.post('/api/solicitudes', solicitudes.crearSolicitud);
router.get('/api/solicitudes/:idSolicitud', solicitudes.obtenerSolicitud);
router.get('/api/solicitudes/cliente/:rut', solicitudes.obtenerSolicitudesPorCliente);

// S003: Evaluación de Riesgo (HU003)
router.post('/api/evaluaciones/:idSolicitud', evaluaciones.evaluarRiesgo);
router.get('/api/evaluaciones/:idSolicitud', evaluaciones.obtenerEvaluacion);

// S004: Consulta de Estado (HU004)
router.get('/api/solicitudes/:idSolicitud/estado', estado.obtenerEstado);
router.get('/api/solicitudes/cliente/:rut/estado', estado.obtenerEstadoPorCliente);

// S005: Firma Digital (HU005)
router.post('/api/solicitudes/:idSolicitud/firma', firma.realizarFirmaDigital);
router.get('/api/solicitudes/:idSolicitud/firma', firma.obtenerEstadoFirma);

// ========================================
// RUTAS EXISTENTES (Compatibilidad)
// ========================================
router.get('/createTable', index.createTable);
router.post('/simulacion', index.crearSimulacion);
router.get('/simulacion', index.obtenerSimulaciones);
router.get('/simulacion/:id', index.obtenerSimulacionPorId);
router.post('/solicitud', index.crearSolicitud);
router.get('/solicitudes', index.obtenerSolicitudes);

// Actualización de estado
router.put('/solicitudes/:id/estado', index.actualizarEstadoSolicitud);
router.get('/creditos', index.obtenerCreditosPorRut);

// Validación y registro de cliente por RUT
router.get('/cliente/validar',    index.validarCliente);
router.post('/cliente/registrar', index.registrarCliente);

// Pagos de cuotas
router.post('/pagos', index.registrarPago);
router.get('/pagos/:id_credito', index.obtenerPagosPorCredito);

// Recomendaciones personalizadas de crédito
router.get('/recomendaciones', index.obtenerRecomendaciones);

module.exports = router;