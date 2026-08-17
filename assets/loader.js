/* Carga progresiva: conserva el HTML inicial liviano y activa la aplicación
   al llegar con ancla, desplazarse o iniciar una interacción. */
(function () {
  'use strict';
  var cargado = false;
  var dialogo;
  var formulario;
  var estado;
  var botonEnviar;

  function mostrarEstado(mensaje, tipo) {
    if (!estado) return;
    estado.textContent = mensaje || '';
    estado.classList.remove('exito', 'error');
    if (tipo) estado.classList.add(tipo);
  }

  function configurarTipoFormulario(tipo) {
    if (!formulario) return;
    var esEntidad = tipo === 'entidad';
    var titulo = document.getElementById('sugerencias-titulo');
    var ayuda = document.getElementById('sugerencias-ayuda');
    var etiquetaContacto = document.getElementById('sugerencia-contacto-etiqueta');
    var nota = document.getElementById('sugerencia-nota');
    var mensaje = formulario.elements.mensaje;
    var contacto = formulario.elements.contacto;
    if (titulo) titulo.textContent = esEntidad ? 'Solicitar actualización de entidad' : 'Enviar un reporte';
    if (ayuda) ayuda.textContent = esEntidad
      ? 'La solicitud no cambia el portal automáticamente. Incluye un enlace publicado en el dominio o canal oficial de la entidad. No envíes cédulas, poderes, historias clínicas, datos bancarios ni información sensible.'
      : 'Es breve y llega al equipo sin mostrar la dirección destinataria. No envíes cédulas, historias clínicas, direcciones de vivienda, datos bancarios ni información sensible de víctimas.';
    if (etiquetaContacto) etiquetaContacto.innerHTML = esEntidad ? 'Contacto institucional <small>(obligatorio)</small>' : 'Contacto para responder <small>(opcional)</small>';
    if (nota) nota.textContent = esEntidad
      ? 'Usa un correo institucional o deja un canal verificable. La solicitud será contrastada antes de cualquier publicación.'
      : 'El contacto es opcional. El mensaje se usa exclusivamente para revisar y mejorar esta plataforma.';
    contacto.required = esEntidad;
    contacto.placeholder = esEntidad ? 'Correo institucional o teléfono verificable' : 'Correo o teléfono; puedes dejarlo vacío';
    mensaje.placeholder = esEntidad
      ? 'Explica qué debe actualizarse y pega el enlace público del anuncio oficial.'
      : 'Describe el cambio y, si puedes, pega el enlace de la fuente.';
  }

  function abrirSugerencias(activador) {
    if (!dialogo || !formulario) return;
    var tipo = (activador && activador.dataset.tipo) || 'sugerencia';
    var registro = (activador && activador.dataset.registro) || '';
    var seccion = (activador && activador.dataset.seccion) || '';
    formulario.elements.tipo.value = ['dato', 'entidad', 'sugerencia', 'seguridad', 'otro'].indexOf(tipo) >= 0 ? tipo : 'otro';
    configurarTipoFormulario(formulario.elements.tipo.value);
    formulario.elements.registro.value = registro;
    formulario.elements.seccion.value = seccion;
    formulario.elements.inicio.value = String(Date.now());
    document.getElementById('campo-sugerencia-registro').hidden = !registro;
    mostrarEstado('');
    if (!dialogo.open) {
      if (typeof dialogo.showModal === 'function') dialogo.showModal();
      else dialogo.setAttribute('open', '');
    }
    setTimeout(function () { formulario.elements.mensaje.focus(); }, 0);
  }

  function cerrarSugerencias() {
    if (!dialogo || !dialogo.open) return;
    if (typeof dialogo.close === 'function') dialogo.close();
    else dialogo.removeAttribute('open');
  }

  async function enviarSugerencia(evento) {
    evento.preventDefault();
    if (!formulario.checkValidity()) {
      formulario.reportValidity();
      return;
    }
    botonEnviar.disabled = true;
    mostrarEstado('Enviando de forma segura…');
    var datos = new FormData(formulario);
    var cuerpo = {
      tipo: datos.get('tipo'),
      registro: datos.get('registro'),
      seccion: datos.get('seccion'),
      mensaje: datos.get('mensaje'),
      contacto: datos.get('contacto'),
      empresa: datos.get('empresa'),
      inicio: datos.get('inicio'),
      pagina: location.origin + location.pathname + location.hash
    };
    try {
      var respuesta = await fetch('/api/sugerencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(cuerpo)
      });
      var resultado = {};
      try { resultado = await respuesta.json(); } catch (_) { /* Respuesta no estructurada */ }
      if (!respuesta.ok || !resultado.ok) throw new Error(resultado.mensaje || 'No pudimos enviar el reporte. Intenta nuevamente.');
      formulario.elements.mensaje.value = '';
      formulario.elements.contacto.value = '';
      formulario.elements.empresa.value = '';
      formulario.elements.inicio.value = String(Date.now());
      mostrarEstado(resultado.mensaje || 'Gracias. Recibimos tu reporte y lo revisaremos.', 'exito');
    } catch (error) {
      mostrarEstado(error && error.message ? error.message : 'No pudimos enviar el reporte. Intenta nuevamente.', 'error');
    } finally {
      botonEnviar.disabled = false;
    }
  }

  function prepararSugerencias() {
    dialogo = document.getElementById('sugerencias');
    formulario = document.getElementById('formulario-sugerencias');
    estado = document.getElementById('estado-sugerencia');
    botonEnviar = document.getElementById('enviar-sugerencia');
    if (!dialogo || !formulario || !botonEnviar) return;
    document.addEventListener('click', function (evento) {
      var activador = evento.target.closest && evento.target.closest('.abrir-sugerencias');
      if (!activador) return;
      evento.preventDefault();
      abrirSugerencias(activador);
    });
    document.getElementById('cerrar-sugerencias').addEventListener('click', cerrarSugerencias);
    document.getElementById('cancelar-sugerencia').addEventListener('click', cerrarSugerencias);
    formulario.elements.tipo.addEventListener('change', function () { configurarTipoFormulario(formulario.elements.tipo.value); });
    formulario.addEventListener('submit', enviarSugerencia);
    if (location.hash === '#sugerencias') abrirSugerencias({ dataset: { tipo: 'seguridad' } });
  }
  function cargar() {
    if (cargado) return;
    cargado = true;
    var app = document.createElement('script');
    app.src = 'assets/app.js?v=20260817b';
    app.onload = function () {
      var extras = document.createElement('script');
      extras.src = 'assets/extras.js?v=20260817b';
      document.body.appendChild(extras);
    };
    document.body.appendChild(app);
  }
  function preparar() {
    prepararSugerencias();
    var accionesPrincipales = document.querySelector('.acciones-rapidas');
    var fabDonar = document.querySelector('.fab-donar-movil');
    if (accionesPrincipales && fabDonar && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entradas) {
        var accionesVisibles = entradas[0].isIntersecting;
        fabDonar.hidden = accionesVisibles;
        document.body.classList.toggle('acciones-principales-visibles', accionesVisibles);
      }, { threshold: 0.2 }).observe(accionesPrincipales);
    }
    var leyenda = document.getElementById('mapa-leyenda');
    if (leyenda && matchMedia('(max-width:700px)').matches) leyenda.removeAttribute('open');
    if (location.hash || scrollY > 0) cargar();
    ['pointerover', 'pointerdown', 'touchstart', 'keydown', 'wheel', 'focusin'].forEach(function (tipo) {
      window.addEventListener(tipo, cargar, { once: true, passive: true });
    });
    // Mantener el primer render liviano sin dejar datos o mapa congelados si
    // la persona no mueve el cursor ni toca la pantalla al abrir la página.
    // Un temporizador real también corre en pestañas sin foco; algunos
    // navegadores postergan requestIdleCallback indefinidamente en background.
    setTimeout(cargar, 1200);
  }
  document.addEventListener('DOMContentLoaded', preparar);
})();
