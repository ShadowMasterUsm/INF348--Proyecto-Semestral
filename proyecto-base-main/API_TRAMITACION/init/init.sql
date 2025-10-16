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

CREATE TABLE IF NOT EXISTS cliente (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    id_region INT NOT NULL,
    id_comuna INT NOT NULL,
    rut VARCHAR(12) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    apellido VARCHAR(50) NOT NULL,
    telefono VARCHAR(15) NOT NULL,
    correo VARCHAR(50) NOT NULL,
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

CREATE TRIGGER trg_calcular_costo_seguro
AFTER INSERT ON credito_seguro
FOR EACH ROW
BEGIN
    CALL calcular_costo_seguro(NEW.id_credito, NEW.id_seguro);
    CALL actualizar_monto_total(NEW.id_credito);
END
//

CREATE TRIGGER trg_calcular_costo_seguro_update
AFTER UPDATE ON credito_seguro
FOR EACH ROW
BEGIN
    CALL calcular_costo_seguro(NEW.id_credito, NEW.id_seguro);
    CALL actualizar_monto_total(NEW.id_credito);
END
//

CREATE TRIGGER trg_actualizar_monto_total_credito
AFTER UPDATE ON credito
FOR EACH ROW
BEGIN
    CALL actualizar_monto_total(NEW.id_credito);
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

    SELECT monto_solicitado
    INTO v_monto_solicitado
    FROM credito c
    WHERE c.id_credito = p_id_credito;

    SELECT tasa
    INTO v_tasa_seguro
    FROM seguro s
    WHERE s.id_seguro = p_id_seguro;

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
    FROM credito
    WHERE id_credito = p_id_credito;

    SELECT IFNULL(SUM(costo_seguro),0)
    INTO v_total_seguros
    FROM credito_seguro
    WHERE id_credito = p_id_credito;

    UPDATE credito
    SET monto_total_pagar = v_monto_solicitado + (v_monto_solicitado * v_tasa_interes * (v_numero_cuotas / 12)) + v_total_seguros,
        monto_cuota = (v_monto_solicitado + (v_monto_solicitado * v_tasa_interes * (v_numero_cuotas / 12)) + v_total_seguros) / v_numero_cuotas
    WHERE id_credito = p_id_credito;
END
//

DELIMITER ;