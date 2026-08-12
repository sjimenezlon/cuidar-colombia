/* ============ Cuidar a Colombia — app.js ============ */
/* Los datos viven en /data/*.json; este archivo solo los pinta.
   El proceso de actualización diaria reescribe los JSON, no este código. */

(function () {
  'use strict';

  var COLORES_GRAVEDAD = { critica: '#7A1815', alta: '#D25B33', media: '#F2B279' };
  var NOMBRES_GRAVEDAD = { critica: 'Crítica', alta: 'Alta', media: 'Media' };

  function esc(t) {
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fetchJSON(ruta) {
    return fetch(ruta).then(function (r) {
      if (!r.ok) throw new Error(ruta + ' → ' + r.status);
      return r.json();
    }).catch(function (e) { console.warn('[cuidar]', e.message); return null; });
  }

  function enlaceFuente(url, titulo) {
    if (!url) return '';
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(titulo || 'fuente') + '</a>';
  }

  function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ---------- Menú móvil ---------- */
  var botonMenu = document.getElementById('menu-movil');
  var nav = document.getElementById('navegacion');
  if (botonMenu) botonMenu.addEventListener('click', function () { nav.classList.toggle('abierta'); });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') nav.classList.remove('abierta'); });

  /* ---------- Meta ---------- */
  function pintarMeta(meta) {
    if (!meta) return;
    var f = meta.ultima_actualizacion || '—';
    document.getElementById('fecha-actualizacion').textContent = f;
    document.getElementById('pie-actualizacion').textContent = 'Última actualización: ' + f;
  }

  /* ---------- Sismo + balance ---------- */
  function pintarSismo(sismo) {
    if (!sismo) return;
    document.getElementById('sismo-descripcion').innerHTML = esc(sismo.descripcion || '') +
      (sismo.fuentes && sismo.fuentes.length
        ? ' <span class="nota-corte">(' + sismo.fuentes.map(function (f) { return enlaceFuente(f.url, f.titulo); }).join(' · ') + ')</span>'
        : '');
  }

  function pintarBalance(balance) {
    if (!balance) return;
    var cont = document.getElementById('fichas-balance');
    cont.innerHTML = (balance.cifras || []).map(function (c) {
      return '<div class="ficha">' +
        '<div class="valor">' + esc(c.valor) + '</div>' +
        '<div class="etiqueta">' + esc(c.etiqueta) + '</div>' +
        (c.fuente_url ? '<div class="fuente-mini">' + enlaceFuente(c.fuente_url, c.fuente_titulo || 'fuente') + '</div>' : '') +
        '</div>';
    }).join('');
    var nota = [];
    if (balance.fecha_corte) nota.push('Cifras con corte al ' + balance.fecha_corte + '; en una emergencia cambian varias veces al día.');
    if (balance.declaratoria) nota.push(balance.declaratoria);
    if (balance.nota) nota.push(balance.nota);
    document.getElementById('nota-corte').textContent = nota.join(' ');
  }

  /* ---------- Líneas de emergencia ---------- */
  function pintarLineas(ayuda) {
    if (!ayuda || !ayuda.lineas || !ayuda.lineas.length) {
      document.getElementById('banner-emergencia').style.display = 'none';
      return;
    }
    document.getElementById('lineas-emergencia').innerHTML = ayuda.lineas.map(function (l) {
      var num = l.numero ? '<a href="tel:' + esc(String(l.numero).replace(/[^0-9+#*]/g, '')) + '">' + esc(l.numero) + '</a>' : '';
      if (!num && l.url) num = '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">ver canal</a>';
      return '<span>' + esc(l.nombre) + ' ' + num + '</span>';
    }).join('');
  }

  /* ---------- Canales financieros ---------- */
  function pintarCanales(ayuda) {
    if (!ayuda || !ayuda.canales) return;
    document.getElementById('canales-financieros').innerHTML = ayuda.canales.map(function (c) {
      return '<div class="tarjeta-canal">' +
        '<div class="canal-cabecera"><h4>' + esc(c.entidad) + '</h4>' +
        '<span class="chip chip-verificado">✓ verificado</span></div>' +
        (c.cobertura ? '<span class="chip chip-ambito">' + esc(c.cobertura) + '</span>' : '') +
        '<div class="canal-detalle">' + esc(c.como_donar || c.campana || '') + '</div>' +
        (c.detalle_cuenta ? '<div class="canal-cuenta">' + esc(c.detalle_cuenta) + '</div>' : '') +
        '<div class="canal-pie">' +
        '<a class="boton boton-secundario" href="' + esc(c.url_oficial) + '" target="_blank" rel="noopener">Ir al canal oficial</a>' +
        '<span class="canal-meta">verificado en ' + esc(c.verificado_en || '') + '<br>' + esc(c.fecha_verificacion || '') + '</span>' +
        '</div></div>';
    }).join('');
  }

  /* ---------- Acopios ---------- */
  var acopiosDatos = [];
  function pintarSelectorCiudades() {
    var sel = document.getElementById('selector-ciudades');
    var ciudades = [];
    acopiosDatos.forEach(function (a) { if (ciudades.indexOf(a.ciudad) === -1) ciudades.push(a.ciudad); });
    sel.innerHTML = ciudades.map(function (c, i) {
      return '<button class="pastilla-ciudad' + (i === 0 ? ' activa' : '') + '" data-ciudad="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
    sel.addEventListener('click', function (e) {
      var b = e.target.closest('.pastilla-ciudad');
      if (!b) return;
      sel.querySelectorAll('.pastilla-ciudad').forEach(function (x) { x.classList.remove('activa'); });
      b.classList.add('activa');
      pintarAcopiosCiudad(b.dataset.ciudad);
    });
    if (ciudades.length) pintarAcopiosCiudad(ciudades[0]);
  }

  function pintarAcopiosCiudad(ciudad) {
    var lista = acopiosDatos.filter(function (a) { return a.ciudad === ciudad; });
    document.getElementById('acopios-detalle').innerHTML = lista.map(function (a) {
      var puntos = (a.puntos || []).map(function (p) {
        return '<li><strong>' + esc(p.nombre) + '</strong>' +
          (p.direccion ? ' — ' + esc(p.direccion) : '') +
          (p.horario ? ' <small>(' + esc(p.horario) + ')</small>' : '') + '</li>';
      }).join('');
      var si = (a.que_donar || []).map(function (q) { return '<span class="etiqueta-si">' + esc(q) + '</span>'; }).join('');
      var no = (a.que_no_donar || []).map(function (q) { return '<span class="etiqueta-no">' + esc(q) + '</span>'; }).join('');
      return '<div class="tarjeta-acopio">' +
        '<h4>' + esc(a.ciudad) + '</h4>' +
        '<div class="acopio-entidad">Habilitado por: ' + esc(a.entidad) + '</div>' +
        (puntos ? '<ul class="lista-puntos">' + puntos + '</ul>' : '') +
        (si ? '<div><strong style="font-size:.82rem">Qué llevar:</strong><div class="etiquetas-donar">' + si + '</div></div>' : '') +
        (no ? '<div style="margin-top:10px"><strong style="font-size:.82rem">Qué no llevar:</strong><div class="etiquetas-donar">' + no + '</div></div>' : '') +
        (a.fuente_url ? '<div class="acopio-fuente">Fuente: ' + enlaceFuente(a.fuente_url, a.fuente_titulo || a.fuente_url) + (a.fecha ? ' · ' + esc(a.fecha) : '') + '</div>' : '') +
        '</div>';
    }).join('') || '<p class="nota-corte">Aún no hay puntos verificados en esta ciudad. Revisa los canales oficiales de tu alcaldía.</p>';
  }

  /* ---------- Sangre ---------- */
  function pintarSangre(ayuda) {
    if (!ayuda || !ayuda.sangre) return;
    document.getElementById('sangre-lista').innerHTML = ayuda.sangre.map(function (s) {
      return '<div class="tarjeta-simple">' +
        '<h4>' + esc(s.ciudad) + '</h4>' +
        '<div class="simple-sub">' + esc(s.entidad) + '</div>' +
        '<p>' + esc(s.donde || '') + '</p>' +
        (s.tipos_urgentes && s.tipos_urgentes.length ? '<p style="margin-top:8px"><strong>Se necesita con urgencia:</strong> ' + esc(s.tipos_urgentes.join(', ')) + '</p>' : '') +
        (s.fuente_url ? '<div class="simple-pie">Fuente: ' + enlaceFuente(s.fuente_url, s.fuente_titulo || 'fuente') + '</div>' : '') +
        '</div>';
    }).join('');
    if (ayuda.sangre_requisitos && ayuda.sangre_requisitos.length) {
      document.getElementById('sangre-requisitos').innerHTML =
        '<h5>Requisitos generales para donar</h5><ul>' +
        ayuda.sangre_requisitos.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';
    }
  }

  /* ---------- Búsqueda de personas ---------- */
  function pintarBusqueda(ayuda) {
    if (!ayuda || !ayuda.busqueda) return;
    document.getElementById('busqueda-lista').innerHTML = ayuda.busqueda.map(function (b) {
      return '<div class="tarjeta-simple">' +
        '<h4>' + esc(b.mecanismo) + '</h4>' +
        '<div class="simple-sub">' + esc(b.entidad || '') + '</div>' +
        (b.linea ? '<div class="destacado-linea">' + esc(b.linea) + '</div>' : '') +
        '<p>' + esc(b.como_usar || '') + '</p>' +
        (b.url ? '<p style="margin-top:8px"><a class="boton boton-secundario" style="font-size:.8rem;padding:7px 14px" href="' + esc(b.url) + '" target="_blank" rel="noopener">Abrir canal</a></p>' : '') +
        (b.fuente_url ? '<div class="simple-pie">Fuente: ' + enlaceFuente(b.fuente_url, 'ver anuncio') + '</div>' : '') +
        '</div>';
    }).join('');
  }

  /* ---------- Pedagogía ---------- */
  function pintarPedagogia(ped) {
    if (!ped) return;
    document.getElementById('consejos-lista').innerHTML = (ped.consejos || []).map(function (c) {
      return '<li><strong>' + esc(c.consejo) + '</strong>' +
        '<span class="consejo-explica">' + esc(c.explicacion || '') + '</span> ' +
        (c.fuente_url ? '<span class="consejo-fuente">— ' + enlaceFuente(c.fuente_url, c.fuente || 'fuente') + '</span>' : '') +
        '</li>';
    }).join('');
    document.getElementById('fraude-lista').innerHTML = (ped.senales || []).map(function (s) {
      return '<li><strong>' + esc(s.senal) + '</strong>' +
        '<span class="fraude-explica">' + esc(s.explicacion || '') + '</span> ' +
        (s.fuente_url ? '<span class="fraude-fuente">— ' + enlaceFuente(s.fuente_url, 'fuente') + '</span>' : '') +
        '</li>';
    }).join('');
    if (ped.alertas && ped.alertas.length) {
      document.getElementById('alertas-actuales').innerHTML =
        '<h3 style="font-size:1rem;margin-top:22px">⚠️ Alertas activas en esta emergencia</h3>' +
        ped.alertas.map(function (a) {
          return '<div class="alerta-actual">' + esc(a.alerta) + ' ' +
            (a.fuente_url ? '<span style="font-size:.75rem">— ' + enlaceFuente(a.fuente_url, 'fuente') + (a.fecha ? ' · ' + esc(a.fecha) : '') + '</span>' : '') + '</div>';
        }).join('');
    }
  }

  /* ---------- Zonas ---------- */
  function pintarZonas(zonas) {
    if (!zonas) return;
    if (zonas.intro) document.getElementById('zonas-intro').textContent = zonas.intro;
    var porDepto = {};
    (zonas.municipios || []).forEach(function (m) {
      (porDepto[m.departamento] = porDepto[m.departamento] || []).push(m);
    });
    var orden = { critica: 0, alta: 1, media: 2 };
    var deptos = Object.keys(porDepto).sort(function (a, b) {
      var ga = Math.min.apply(null, porDepto[a].map(function (m) { return orden[m.gravedad] != null ? orden[m.gravedad] : 3; }));
      var gb = Math.min.apply(null, porDepto[b].map(function (m) { return orden[m.gravedad] != null ? orden[m.gravedad] : 3; }));
      return ga - gb || porDepto[b].length - porDepto[a].length;
    });
    document.getElementById('zonas-departamentos').innerHTML = deptos.map(function (d) {
      var ms = porDepto[d].slice().sort(function (a, b) { return (orden[a.gravedad] || 3) - (orden[b.gravedad] || 3); });
      return '<div class="grupo-depto"><h3>' + esc(d) + '<small>' + ms.length + ' municipio' + (ms.length === 1 ? '' : 's') + ' con reporte</small></h3>' +
        '<div class="tarjetas-municipios">' + ms.map(function (m) {
          return '<div class="tarjeta-municipio">' +
            '<div class="muni-cabecera"><h4>' + esc(m.municipio) + '</h4>' +
            '<span class="chip chip-gravedad-' + esc(m.gravedad || 'media') + '">' + esc(NOMBRES_GRAVEDAD[m.gravedad] || m.gravedad || '') + '</span></div>' +
            '<p>' + esc(m.afectacion || '') + '</p>' +
            (m.fuentes && m.fuentes.length ? '<div class="muni-fuente">' + m.fuentes.map(function (f) { return enlaceFuente(f.url, f.titulo || 'fuente'); }).join(' · ') + '</div>' : '') +
            '</div>';
        }).join('') + '</div></div>';
    }).join('');
    var vias = document.getElementById('vias-lista');
    if (zonas.vias && zonas.vias.length) {
      vias.innerHTML = zonas.vias.map(function (v) {
        return '<li>' + esc(v.texto) + (v.fuente_url ? ' ' + enlaceFuente(v.fuente_url, '(fuente)') : '') + '</li>';
      }).join('');
    } else document.getElementById('vias-bloque').style.display = 'none';
    var resp = document.getElementById('respuesta-lista');
    if (zonas.respuesta && zonas.respuesta.length) {
      resp.innerHTML = zonas.respuesta.map(function (r) {
        return '<li>' + esc(r.texto) + (r.fuente_url ? ' ' + enlaceFuente(r.fuente_url, '(fuente)') : '') + '</li>';
      }).join('');
    } else document.getElementById('respuesta-bloque').style.display = 'none';
  }

  /* ---------- Benchmarks ---------- */
  function pintarBenchmarks(bm) {
    if (!bm || !bm.items) return;
    document.getElementById('benchmarks-lista').innerHTML = bm.items.map(function (b) {
      return '<div class="tarjeta-mundo">' +
        '<div class="mundo-cabecera"><h4>' + esc(b.nombre) + '</h4>' +
        '<span class="mundo-contexto">' + esc(b.pais_desastre || '') + (b.ano ? ' · ' + esc(b.ano) : '') + '</span></div>' +
        '<p>' + esc(b.que_hacia) + '</p>' +
        '<div class="mundo-leccion"><strong>La lección</strong>' + esc(b.leccion) + '</div>' +
        (b.url ? '<a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + (b.estado === 'activa' ? 'Visitar →' : 'Ver registro →') + '</a>' : '') +
        '</div>';
    }).join('');
  }

  /* ---------- Fuentes ---------- */
  function pintarFuentes(fu) {
    if (!fu || !fu.items) return;
    document.getElementById('fuentes-lista').innerHTML = fu.items.map(function (f) {
      return '<a class="fuente-item" href="' + esc(f.url) + '" target="_blank" rel="noopener">' +
        '<strong>' + esc(f.nombre) + '</strong>' +
        (f.descripcion ? '<span style="font-size:.8rem;color:var(--tinta-suave)">' + esc(f.descripcion) + '</span><br>' : '') +
        '<small>' + esc(f.url.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</small></a>';
    }).join('');
  }

  /* ============ MAPA ============ */
  /* Patrón: arrancar con estilo local mínimo (nunca colgar el arranque del CDN),
     traer el mapa base después con reintentos, y reconstruir las capas propias
     en styledata porque setStyle las borra. Los datos propios se pintan SIEMPRE,
     llegue o no el mapa base. */
  var mapa = null, datosMapa = { municipios: null, zonas: null, ayuda: null, sismo: null };

  function iniciarMapa() {
    if (typeof maplibregl === 'undefined') return;
    mapa = new maplibregl.Map({
      container: 'mapa',
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#DCE7ED' } }]
      },
      center: [-76.2, 4.9],
      zoom: 7,
      cooperativeGestures: true,
      attributionControl: { compact: true }
    });
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    construirCapas();
    mapa.on('styledata', construirCapas);

    var intentos = 0;
    (function traerBase() {
      intentos++;
      fetch('https://tiles.openfreemap.org/styles/positron')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (estilo) { mapa.setStyle(estilo, { diff: false }); })
        .catch(function () { if (intentos < 3) setTimeout(traerBase, 2500 * intentos); });
    })();
  }

  function construirCapas() {
    if (!mapa || !datosMapa.municipios || !datosMapa.zonas) return;
    try {
      if (!mapa.getSource('municipios')) {
        mapa.addSource('municipios', { type: 'geojson', data: datosMapa.municipios });
      }
      var codigos = datosMapa._codigos; // { mpio: gravedad }
      var claves = Object.keys(codigos);
      if (!mapa.getLayer('afectados-relleno')) {
        var expresion = ['match', ['get', 'mpio']];
        claves.forEach(function (k) { expresion.push(k, COLORES_GRAVEDAD[codigos[k]] || '#F2B279'); });
        expresion.push('rgba(0,0,0,0)');
        mapa.addLayer({
          id: 'afectados-relleno', type: 'fill', source: 'municipios',
          filter: ['in', ['get', 'mpio'], ['literal', claves]],
          paint: { 'fill-color': expresion, 'fill-opacity': 0.78 }
        });
        mapa.addLayer({
          id: 'afectados-borde', type: 'line', source: 'municipios',
          filter: ['in', ['get', 'mpio'], ['literal', claves]],
          paint: { 'line-color': '#5A3A26', 'line-width': 0.8, 'line-opacity': 0.6 }
        });
      }
    } catch (e) { console.warn('[mapa]', e.message); }
  }

  // Erratas conocidas del geojson (p. ej. «Itsmina»): alias explícito nombre|depto → código DANE
  var ALIAS_MPIO = { 'istmina|choco': '27361' };

  function prepararDatosMapa() {
    var indice = {}; // nombre normalizado + depto normalizado → mpio
    var porNombre = {}; // nombre normalizado → [mpio]
    datosMapa.municipios.features.forEach(function (f) {
      var p = f.properties;
      indice[normalizar(p.nombre) + '|' + normalizar(p.depto)] = p.mpio;
      (porNombre[normalizar(p.nombre)] = porNombre[normalizar(p.nombre)] || []).push(p.mpio);
    });
    var codigos = {}, sinPoligono = [];
    (datosMapa.zonas.municipios || []).forEach(function (m) {
      var clave = normalizar(m.municipio) + '|' + normalizar(m.departamento);
      var codigo = ALIAS_MPIO[clave] || indice[clave];
      if (!codigo) {
        var candidatos = porNombre[normalizar(m.municipio)];
        if (candidatos && candidatos.length === 1) codigo = candidatos[0];
      }
      if (codigo) codigos[codigo] = m.gravedad || 'media';
      else if (m.lat && m.lon) sinPoligono.push(m);
      if (codigo) m._mpio = codigo;
    });
    datosMapa._codigos = codigos;
    datosMapa._sinPoligono = sinPoligono;
  }

  function anadirMarcadores() {
    if (!mapa) return;
    var sismo = datosMapa.sismo;
    if (sismo && sismo.epicentro && sismo.epicentro.lat) {
      var el = document.createElement('div');
      el.style.cssText = 'width:20px;height:20px;border-radius:50%;background:#16324F;border:3px solid #fff;box-shadow:0 0 0 6px rgba(22,50,79,.28);';
      new maplibregl.Marker({ element: el })
        .setLngLat([sismo.epicentro.lon, sismo.epicentro.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(
          '<h4>Epicentro</h4><p>' + esc(sismo.epicentro.municipio || '') + ', ' + esc(sismo.epicentro.departamento || '') +
          '</p><p>Magnitud ' + esc(sismo.magnitud) + ' · Profundidad ' + esc(sismo.profundidad_km) + ' km</p>'))
        .addTo(mapa);
    }
    (datosMapa._sinPoligono || []).forEach(function (m) {
      var el = document.createElement('div');
      var color = COLORES_GRAVEDAD[m.gravedad] || '#F2B279';
      el.style.cssText = 'width:14px;height:14px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;';
      new maplibregl.Marker({ element: el })
        .setLngLat([m.lon, m.lat])
        .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(popupMunicipio(m)))
        .addTo(mapa);
    });
    var ayuda = datosMapa.ayuda;
    if (ayuda && ayuda.ciudades_acopio) {
      ayuda.ciudades_acopio.forEach(function (c) {
        if (!c.lat) return;
        var el = document.createElement('div');
        el.style.cssText = 'width:13px;height:13px;border-radius:50%;background:#1D5A8A;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;';
        new maplibregl.Marker({ element: el })
          .setLngLat([c.lon, c.lat])
          .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(
            '<h4>' + esc(c.ciudad) + '</h4><p>Ciudad con puntos de acopio habilitados.</p>' +
            '<p><a href="#acopios">Ver puntos de acopio →</a></p>'))
          .addTo(mapa);
      });
    }
  }

  function popupMunicipio(m) {
    var color = COLORES_GRAVEDAD[m.gravedad] || '#8A6420';
    return '<h4>' + esc(m.municipio) + ', ' + esc(m.departamento) + '</h4>' +
      '<span class="pop-gravedad" style="color:' + color + '">Gravedad ' + esc(NOMBRES_GRAVEDAD[m.gravedad] || m.gravedad || '') + '</span>' +
      '<p>' + esc(m.afectacion || '') + '</p>' +
      (m.fuentes && m.fuentes.length ? '<div class="pop-fuente">' + m.fuentes.map(function (f) { return enlaceFuente(f.url, f.titulo || 'fuente'); }).join(' · ') + '</div>' : '');
  }

  function conectarClicsMapa() {
    if (!mapa) return;
    var porCodigo = {};
    (datosMapa.zonas.municipios || []).forEach(function (m) { if (m._mpio) porCodigo[m._mpio] = m; });
    mapa.on('click', 'afectados-relleno', function (e) {
      var m = porCodigo[e.features[0].properties.mpio];
      if (!m) return;
      new maplibregl.Popup({ offset: 6 }).setLngLat(e.lngLat).setHTML(popupMunicipio(m)).addTo(mapa);
    });
    mapa.on('mouseenter', 'afectados-relleno', function () { mapa.getCanvas().style.cursor = 'pointer'; });
    mapa.on('mouseleave', 'afectados-relleno', function () { mapa.getCanvas().style.cursor = ''; });
  }

  function encuadrarMapa() {
    var puntos = [];
    (datosMapa.zonas.municipios || []).forEach(function (m) { if (m.lat && m.lon) puntos.push([m.lon, m.lat]); });
    var s = datosMapa.sismo;
    if (s && s.epicentro && s.epicentro.lat) puntos.push([s.epicentro.lon, s.epicentro.lat]);
    if (puntos.length < 2) return;
    var limites = puntos.reduce(function (b, p) { return b.extend(p); }, new maplibregl.LngLatBounds(puntos[0], puntos[0]));
    mapa.fitBounds(limites, { padding: 70, maxZoom: 9, duration: 0 });
  }

  /* ============ Arranque ============ */
  Promise.all([
    fetchJSON('data/meta.json'),
    fetchJSON('data/sismo.json'),
    fetchJSON('data/balance.json'),
    fetchJSON('data/zonas.json'),
    fetchJSON('data/ayuda.json'),
    fetchJSON('data/pedagogia.json'),
    fetchJSON('data/benchmarks.json'),
    fetchJSON('data/fuentes.json'),
    fetchJSON('data/municipios.geojson')
  ]).then(function (r) {
    var meta = r[0], sismo = r[1], balance = r[2], zonas = r[3], ayuda = r[4],
        pedagogia = r[5], benchmarks = r[6], fuentes = r[7], municipios = r[8];

    pintarMeta(meta);
    pintarSismo(sismo);
    pintarBalance(balance);
    pintarLineas(ayuda);
    pintarCanales(ayuda);
    if (ayuda && ayuda.acopios) { acopiosDatos = ayuda.acopios; pintarSelectorCiudades(); }
    pintarSangre(ayuda);
    pintarBusqueda(ayuda);
    pintarPedagogia(pedagogia);
    pintarZonas(zonas);
    pintarBenchmarks(benchmarks);
    pintarFuentes(fuentes);

    if (municipios && zonas) {
      datosMapa.municipios = municipios;
      datosMapa.zonas = zonas;
      datosMapa.ayuda = ayuda;
      datosMapa.sismo = sismo;
      prepararDatosMapa();
      iniciarMapa();
      construirCapas();
      anadirMarcadores();
      conectarClicsMapa();
      encuadrarMapa();
    }
  });
})();
