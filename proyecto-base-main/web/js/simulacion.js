document.addEventListener('DOMContentLoaded', () => {

    const steps = document.querySelectorAll('.step');

    function showStep(num) {
        steps.forEach((s, i) => s.classList.toggle('active', i == num - 1));
    }

    // ---------- PASO 1 ----------
    document.getElementById('next1').addEventListener('click', () => {
        const tipo = document.getElementById('tipo').value;
        const error = document.getElementById('errorTipo');
        if (!tipo) {
            error.textContent = 'Debes seleccionar un tipo de crédito';
            return;
        }
        error.textContent = '';
        showStep(2);
    });

    // ---------- PASO 2 ----------
    document.getElementById('back2').addEventListener('click', () => showStep(1));
    document.getElementById('next2').addEventListener('click', () => {
        let valid = true;

        const rut = document.getElementById('rut').value;
        const nombre = document.getElementById('nombre').value;
        const correo = document.getElementById('correo').value;
        const telefono = document.getElementById('telefono').value;
        const region = document.getElementById('region').value;
        const comuna = document.getElementById('comuna').value;

        document.getElementById('errorRut').textContent = '';
        document.getElementById('errorNombre').textContent = '';
        document.getElementById('errorCorreo').textContent = '';
        document.getElementById('errorTelefono').textContent = '';
        document.getElementById('errorRegion').textContent = '';
        document.getElementById('errorComuna').textContent = '';

        if (!rut) { document.getElementById('errorRut').textContent = 'El campo es obligatorio'; valid = false; }
        if (!nombre) { document.getElementById('errorNombre').textContent = 'El campo es obligatorio'; valid = false; }
        if (!correo) { document.getElementById('errorCorreo').textContent = 'El campo es obligatorio'; valid = false; }
        if (!telefono || telefono.length <= 6) { document.getElementById('errorTelefono').textContent = 'El campo es obligatorio'; valid = false; }
        if (!region) { document.getElementById('errorRegion').textContent = 'El campo es obligatorio'; valid = false; }
        if (!comuna) { document.getElementById('errorComuna').textContent = 'El campo es obligatorio'; valid = false; }

        if (!valid) return;
        showStep(3);
    });

    // ---------- PASO 3 ----------
    document.getElementById('back3').addEventListener('click', () => showStep(2));
    document.getElementById('next3').addEventListener('click', () => {
        let valid = true;
        const monto = document.getElementById('monto').value;
        const cuotas = document.getElementById('cuotas').value;
        const mesPago = document.getElementById('mesPago').value;
        const diaPago = document.getElementById('diaPago').value;

        document.getElementById('errorMonto').textContent = '';
        document.getElementById('errorCuotas').textContent = '';
        document.getElementById('errorMesPago').textContent = '';
        document.getElementById('errorDiaPago').textContent = '';

        if (!monto) { document.getElementById('errorMonto').textContent = 'El campo es obligatorio'; valid = false; }
        if (!cuotas) { document.getElementById('errorCuotas').textContent = 'El campo es obligatorio'; valid = false; }
        if (!mesPago) { document.getElementById('errorMesPago').textContent = 'El campo es obligatorio'; valid = false; }
        if (!diaPago) { document.getElementById('errorDiaPago').textContent = 'El campo es obligatorio'; valid = false; }
        if (!valid) return;

        const interes = 0.05;
        const total = monto * (1 + interes);
        const valorCuota = total / cuotas;

        const resumen = document.getElementById('resumen');
        resumen.innerHTML = `
            <strong>Tipo:</strong> ${document.getElementById('tipo').value}<br>
            <strong>Monto solicitado:</strong> $${monto}<br>
            <strong>Número de cuotas:</strong> ${cuotas}<br>
            <strong>Total a pagar:</strong> $${total.toFixed(0)}<br>
            <strong>Valor por cuota:</strong> $${valorCuota.toFixed(0)}<br>
            <strong>Primer pago:</strong> ${diaPago} de ${mesPago}
        `;

        showStep(4);
    });

    document.getElementById('back4').addEventListener('click', () => showStep(3));

    // ---------- RUT automático ----------
    const rutInput = document.getElementById('rut');
    rutInput.addEventListener('input', () => {
        let valor = rutInput.value.replace(/[^0-9kK]/g, '');
        let cuerpo = valor.slice(0, -1);
        let dv = valor.slice(-1);
        cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        rutInput.value = cuerpo ? `${cuerpo}-${dv.toUpperCase()}` : dv.toUpperCase();
    });

    // ---------- Teléfono +56 9 ----------
    const telInput = document.getElementById('telefono');
    telInput.addEventListener('input', () => {
        const prefix = '+56 9 ';
        if (!telInput.value.startsWith(prefix)) {
            telInput.value = prefix + telInput.value.replace(prefix, '');
        }
        if (document.activeElement === telInput) {
            telInput.setSelectionRange(telInput.value.length, telInput.value.length);
        }
    });

    // ---------- Regiones y comunas ----------
    const regiones = [
        { nombre: 'Metropolitana', comunas: ['Santiago', 'Providencia', 'Las Condes'] },
        { nombre: 'Valparaíso', comunas: ['Valparaíso', 'Viña del Mar', 'Quilpué'] }
    ];

    const regionSelect = document.getElementById('region');
    const comunaSelect = document.getElementById('comuna');

    regiones.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.nombre;
        opt.textContent = r.nombre;
        regionSelect.appendChild(opt);
    });

    regionSelect.addEventListener('change', () => {
        const r = regiones.find(x => x.nombre === regionSelect.value);
        comunaSelect.innerHTML = '<option value="" disabled selected>Selecciona comuna</option>';
        r.comunas.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            comunaSelect.appendChild(opt);
        });
    });

    // ---------- Número de cuotas ----------
    const cuotasSelect = document.getElementById('cuotas');
    for (let i = 1; i <= 60; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        cuotasSelect.appendChild(opt);
    }

    // ---------- Mes y día ----------
    const mesSelect = document.getElementById('mesPago');
    const diaSelect = document.getElementById('diaPago');
    const hoy = new Date();

    // Agregar opción inicial   
    mesSelect.innerHTML = '<option value="" disabled selected>Selecciona mes</option>';
    diaSelect.innerHTML = '<option value="" disabled selected>Selecciona día</option>';

    // Cargar 3 meses siguientes (incluyendo el actual)
    for (let i = 0; i < 3; i++) {
        let m = hoy.getMonth() + 1 + i;
        let año = hoy.getFullYear();
        if (m > 12) {
            m -= 12;
            año++;
        }

        const nombreMes = new Date(año, m - 1).toLocaleString('es-ES', { month: 'long' });
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
        mesSelect.appendChild(opt);
    }

    // Al cambiar el mes, cargar los días correspondientes
    mesSelect.addEventListener('change', () => {
        const mes = parseInt(mesSelect.value);
        const año = hoy.getFullYear();

        if (!mes) return; // si aún no se ha seleccionado mes

        let dias = 30;
        if ([1, 3, 5, 7, 8, 10, 12].includes(mes)) dias = 31;
        else if (mes === 2) dias = (año % 4 === 0 && (año % 100 !== 0 || año % 400 === 0)) ? 29 : 28;

        diaSelect.innerHTML = '<option value="" disabled selected>Selecciona día</option>';
        for (let d = 1; d <= dias; d++) {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            diaSelect.appendChild(opt);
        }
    });
});


/*
const steps = document.querySelectorAll('.step');

function showStep(num) {
    steps.forEach((s, i) => {
        s.classList.toggle('active', i == num - 1);
    });
}

// ---------- PASO 1 ----------
document.getElementById('next1').addEventListener('click' , () => {
    const tipo = document.getElementById('tipo').value;
    const error = document.getElementById('errorTipo');

    if(!tipo) {
        error.textContent='Debes seleccionar un tipo de crédito';
        return;
    }

    error.textContent='';
    showStep(2);
});

// ---------- PASO 2 ----------
document.getElementById('back2').addEventListener('click', () => showStep(1));

document.getElementById('next2').addEventListener('click', () => {
    let valid = true;

    const rut = document.getElementById('rut').value;
    const nombre = document.getElementById('nombre').value;
    const correo = document.getElementById('correo').value;
    const telefono = document.getElementById('telefono').value;
    const region = document.getElementById('region').value;
    const comuna = document.getElementById('comuna').value;

    document.getElementById('errorRut').textContent='';
    document.getElementById('errorNombre').textContent='';
    document.getElementById('errorCorreo').textContent='';
    document.getElementById('errorTelefono').textContent='';
    document.getElementById('errorRegion').textContent='';
    document.getElementById('errorComuna').textContent='';

    if(!rut){document.getElementById('errorRut').textContent='El campo es obligatorio'; valid=false;}
    if(!nombre){document.getElementById('errorNombre').textContent='El campo es obligatorio'; valid=false;}
    if(!correo){document.getElementById('errorCorreo').textContent='El campo es obligatorio'; valid=false;}
    if(!telefono || telefono.length<=6){document.getElementById('errorTelefono').textContent='El campo es obligatorio'; valid=false;}
    if(!region){document.getElementById('errorRegion').textContent='El campo es obligatorio'; valid=false;}
    if(!comuna){document.getElementById('errorComuna').textContent='El campo es obligatorio'; valid=false;}

    if(!valid) return;

    showStep(3);
});

// ---------- PASO 3 ----------
document.getElementById('back3').addEventListener('click', () => showStep(2));

document.getElementById('next3').addEventListener('click', () => {
    let valid=true;
    const monto = document.getElementById('monto').value;
    const cuotas = document.getElementById('cuotas').value;
    const mesPago = document.getElementById('mesPago').value;
    const diaPago = document.getElementById('diaPago').value;

    document.getElementById('errorMonto').textContent='';
    document.getElementById('errorCuotas').textContent='';
    document.getElementById('errorMesPago').textContent='';
    document.getElementById('errorDiaPago').textContent='';

    if(!monto){document.getElementById('errorMonto').textContent='El campo es obligatorio'; valid=false;}
    if(!cuotas){document.getElementById('errorCuotas').textContent='El campo es obligatorio'; valid=false;}
    if(!mesPago){document.getElementById('errorMesPago').textContent='El campo es obligatorio'; valid=false;}
    if(!diaPago){document.getElementById('errorDiaPago').textContent='El campo es obligatorio'; valid=false;}
    if(!valid) return;

    const interes=0.05;
    const total = monto*(1+interes);
    const valorCuota = total/cuotas;

    const resumen=document.getElementById('resumen');
    resumen.innerHTML=`
        <strong>Tipo:</strong> ${document.getElementById('tipo').value}<br>
        <strong>Monto solicitado:</strong> $${monto}<br>
        <strong>Número de cuotas:</strong> ${cuotas}<br>
        <strong>Total a pagar:</strong> $${total.toFixed(0)}<br>
        <strong>Valor por cuota:</strong> $${valorCuota.toFixed(0)}<br>
        <strong>Primer pago:</strong> ${diaPago} de ${mesPago}
    `;

    showStep(4);
});

document.getElementById('back4').addEventListener('click', () => showStep(3));

// ---------- RUT automático ----------
const rutInput=document.getElementById('rut');
rutInput.addEventListener('input',()=>{
    let valor = rutInput.value.replace(/[^0-9kK]/g,'');
    let cuerpo = valor.slice(0,-1);
    let dv = valor.slice(-1);
    cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
    rutInput.value = cuerpo ? `${cuerpo}-${dv.toUpperCase()}` : dv.toUpperCase();
});

// ---------- Teléfono +56 9 ----------
const telInput=document.getElementById('telefono');
telInput.addEventListener('input', () => {
    const prefix = '+56 9 ';
    if (!telInput.value.startsWith(prefix)) {
        telInput.value = prefix + telInput.value.replace(prefix, '');
    }
    if (document.activeElement === telInput) {
        telInput.setSelectionRange(telInput.value.length, telInput.value.length);
    }
});

// ---------- Inicializar listas desplegables ----------

// Número de cuotas
const cuotasSelect=document.getElementById('cuotas');
for(let i=1;i<=60;i++){
    const opt=document.createElement('option');
    opt.value=i;
    opt.textContent=i;
    cuotasSelect.appendChild(opt);
}

// Mes y día de primer pago
const mesSelect=document.getElementById('mesPago');
const diaSelect=document.getElementById('diaPago');

const hoy=new Date();
for(let i=0;i<3;i++){ // 3 meses máximo
    let m=(hoy.getMonth()+1+i);
    if(m>12)m-=12;
    const opt=document.createElement('option');
    opt.value=m;
    opt.textContent=`${m}`;
    mesSelect.appendChild(opt);
}

// Día se ajusta según mes
mesSelect.addEventListener('change',()=>{
    const mes=parseInt(mesSelect.value);
    const año=hoy.getFullYear();
    let dias=30;
    if([1,3,5,7,8,10,12].includes(mes)) dias=31;
    else if(mes===2) dias=(año%4===0 && (año%100!==0 || año%400===0))?29:28;
    diaSelect.innerHTML='';
    for(let d=1;d<=dias;d++){
        const opt=document.createElement('option');
        opt.value=d;
        opt.textContent=d;
        diaSelect.appendChild(opt);
    }
});

// ---------- Regiones y comunas (simplificado) ----------
const regiones=[
    {nombre:'Metropolitana', comunas:['Santiago','Providencia','Las Condes']},
    {nombre:'Valparaíso', comunas:['Valparaíso','Viña del Mar','Quilpué']}
];
const regionSelect=document.getElementById('region');
const comunaSelect=document.getElementById('comuna');

regiones.forEach(r=>{
    const opt=document.createElement('option');
    opt.value=r.nombre;
    opt.textContent=r.nombre;
    regionSelect.appendChild(opt);
});

regionSelect.addEventListener('change',()=>{
    const r=regiones.find(x=>x.nombre===regionSelect.value);
    comunaSelect.innerHTML='<option value="" disabled selected>Selecciona comuna</option>';
    r.comunas.forEach(c=>{
        const opt=document.createElement('option');
        opt.value=c;
        opt.textContent=c;
        comunaSelect.appendChild(opt);
    });
});
*/