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

  /* ---------- 1. Contador de verificación ---------- */
  Promise.all(['data/ayuda.json', 'data/zonas.json', 'data/geo_puntos.json', 'data/verificacion.json'].map(function (r) {
    return fetch(r).then(function (x) { return x.ok ? x.json() : null; }).catch(function () { return null; });
  })).then(function (r) {
    var cont = document.getElementById('contador-verificacion');
    if (!cont) return;
    var ayuda = r[0] || {}, zonas = r[1] || {}, geo = r[2] || {}, veri = r[3] || {};
    var dominios = {};
    try {
      JSON.stringify(r).replace(/https?:\\?\/\\?\/([^\/"\\]+)/g, function (t, d) { dominios[d] = true; return t; });
    } catch (e) { /* sin dominios */ }
    var datos = (ayuda.canales || []).length + (ayuda.acopios || []).length + (ayuda.sangre || []).length +
      (ayuda.busqueda || []).length + (veri.afirmaciones || []).length + (zonas.municipios || []).length +
      (geo.puntos || []).length;
    var objetivos = [
      [datos, 'registros trazables'],
      [Object.keys(dominios).length, 'fuentes consultadas'],
      [(zonas.municipios || []).length, 'municipios monitoreados']
    ];
    cont.innerHTML = objetivos.map(function (o, i) {
      return '<span class="contador-item"><strong id="contx-' + i + '">0</strong> ' + o[1] + '</span>';
    }).join('<span class="contador-sep" aria-hidden="true">·</span>');
    objetivos.forEach(function (o, i) {
      var el = document.getElementById('contx-' + i), inicio = null;
      function paso(t) {
        if (!inicio) inicio = t;
        var p = Math.min(1, (t - inicio) / 1400);
        el.textContent = Math.round(o[0] * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(paso);
      }
      requestAnimationFrame(paso);
      // Seguro: si la pestaña pierde frames (ventana oculta), fijar el valor final
      setTimeout(function () { el.textContent = o[0]; }, 2200);
    });
  });

  /* ---------- Espera de los datos del mapa ---------- */
  var intentos = 0;
  var espera = setInterval(function () {
    intentos++;
    if (window.__cuidar && window.__cuidar.datos) {
      clearInterval(espera);
      iniciarCercaDeMi();
    } else if (intentos > 80) { clearInterval(espera); }
  }, 250);

  function iniciarCercaDeMi() {
    var filtros = document.getElementById('mapa-filtros');
    if (!filtros) return;

    var fila = document.createElement('div');
    fila.className = 'mapa-extras';
    fila.innerHTML = '<button type="button" class="chip-capa chip-ubicacion" id="boton-cerca">📍 Mostrar puntos cerca de mí</button>';
    filtros.parentNode.insertBefore(fila, filtros.nextSibling);

    document.getElementById('boton-cerca').addEventListener('click', cercaDeMi);
  }

  /* ---------- 2. Cerca de mí ---------- */
  var marcadorUsuario = null;

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
    if (!navigator.geolocation) { res.textContent = 'Tu navegador no permite obtener la ubicación.'; return; }
    res.textContent = 'Buscando puntos de ayuda cerca de ti…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      var mapa = window.__cuidar.obtenerMapa();
      var datos = window.__cuidar.datos || {};
      var lat = pos.coords.latitude, lon = pos.coords.longitude;
      var puntos = ((datos.geo && datos.geo.puntos) || []).map(function (p) {
        return { p: p, d: distanciaKm(lat, lon, p.lat, p.lon) };
      }).sort(function (a, b) { return a.d - b.d; }).slice(0, 5);
      if (mapa) {
        if (marcadorUsuario) marcadorUsuario.remove();
        var el = document.createElement('div');
        el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#C8862A;border:3px solid #fff;box-shadow:0 0 0 5px rgba(200,134,42,.3);';
        marcadorUsuario = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(mapa);
        mapa.flyTo({ center: [lon, lat], zoom: puntos.length && puntos[0].d < 30 ? 11.5 : 7.5, essential: true });
      }
      if (!puntos.length) { res.textContent = 'No hay puntos georreferenciados todavía.'; return; }
      res.innerHTML = '<strong>Lo más cercano a ti:</strong><ul class="lista-cercanos">' + puntos.map(function (c) {
        return '<li>' + (c.p.tipo === 'sangre' ? '🩸' : '📦') + ' <strong>' + esc(c.p.nombre) + '</strong> — ' +
          esc(c.p.ciudad) + (c.p.direccion ? ', ' + esc(c.p.direccion) : '') +
          ' · a ~' + (c.d < 10 ? c.d.toFixed(1) : Math.round(c.d)) + ' km · ' +
          '<a href="https://www.google.com/maps/dir/?api=1&destination=' + c.p.lat + ',' + c.p.lon +
          '" target="_blank" rel="noopener noreferrer">Cómo llegar →</a></li>';
      }).join('') + '</ul><p class="nota-corte">Distancias en línea recta; el pin es aproximado, guíate por la dirección publicada.</p>';
    }, function () {
      res.textContent = 'No pudimos obtener tu ubicación: revisa el permiso de ubicación del navegador.';
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
})();
