/**
 * acceso.js — Lógica de acceso, login y registro de clientes en ClaroFin.
 *
 * Paneles:
 *   #panelRol       → selección de rol (analista / cliente)
 *   #panelLogin     → login de cliente con RUT + contraseña
 *   #panelRegistro  → registro de nuevo cliente
 *
 * API:
 *   GET  /cliente/validar?rut=&password=  → valida credenciales
 *   POST /cliente/registrar               → crea nueva cuenta
 */

const API_BASE = 'http://localhost:8080';

// ── Paneles ───────────────────────────────────────────────────────────────────
const panelRol      = document.getElementById('panelRol');
const panelLogin    = document.getElementById('panelLogin');
const panelRegistro = document.getElementById('panelRegistro');

function mostrar(panel) {
    [panelRol, panelLogin, panelRegistro].forEach(p => p.style.display = 'none');
    panel.style.display = 'block';
}

// Al cargar: si viene con ?modo=registro ir directo al registro
// Si ya hay sesión activa, redirigir al inicio
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('modo') === 'registro') {
        mostrar(panelRegistro);
    }
    if (localStorage.getItem('loggedIn') === 'true') {
        window.location.href = 'index.html';
    }
});

// ── Navegación entre paneles ──────────────────────────────────────────────────
document.getElementById('analistaBtn').addEventListener('click', () => {
    localStorage.setItem('loggedIn', 'true');
    localStorage.setItem('userRole', 'analista');
    localStorage.removeItem('clienteRut');
    localStorage.removeItem('clienteNombre');
    window.location.href = 'analista_riesgo.html';
});

document.getElementById('clienteBtn').addEventListener('click', () => mostrar(panelLogin));

document.getElementById('volverDesdeLogin').addEventListener('click',    () => mostrar(panelRol));
document.getElementById('volverDesdeRegistro').addEventListener('click', () => mostrar(panelRol));

document.getElementById('linkIrRegistro').addEventListener('click', (e) => { e.preventDefault(); irARegistro(); });
document.getElementById('linkRegistrar').addEventListener('click',  (e) => { e.preventDefault(); irARegistro(); });
document.getElementById('linkIrLogin').addEventListener('click',    (e) => { e.preventDefault(); mostrar(panelLogin); });

function irARegistro(rutPrefill = '') {
    mostrar(panelRegistro);
    limpiarRegistro();
    if (rutPrefill) document.getElementById('regRut').value = rutPrefill;
}

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════
const inputRut      = document.getElementById('inputRut');
const inputPassword = document.getElementById('inputPassword');
const rutError      = document.getElementById('rutError');
const passwordError = document.getElementById('passwordError');
const ingresarBtn   = document.getElementById('ingresarBtn');
const btnLabel      = document.getElementById('btnLabel');
const spinner       = document.getElementById('spinner');
const alertaNoReg   = document.getElementById('alertaNoReg');

inputRut.addEventListener('input', () => {
    inputRut.value = inputRut.value.replace(/[^0-9kK\-]/g, '');
    rutError.style.display    = 'none';
    alertaNoReg.style.display = 'none';
    inputRut.classList.remove('error-input');
});

inputPassword.addEventListener('input', () => {
    passwordError.style.display = 'none';
    inputPassword.classList.remove('error-input');
    alertaNoReg.style.display = 'none';
});

function validarFormato(rut) {
    return /^\d{6,8}-[\dkK]$/.test(rut.trim());
}

function setLoadingLogin(on) {
    ingresarBtn.disabled   = on;
    btnLabel.style.display = on ? 'none'  : 'inline';
    spinner.style.display  = on ? 'block' : 'none';
}

async function intentarIngreso() {
    const rut      = inputRut.value.trim();
    const password = inputPassword.value;

    if (!validarFormato(rut)) {
        rutError.style.display = 'block';
        inputRut.classList.add('error-input');
        inputRut.focus();
        return;
    }

    if (!password) {
        passwordError.style.display = 'block';
        inputPassword.classList.add('error-input');
        inputPassword.focus();
        return;
    }

    setLoadingLogin(true);
    try {
        const resp = await fetch(`${API_BASE}/cliente/validar?rut=${encodeURIComponent(rut)}&password=${encodeURIComponent(password)}`);
        const data = await resp.json();

        if (!data.ok || !data.existe) {
            alertaNoReg.style.display = 'block';
            alertaNoReg.querySelector('strong').textContent = data.error || 'RUT o contraseña incorrectos';
            inputRut.classList.add('error-input');
            inputPassword.classList.add('error-input');
            setLoadingLogin(false);
            return;
        }

        localStorage.setItem('loggedIn',      'true');
        localStorage.setItem('userRole',       'cliente');
        localStorage.setItem('clienteRut',     rut);
        localStorage.setItem('clienteNombre', `${data.cliente.nombre} ${data.cliente.apellido}`);

        // Si venía desde otra página, volver ahí; si no, al index
        const redirect = new URLSearchParams(window.location.search).get('redirect');
        window.location.href = redirect ? decodeURIComponent(redirect) : 'index.html';

    } catch (e) {
        console.warn('API no disponible, acceso offline:', e.message);
        localStorage.setItem('loggedIn',  'true');
        localStorage.setItem('userRole',   'cliente');
        localStorage.setItem('clienteRut', rut);
        localStorage.removeItem('clienteNombre');
        window.location.href = 'index.html';
    }
}

ingresarBtn.addEventListener('click', intentarIngreso);
inputRut.addEventListener('keydown',      (e) => { if (e.key === 'Enter') intentarIngreso(); });
inputPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') intentarIngreso(); });

// ════════════════════════════════════════════════════════════════════════════
// REGISTRO
// ════════════════════════════════════════════════════════════════════════════
const regRut             = document.getElementById('regRut');
const regNombre          = document.getElementById('regNombre');
const regApellido        = document.getElementById('regApellido');
const regTelefono        = document.getElementById('regTelefono');
const regCorreo          = document.getElementById('regCorreo');
const regPassword        = document.getElementById('regPassword');
const regPasswordConfirm = document.getElementById('regPasswordConfirm');
const registrarBtn       = document.getElementById('registrarBtn');
const regBtnLabel        = document.getElementById('regBtnLabel');
const regSpinner         = document.getElementById('regSpinner');
const alertaExito        = document.getElementById('alertaExito');
const alertaErrorReg     = document.getElementById('alertaErrorReg');

regRut.addEventListener('input', () => {
    regRut.value = regRut.value.replace(/[^0-9kK\-]/g, '');
    limpiarError(regRut, 'regRutError');
});

['regNombre','regApellido','regTelefono','regCorreo','regPassword','regPasswordConfirm'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        limpiarError(document.getElementById(id), id + 'Error');
    });
});

function limpiarError(input, errorId) {
    input.classList.remove('error-input');
    document.getElementById(errorId).style.display = 'none';
    alertaErrorReg.style.display = 'none';
}

function limpiarRegistro() {
    [regRut, regNombre, regApellido, regTelefono, regCorreo, regPassword, regPasswordConfirm].forEach(i => {
        i.value = '';
        i.classList.remove('error-input');
    });
    ['regRutError','regNombreError','regApellidoError','regTelefonoError','regCorreoError','regPasswordError','regPasswordConfirmError'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    alertaExito.style.display    = 'none';
    alertaErrorReg.style.display = 'none';
}

function mostrarErrorCampo(inputEl, errorId, msg) {
    inputEl.classList.add('error-input');
    const el = document.getElementById(errorId);
    if (msg) el.textContent = msg;
    el.style.display = 'block';
    inputEl.focus();
}

function setLoadingReg(on) {
    registrarBtn.disabled     = on;
    regBtnLabel.style.display = on ? 'none'  : 'inline';
    regSpinner.style.display  = on ? 'block' : 'none';
}

async function intentarRegistro() {
    const rut             = regRut.value.trim();
    const nombre          = regNombre.value.trim();
    const apellido        = regApellido.value.trim();
    const telefono        = regTelefono.value.trim();
    const correo          = regCorreo.value.trim();
    const password        = regPassword.value;
    const passwordConfirm = regPasswordConfirm.value;

    // Validaciones
    if (!validarFormato(rut))  { mostrarErrorCampo(regRut,      'regRutError',      'RUT con formato inválido (ej: 12345678-9)'); return; }
    if (!nombre)               { mostrarErrorCampo(regNombre,    'regNombreError',   'Ingresa tu nombre'); return; }
    if (!apellido)             { mostrarErrorCampo(regApellido,  'regApellidoError', 'Ingresa tu apellido'); return; }
    if (!telefono)             { mostrarErrorCampo(regTelefono,  'regTelefonoError', 'Ingresa tu teléfono'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        mostrarErrorCampo(regCorreo, 'regCorreoError', 'Ingresa un correo válido');
        return;
    }
    if (!password || password.length < 6) {
        mostrarErrorCampo(regPassword, 'regPasswordError', 'La contraseña debe tener al menos 6 caracteres');
        return;
    }
    if (password !== passwordConfirm) {
        mostrarErrorCampo(regPasswordConfirm, 'regPasswordConfirmError', 'Las contraseñas no coinciden');
        return;
    }

    setLoadingReg(true);
    alertaErrorReg.style.display = 'none';

    try {
        const resp = await fetch(`${API_BASE}/cliente/registrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rut, nombre, apellido, telefono, correo, password })
        });
        const data = await resp.json();

        if (!data.ok) {
            alertaErrorReg.textContent   = data.error || 'No se pudo registrar. Intenta nuevamente.';
            alertaErrorReg.style.display = 'block';
            setLoadingReg(false);
            return;
        }

        // Éxito — mostrar mensaje y redirigir al login tras 2s
        alertaExito.style.display = 'block';
        registrarBtn.disabled     = true;
        setTimeout(() => {
            mostrar(panelLogin);
            inputRut.value = rut;
            alertaExito.style.display = 'none';
            setLoadingReg(false);
        }, 2000);

    } catch (e) {
        alertaErrorReg.textContent   = 'Sin conexión al servidor. Intenta más tarde.';
        alertaErrorReg.style.display = 'block';
        setLoadingReg(false);
    }
}

registrarBtn.addEventListener('click', intentarRegistro);
[regRut, regNombre, regApellido, regTelefono, regCorreo, regPassword, regPasswordConfirm].forEach(inp => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') intentarRegistro(); });
});