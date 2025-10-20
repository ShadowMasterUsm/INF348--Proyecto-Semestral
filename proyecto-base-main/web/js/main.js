





const btnSimular = document.querySelector('.btn-accent');

if (btnSimular) {
  // Añadimos un evento al botón que se ejecuta al hacer click
  btnSimular.addEventListener('click', () => {
    // window.location.href sirve para redirigir a otra página
    // En este caso, vamos a "simulacion.html"
    window.location.href = "simulacion.html";
  });
}


//btnSimulacion.addEventListener('click', () => {
//    window.location.href = '../simulacion.html';
//});