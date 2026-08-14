/* ============ Cuidar a Colombia — extras.js ============
   Funciones progresivas: resumen de registros y puntos cercanos.
   Las réplicas no se consultan en vivo: solo deben publicarse después de
   pasar por el mismo proceso de validación y trazabilidad de los demás datos. */

(function () {
  'use strict';

  function esc(t) {
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 1. Contador de trazabilidad, calculado al construir ---------- */
  function actualizarContador() {
    var cont = document.getElementById('contador-verificacion');
    if (!cont) return;
    var resumen = window.__cuidar && window.__cuidar.datos && window.__cuidar.datos.resumen;
    if (!resumen) return;
    var objetivos = [
      [resumen.registros, 'registros trazables'],
      [resumen.fuentes, 'fuentes consultadas'],
      [resumen.municipios, 'municipios monitoreados']
    ];
    if (!document.getElementById('contx-0')) {
      cont.innerHTML = objetivos.map(function (o, i) {
        return '<span class="contador-item"><strong id="contx-' + i + '">' + o[0] + '</strong> ' + o[1] + '</span>';
      }).join('<span class="contador-sep" aria-hidden="true">·</span>');
    } else {
      objetivos.forEach(function (o, i) {
        var valor = document.getElementById('contx-' + i);
        if (valor && valor.textContent !== String(o[0])) valor.textContent = o[0];
      });
    }
  }

  /* ---------- Espera de los datos del mapa ---------- */
  var intentos = 0;
  var espera = setInterval(function () {
    intentos++;
    if (window.__cuidar && window.__cuidar.datos) {
      clearInterval(espera);
      actualizarContador();
      iniciarCercaDeMi();
    } else if (intentos > 80) { clearInterval(espera); }
  }, 250);

  function iniciarCercaDeMi() {
    var filtros = document.getElementById('mapa-filtros');
    if (!filtros) return;

    var fila = document.createElement('div');
    fila.className = 'mapa-extras';
    var datosListos = Boolean(window.__cuidar.datos && window.__cuidar.datos.geo);
    fila.innerHTML = '<button type="button" class="chip-capa chip-ubicacion" id="boton-cerca"' +
      (datosListos ? '' : ' disabled') + '>' + (datosListos ? '📍 Mostrar puntos cerca de mí' : 'Cargando ubicaciones…') + '</button>' +
      '<small class="nota-privacidad-ubicacion">Tu ubicación se procesa solo en este dispositivo; no la guardamos ni la enviamos.</small>';
    filtros.parentNode.insertBefore(fila, filtros.nextSibling);
    var envoltura = document.querySelector('.mapa-envoltura');
    fila.hidden = Boolean(envoltura && envoltura.dataset.modo && envoltura.dataset.modo !== 'ayuda');

    var boton = document.getElementById('boton-cerca');
    boton.addEventListener('click', cercaDeMi);
    window.addEventListener('cuidar:mapa-datos-listos', function () {
      boton.disabled = false; boton.textContent = '📍 Mostrar puntos cerca de mí';
    }, { once: true });
  }

  /* ---------- 2. Cerca de mí ---------- */
  function distanciaKm(a, b, c, d) {
    var rl = Math.PI / 180, x = Math.sin((c - a) * rl / 2), y = Math.sin((d - b) * rl / 2);
    var h = x * x + Math.cos(a * rl) * Math.cos(c * rl) * y * y;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }

  function panelCercanos() {
    var p = document.getElementById('cerca-resultados');
    if (!p) {
      p = document.createElement('div');
      p.id = 'cerca-resultados';
      p.className = 'cerca-resultados';
      p.setAttribute('aria-live', 'polite');
      var ancla = document.getElementById('mapa-resultados');
      (ancla ? ancla.parentNode : document.body).insertBefore(p, ancla || null);
    }
    return p;
  }

  function cercaDeMi() {
    var res = panelCercanos();
    res.hidden = false;
    if (!navigator.geolocation) { res.textContent = 'Tu navegador no permite obtener la ubicación.'; return; }
    res.textContent = 'Buscando puntos de ayuda cerca de ti…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      var datos = window.__cuidar.datos || {};
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      var visibles = window.__cuidar.obtenerPuntosVisibles ? window.__cuidar.obtenerPuntosVisibles() : ((datos.geo && datos.geo.puntos) || []);
      var puntos = visibles.map(function (p) {
        return { p: p, d: distanciaKm(lat, lon, p.lat, p.lon) };
      }).sort(function (a, b) { return a.d - b.d; }).slice(0, 5);
      if (!puntos.length) { res.textContent = 'No hay puntos georreferenciados todavía.'; return; }
      res.innerHTML = '<strong>Lo más cercano a ti:</strong><ul class="lista-cercanos">' + puntos.map(function (c) {
        return '<li>' + (c.p.tipo === 'sangre' ? '🩸' : '📦') + ' <strong>' + esc(c.p.nombre) + '</strong> — ' +
          esc(c.p.ciudad) + (c.p.direccion ? ', ' + esc(c.p.direccion) : '') +
          ' · a ~' + (c.d < 10 ? c.d.toFixed(1) : Math.round(c.d)) + ' km · ' +
          '<a href="https://www.google.com/maps/dir/?api=1&destination=' + c.p.lat + ',' + c.p.lon +
          '" target="_blank" rel="noopener noreferrer" aria-label="Cómo llegar a ' + esc(c.p.nombre) + ' (se abre en una pestaña nueva)">Cómo llegar ↗</a></li>';
      }).join('') + '</ul><p class="nota-corte">Cálculo local y en línea recta; no guardamos tu ubicación. El pin es aproximado: guíate por la dirección publicada.</p>';
    }, function () {
      res.textContent = 'No pudimos obtener tu ubicación: revisa el permiso de ubicación del navegador.';
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
})();
