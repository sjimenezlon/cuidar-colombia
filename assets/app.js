/* ============ Cuidar a Colombia — app.js ============ */
/* Los datos viven en /data/*.json; este archivo solo los pinta.
   El proceso de actualización diaria reescribe los JSON, no este código. */

(function () {
  'use strict';

  var COLORES_GRAVEDAD = { critica: '#7A1815', alta: '#D25B33', media: '#F2B279' };
  var NOMBRES_GRAVEDAD = { critica: 'Crítica', alta: 'Alta', media: 'Media' };
  var COLOR_ACOPIO = '#1D5A8A', COLOR_SANGRE = '#C62828';
  var filtrosMapa = {
    gravedades: { critica: true, alta: true, media: true },
    puntos: { acopio: true, sangre: true },
    departamento: 'todos', busqueda: ''
  };
  function esc(t) {
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function urlSegura(url, permitirTel) {
    if (!url) return '';
    try {
      var u = new URL(String(url), window.location.href);
      if (u.protocol === 'https:' || (permitirTel && u.protocol === 'tel:')) return u.href;
    } catch (e) { /* URL inválida */ }
    return '';
  }

  function pintarError(id, mensaje) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<div class="estado-datos estado-error" role="alert"><strong>No pudimos cargar esta información.</strong><span>' + esc(mensaje) + '</span></div>';
  }

  function fetchJSON(ruta) {
    return fetch(ruta).then(function (r) {
      if (!r.ok) throw new Error(ruta + ' → ' + r.status);
      return r.json();
    }).catch(function (e) { console.warn('[cuidar]', e.message); return null; });
  }

  function enlaceFuente(url, titulo) {
    var segura = urlSegura(url, false);
    if (!segura) return '';
    return '<a href="' + esc(segura) + '" target="_blank" rel="noopener noreferrer">' + esc(titulo || 'fuente') + '</a>';
  }

  function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ---------- Menú móvil ---------- */
  var botonMenu = document.getElementById('menu-movil');
  var nav = document.getElementById('navegacion');
  function cambiarMenu(abierto) {
    if (!nav || !botonMenu) return;
    nav.classList.toggle('abierta', abierto);
    botonMenu.setAttribute('aria-expanded', String(abierto));
    botonMenu.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  }
  if (botonMenu) botonMenu.addEventListener('click', function () { cambiarMenu(!nav.classList.contains('abierta')); });
  if (nav) nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') cambiarMenu(false); });

  /* ---------- Meta ---------- */
  function pintarMeta(meta) {
    if (!meta) return;
    var f = meta.ultima_actualizacion || '—';
    document.getElementById('fecha-actualizacion').textContent = f;
    document.getElementById('pie-actualizacion').textContent = 'Última actualización: ' + f;
    var aviso = document.getElementById('aviso-vigencia');
    var fecha = new Date(meta.iso);
    if (!aviso || isNaN(fecha.getTime())) return;
    var horas = Math.max(0, (Date.now() - fecha.getTime()) / 36e5);
    var limite = Number(meta.vigencia_horas) || 24;
    aviso.hidden = false;
    if (horas > limite) {
      aviso.className = 'aviso-vigencia aviso-vigencia-alerta';
      aviso.innerHTML = '<strong>Esta información necesita una nueva revisión.</strong> Confirma siempre en la fuente antes de actuar.';
    } else {
      aviso.className = 'aviso-vigencia aviso-vigencia-ok';
      aviso.innerHTML = '<strong>Datos dentro de la ventana de revisión.</strong>' +
        (meta.proxima_revision ? ' Próxima revisión prevista: ' + esc(meta.proxima_revision) : '');
    }
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

  /* ---------- Canales financieros: cobertura + nivel de evidencia ---------- */
  var canalesTodos = [];
  var filtrosCanales = { cobertura: 'todas', evidencia: 'todas' };

  function nivelCanal(c) {
    return c && c.verificacion && c.verificacion.nivel === 'fuente_oficial' ? 'fuente_oficial' : 'fuente_secundaria';
  }

  function pintarCanales(ayuda) {
    if (!ayuda || !Array.isArray(ayuda.canales)) {
      pintarError('canales-financieros', 'Consulta directamente los sitios de las entidades antes de donar.');
      return;
    }
    canalesTodos = ayuda.canales;
    var filtros = document.getElementById('filtros-canales');
    filtros.innerHTML = '<label class="control-filtro"><span>Cobertura</span><select id="filtro-cobertura">' +
      '<option value="todas">Todas</option><option value="Nacional">En Colombia</option>' +
      '<option value="Desde el exterior">Desde el exterior</option></select></label>' +
      '<label class="control-filtro"><span>Evidencia</span><select id="filtro-evidencia">' +
      '<option value="todas">Todos los niveles</option><option value="fuente_oficial">Fuente oficial</option>' +
      '<option value="fuente_secundaria">Confirmación secundaria</option></select></label>' +
      '<span class="conteo-resultados" id="conteo-canales" role="status"></span>';
    document.getElementById('filtro-cobertura').addEventListener('change', function (e) {
      filtrosCanales.cobertura = e.target.value; pintarTarjetasCanales();
    });
    document.getElementById('filtro-evidencia').addEventListener('change', function (e) {
      filtrosCanales.evidencia = e.target.value; pintarTarjetasCanales();
    });
    pintarTarjetasCanales();
  }

  function pintarTarjetasCanales() {
    var lista = canalesTodos.filter(function (c) {
      return (filtrosCanales.cobertura === 'todas' || c.cobertura === filtrosCanales.cobertura) &&
        (filtrosCanales.evidencia === 'todas' || nivelCanal(c) === filtrosCanales.evidencia);
    });
    var conteo = document.getElementById('conteo-canales');
    if (conteo) conteo.textContent = lista.length + ' canal' + (lista.length === 1 ? '' : 'es');
    var cont = document.getElementById('canales-financieros');
    if (!lista.length) {
      cont.innerHTML = '<div class="estado-datos">No hay canales que coincidan con estos filtros.</div>';
      return;
    }
    cont.innerHTML = lista.map(function (c) {
      var oficial = nivelCanal(c) === 'fuente_oficial';
      var chip = oficial
        ? '<span class="chip chip-verificado">✓ Fuente oficial</span>'
        : '<span class="chip chip-verificado-prensa">◉ Confirmación secundaria</span>';
      var destino = urlSegura(c.url_oficial, false);
      var evidencia = c.verificacion && urlSegura(c.verificacion.evidencia_url, false);
      return '<article class="tarjeta-canal">' +
        '<div class="canal-cabecera"><h4>' + esc(c.entidad) + '</h4>' + chip + '</div>' +
        (c.cobertura ? '<span class="chip chip-ambito">' + esc(c.cobertura) + '</span>' : '') +
        '<div class="canal-detalle">' + esc(c.como_donar || c.campana || '') + '</div>' +
        (c.detalle_cuenta ? '<div class="canal-cuenta">' + esc(c.detalle_cuenta) + '</div>' : '') +
        '<div class="canal-pie">' +
        (destino ? '<a class="boton boton-secundario" href="' + esc(destino) + '" target="_blank" rel="noopener noreferrer">' +
          (oficial ? 'Abrir canal oficial' : 'Ver evidencia y confirmar') + '</a>' : '') +
        '<span class="canal-meta">Comprobado en ' + esc(c.verificado_en || '') + '<br>' + esc(c.fecha_verificacion || '') +
        (evidencia && evidencia !== destino ? ' · <a href="' + esc(evidencia) + '" target="_blank" rel="noopener noreferrer">ver evidencia</a>' : '') + '</span>' +
        '</div></article>';
    }).join('');
  }

  /* ---------- Antes de reenviar, verifica ---------- */
  function pintarCadenas(verificacion) {
    if (!verificacion || !Array.isArray(verificacion.afirmaciones)) {
      pintarError('cadenas-lista', 'No reenvíes cadenas: consulta las fuentes oficiales enlazadas más abajo.');
      return;
    }
    var etiquetasNivel = {
      fuente_oficial: { clase: 'chip-verificado', texto: 'Fuente oficial' },
      fuente_secundaria: { clase: 'chip-verificado-prensa', texto: 'Confirmación secundaria' },
      guia_publica: { clase: 'chip-verificado-prensa', texto: 'Organización verificadora' }
    };
    document.getElementById('cadenas-lista').innerHTML = verificacion.afirmaciones.map(function (c) {
      var nivel = etiquetasNivel[c.nivel_fuente] || etiquetasNivel.guia_publica;
      var remision = urlSegura(c.remitir_url, false);
      return '<div class="tarjeta-cadena">' +
        '<p class="cadena-dice"><strong>Afirmación:</strong> ' + esc(c.afirmacion) + '</p>' +
        '<p class="cadena-realidad"><strong>' + esc(c.veredicto) + ':</strong> ' + esc(c.realidad) + '</p>' +
        '<div class="cadena-pie">' +
        '<span class="chip ' + nivel.clase + '">' + nivel.texto + '</span>' +
        (remision ? '<a class="boton-remision" href="' + esc(remision) + '" target="_blank" rel="noopener noreferrer">Verifica en: ' + esc(c.remitir_nombre || 'la fuente oficial') + '</a>' : '') +
        enlaceFuente(c.fuente_url, c.fuente_nombre || 'consultar fuente') +
        (c.verificado_iso ? '<span>Revisado: ' + esc(c.verificado_iso) + '</span>' : '') +
        '</div></div>';
    }).join('');
    document.getElementById('remision-lista').innerHTML = (verificacion.fuentes_para_verificar || []).map(function (r) {
      var destino = urlSegura(r.url, true);
      return '<a class="tarjeta-remision" href="' + esc(destino) + '"' +
        (destino.indexOf('tel:') === 0 ? '' : ' target="_blank" rel="noopener noreferrer"') + '>' +
        '<strong>' + esc(r.nombre) + '</strong><span>' + esc(r.para || '') + '</span>' +
        '<small>' + esc(String(r.url).replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</small></a>';
    }).join('');
    var principios = verificacion.metodologia && verificacion.metodologia.principios;
    if (principios && principios.length) {
      document.getElementById('consejos-cadenas').innerHTML =
        '<h3>🔍 Cómo verificamos</h3><ol class="lista-consejos lista-metodologia">' +
        principios.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    }
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
  var zonasDatos = null;

  function municipiosFiltrados() {
    if (!zonasDatos) return [];
    var q = normalizar(filtrosMapa.busqueda);
    return (zonasDatos.municipios || []).filter(function (m) {
      var coincideTexto = !q || normalizar([m.municipio, m.departamento].join(' ')).indexOf(q) !== -1;
      return filtrosMapa.gravedades[m.gravedad] &&
        (filtrosMapa.departamento === 'todos' || m.departamento === filtrosMapa.departamento) && coincideTexto;
    });
  }

  function renderZonasFiltradas() {
    var municipios = municipiosFiltrados();
    var porDepto = {};
    municipios.forEach(function (m) { (porDepto[m.departamento] = porDepto[m.departamento] || []).push(m); });
    var orden = { critica: 0, alta: 1, media: 2 };
    var deptos = Object.keys(porDepto).sort(function (a, b) {
      var ga = Math.min.apply(null, porDepto[a].map(function (m) { return orden[m.gravedad] != null ? orden[m.gravedad] : 3; }));
      var gb = Math.min.apply(null, porDepto[b].map(function (m) { return orden[m.gravedad] != null ? orden[m.gravedad] : 3; }));
      return ga - gb || porDepto[b].length - porDepto[a].length;
    });
    var cont = document.getElementById('zonas-departamentos');
    if (!municipios.length) {
      cont.innerHTML = '<div class="estado-datos">No hay municipios que coincidan con los filtros del mapa.</div>';
      return;
    }
    cont.innerHTML = deptos.map(function (d) {
      var ms = porDepto[d].slice().sort(function (a, b) {
        var ga = orden[a.gravedad] != null ? orden[a.gravedad] : 3;
        var gb = orden[b.gravedad] != null ? orden[b.gravedad] : 3;
        return ga - gb || a.municipio.localeCompare(b.municipio, 'es');
      });
      return '<div class="grupo-depto"><h3>' + esc(d) + '<small>' + ms.length + ' municipio' + (ms.length === 1 ? '' : 's') + ' con reporte</small></h3>' +
        '<div class="tarjetas-municipios">' + ms.map(function (m) {
          return '<article class="tarjeta-municipio">' +
            '<div class="muni-cabecera"><h4>' + esc(m.municipio) + '</h4>' +
            '<span class="chip chip-gravedad-' + esc(m.gravedad || 'media') + '">' + esc(NOMBRES_GRAVEDAD[m.gravedad] || m.gravedad || '') + '</span></div>' +
            '<p>' + esc(m.afectacion || '') + '</p>' +
            (m.fuentes && m.fuentes.length ? '<div class="muni-fuente">' + m.fuentes.map(function (f) { return enlaceFuente(f.url, f.titulo || 'fuente'); }).join(' · ') + '</div>' : '') +
            (m.lat && m.lon ? '<button class="ver-mapa" type="button" data-lat="' + m.lat + '" data-lon="' + m.lon + '">Ver en el mapa 📍</button>' : '') +
            '</article>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function pintarZonas(zonas) {
    if (!zonas) { pintarError('zonas-departamentos', 'Consulta los reportes situacionales oficiales.'); return; }
    zonasDatos = zonas;
    if (zonas.intro) document.getElementById('zonas-intro').textContent = zonas.intro;
    renderZonasFiltradas();
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

    document.getElementById('zonas-departamentos').addEventListener('click', function (e) {
      var v = e.target.closest('.ver-mapa');
      if (!v || !mapa) return;
      var lat = +v.dataset.lat, lon = +v.dataset.lon;
      document.getElementById('mapa-seccion').scrollIntoView();
      mapa.flyTo({ center: [lon, lat], zoom: 9.3, essential: true });
      var m = (datosMapa.zonas && datosMapa.zonas.municipios || []).filter(function (x) { return x.lat === lat && x.lon === lon; })[0];
      if (m) new maplibregl.Popup({ offset: 6 }).setLngLat([lon, lat]).setHTML(popupMunicipio(m)).addTo(mapa);
    });
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
  var mapa = null, mapaListo = false, mapaEventosConectados = false, epicentroAnadido = false;
  var datosMapa = { municipios: null, zonas: null, ayuda: null, sismo: null, geo: null };

  function cambiarEstadoMapa(texto, tipo) {
    var el = document.getElementById('mapa-estado');
    if (!el) return;
    el.textContent = texto || '';
    el.className = 'mapa-estado' + (tipo ? ' mapa-estado-' + tipo : '');
    el.hidden = !texto;
  }

  function iniciarMapa() {
    if (typeof maplibregl === 'undefined') {
      cambiarEstadoMapa('El mapa visual no está disponible. Usa la lista de resultados que aparece debajo.', 'error');
      renderResultadosMapa();
      return;
    }
    try {
      mapa = new maplibregl.Map({
        container: 'mapa',
        style: { version: 8, sources: {}, layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#DCE7ED' } }] },
        center: [-76.2, 4.9], zoom: 6.8, cooperativeGestures: true,
        attributionControl: { compact: true }
      });
      mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      conectarClicsMapa();
      mapa.on('style.load', function () {
        mapaListo = true;
        reconstruirCapasPropias();
        anadirMarcadores();
      });
      mapa.once('load', function () {
        encuadrarMapa();
        fetch('https://tiles.openfreemap.org/styles/positron')
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(function (estilo) { mapa.setStyle(estilo, { diff: false }); })
          .catch(function () { cambiarEstadoMapa('Mapa base simplificado. Los datos verificados siguen visibles.', 'aviso'); });
      });
      mapa.on('error', function () {
        if (!mapaListo) cambiarEstadoMapa('No se pudo iniciar el mapa visual. Usa la lista accesible debajo.', 'error');
      });
    } catch (e) {
      mapa = null;
      cambiarEstadoMapa('No se pudo iniciar el mapa visual. Usa la lista accesible debajo.', 'error');
      renderResultadosMapa();
    }
  }

  function reconstruirCapasPropias() {
    if (!mapa) return;
    var completas = construirCapas();
    aplicarFiltrosMapa(false);
    if (completas) {
      cambiarEstadoMapa('', '');
      return;
    }
    // Algunos estilos externos emiten style.load antes de terminar sprites y
    // fuentes. Reintentar en idle evita dejar el mapa base sin nuestros datos.
    mapa.once('idle', function () {
      if (construirCapas()) {
        aplicarFiltrosMapa(false);
        cambiarEstadoMapa('', '');
      } else {
        cambiarEstadoMapa('No pudimos dibujar las capas del mapa. Usa la lista de resultados que aparece debajo.', 'error');
      }
    });
  }

  function construirCapas() {
    if (!mapa) return false;
    try {
      if (datosMapa.municipios && datosMapa.zonas && !mapa.getSource('municipios')) {
        mapa.addSource('municipios', { type: 'geojson', data: datosMapa.municipios });
        var codigos = datosMapa._codigos || {}; // { mpio: gravedad }
        var claves = Object.keys(codigos);
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
      // Puntos de acopio y sangre geocodificados
      if (datosMapa._fcAcopios && !mapa.getSource('acopios')) {
        mapa.addSource('acopios', { type: 'geojson', data: datosMapa._fcAcopios });
        mapa.addLayer({
          id: 'capa-acopios', type: 'circle', source: 'acopios',
          paint: { 'circle-color': COLOR_ACOPIO, 'circle-radius': 6.5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }
        });
      }
      if (datosMapa._fcSangre && !mapa.getSource('sangre')) {
        mapa.addSource('sangre', { type: 'geojson', data: datosMapa._fcSangre });
        mapa.addLayer({
          id: 'capa-sangre', type: 'circle', source: 'sangre',
          paint: { 'circle-color': COLOR_SANGRE, 'circle-radius': 6.5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }
        });
      }
      return (!datosMapa.municipios || !!mapa.getLayer('afectados-relleno')) &&
        (!datosMapa._fcAcopios || !!mapa.getLayer('capa-acopios')) &&
        (!datosMapa._fcSangre || !!mapa.getLayer('capa-sangre'));
    } catch (e) {
      console.warn('[mapa]', e.message);
      return false;
    }
  }

  /* ---------- Filtros de capas del mapa ---------- */
  function pintarFiltrosMapa() {
    var cont = document.getElementById('mapa-filtros');
    if (!cont || !datosMapa._fcAcopios) return;
    var deptos = [];
    ((datosMapa.zonas && datosMapa.zonas.municipios) || []).forEach(function (m) { if (deptos.indexOf(m.departamento) === -1) deptos.push(m.departamento); });
    deptos.sort(function (a, b) { return a.localeCompare(b, 'es'); });
    function chip(tipo, clave, color, texto, activo, conteo) {
      return '<button type="button" class="chip-capa' + (activo ? ' activa' : '') + '" data-tipo="' + tipo + '" data-clave="' + clave + '" aria-pressed="' + activo + '">' +
        '<span class="punto-capa" style="background:' + color + '"></span>' + texto + '<span class="conteo">(' + conteo + ')</span></button>';
    }
    var municipiosFiltro = (datosMapa.zonas && datosMapa.zonas.municipios) || [];
    var puntosFiltro = datosMapa._puntos || [];
    cont.innerHTML = '<fieldset class="grupo-filtros"><legend>Afectación</legend>' +
      chip('gravedad', 'critica', COLORES_GRAVEDAD.critica, 'Crítica', filtrosMapa.gravedades.critica, municipiosFiltro.filter(function (m) { return m.gravedad === 'critica'; }).length) +
      chip('gravedad', 'alta', COLORES_GRAVEDAD.alta, 'Alta', filtrosMapa.gravedades.alta, municipiosFiltro.filter(function (m) { return m.gravedad === 'alta'; }).length) +
      chip('gravedad', 'media', COLORES_GRAVEDAD.media, 'Media', filtrosMapa.gravedades.media, municipiosFiltro.filter(function (m) { return m.gravedad === 'media'; }).length) + '</fieldset>' +
      '<fieldset class="grupo-filtros"><legend>Puntos de ayuda</legend>' +
      chip('punto', 'acopio', COLOR_ACOPIO, 'Acopios', filtrosMapa.puntos.acopio, puntosFiltro.filter(function (p) { return p.tipo === 'acopio'; }).length) +
      chip('punto', 'sangre', COLOR_SANGRE, 'Sangre', filtrosMapa.puntos.sangre, puntosFiltro.filter(function (p) { return p.tipo === 'sangre'; }).length) + '</fieldset>' +
      '<label class="control-filtro"><span>Departamento afectado</span><select id="filtro-departamento"><option value="todos">Todos</option>' +
      deptos.map(function (d) { return '<option value="' + esc(d) + '"' + (filtrosMapa.departamento === d ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select></label>' +
      '<label class="control-filtro control-busqueda"><span>Buscar municipio o punto</span><input id="filtro-busqueda-mapa" type="search" value="' + esc(filtrosMapa.busqueda) + '" placeholder="Ej. Quibdó o banco de sangre"></label>' +
      '<button class="boton-limpiar" id="limpiar-filtros-mapa" type="button">Restablecer</button>';
    if (!cont.dataset.conectado) {
      cont.dataset.conectado = 'true';
      cont.addEventListener('click', function (e) {
        var b = e.target.closest('.chip-capa');
        if (!b) return;
        var grupo = b.dataset.tipo === 'gravedad' ? filtrosMapa.gravedades : filtrosMapa.puntos;
        grupo[b.dataset.clave] = !grupo[b.dataset.clave];
        b.classList.toggle('activa', grupo[b.dataset.clave]);
        b.setAttribute('aria-pressed', String(grupo[b.dataset.clave]));
        aplicarFiltrosMapa(true);
      });
    }
    document.getElementById('filtro-departamento').addEventListener('change', function (e) { filtrosMapa.departamento = e.target.value; aplicarFiltrosMapa(true); });
    document.getElementById('filtro-busqueda-mapa').addEventListener('input', function (e) { filtrosMapa.busqueda = e.target.value; aplicarFiltrosMapa(true); });
    document.getElementById('limpiar-filtros-mapa').addEventListener('click', function () {
      filtrosMapa = { gravedades: { critica: true, alta: true, media: true }, puntos: { acopio: true, sangre: true }, departamento: 'todos', busqueda: '' };
      pintarFiltrosMapa(); aplicarFiltrosMapa(true);
    });
    var resultados = document.getElementById('mapa-resultados');
    if (!resultados.dataset.conectado) {
      resultados.dataset.conectado = 'true';
      resultados.addEventListener('click', function (e) {
        var b = e.target.closest('[data-enfocar]');
        if (!b || !mapa) return;
        mapa.flyTo({ center: [+b.dataset.lon, +b.dataset.lat], zoom: 10, essential: true });
        document.getElementById('mapa-seccion').scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  // Erratas conocidas del geojson (p. ej. «Itsmina»): alias explícito nombre|depto → código DANE
  var ALIAS_MPIO = { 'istmina|choco': '27361' };

  function prepararDatosMapa() {
    var indice = {}; // nombre normalizado + depto normalizado → mpio
    var porNombre = {}; // nombre normalizado → [mpio]
    ((datosMapa.municipios && datosMapa.municipios.features) || []).forEach(function (f) {
      var p = f.properties;
      indice[normalizar(p.nombre) + '|' + normalizar(p.depto)] = p.mpio;
      (porNombre[normalizar(p.nombre)] = porNombre[normalizar(p.nombre)] || []).push(p.mpio);
    });
    var codigos = {};
    (datosMapa.zonas.municipios || []).forEach(function (m) {
      var clave = normalizar(m.municipio) + '|' + normalizar(m.departamento);
      var codigo = ALIAS_MPIO[clave] || indice[clave];
      if (!codigo) {
        var candidatos = porNombre[normalizar(m.municipio)];
        if (candidatos && candidatos.length === 1) codigo = candidatos[0];
      }
      if (codigo) codigos[codigo] = m.gravedad || 'media';
      if (codigo) m._mpio = codigo;
    });
    datosMapa._codigos = codigos;
    datosMapa._porCodigo = {};
    (datosMapa.zonas.municipios || []).forEach(function (m) { if (m._mpio) datosMapa._porCodigo[m._mpio] = m; });

    // Solo se muestran puntos con coordenada concreta; los demás permanecen en la lista textual.
    var geo = ((datosMapa.geo && datosMapa.geo.puntos) || []).filter(function (p) {
      return Number.isFinite(+p.lat) && Number.isFinite(+p.lon) && (p.tipo === 'acopio' || p.tipo === 'sangre');
    });
    function fuentePunto(p) {
      var lista = p.tipo === 'acopio' ? ((datosMapa.ayuda && datosMapa.ayuda.acopios) || []) : ((datosMapa.ayuda && datosMapa.ayuda.sangre) || []);
      var coincidencia = lista.filter(function (x) { return x.ciudad === p.ciudad; })[0];
      return coincidencia && coincidencia.fuente_url || '';
    }
    function aFC(lista) {
      return { type: 'FeatureCollection', features: lista.map(function (p, i) {
        var copia = Object.assign({}, p, { _id: p.tipo + '-' + i, fuente_url: fuentePunto(p) });
        return { type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: copia };
      }) };
    }
    datosMapa._puntos = geo;
    datosMapa._fcAcopios = aFC(geo.filter(function (p) { return p.tipo === 'acopio'; }));
    datosMapa._fcSangre = aFC(geo.filter(function (p) { return p.tipo === 'sangre'; }));
  }

  function puntosFiltrados() {
    var q = normalizar(filtrosMapa.busqueda);
    return (datosMapa._puntos || []).filter(function (p) {
      return filtrosMapa.puntos[p.tipo] && (!q || normalizar([p.nombre, p.ciudad, p.direccion].join(' ')).indexOf(q) !== -1);
    });
  }

  function aplicarFiltrosMapa(encuadrar) {
    var municipios = municipiosFiltrados();
    var puntos = puntosFiltrados();
    var codigos = municipios.map(function (m) { return m._mpio; }).filter(Boolean);
    if (mapa && mapaListo) {
      ['afectados-relleno', 'afectados-borde'].forEach(function (id) {
        if (mapa.getLayer(id)) mapa.setFilter(id, ['in', ['get', 'mpio'], ['literal', codigos]]);
      });
      ['acopio', 'sangre'].forEach(function (tipo) {
        var visibles = puntos.filter(function (p) { return p.tipo === tipo; });
        var todosTipo = (datosMapa._puntos || []).filter(function (p) { return p.tipo === tipo; });
        var ids = visibles.map(function (p) { return tipo + '-' + todosTipo.indexOf(p); });
        var capa = tipo === 'acopio' ? 'capa-acopios' : 'capa-sangre';
        if (mapa.getLayer(capa)) mapa.setFilter(capa, ['in', ['get', '_id'], ['literal', ids]]);
      });
      if (encuadrar) encuadrarMapa(municipios, puntos);
    }
    renderResultadosMapa(municipios, puntos);
    renderZonasFiltradas();
  }

  function renderResultadosMapa(municipios, puntos) {
    municipios = municipios || municipiosFiltrados(); puntos = puntos || puntosFiltrados();
    var total = municipios.length + puntos.length;
    var cont = document.getElementById('mapa-resultados');
    if (!cont) return;
    var items = municipios.map(function (m) {
      return '<li><span class="resultado-tipo resultado-' + esc(m.gravedad) + '">Afectación ' + esc(NOMBRES_GRAVEDAD[m.gravedad]) + '</span>' +
        '<strong>' + esc(m.municipio) + ', ' + esc(m.departamento) + '</strong>' +
        '<button type="button" data-enfocar data-lat="' + m.lat + '" data-lon="' + m.lon + '">Ubicar</button></li>';
    }).concat(puntos.map(function (p) {
      return '<li><span class="resultado-tipo resultado-' + esc(p.tipo) + '">' + (p.tipo === 'acopio' ? 'Punto de acopio' : 'Donación de sangre') + '</span>' +
        '<strong>' + esc(p.nombre) + '</strong><small>' + esc(p.ciudad) + (p.direccion ? ' · ' + esc(p.direccion) : '') + '</small>' +
        '<button type="button" data-enfocar data-lat="' + p.lat + '" data-lon="' + p.lon + '">Ubicar</button></li>';
    }));
    cont.innerHTML = '<details' + (!mapaListo || !total ? ' open' : '') + '><summary><strong>' + total + ' resultado' + (total === 1 ? '' : 's') + '</strong> · ' +
      municipios.length + ' municipio' + (municipios.length === 1 ? '' : 's') + ' y ' + puntos.length + ' punto' + (puntos.length === 1 ? '' : 's') + ' de ayuda</summary>' +
      (items.length ? '<ul class="lista-resultados-mapa">' + items.join('') + '</ul>' : '<div class="estado-datos">No hay resultados. Ajusta o restablece los filtros.</div>') + '</details>';
  }

  function anadirMarcadores() {
    if (!mapa || epicentroAnadido) return;
    var sismo = datosMapa.sismo;
    if (sismo && sismo.epicentro && sismo.epicentro.lat) {
      var el = document.createElement('button');
      el.type = 'button'; el.className = 'marcador-epicentro'; el.setAttribute('aria-label', 'Epicentro del sismo');
      new maplibregl.Marker({ element: el })
        .setLngLat([sismo.epicentro.lon, sismo.epicentro.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(
          '<h4>Epicentro</h4><p>' + esc(sismo.epicentro.municipio || '') + ', ' + esc(sismo.epicentro.departamento || '') +
          '</p><p>Magnitud ' + esc(sismo.magnitud) + ' · Profundidad ' + esc(sismo.profundidad_km) + ' km</p>'))
        .addTo(mapa);
      epicentroAnadido = true;
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
    if (!mapa || mapaEventosConectados) return;
    mapaEventosConectados = true;
    function capasVivas(lista) {
      return lista.filter(function (id) { return mapa.getLayer(id); });
    }
    mapa.on('click', function (e) {
      var ids = capasVivas(['capa-acopios', 'capa-sangre', 'afectados-relleno']);
      if (!ids.length) return;
      var fts = mapa.queryRenderedFeatures(e.point, { layers: ids });
      if (!fts.length) return;
      var f = fts[0], p = f.properties || {}, html = null;
      if (f.layer.id === 'capa-acopios') {
        html = '<h4>📦 ' + esc(p.nombre) + '</h4>' +
          '<p>' + esc(p.ciudad) + (p.direccion && p.direccion !== 'null' ? ' — ' + esc(p.direccion) : '') + '</p>' +
          '<p style="font-size:.72rem;color:#52606D">Ubicación aproximada: confirma dirección y horario antes de salir. ' + enlaceFuente(p.fuente_url, 'ver fuente') + '</p>';
      } else if (f.layer.id === 'capa-sangre') {
        html = '<h4>🩸 ' + esc(p.nombre) + '</h4>' +
          '<p>' + esc(p.ciudad) + (p.direccion && p.direccion !== 'null' ? ' — ' + esc(p.direccion) : '') + '</p>' +
          '<p style="font-size:.72rem;color:#52606D">Confirma horario y requisitos antes de salir. ' + enlaceFuente(p.fuente_url, 'ver fuente') + '</p>';
      } else {
        var m = datosMapa._porCodigo[p.mpio];
        if (m) html = popupMunicipio(m);
      }
      if (html) new maplibregl.Popup({ offset: 6 }).setLngLat(e.lngLat).setHTML(html).addTo(mapa);
    });
    mapa.on('mousemove', function (e) {
      var ids = capasVivas(['capa-acopios', 'capa-sangre', 'afectados-relleno']);
      if (!ids.length) return;
      mapa.getCanvas().style.cursor = mapa.queryRenderedFeatures(e.point, { layers: ids }).length ? 'pointer' : '';
    });
  }

  function encuadrarMapa(municipios, puntosAyuda) {
    if (!mapa) return;
    municipios = municipios || municipiosFiltrados(); puntosAyuda = puntosAyuda || puntosFiltrados();
    var puntos = [];
    municipios.forEach(function (m) { if (m.lat && m.lon) puntos.push([m.lon, m.lat]); });
    puntosAyuda.forEach(function (p) { puntos.push([p.lon, p.lat]); });
    if (!puntos.length) return;
    if (puntos.length === 1) { mapa.flyTo({ center: puntos[0], zoom: 9.5, essential: true }); return; }
    var limites = puntos.reduce(function (b, p) { return b.extend(p); }, new maplibregl.LngLatBounds(puntos[0], puntos[0]));
    mapa.fitBounds(limites, { padding: 60, maxZoom: 9, duration: 350 });
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
    fetchJSON('data/municipios.geojson'),
    fetchJSON('data/geo_puntos.json'),
    fetchJSON('data/verificacion.json')
  ]).then(function (r) {
    var meta = r[0], sismo = r[1], balance = r[2], zonas = r[3], ayuda = r[4],
        pedagogia = r[5], benchmarks = r[6], fuentes = r[7], municipios = r[8],
        geo = r[9], verificacion = r[10];

    pintarMeta(meta);
    pintarSismo(sismo);
    pintarBalance(balance);
    pintarLineas(ayuda);
    pintarCanales(ayuda);
    if (ayuda && ayuda.acopios) { acopiosDatos = ayuda.acopios; pintarSelectorCiudades(); }
    pintarSangre(ayuda);
    pintarBusqueda(ayuda);
    pintarPedagogia(pedagogia);
    pintarCadenas(verificacion);
    pintarZonas(zonas);
    pintarBenchmarks(benchmarks);
    pintarFuentes(fuentes);

    if (zonas || geo) {
      datosMapa.municipios = municipios || null;
      datosMapa.zonas = zonas || { municipios: [] };
      datosMapa.ayuda = ayuda;
      datosMapa.sismo = sismo;
      datosMapa.geo = geo;
      prepararDatosMapa();
      pintarFiltrosMapa();
      aplicarFiltrosMapa(false);
      iniciarMapa();
    } else {
      cambiarEstadoMapa('No se pudieron cargar los datos geográficos. Usa las listas de información.', 'error');
      renderResultadosMapa();
    }
    // Gancho de solo lectura para la función opcional «Cerca de mí».
    window.__cuidar = { obtenerMapa: function () { return mapa; }, datos: datosMapa };
  });
})();
