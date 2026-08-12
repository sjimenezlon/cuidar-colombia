/* Carga progresiva: conserva el HTML inicial liviano y activa la aplicación
   al llegar con ancla, desplazarse o iniciar una interacción. */
(function () {
  'use strict';
  var cargado = false;
  function cargar() {
    if (cargado) return;
    cargado = true;
    var app = document.createElement('script');
    app.src = 'assets/app.js?v=20260812zi';
    app.onload = function () {
      var extras = document.createElement('script');
      extras.src = 'assets/extras.js?v=20260812h';
      document.body.appendChild(extras);
    };
    document.body.appendChild(app);
  }
  function preparar() {
    var leyenda = document.getElementById('mapa-leyenda');
    if (leyenda && matchMedia('(max-width:700px)').matches) leyenda.removeAttribute('open');
    if (location.hash || scrollY > 0) cargar();
    ['pointerover', 'pointerdown', 'touchstart', 'keydown', 'wheel', 'focusin'].forEach(function (tipo) {
      window.addEventListener(tipo, cargar, { once: true, passive: true });
    });
  }
  document.addEventListener('DOMContentLoaded', preparar);
})();
