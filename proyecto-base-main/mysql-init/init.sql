-- Combined DB initialization for proyecto

-- API_TRAMITACION schema and objects
CREATE DATABASE IF NOT EXISTS BD06_TRAMITACION;
USE BD06_TRAMITACION;

-- ========================================
-- TABLAS PRINCIPALES
-- ========================================

CREATE TABLE IF NOT EXISTS region (
    id_region INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS comuna (
    id_comuna INT AUTO_INCREMENT PRIMARY KEY,
    id_region INT NOT NULL,
    nombre VARCHAR(75) NOT NULL,
    FOREIGN KEY (id_region) REFERENCES region(id_region) ON DELETE CASCADE
);

-- FIX: columna password agregada para soportar registro y login de clientes
CREATE TABLE IF NOT EXISTS cliente (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    id_region INT NOT NULL,
    id_comuna INT NOT NULL,
    rut VARCHAR(12) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    telefono VARCHAR(15) NOT NULL,
    correo VARCHAR(50) NOT NULL,
    password VARCHAR(255),
    num_documento VARCHAR(20) NULL,
    FOREIGN KEY (id_region) REFERENCES region(id_region) ON DELETE CASCADE,
    FOREIGN KEY (id_comuna) REFERENCES comuna(id_comuna) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analista (
    id_analista INT AUTO_INCREMENT PRIMARY KEY,
    rut VARCHAR(12) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    correo VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS tipo_credito (
    id_tipo_credito INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS credito (
    id_credito INT AUTO_INCREMENT PRIMARY KEY,
    id_tipo_credito INT NOT NULL,
    id_cliente INT NOT NULL,
    monto_solicitado DECIMAL(15,2) NOT NULL CHECK(monto_solicitado BETWEEN 1000000 AND 60000000),
    numero_cuotas INT NOT NULL CHECK(numero_cuotas <= 60),
    fecha_primer_pago DATE NOT NULL,
    tasa_interes_anual DECIMAL(5,2) CHECK(tasa_interes_anual >= 0),
    monto_total_pagar DECIMAL(15,2),
    monto_cuota DECIMAL(15,2),
    estado ENUM('PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO', 'PAGADO') DEFAULT 'PENDIENTE',
    fecha_solicitud DATETIME DEFAULT NOW(),
    FOREIGN KEY (id_tipo_credito) REFERENCES tipo_credito(id_tipo_credito) ON DELETE CASCADE,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS seguro (
    id_seguro INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(75) UNIQUE NOT NULL,
    cobertura VARCHAR(150) NOT NULL,
    tasa DECIMAL(5,2) CHECK(tasa BETWEEN 0 AND 100),
    monto_max_cobertura DECIMAL(15,2)
);

CREATE TABLE IF NOT EXISTS credito_seguro (
    id_credito_seguro INT AUTO_INCREMENT PRIMARY KEY,
    id_credito INT NOT NULL,
    id_seguro INT NOT NULL,
    costo_seguro DECIMAL(15,2),
    fecha_inicio DATE,
    fecha_fin DATE,
    FOREIGN KEY (id_credito) REFERENCES credito(id_credito) ON DELETE CASCADE,
    FOREIGN KEY (id_seguro) REFERENCES seguro(id_seguro) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tramite (
    id_tramite INT AUTO_INCREMENT PRIMARY KEY,
    id_credito INT NOT NULL,
    id_analista INT NOT NULL,
    etapa ENUM('RECEPCION', 'REVISION', 'VALIDACION', 'APROBACION', 'FINALIZADO') DEFAULT 'RECEPCION',
    fecha_inicio DATETIME DEFAULT NOW(),
    fecha_ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_credito) REFERENCES credito(id_credito) ON DELETE CASCADE,
    FOREIGN KEY (id_analista) REFERENCES analista(id_analista) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documento (
    id_documento INT AUTO_INCREMENT PRIMARY KEY,
    id_tramite INT NOT NULL,
    nombre VARCHAR(75),
    ruta_archivo VARCHAR(250) NOT NULL,
    tipo_archivo VARCHAR(50) DEFAULT 'application/pdf',
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    valido BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_tramite) REFERENCES tramite(id_tramite) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS simulacion (
    id_simulacion INT AUTO_INCREMENT PRIMARY KEY,
    rut VARCHAR(12) NOT NULL,
    id_tipo_credito INT,
    monto DECIMAL(15,2) NOT NULL,
    cuotas INT NOT NULL,
    tasa_interes_anual DECIMAL(5,2) NOT NULL,
    incluye_seguro_desgravamen BOOLEAN DEFAULT FALSE,
    incluye_seguro_cesantia BOOLEAN DEFAULT FALSE,
    monto_total DECIMAL(15,2),
    monto_cuota DECIMAL(15,2),
    fecha_primer_pago DATE,
    probabilidad_aprobacion DECIMAL(5,2),
    tipo_simulacion VARCHAR(50),
    fecha DATETIME DEFAULT NOW(),
    FOREIGN KEY (id_tipo_credito) REFERENCES tipo_credito(id_tipo_credito)
);

CREATE TABLE IF NOT EXISTS antecedentes_financieros (
    id_antecedente INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    ingresos DECIMAL(15,2),
    deudas DECIMAL(15,2),
    antiguedad_laboral INT COMMENT 'En meses',
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evaluation_riesgo (
    id_evaluacion INT AUTO_INCREMENT PRIMARY KEY,
    id_credito INT NOT NULL,
    id_analista INT,
    puntaje INT CHECK(puntaje BETWEEN 0 AND 100),
    estado ENUM('PENDIENTE', 'EVALUANDO', 'APROBADO', 'RECHAZADO', 'ERROR_EVALUACION') DEFAULT 'PENDIENTE',
    observaciones TEXT,
    fecha_evaluacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_credito) REFERENCES credito(id_credito) ON DELETE CASCADE,
    FOREIGN KEY (id_analista) REFERENCES analista(id_analista) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS prestamo (
    id_prestamo INT AUTO_INCREMENT PRIMARY KEY,
    id_credito INT NOT NULL UNIQUE,
    estado ENUM('ACTIVADO', 'PAGANDOSE', 'FINALIZADO') DEFAULT 'ACTIVADO',
    fecha_primer_pago DATE,
    fecha_activacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_credito) REFERENCES credito(id_credito) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cuota (
    id_cuota INT AUTO_INCREMENT PRIMARY KEY,
    id_prestamo INT NOT NULL,
    numero_cuota INT NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado ENUM('PENDIENTE', 'PAGADA', 'VENCIDA', 'PARCIAL') DEFAULT 'PENDIENTE',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cuota (id_prestamo, numero_cuota),
    FOREIGN KEY (id_prestamo) REFERENCES prestamo(id_prestamo) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pago (
    id_pago INT AUTO_INCREMENT PRIMARY KEY,
    id_cuota INT NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
    comprobante VARCHAR(255),
    FOREIGN KEY (id_cuota) REFERENCES cuota(id_cuota) ON DELETE CASCADE
);

-- FIX: tabla pago_cuota mantiene compatibilidad con versión anterior
CREATE TABLE IF NOT EXISTS pago_cuota (
    id_pago        INT AUTO_INCREMENT PRIMARY KEY,
    id_credito     INT NOT NULL,
    numero_cuota   INT NOT NULL,
    monto_pagado   DECIMAL(15,2) NOT NULL,
    fecha_pago     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pago_cuota (id_credito, numero_cuota),
    FOREIGN KEY (id_credito) REFERENCES credito(id_credito) ON DELETE CASCADE
);

-- ========================================
-- TRIGGERS
-- ========================================

DELIMITER //

CREATE TRIGGER trg_validar_correo_cliente
BEFORE INSERT ON cliente
FOR EACH ROW
BEGIN
    IF NEW.correo NOT LIKE '%@%' OR SUBSTRING_INDEX(NEW.correo, '@', -1) NOT LIKE '%.%' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Correo inválido';
    END IF;
END
//

CREATE TRIGGER trg_validar_correo_cliente_update
BEFORE UPDATE ON cliente
FOR EACH ROW
BEGIN
    IF NEW.correo NOT LIKE '%@%' OR SUBSTRING_INDEX(NEW.correo, '@', -1) NOT LIKE '%.%' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Correo inválido';
    END IF;
END
//


DELIMITER ;

-- ========================================
-- PROCEDURES
-- ========================================

DELIMITER //

CREATE PROCEDURE calcular_costo_seguro(IN p_id_credito INT, IN p_id_seguro INT)
BEGIN
    DECLARE v_monto_solicitado DECIMAL(15,2);
    DECLARE v_tasa_seguro DECIMAL(5,2);
    DECLARE v_costo_seguro DECIMAL(15,2);

    SELECT monto_solicitado INTO v_monto_solicitado
    FROM credito WHERE id_credito = p_id_credito;

    SELECT tasa INTO v_tasa_seguro
    FROM seguro WHERE id_seguro = p_id_seguro;

    SET v_costo_seguro = v_monto_solicitado * v_tasa_seguro / 100;

    UPDATE credito_seguro
    SET costo_seguro = v_costo_seguro
    WHERE id_credito = p_id_credito AND id_seguro = p_id_seguro;
END
//

CREATE PROCEDURE actualizar_monto_total(IN p_id_credito INT)
BEGIN
    DECLARE v_monto_solicitado DECIMAL(15,2);
    DECLARE v_numero_cuotas INT;
    DECLARE v_tasa_interes DECIMAL(5,2);
    DECLARE v_total_seguros DECIMAL(15,2);

    SELECT monto_solicitado, numero_cuotas, tasa_interes_anual
    INTO v_monto_solicitado, v_numero_cuotas, v_tasa_interes
    FROM credito WHERE id_credito = p_id_credito;

    SELECT IFNULL(SUM(costo_seguro),0) INTO v_total_seguros
    FROM credito_seguro WHERE id_credito = p_id_credito;

    UPDATE credito
    SET monto_total_pagar = v_monto_solicitado + (v_monto_solicitado * v_tasa_interes * (v_numero_cuotas / 12)) + v_total_seguros,
        monto_cuota = (v_monto_solicitado + (v_monto_solicitado * v_tasa_interes * (v_numero_cuotas / 12)) + v_total_seguros) / v_numero_cuotas
    WHERE id_credito = p_id_credito;
END
//

DELIMITER ;


-- API_EJEMPLO schema
CREATE DATABASE IF NOT EXISTS BD_EJEMPLO;
USE BD_EJEMPLO;

CREATE TABLE IF NOT EXISTS paises (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    capital VARCHAR(100),
    continente VARCHAR(100)
);

INSERT INTO paises (nombre, capital, continente)
VALUES 
('Chile', 'Santiago', 'America del sur'),
('Noruega', 'Oslo', 'Europa'),
('Mexico', 'Ciudad de Mexico', 'America del norte');

-- ========================================
-- DATOS DE PRUEBA PARA BD06_TRAMITACION
-- ========================================

USE BD06_TRAMITACION;

-- Regiones (si no existen)
INSERT IGNORE INTO region (id_region, nombre) VALUES 
(1, 'Región de Arica y Parinacota'),
(2, 'Región de Tarapacá'),
(3, 'Región de Antofagasta'),
(4, 'Región de Atacama'),
(5, 'Región de Coquimbo'),
(6, 'Región de Valparaíso'),
(7, 'Región del Libertador General Bernardo O\'Higgins'),
(8, 'Región del Maule'),
(9, 'Región de Ñuble'),
(10, 'Región de La Araucanía'),
(11, 'Región de Los Ríos'),
(12, 'Región de Los Lagos'),
(13, 'Región de Aysén del General Carlos Ibáñez del Campo'),
(14, 'Región de Magallanes y de la Antártica Chilena'),
(15, 'Región Metropolitana de Santiago');

-- Comunas de ejemplo (Región Metropolitana)
INSERT IGNORE INTO comuna (id_region, nombre) VALUES 
(15, 'Santiago'),
(15, 'La Florida'),
(15, 'Puente Alto'),
(15, 'San Bernardo'),
(15, 'La Pintana'),
(15, 'Peñalolén'),
(15, 'Quilicura'),
(15, 'Maipú');

-- Tipos de crédito
INSERT IGNORE INTO tipo_credito (nombre, descripcion) VALUES 
('Crédito de Consumo', 'Crédito destinado a la compra de bienes o servicios de consumo'),
('Crédito Automotriz', 'Crédito especializado para la compra de vehículos'),
('Crédito Vivienda', 'Crédito para la adquisición o construcción de vivienda'),
('Crédito Educación', 'Crédito para financiar gastos de educación');

-- Seguros
INSERT IGNORE INTO seguro (nombre, cobertura, tasa, monto_max_cobertura) VALUES 
('Seguro Desgravamen', 'Cubre el saldo del crédito en caso de fallecimiento', 0.5, 60000000),
('Seguro Cesantía', 'Cubre el pago de cuotas en caso de desempleo', 0.3, 60000000),
('Seguro Protección Compra', 'Protege la compra con cobertura adicional', 0.2, 30000000);

-- Analistas de ejemplo
INSERT IGNORE INTO analista (rut, nombre, apellido, correo) VALUES 
('12.345.678-9', 'Juan', 'García', 'juan.garcia@banco.cl'),
('15.678.901-2', 'María', 'López', 'maria.lopez@banco.cl'),
('19.876.543-1', 'Carlos', 'Rodríguez', 'carlos.rodriguez@banco.cl');

-- Cliente de ejemplo para testing
INSERT IGNORE INTO cliente (id_region, id_comuna, rut, nombre, apellido, telefono, correo, password) VALUES 
(15, 1, '18.765.432-0', 'Pedro', 'Pérez', '+56912345678', 'pedro.perez@example.com', 'hashed_password_123');

-- ========================================
-- COMENTARIO SOBRE ESTRUCTURA
-- ========================================
-- 
-- El modelo de dominio incluye las siguientes entidades:
-- - cliente: Usuario que solicita créditos
-- - tipo_credito: Clasificación de créditos
-- - credito: Solicitud principal de crédito
-- - simulacion: Simulaciones de crédito sin crear solicitud
-- - prestamo: Préstamo activado tras firma digital
-- - cuota: Cuotas mensuales del préstamo
-- - pago: Registro de pagos realizados
-- - evaluation_riesgo: Evaluación automatizada del riesgo
-- - analista: Personal de análisis
-- - antecedentes_financieros: Historial financiero del cliente
-- - tramite: Seguimiento del proceso administrativo
-- - documento: Documentos adjuntos
-- - seguro & credito_seguro: Seguros adicionales
--
-- El flujo típico es:
-- 1. Cliente simula un crédito (simulacion)
-- 2. Cliente envía solicitud formal (credito)
-- 3. Sistema ejecuta evaluation_riesgo
-- 4. Si aprobado, cliente realiza firma digital
-- 5. Se crea prestamo con cuotas
-- 6. Cliente realiza pagos (pago)
-- ========================================