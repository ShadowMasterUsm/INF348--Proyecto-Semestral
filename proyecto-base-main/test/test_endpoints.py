"""
Pruebas Unitarias - ClaroFin (Hito 3)
======================================
Endpoints probados:
  - POST /simulacion  (2 casos)
  - POST /solicitud   (2 casos)

Ejecutar:
  python -m unittest tests/test_endpoints.py -v
"""

import unittest
import requests

BASE_URL = "http://localhost:8080"


# ══════════════════════════════════════════════════════════════════════════════
# HU: "Como cliente quiero simular mi crédito para conocer el monto de cuota"
# Endpoint: POST /simulacion
# ══════════════════════════════════════════════════════════════════════════════
class TestSimulacion(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Prepara datos de prueba compartidos por todos los métodos de esta clase."""
        cls.url = f"{BASE_URL}/simulacion"

        # Payload válido: valores dentro del rango permitido
        cls.payload_valido = {
            "rut":               "12.345.678-9",
            "renta":             "C",
            "monto":             5_000_000,
            "cuotas":            24,
            "tasa_interes_anual": 12.5,
            "mesInicio":         6,
            "diaPago":           15,
            "seguroCesantia":    False,
            "seguroDesgravamen": False,
            "tipoCredito":       "consumo"
        }

        # Payload inválido: monto fuera del rango (> 60.000.000)
        cls.payload_monto_invalido = {
            **cls.payload_valido,
            "monto": 999_999_999   # valor frontera: excede el máximo
        }

    @classmethod
    def tearDownClass(cls):
        """Limpieza post-pruebas (aquí no hay estado que limpiar)."""
        pass

    # ── Caso 1: Simulación válida ─────────────────────────────────────────────
    # Clase de equivalencia: monto ∈ [1.000.000, 60.000.000], cuotas ∈ [1, 60]
    # Valor frontera: monto = 5.000.000 (valor típico dentro del rango)
    def test_01_simulacion_valida_retorna_200(self):
        """
        Input:    payload con monto=5.000.000 y cuotas=24 (valores válidos)
        Esperado: HTTP 200 y body con id_simulacion
        Contexto: Backend corriendo en localhost:8080
        """
        resp = requests.post(self.url, json=self.payload_valido)

        self.assertEqual(resp.status_code, 200,
            f"Se esperaba 200 pero llegó {resp.status_code}. Body: {resp.text}")

        body = resp.json()
        self.assertIn("id_simulacion", body,
            "La respuesta debe contener 'id_simulacion'")

    # ── Caso 2: Monto fuera de rango ──────────────────────────────────────────
    # Clase de equivalencia: monto > 60.000.000  (inválido)
    # Valor frontera: 999.999.999 (muy por encima del máximo)
    def test_02_simulacion_monto_invalido_retorna_error(self):
        """
        Input:    monto=999.999.999 (supera el máximo de 60.000.000)
        Esperado: HTTP 4xx y body con campo 'error'
        Contexto: Backend corriendo en localhost:8080
        """
        resp = requests.post(self.url, json=self.payload_monto_invalido)

        self.assertIn(resp.status_code, [400, 422],
            f"Se esperaba 400 o 422 pero llegó {resp.status_code}. Body: {resp.text}")

        body = resp.json()
        self.assertTrue(
            "error" in body or "detalle" in body or "message" in body,
            "La respuesta de error debe contener 'error', 'detalle' o 'message'"
        )


# ══════════════════════════════════════════════════════════════════════════════
# HU: "Como cliente quiero enviar mi solicitud de crédito al analista"
# Endpoint: POST /solicitud
# ══════════════════════════════════════════════════════════════════════════════
class TestSolicitud(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """Prepara datos de prueba compartidos."""
        cls.url = f"{BASE_URL}/solicitud"
        cls.ids_creados = []   # para teardown si se necesita limpiar

        # Solicitud válida completa
        cls.payload_valido = {
            "rut":               "12.345.678-9",
            "renta":             "D",
            "monto":             10_000_000,
            "cuotas":            36,
            "tasa_interes_anual": 12.5,
            "mesInicio":         7,
            "diaPago":           5,
            "seguroCesantia":    True,
            "seguroDesgravamen": False,
            "tipoCredito":       "consumo"
        }

        # Solicitud sin RUT (campo obligatorio ausente)
        cls.payload_sin_rut = {
            **cls.payload_valido,
            "rut": ""   # valor frontera: string vacío
        }

    @classmethod
    def tearDownClass(cls):
        """Registra que las pruebas terminaron."""
        print(f"\n[tearDownClass] TestSolicitud finalizado. "
              f"IDs creados durante pruebas: {cls.ids_creados}")

    # ── Caso 3: Solicitud válida ──────────────────────────────────────────────
    # Clase de equivalencia: todos los campos presentes y con valores válidos
    # Valor frontera: cuotas=36 (dentro del rango 1-60)
    def test_03_solicitud_valida_retorna_201_o_200(self):
        """
        Input:    payload completo con rut, monto, cuotas válidos
        Esperado: HTTP 200 o 201 y body con id del crédito creado
        Contexto: Backend corriendo en localhost:8080
        """
        resp = requests.post(self.url, json=self.payload_valido)

        self.assertIn(resp.status_code, [200, 201],
            f"Se esperaba 200 o 201 pero llegó {resp.status_code}. Body: {resp.text}")

        body = resp.json()
        id_creado = body.get("id_credito") or body.get("id_solicitud") or body.get("id")
        self.assertIsNotNone(id_creado,
            "La respuesta debe contener el id del crédito/solicitud creado")

        # Guardar para posible limpieza
        if id_creado:
            self.__class__.ids_creados.append(id_creado)

    # ── Caso 4: Solicitud sin RUT (campo requerido vacío) ─────────────────────
    # Clase de equivalencia: RUT ausente o vacío (inválido)
    # Valor frontera: rut="" (string vacío, límite inferior de longitud)
    def test_04_solicitud_sin_rut_retorna_error(self):
        """
        Input:    payload con rut="" (campo obligatorio vacío)
        Esperado: HTTP 4xx y body con mensaje de error
        Contexto: Backend corriendo en localhost:8080
        """
        resp = requests.post(self.url, json=self.payload_sin_rut)

        self.assertIn(resp.status_code, [400, 422],
            f"Se esperaba 400 o 422 pero llegó {resp.status_code}. Body: {resp.text}")

        body = resp.json()
        self.assertTrue(
            "error" in body or "detalle" in body or "message" in body,
            "La respuesta debe indicar qué campo falló"
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)