/* ============ Cuidar a Colombia — app.js ============ */
/* Los datos viven en /data/*.json; este archivo solo los pinta.
   El proceso de actualización diaria reescribe los JSON, no este código. */

(function () {
  'use strict';

  var COLORES_GRAVEDAD = { critica: '#7A1815', alta: '#D25B33', media: '#F2B279' };
  var NOMBRES_GRAVEDAD = { critica: 'Crítica', alta: 'Alta', media: 'Media' };
  var COLOR_ACOPIO = '#1D5A8A', COLOR_SANGRE = '#C62828';
  var filtrosMapa = {
    modo: 'ayuda',
    gravedades: { critica: true, alta: true, media: true },
    puntos: { acopio: true, sangre: true },
    departamento: 'todos', ciudad: 'todas', operacion: 'todas', busqueda: ''
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

  function fetchJSON(ruta, politicaCache) {
    return fetch(ruta, { cache: politicaCache || 'default', credentials: 'omit', referrerPolicy: 'no-referrer' }).then(function (r) {
      if (!r.ok) throw new Error(ruta + ' → ' + r.status);
      return r.json();
    }).catch(function (e) { console.warn('[cuidar]', e.message); return null; });
  }

  function enlaceExterno(url, texto, clase, etiqueta) {
    var segura = urlSegura(url, false);
    if (!segura) return '';
    var visible = texto || 'Abrir enlace';
    return '<a class="enlace-externo' + (clase ? ' ' + esc(clase) : '') + '" href="' + esc(segura) +
      '" target="_blank" rel="noopener noreferrer">' + esc(visible) + ' <span aria-hidden="true">↗</span>' +
      '<span class="solo-lectores aviso-pestana-nueva"> — ' + esc(etiqueta || visible) + '. Se abre en una pestaña nueva.</span></a>';
  }

  function enlaceFuente(url, titulo) {
    return enlaceExterno(url, titulo || 'fuente', 'enlace-fuente');
  }

  var citasCompartidas = {};
  function citasDeRegistro(registro, alcancePrincipal) {
    registro = registro || {};
    var citas = [];
    function agregar(cita) {
      var segura = urlSegura(cita && cita.url, false);
      if (!segura || citas.some(function (actual) { return actual.url === segura; })) return;
      citas.push({
        url: segura,
        titulo: cita.titulo || 'Fuente consultada',
        alcance: cita.alcance || 'Evidencia complementaria',
        nivel: cita.nivel_fuente || ''
      });
    }
    agregar({
      url: registro.fuente_url,
      titulo: registro.fuente_titulo || 'Fuente principal',
      alcance: registro.fuente_alcance || alcancePrincipal || 'Anuncio o evidencia principal',
      nivel_fuente: registro.nivel_fuente
    });
    agregar({
      url: registro.fuente_adicional_url,
      titulo: registro.fuente_adicional_titulo || 'Corroboración adicional',
      alcance: registro.fuente_adicional_alcance || 'Corrobora parte de los datos publicados',
      nivel_fuente: registro.fuente_adicional_nivel || ''
    });
    (registro.fuentes_adicionales || []).forEach(agregar);
    (citasCompartidas[registro.entidad] || []).forEach(agregar);
    return citas;
  }

  function renderCitas(citas, contexto) {
    if (!citas || !citas.length) return '';
    return '<details class="citas-registro"><summary>' + citas.length + ' cita' + (citas.length === 1 ? '' : 's') +
      ' para comprobar este dato</summary><ol>' + citas.map(function (cita, i) {
        var tipo = cita.nivel === 'fuente_oficial' ? '<span class="cita-tipo">Fuente oficial</span>' : '';
        return '<li><span class="cita-numero">' + (i + 1) + '</span><div><span class="cita-alcance">' + esc(cita.alcance) +
          '</span>' + enlaceExterno(cita.url, cita.titulo, 'enlace-cita', 'Consultar cita de ' + (contexto || 'este registro')) + tipo + '</div></li>';
      }).join('') + '</ol></details>';
  }

  function renderCitasRegistro(registro, alcancePrincipal) {
    return renderCitas(citasDeRegistro(registro, alcancePrincipal), registro && (registro.entidad || registro.mecanismo));
  }

  function renderCitasCanal(canal) {
    var citas = [];
    function agregar(url, titulo, alcance, nivel) {
      var segura = urlSegura(url, false);
      if (!segura || citas.some(function (actual) { return actual.url === segura; })) return;
      citas.push({ url: segura, titulo: titulo, alcance: alcance, nivel: nivel });
    }
    agregar(canal.url_oficial, canal.entidad + ' — canal publicado', 'Destino enlazado para realizar o consultar la donación', canal.verificacion && canal.verificacion.nivel);
    agregar(canal.verificacion && canal.verificacion.evidencia_url, canal.verificado_en || 'Evidencia consultada',
      'Evidencia usada para comprobar la campaña y su relación con esta emergencia', canal.verificacion && canal.verificacion.nivel);
    (canal.fuentes_adicionales || []).forEach(function (cita) {
      agregar(cita.url, cita.titulo || 'Fuente adicional', cita.alcance || 'Corrobora parte de los datos publicados', cita.nivel_fuente || '');
    });
    return renderCitas(citas, canal.entidad);
  }

  function enlaceMapaDireccion(punto, ciudad) {
    if (!punto || !punto.direccion) return '';
    var direccionRuta = punto.direccion_mapa || punto.direccion;
    var consulta = [punto.nombre, direccionRuta, ciudad, 'Colombia'].filter(Boolean).join(', ');
    var url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(consulta);
    return enlaceExterno(url, 'Cómo llegar', 'enlace-maps', 'Cómo llegar a ' + (punto.nombre || 'este punto') + ' con Google Maps');
  }

  function enlaceRuta(lat, lon, nombre, clase) {
    if (!Number.isFinite(+lat) || !Number.isFinite(+lon)) return '';
    var url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(String(lat) + ',' + String(lon));
    return enlaceExterno(url, 'Cómo llegar', clase || 'enlace-maps', 'Cómo llegar a ' + (nombre || 'este punto'));
  }

  function telefonoEnTexto(texto) {
    var coincidencia = String(texto || '').match(/(?:contacto|tel[eé]fono|llama(?:r)?(?: antes)?(?: al)?|whatsapp)\s*:?\s*(?:\+?57\s*)?((?:\(?\d{3}\)?[\s.-]*)?\d{3}[\s.-]*\d{4})/i);
    if (!coincidencia) return null;
    var numero = coincidencia[1].replace(/\D/g, '');
    if (numero.length !== 7 && numero.length !== 10) return null;
    return { numero: numero, visible: coincidencia[1].replace(/\s+/g, ' ').trim() };
  }

  function enlaceLlamarDesdeTexto(texto, nombre, clase) {
    var telefono = telefonoEnTexto(texto);
    if (!telefono) return '';
    var url = urlSegura('tel:' + telefono.numero, true);
    if (!url) return '';
    return '<a class="enlace-externo' + (clase ? ' ' + esc(clase) : '') + '" href="' + esc(url) +
      '" aria-label="Llamar a ' + esc(nombre || 'este punto') + ' al ' + esc(telefono.visible) + '">Llamar</a>';
  }

  function duracionMapa() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500;
  }

  function reforzarEnlacesExternos(raiz) {
    var enlaces = raiz && raiz.matches && raiz.matches('a[target="_blank"]') ? [raiz] :
      ((raiz && raiz.querySelectorAll) ? raiz.querySelectorAll('a[target="_blank"]') : []);
    Array.prototype.forEach.call(enlaces, function (a) {
      var rel = new Set(String(a.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener'); rel.add('noreferrer'); a.setAttribute('rel', Array.from(rel).join(' '));
      var contexto = String(a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      if (!a.querySelector('.aviso-pestana-nueva')) {
        var aviso = document.createElement('span');
        aviso.className = 'solo-lectores aviso-pestana-nueva';
        aviso.textContent = (contexto ? ' — ' + contexto.replace(/\.?\s*\(se abre en una pestaña nueva\)$/i, '') + '.' : '') +
          ' Se abre en una pestaña nueva.';
        a.appendChild(aviso);
      }
      // El texto real del enlace + el aviso oculto producen un nombre accesible
      // consistente con la etiqueta visible, incluso en tarjetas de varias líneas.
      if (a.classList.contains('fab-whatsapp')) {
        a.setAttribute('aria-label', (contexto || 'Compartir por WhatsApp')
          .replace(/\.?\s*\(se abre en una pestaña nueva\)$/i, '') + ' (se abre en una pestaña nueva)');
      } else a.removeAttribute('aria-label');
    });
  }

  reforzarEnlacesExternos(document);
  if ('MutationObserver' in window) {
    new MutationObserver(function (cambios) {
      cambios.forEach(function (cambio) { Array.prototype.forEach.call(cambio.addedNodes || [], reforzarEnlacesExternos); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  function normalizar(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function enlaceReporte(nombre, seccion) {
    return '<button class="enlace-reporte abrir-sugerencias" type="button" data-tipo="dato" data-registro="' +
      esc(nombre) + '" data-seccion="' + esc(seccion) + '" aria-label="Reportar dato desactualizado de ' + esc(nombre) + '">' +
      '⚠ Reportar dato desactualizado</button>';
  }

  function estadoVigencia(iso) {
    var fecha = new Date(String(iso || '') + 'T12:00:00-05:00');
    if (isNaN(fecha.getTime())) return { clase: 'vigencia-sin-fecha', titulo: 'Fecha de revisión no disponible' };
    var horas = Math.max(0, (Date.now() - fecha.getTime()) / 36e5);
    if (horas < 24) return { clase: 'vigencia-reciente', titulo: 'Revisado hace menos de 24 horas' };
    if (horas <= 72) return { clase: 'vigencia-atencion', titulo: 'Revisado hace entre 24 y 72 horas' };
    return { clase: 'vigencia-vencida', titulo: 'Revisado hace más de 72 horas: confirma antes de actuar' };
  }

  function selloFecha(iso, texto) {
    var estado = estadoVigencia(iso);
    return '<time class="vigencia-dato ' + estado.clase + '" datetime="' + esc(iso || '') + '" title="' +
      esc(estado.titulo) + '">' + esc(texto || iso || 'Sin fecha') + '</time>';
  }

  function isoDesdeFechaCorta(texto) {
    var meses = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };
    var partes = String(texto || '').toLowerCase().match(/^(\d{1,2})\s+([a-záéíóú]{3})\s+(\d{4})$/);
    if (!partes || !meses[partes[2]]) return '';
    return partes[3] + '-' + meses[partes[2]] + '-' + String(partes[1]).padStart(2, '0');
  }

  function renderDatosCopiables(texto) {
    var original = String(texto || '');
    var regex = /@[a-zA-Z0-9._-]{4,}|\d[\d .-]{6,}\d/g;
    var salida = '', ultimo = 0, coincidencia;
    while ((coincidencia = regex.exec(original))) {
      var esLlave = coincidencia[0].charAt(0) === '@';
      var digitos = coincidencia[0].replace(/\D/g, '');
      if (!esLlave && digitos.length < 8) continue;
      var copiable = esLlave ? coincidencia[0] : coincidencia[0].replace(/[ .]/g, '');
      salida += esc(original.slice(ultimo, coincidencia.index)) + '<span class="dato-copiable"><span>' +
        esc(coincidencia[0]) + '</span><button type="button" class="boton-copiar" data-copiar="' +
        esc(copiable) + '" aria-label="Copiar ' + esc(coincidencia[0]) + '">Copiar</button></span>';
      ultimo = coincidencia.index + coincidencia[0].length;
    }
    return salida + esc(original.slice(ultimo));
  }

  function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto);
    return new Promise(function (resolver, rechazar) {
      var campo = document.createElement('textarea');
      campo.value = texto; campo.setAttribute('readonly', ''); campo.style.position = 'fixed'; campo.style.opacity = '0';
      document.body.appendChild(campo); campo.select();
      try { document.execCommand('copy') ? resolver() : rechazar(new Error('No se pudo copiar')); }
      catch (e) { rechazar(e); }
      campo.remove();
    });
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
    var fechaActualizacion = document.getElementById('fecha-actualizacion');
    var pieActualizacion = document.getElementById('pie-actualizacion');
    if (fechaActualizacion.textContent !== f) fechaActualizacion.textContent = f;
    if (pieActualizacion.textContent !== 'Última actualización: ' + f) pieActualizacion.textContent = 'Última actualización: ' + f;
    var aviso = document.getElementById('aviso-vigencia');
    var fecha = new Date(meta.iso);
    if (!aviso || isNaN(fecha.getTime())) return;
    var horas = Math.max(0, (Date.now() - fecha.getTime()) / 36e5);
    var limite = Number(meta.vigencia_horas) || 24;
    var clase, contenido;
    if (horas > limite) {
      clase = 'aviso-vigencia aviso-vigencia-alerta';
      contenido = '<strong>Revisión pendiente</strong><span>Confirma en la fuente antes de actuar</span>';
    } else {
      clase = 'aviso-vigencia aviso-vigencia-ok';
      contenido = '<strong>Información vigente</strong>' +
        (meta.proxima_revision ? '<span>Próxima: ' + esc(meta.proxima_revision) + '</span>' : '');
    }
    if (aviso.className !== clase) aviso.className = clase;
    if (aviso.innerHTML !== contenido) aviso.innerHTML = contenido;
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
      var esWhatsapp = /whatsapp/i.test(l.nombre || '');
      var numeroLimpio = String(l.numero || '').replace(/\D/g, '');
      var hrefNumero = esWhatsapp ? 'https://wa.me/' + numeroLimpio : 'tel:' + String(l.numero || '').replace(/[^0-9+#*]/g, '');
      var num = l.numero ? '<a href="' + esc(hrefNumero) + '"' +
        (esWhatsapp ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(l.numero) + '</a>' : '';
      if (!num && l.url) num = '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">ver canal</a>';
      return '<span>' + esc(l.nombre) + ' ' + num + '</span>';
    }).join('');
  }

  /* ---------- Filtros globales de ayuda ---------- */
  var CIUDAD_DEPARTAMENTO = {
    'bogota': 'Bogotá D.C.', 'medellin': 'Antioquia', 'cali': 'Valle del Cauca', 'pereira': 'Risaralda',
    'manizales': 'Caldas', 'armenia': 'Quindío', 'quibdo': 'Chocó', 'barranquilla': 'Atlántico',
    'bucaramanga': 'Santander', 'cartagena': 'Bolívar', 'ibague': 'Tolima', 'santa marta': 'Magdalena',
    'monteria': 'Córdoba', 'villavicencio': 'Meta', 'buenaventura': 'Valle del Cauca',
    'cota': 'Cundinamarca', 'tunja': 'Boyacá', 'itagui': 'Antioquia', 'envigado': 'Antioquia', 'la estrella': 'Antioquia',
    'pasto': 'Nariño', 'chia': 'Cundinamarca', 'caqueza': 'Cundinamarca', 'sincelejo': 'Sucre',
    'acacias': 'Meta', 'florencia': 'Caquetá', 'popayan': 'Cauca', 'valledupar': 'Cesar',
    'riohacha': 'La Guajira', 'neiva': 'Huila', 'cucuta': 'Norte de Santander', 'floridablanca': 'Santander',
    'rionegro': 'Antioquia'
  };
  var filtrosAyuda = { tipo: 'todos', ubicacion: 'todas', busqueda: '', soloOficial: false };
  var conteosAyuda = { dinero: 0, especie: 0, sangre: 0, personas: 0 };

  function departamentoCiudad(ciudad) { return CIUDAD_DEPARTAMENTO[normalizar(ciudad)] || ''; }

  function coincideUbicacion(ciudad, cobertura) {
    if (filtrosAyuda.ubicacion === 'todas') return true;
    if (normalizar(cobertura) === 'nacional') return true;
    var partes = filtrosAyuda.ubicacion.split(':');
    var valor = partes.slice(1).join(':');
    if (partes[0] === 'ciudad') return normalizar(ciudad) === valor || normalizar(cobertura) === valor;
    return normalizar(departamentoCiudad(ciudad)) === valor || normalizar(cobertura) === valor;
  }

  function coincideBusqueda(campos) {
    var q = normalizar(filtrosAyuda.busqueda);
    return !q || normalizar(campos.join(' ')).indexOf(q) !== -1;
  }

  function actualizarConteoAyuda() {
    var total = 0;
    Object.keys(conteosAyuda).forEach(function (k) {
      if (filtrosAyuda.tipo === 'todos' || filtrosAyuda.tipo === k) total += conteosAyuda[k] || 0;
    });
    var el = document.getElementById('conteo-ayuda');
    if (el) el.textContent = total + ' opci' + (total === 1 ? 'ón' : 'ones') + ' para esta búsqueda';
    var activos = (filtrosAyuda.tipo !== 'todos' ? 1 : 0) + (filtrosAyuda.ubicacion !== 'todas' ? 1 : 0) +
      (filtrosAyuda.busqueda.trim() ? 1 : 0) + (filtrosAyuda.soloOficial ? 1 : 0);
    var alternar = document.getElementById('alternar-filtros-ayuda');
    if (alternar) {
      alternar.textContent = (document.getElementById('filtros-ayuda-global').classList.contains('abiertos') ? 'Ocultar filtros' : 'Mostrar filtros') +
        (activos ? ' (' + activos + ')' : '');
      alternar.classList.toggle('con-filtros', activos > 0);
    }
  }

  function aplicarFiltrosAyuda() {
    [['donar-dinero', 'dinero'], ['acopios', 'especie'], ['sangre', 'sangre'], ['buscar', 'personas']].forEach(function (par) {
      var bloque = document.getElementById(par[0]);
      if (bloque) bloque.hidden = filtrosAyuda.tipo !== 'todos' && filtrosAyuda.tipo !== par[1];
    });
    pintarTarjetasCanales();
    pintarAcopiosCiudad(ciudadAcopioActiva);
    pintarTarjetasSangre();
    pintarTarjetasBusqueda();
    actualizarConteoAyuda();
  }

  function inicializarFiltrosAyuda(ayuda) {
    var selUbicacion = document.getElementById('filtro-ayuda-ubicacion');
    if (!selUbicacion || selUbicacion.dataset.preparado) return;
    selUbicacion.dataset.preparado = 'true';
    var ciudades = [], departamentos = [];
    ((ayuda && ayuda.acopios) || []).concat((ayuda && ayuda.sangre) || []).forEach(function (x) {
      if (x.ciudad && ciudades.indexOf(x.ciudad) === -1) ciudades.push(x.ciudad);
      var depto = departamentoCiudad(x.ciudad);
      if (depto && departamentos.indexOf(depto) === -1) departamentos.push(depto);
    });
    ciudades.sort(function (a, b) { return a.localeCompare(b, 'es'); });
    departamentos.sort(function (a, b) { return a.localeCompare(b, 'es'); });
    selUbicacion.innerHTML = '<option value="todas">Todas las ubicaciones</option><optgroup label="Departamentos">' +
      departamentos.map(function (d) { return '<option value="departamento:' + esc(normalizar(d)) + '">' + esc(d) + '</option>'; }).join('') +
      '</optgroup><optgroup label="Ciudades">' + ciudades.map(function (c) {
        return '<option value="ciudad:' + esc(normalizar(c)) + '">' + esc(c) + '</option>';
      }).join('') + '</optgroup>';
    var alternar = document.getElementById('alternar-filtros-ayuda');
    var panelFiltros = document.getElementById('filtros-ayuda-global');
    if (alternar && panelFiltros) alternar.addEventListener('click', function () {
      var abierto = !panelFiltros.classList.contains('abiertos');
      panelFiltros.classList.toggle('abiertos', abierto);
      alternar.setAttribute('aria-expanded', String(abierto));
      actualizarConteoAyuda();
    });
    document.getElementById('filtro-ayuda-tipo').addEventListener('change', function (e) { filtrosAyuda.tipo = e.target.value; aplicarFiltrosAyuda(); });
    selUbicacion.addEventListener('change', function (e) { filtrosAyuda.ubicacion = e.target.value; aplicarFiltrosAyuda(); });
    document.getElementById('filtro-ayuda-busqueda').addEventListener('input', function (e) { filtrosAyuda.busqueda = e.target.value; aplicarFiltrosAyuda(); });
    document.getElementById('filtro-ayuda-oficial').addEventListener('change', function (e) { filtrosAyuda.soloOficial = e.target.checked; aplicarFiltrosAyuda(); });
    document.getElementById('limpiar-filtros-ayuda').addEventListener('click', function () {
      filtrosAyuda = { tipo: 'todos', ubicacion: 'todas', busqueda: '', soloOficial: false };
      filtrosCanales = { cobertura: 'todas', evidencia: 'todas' };
      ciudadAcopioActiva = 'todas';
      document.getElementById('filtro-ayuda-tipo').value = 'todos'; selUbicacion.value = 'todas';
      document.getElementById('filtro-ayuda-busqueda').value = ''; document.getElementById('filtro-ayuda-oficial').checked = false;
      if (document.getElementById('filtro-cobertura')) document.getElementById('filtro-cobertura').value = 'todas';
      if (document.getElementById('filtro-evidencia')) document.getElementById('filtro-evidencia').value = 'todas';
      document.querySelectorAll('#selector-ciudades .pastilla-ciudad').forEach(function (b) { b.classList.toggle('activa', b.dataset.ciudad === 'todas'); });
      aplicarFiltrosAyuda();
    });
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
      filtrosCanales.cobertura = e.target.value; aplicarFiltrosAyuda();
    });
    document.getElementById('filtro-evidencia').addEventListener('change', function (e) {
      filtrosCanales.evidencia = e.target.value; aplicarFiltrosAyuda();
    });
    pintarTarjetasCanales();
    var tarjetas = document.getElementById('canales-financieros');
    if (!tarjetas.dataset.copiarConectado) {
      tarjetas.dataset.copiarConectado = 'true';
      tarjetas.addEventListener('click', function (e) {
        var boton = e.target.closest('.boton-copiar');
        if (!boton) return;
        var textoOriginal = boton.textContent;
        copiarTexto(boton.dataset.copiar || '').then(function () {
          boton.textContent = '✓ Copiado'; boton.classList.add('copiado');
          setTimeout(function () { boton.textContent = textoOriginal; boton.classList.remove('copiado'); }, 1800);
        }).catch(function () {
          boton.textContent = 'No se pudo copiar';
          setTimeout(function () { boton.textContent = textoOriginal; }, 2200);
        });
      });
    }
  }

  function pintarTarjetasCanales() {
    var lista = canalesTodos.filter(function (c) {
      return (filtrosCanales.cobertura === 'todas' || c.cobertura === filtrosCanales.cobertura) &&
        (filtrosCanales.evidencia === 'todas' || nivelCanal(c) === filtrosCanales.evidencia) &&
        (!filtrosAyuda.soloOficial || nivelCanal(c) === 'fuente_oficial') &&
        coincideUbicacion('', c.cobertura) &&
        coincideBusqueda([c.entidad, c.cobertura, c.como_donar, c.campana, c.detalle_cuenta, c.destino]);
    });
    conteosAyuda.dinero = lista.length;
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
      var canalOficial = urlSegura(c.url_oficial, false);
      var evidencia = c.verificacion && urlSegura(c.verificacion.evidencia_url, false);
      var destino = oficial ? canalOficial : (evidencia || canalOficial);
      var isoRevision = c.verificacion && c.verificacion.fecha_iso;
      return '<article class="tarjeta-canal" data-ayuda-tipo="dinero" data-evidencia="' + esc(nivelCanal(c)) +
        '" data-ubicacion="' + esc(normalizar(c.cobertura)) + '">' +
        '<div class="canal-cabecera"><h4>' + esc(c.entidad) + '</h4>' + chip + '</div>' +
        (c.cobertura ? '<span class="chip chip-ambito">' + esc(c.cobertura) + '</span>' : '') +
        '<div class="canal-detalle">' + esc(c.como_donar || c.campana || '') + '</div>' +
        (c.detalle_cuenta ? '<div class="canal-cuenta">' + renderDatosCopiables(c.detalle_cuenta) + '</div>' : '') +
        '<div class="canal-pie">' +
        (destino ? '<a class="boton boton-secundario" href="' + esc(destino) + '" target="_blank" rel="noopener noreferrer" aria-label="' +
          (oficial ? 'Abrir canal oficial de ' : 'Ver evidencia y confirmar ') + esc(c.entidad) + ' (se abre en una pestaña nueva)">' +
          (oficial ? 'Abrir canal oficial' : 'Ver evidencia y confirmar') + ' <span aria-hidden="true">↗</span></a>' : '') +
        '<span class="canal-meta">Comprobado en ' + esc(c.verificado_en || '') + '<br>' + selloFecha(isoRevision, c.fecha_verificacion) +
        (evidencia && evidencia !== destino ? ' · <a href="' + esc(evidencia) + '" target="_blank" rel="noopener noreferrer">ver evidencia</a>' : '') + '</span>' +
        '</div>' + renderCitasCanal(c) + '<div class="tarjeta-acciones-secundarias">' + enlaceReporte(c.entidad, 'Donar dinero') + '</div></article>';
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
  var acopiosDatos = [], ciudadAcopioActiva = 'todas';
  function nivelRegistroAyuda(registro) {
    if (registro && registro.nivel_fuente === 'fuente_oficial') return 'fuente_oficial';
    try { if (/\.gov\.co$/i.test(new URL(registro.fuente_url).hostname)) return 'fuente_oficial'; } catch (e) { /* URL validada al publicar */ }
    return 'fuente_secundaria';
  }
  function esInstitucionalConFuenteOficial(registro) {
    return nivelRegistroAyuda(registro) === 'fuente_oficial' && registro.tipo_canal !== 'complementario';
  }
  function pintarSelectorCiudades() {
    var sel = document.getElementById('selector-ciudades');
    var ciudades = [];
    acopiosDatos.forEach(function (a) { if (ciudades.indexOf(a.ciudad) === -1) ciudades.push(a.ciudad); });
    sel.innerHTML = '<button type="button" class="pastilla-ciudad activa" data-ciudad="todas">Todas</button>' + ciudades.map(function (c) {
      return '<button type="button" class="pastilla-ciudad" data-ciudad="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
    sel.addEventListener('click', function (e) {
      var b = e.target.closest('.pastilla-ciudad');
      if (!b) return;
      sel.querySelectorAll('.pastilla-ciudad').forEach(function (x) { x.classList.remove('activa'); });
      b.classList.add('activa');
      ciudadAcopioActiva = b.dataset.ciudad;
      pintarAcopiosCiudad(ciudadAcopioActiva);
      actualizarConteoAyuda();
    });
    pintarAcopiosCiudad('todas');
  }

  function pintarAcopiosCiudad(ciudad) {
    ciudad = ciudad || 'todas';
    var lista = acopiosDatos.filter(function (a) {
      return (ciudad === 'todas' || a.ciudad === ciudad) && coincideUbicacion(a.ciudad, '') &&
        (!filtrosAyuda.soloOficial || nivelRegistroAyuda(a) === 'fuente_oficial') &&
        coincideBusqueda([a.ciudad, departamentoCiudad(a.ciudad), a.entidad, a.que_donar, a.que_no_donar].concat((a.puntos || []).map(function (p) { return [p.nombre, p.direccion, p.horario].join(' '); })));
    });
    conteosAyuda.especie = lista.length;
    document.getElementById('acopios-detalle').innerHTML = lista.map(function (a) {
      var puntos = (a.puntos || []).map(function (p) {
        var accionesPunto = enlaceMapaDireccion(p, a.ciudad) + enlaceLlamarDesdeTexto(p.horario, p.nombre, 'enlace-llamar');
        return '<li><div class="punto-contenido"><strong>' + esc(p.nombre) + '</strong>' +
          (p.direccion ? '<span class="punto-direccion">' + esc(p.direccion) + '</span>' : '') +
          (p.horario ? '<small>' + esc(p.horario) + '</small>' : '') + '</div>' +
          (accionesPunto ? '<div class="acciones-punto">' + accionesPunto + '</div>' : '') + '</li>';
      }).join('');
      var si = (a.que_donar || []).map(function (q) { return '<span class="etiqueta-si">' + esc(q) + '</span>'; }).join('');
      var no = (a.que_no_donar || []).map(function (q) { return '<span class="etiqueta-no">' + esc(q) + '</span>'; }).join('');
      var fuenteOficial = nivelRegistroAyuda(a) === 'fuente_oficial';
      var chipFuente = fuenteOficial
        ? '<span class="chip chip-verificado">✓ Fuente oficial</span>'
        : '<span class="chip chip-verificado-prensa">◉ Confirmación secundaria</span>';
      return '<article class="tarjeta-acopio" data-ayuda-tipo="especie" data-ciudad="' + esc(normalizar(a.ciudad)) +
        '" data-departamento="' + esc(normalizar(departamentoCiudad(a.ciudad))) + '">' +
        '<div class="canal-cabecera"><h4>' + esc(a.ciudad) + '</h4>' + chipFuente + '</div>' +
        '<div class="acopio-entidad">Habilitado por: ' + esc(a.entidad) + '</div>' +
        (puntos ? '<ul class="lista-puntos">' + puntos + '</ul>' : '') +
        (si ? '<div><strong style="font-size:.82rem">Qué llevar:</strong><div class="etiquetas-donar">' + si + '</div></div>' : '') +
        (no ? '<div style="margin-top:10px"><strong style="font-size:.82rem">Qué no llevar:</strong><div class="etiquetas-donar">' + no + '</div></div>' : '') +
        (a.fuente_url ? '<div class="acopio-fuente"><span>Evidencia: ' + esc(a.fuente_titulo || 'fuente consultada') + '</span>' +
          (a.fecha ? selloFecha(isoDesdeFechaCorta(a.fecha), a.fecha) : '') + '</div>' +
          '<div class="acciones-enlaces">' + enlaceExterno(a.fuente_url, 'Ver evidencia principal', 'enlace-accion', 'Ver fuente: ' + (a.fuente_titulo || a.entidad)) + '</div>' : '') +
        renderCitasRegistro(a, 'Anuncio de campaña, vigencia o punto de recepción') +
        '<div class="tarjeta-acciones-secundarias">' + enlaceReporte(a.entidad + ' — ' + a.ciudad, 'Puntos de acopio') + '</div>' +
        '</article>';
    }).join('') || '<div class="estado-datos">No hay puntos de acopio que coincidan con estos filtros.</div>';
  }

  /* ---------- Sangre ---------- */
  var sangreDatos = [];
  function pintarSangre(ayuda) {
    if (!ayuda || !ayuda.sangre) return;
    sangreDatos = ayuda.sangre;
    pintarTarjetasSangre();
    if (ayuda.sangre_requisitos && ayuda.sangre_requisitos.length) {
      document.getElementById('sangre-requisitos').innerHTML =
        '<h5>Requisitos generales para donar</h5><ul>' +
        ayuda.sangre_requisitos.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';
    }
  }

  function pintarTarjetasSangre() {
    var lista = sangreDatos.filter(function (s) {
      return coincideUbicacion(s.ciudad, '') &&
        (!filtrosAyuda.soloOficial || esInstitucionalConFuenteOficial(s)) &&
        coincideBusqueda([s.ciudad, departamentoCiudad(s.ciudad), s.entidad, s.donde, s.tipos_urgentes]);
    });
    conteosAyuda.sangre = lista.length;
    document.getElementById('sangre-lista').innerHTML = lista.map(function (s) {
      return '<article class="tarjeta-simple" data-ayuda-tipo="sangre" data-ciudad="' + esc(normalizar(s.ciudad)) +
        '" data-departamento="' + esc(normalizar(departamentoCiudad(s.ciudad))) + '">' +
        '<div class="canal-cabecera"><h4>' + esc(s.ciudad) + '</h4>' +
        (nivelRegistroAyuda(s) === 'fuente_oficial'
          ? '<span class="chip chip-verificado">✓ Fuente oficial</span>'
          : '<span class="chip chip-verificado-prensa">◉ Confirmación secundaria</span>') + '</div>' +
        '<div class="simple-sub">' + esc(s.entidad) + '</div>' +
        '<p>' + esc(s.donde || '') + '</p>' +
        (s.tipos_urgentes && s.tipos_urgentes.length ? '<p style="margin-top:8px"><strong>Se necesita con urgencia:</strong> ' + esc(s.tipos_urgentes.join(', ')) + '</p>' : '') +
        (s.fuente_url ? '<div class="acciones-enlaces">' + enlaceExterno(s.fuente_url, 'Ver evidencia principal', 'enlace-accion', 'Ver evidencia de ' + s.entidad + ' en ' + s.ciudad) + '</div>' : '') +
        renderCitasRegistro(s, 'Anuncio de jornada, banco o necesidad de sangre') +
        (s.fecha_revision ? '<div class="simple-pie">Revisado: ' + selloFecha(String(s.fecha_revision_iso || '').slice(0, 10), s.fecha_revision) + '</div>' : '') +
        '<div class="tarjeta-acciones-secundarias">' + enlaceReporte(s.entidad + ' — ' + s.ciudad, 'Donación de sangre') + '</div>' +
        '</article>';
    }).join('') || '<div class="estado-datos">No hay puntos de donación de sangre que coincidan con estos filtros.</div>';
  }

  /* ---------- Búsqueda de personas ---------- */
  var busquedaDatos = [];
  function pintarBusqueda(ayuda) {
    if (!ayuda || !ayuda.busqueda) return;
    busquedaDatos = ayuda.busqueda;
    pintarTarjetasBusqueda();
  }

  function pintarTarjetasBusqueda() {
    var lista = busquedaDatos.filter(function (b) {
      return (!filtrosAyuda.soloOficial || esInstitucionalConFuenteOficial(b)) &&
        coincideBusqueda([b.mecanismo, b.entidad, b.linea, b.como_usar]);
    });
    conteosAyuda.personas = lista.length;
    document.getElementById('busqueda-lista').innerHTML = lista.map(function (b) {
      var institucional = b.tipo_canal === 'institucional';
      var primaria = nivelRegistroAyuda(b) === 'fuente_oficial';
      var etiqueta = institucional
        ? (primaria ? '✓ Canal institucional · fuente oficial' : '◉ Canal institucional · confirmación secundaria')
        : (primaria ? '◉ Canal complementario · publicación directa' : '◉ Canal complementario · confirmación secundaria');
      return '<article class="tarjeta-simple" data-ayuda-tipo="personas">' +
        '<div class="canal-cabecera"><h4>' + esc(b.mecanismo) + '</h4><span class="chip ' +
        (institucional && primaria ? 'chip-verificado' : 'chip-verificado-prensa') + '">' + esc(etiqueta) + '</span></div>' +
        '<div class="simple-sub">' + esc(b.entidad || '') + '</div>' +
        (b.linea ? '<div class="destacado-linea">' + esc(b.linea) + '</div>' : '') +
        '<p>' + esc(b.como_usar || '') + '</p>' +
        (b.url ? '<p style="margin-top:8px">' + enlaceExterno(b.url, 'Abrir canal', 'boton boton-secundario', 'Abrir ' + b.mecanismo) + '</p>' : '') +
        renderCitasRegistro(b, 'Anuncio del mecanismo o línea de atención') +
        (b.fecha_revision ? '<div class="simple-pie">Revisado: ' + selloFecha(String(b.fecha_revision_iso || '').slice(0, 10), b.fecha_revision) + '</div>' : '') +
        '<div class="tarjeta-acciones-secundarias">' + enlaceReporte(b.mecanismo, 'Búsqueda de personas') + '</div>' +
        '</article>';
    }).join('') || '<div class="estado-datos">No hay mecanismos de búsqueda que coincidan con estos filtros.</div>';
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
            '<div class="tarjeta-acciones-secundarias">' + enlaceReporte(m.municipio + ', ' + m.departamento, 'Zonas afectadas') + '</div>' +
            '</article>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function pintarZonas(zonas) {
    if (!zonas) { pintarError('zonas-departamentos', 'Consulta los reportes situacionales oficiales.'); return; }
    zonasDatos = zonas;
    if (zonas.intro) document.getElementById('zonas-intro').textContent = zonas.intro +
      (zonas.fecha_revision ? ' Revisión del capítulo: ' + zonas.fecha_revision + '.' : '');
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
      mapa.flyTo({ center: [lon, lat], zoom: 9.3, duration: duracionMapa(), essential: false });
      var m = (datosMapa.zonas && datosMapa.zonas.municipios || []).filter(function (x) { return x.lat === lat && x.lon === lon; })[0];
      if (m) new maplibregl.Popup({ offset: 6 }).setLngLat([lon, lat]).setHTML(popupMunicipio(m)).addTo(mapa);
    });
  }

  /* ---------- Benchmarks ---------- */
  function pintarBenchmarks(bm) {
    if (!bm || !bm.items) return;
    function tarjeta(b) {
      return '<div class="tarjeta-mundo">' +
        '<div class="mundo-cabecera"><h3>' + esc(b.nombre) + '</h3>' +
        '<span class="mundo-contexto">' + esc(b.pais_desastre || '') + (b.ano ? ' · ' + esc(b.ano) : '') + '</span></div>' +
        (b.categoria ? '<span class="mundo-categoria">' + esc(b.categoria) + '</span>' : '') +
        '<p>' + esc(b.que_hacia) + '</p>' +
        '<div class="mundo-leccion"><strong>La lección</strong>' + esc(b.leccion) + '</div>' +
        (b.url ? '<a href="' + esc(b.url) + '" target="_blank" rel="noopener">' +
          (b.estado === 'activa' ? 'Visitar →' : b.estado === 'cautela' ? 'Examinar con cautela →' : 'Ver registro →') + '</a>' : '') +
        '</div>';
    }
    function grupo(titulo, descripcion, items, abierto) {
      if (!items.length) return '';
      return '<details class="grupo-referentes"' + (abierto ? ' open' : '') + '>' +
        '<summary><span><strong>' + esc(titulo) + '</strong><small>' + esc(descripcion) + '</small></span>' +
        '<b>' + items.length + '</b></summary>' +
        '<div class="tarjetas-mundo">' + items.map(tarjeta).join('') + '</div></details>';
    }
    var colombia = bm.items.filter(function (b) { return b.ambito === 'colombia'; });
    var internacionales = bm.items.filter(function (b) { return b.ambito !== 'colombia'; });
    document.getElementById('benchmarks-lista').innerHTML =
      grupo('Iniciativas en Colombia', 'Sistemas oficiales, humanitarios y ciudadanos comparables', colombia, true) +
      grupo('Referentes internacionales', 'Experiencias que complementan el aprendizaje local', internacionales, false);
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
  var mapa = null, mapaListo = false, mapaEventosConectados = false, marcadorEpicentro = null, marcadoresAyuda = [];
  var puntoMapaActivoId = '', popupPuntoActivo = null, fichaPuntoConectada = false;
  var datosMapa = { municipios: null, zonas: null, ayuda: null, sismo: null, geo: null, meta: null, resumen: null };
  var cargaMapaIniciada = false;

  function cambiarEstadoMapa(texto, tipo) {
    var el = document.getElementById('mapa-estado');
    if (!el) return;
    el.textContent = texto || '';
    el.className = 'mapa-estado' + (tipo ? ' mapa-estado-' + tipo : '');
    el.hidden = !texto;
  }

  function cargarMapLibre() {
    if (typeof maplibregl !== 'undefined') return Promise.resolve();
    if (!document.querySelector('link[data-maplibre]')) {
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.dataset.maplibre = 'true';
      css.href = 'assets/vendor/maplibre-gl.css?v=4.7.1';
      document.head.appendChild(css);
    }
    return new Promise(function (resolver, rechazar) {
      var script = document.createElement('script');
      script.src = 'assets/vendor/maplibre-gl.js?v=4.7.1'; script.async = true;
      script.onload = function () { typeof maplibregl !== 'undefined' ? resolver() : rechazar(new Error('MapLibre no disponible')); };
      script.onerror = function () { script.remove(); rechazar(new Error('No se pudo cargar MapLibre local')); };
      document.head.appendChild(script);
    });
  }

  function cargarMapaDiferido() {
    if (cargaMapaIniciada) return;
    cargaMapaIniciada = true;
    cambiarEstadoMapa('Cargando mapa y datos geográficos…', '');
    Promise.all([fetchJSON('data/mapa.json?v=20260813g'), cargarMapLibre()])
      .then(function (r) {
        datosMapa.municipios = r[0] && r[0].municipios; datosMapa.geo = r[0] && r[0].geo;
        if (!datosMapa.municipios || !datosMapa.geo) throw new Error('Datos geográficos incompletos');
        prepararDatosMapa(); pintarFiltrosMapa(); aplicarFiltrosMapa(false); iniciarMapa();
        window.dispatchEvent(new CustomEvent('cuidar:mapa-datos-listos'));
      }).catch(function () {
        cambiarEstadoMapa('No se pudo cargar el mapa visual. La información y los canales de ayuda siguen disponibles en las listas.', 'error');
        renderResultadosMapa();
      });
  }

  function observarMapa() {
    var seccion = document.getElementById('mapa-seccion');
    if (!seccion || !('IntersectionObserver' in window)) { cargarMapaDiferido(); return; }
    var observador = new IntersectionObserver(function (entradas) {
      if (!entradas.some(function (e) { return e.isIntersecting; })) return;
      observador.disconnect(); cargarMapaDiferido();
    }, { rootMargin: '500px 0px' });
    observador.observe(seccion);
  }

  function iniciarMapa() {
    if (typeof maplibregl === 'undefined') {
      cambiarEstadoMapa('El mapa visual no está disponible. Usa la lista de resultados que aparece debajo.', 'error');
      renderResultadosMapa();
      return;
    }
    var controlador = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var temporizador = controlador ? setTimeout(function () { controlador.abort(); }, 4500) : null;
    var opcionesEstilo = { credentials: 'omit', referrerPolicy: 'no-referrer' };
    if (controlador) opcionesEstilo.signal = controlador.signal;
    fetch('https://tiles.openfreemap.org/styles/positron', opcionesEstilo)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (estilo) { if (temporizador) clearTimeout(temporizador); crearMapa(estilo, false); })
      .catch(function () {
        if (temporizador) clearTimeout(temporizador);
        crearMapa({ version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', sources: {}, layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#DCE7ED' } }] }, true);
      });
  }

  function crearMapa(estilo, simplificado) {
    try {
      mapa = new maplibregl.Map({
        container: 'mapa',
        style: estilo,
        center: [-76.2, 4.9], zoom: 6.8, cooperativeGestures: true,
        attributionControl: { compact: true },
        transformRequest: function (url) { return { url: url, referrerPolicy: 'no-referrer', cache: 'default' }; }
      });
      mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      conectarClicsMapa();
      mapa.once('load', function () {
        mapaListo = true;
        reconstruirCapasPropias(simplificado ? 'Mapa base simplificado. Los puntos publicados siguen visibles.' : '');
        actualizarEpicentro();
        encuadrarMapa();
      });
      mapa.on('zoomend', function () {
        if (!mapaListo) return;
        renderizarMarcadoresAyuda(filtrosMapa.modo === 'ayuda' ? puntosFiltrados() : []);
      });
      mapa.on('error', function (evento) {
        var nodoMapa = document.getElementById('mapa');
        if (nodoMapa) nodoMapa.dataset.ultimoError = (evento && evento.error && evento.error.message) || 'error de carga del mapa';
        if (!mapaListo) cambiarEstadoMapa('No se pudo iniciar el mapa visual. Usa la lista accesible debajo.', 'error');
      });
    } catch (e) {
      mapa = null;
      cambiarEstadoMapa('No se pudo iniciar el mapa visual. Usa la lista accesible debajo.', 'error');
      renderResultadosMapa();
    }
  }

  function reconstruirCapasPropias(avisoExito) {
    if (!mapa) return;
    var completas = construirCapas();
    aplicarFiltrosMapa(false);
    if (completas) {
      cambiarEstadoMapa(avisoExito || '', avisoExito ? 'aviso' : '');
      registrarDiagnosticoMapa();
      return;
    }
    // Algunos estilos externos emiten style.load antes de terminar sprites y
    // fuentes. Reintentar en idle evita dejar el mapa base sin nuestros datos.
    mapa.once('idle', function () {
      if (construirCapas()) {
        aplicarFiltrosMapa(false);
        cambiarEstadoMapa(avisoExito || '', avisoExito ? 'aviso' : '');
        registrarDiagnosticoMapa();
      } else {
        cambiarEstadoMapa('No pudimos dibujar las capas del mapa. Usa la lista de resultados que aparece debajo.', 'error');
      }
    });
  }

  function registrarDiagnosticoMapa() {
    var nodo = document.getElementById('mapa');
    if (!nodo || !mapa) return;
    nodo.dataset.capasAyuda = ['afectados-relleno', 'afectados-borde'].filter(function (id) { return mapa.getLayer(id); }).join(',');
    nodo.dataset.puntosEsperados = String((datosMapa._puntos || []).length);
    nodo.dataset.marcadoresAyuda = String(marcadoresAyuda.length);
  }

  function construirCapas() {
    if (!mapa) return false;
    try {
      if (datosMapa.municipios && datosMapa.zonas && !mapa.getSource('municipios')) {
        mapa.addSource('municipios', { type: 'geojson', data: datosMapa.municipios });
      }
      if (datosMapa.municipios && datosMapa.zonas && mapa.getSource('municipios')) {
        var codigos = datosMapa._codigos || {}; // { mpio: gravedad }
        var claves = Object.keys(codigos);
        var expresion = ['match', ['get', 'mpio']];
        claves.forEach(function (k) { expresion.push(k, COLORES_GRAVEDAD[codigos[k]] || '#F2B279'); });
        expresion.push('rgba(0,0,0,0)');
        if (!mapa.getLayer('afectados-relleno')) {
          mapa.addLayer({
            id: 'afectados-relleno', type: 'fill', source: 'municipios',
            filter: ['in', ['get', 'mpio'], ['literal', claves]],
            paint: { 'fill-color': expresion, 'fill-opacity': 0.78 }
          });
        }
        if (!mapa.getLayer('afectados-borde')) {
          mapa.addLayer({
            id: 'afectados-borde', type: 'line', source: 'municipios',
            filter: ['in', ['get', 'mpio'], ['literal', claves]],
            paint: { 'line-color': '#5A3A26', 'line-width': 0.8, 'line-opacity': 0.6 }
          });
        }
      }
      return !datosMapa.municipios || !!mapa.getLayer('afectados-relleno');
    } catch (e) {
      console.warn('[mapa]', e.message);
      return false;
    }
  }

  /* ---------- Filtros de capas del mapa ---------- */
  function pintarFiltrosMapa() {
    var cont = document.getElementById('mapa-filtros');
    if (!cont || !datosMapa._fcAcopios) return;
    var deptos = [], ciudades = [];
    ((datosMapa.zonas && datosMapa.zonas.municipios) || []).forEach(function (m) { if (deptos.indexOf(m.departamento) === -1) deptos.push(m.departamento); });
    (datosMapa._puntos || []).forEach(function (p) { if (p.ciudad && ciudades.indexOf(p.ciudad) === -1) ciudades.push(p.ciudad); });
    deptos.sort(function (a, b) { return a.localeCompare(b, 'es'); });
    ciudades.sort(function (a, b) { return a.localeCompare(b, 'es'); });
    function chip(tipo, clave, color, texto, activo, conteo) {
      return '<button type="button" class="chip-capa' + (activo ? ' activa' : '') + '" data-tipo="' + tipo + '" data-clave="' + clave + '" aria-pressed="' + activo + '">' +
        '<span class="punto-capa" style="background:' + color + '"></span>' + texto + '<span class="conteo">(' + conteo + ')</span></button>';
    }
    var municipiosFiltro = (datosMapa.zonas && datosMapa.zonas.municipios) || [];
    var puntosFiltro = datosMapa._puntos || [];
    var panelAnterior = cont.querySelector('.panel-filtros-mapa');
    var panelAbierto = panelAnterior ? panelAnterior.open : !(window.matchMedia && window.matchMedia('(max-width: 700px)').matches);
    var resumenInicial = filtrosMapa.modo === 'ayuda'
      ? puntosFiltro.length + ' puntos de ayuda'
      : municipiosFiltro.length + ' municipios con reporte';
    var controlesModo = filtrosMapa.modo === 'ayuda'
      ? '<fieldset class="grupo-filtros"><legend>Tipo de ayuda</legend>' +
        chip('punto', 'acopio', COLOR_ACOPIO, 'Acopios', filtrosMapa.puntos.acopio, puntosFiltro.filter(function (p) { return p.tipo === 'acopio'; }).length) +
        chip('punto', 'sangre', COLOR_SANGRE, 'Sangre', filtrosMapa.puntos.sangre, puntosFiltro.filter(function (p) { return p.tipo === 'sangre'; }).length) + '</fieldset>' +
        '<label class="control-filtro"><span>Ciudad</span><select id="filtro-ciudad-mapa"><option value="todas">Todas</option>' +
        ciudades.map(function (c) { return '<option value="' + esc(c) + '"' + (filtrosMapa.ciudad === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
        '<label class="control-filtro"><span>Antes de ir</span><select id="filtro-operacion-mapa"><option value="todas">Todos</option>' +
        '<option value="informacion_publicada"' + (filtrosMapa.operacion === 'informacion_publicada' ? ' selected' : '') + '>Información publicada</option>' +
        '<option value="confirmar"' + (filtrosMapa.operacion === 'confirmar' ? ' selected' : '') + '>Confirmar antes de ir</option></select></label>'
      : '<fieldset class="grupo-filtros"><legend>Nivel de afectación</legend>' +
        chip('gravedad', 'critica', COLORES_GRAVEDAD.critica, 'Crítica', filtrosMapa.gravedades.critica, municipiosFiltro.filter(function (m) { return m.gravedad === 'critica'; }).length) +
        chip('gravedad', 'alta', COLORES_GRAVEDAD.alta, 'Alta', filtrosMapa.gravedades.alta, municipiosFiltro.filter(function (m) { return m.gravedad === 'alta'; }).length) +
        chip('gravedad', 'media', COLORES_GRAVEDAD.media, 'Media', filtrosMapa.gravedades.media, municipiosFiltro.filter(function (m) { return m.gravedad === 'media'; }).length) + '</fieldset>' +
        '<label class="control-filtro"><span>Departamento afectado</span><select id="filtro-departamento"><option value="todos">Todos</option>' +
        deptos.map(function (d) { return '<option value="' + esc(d) + '"' + (filtrosMapa.departamento === d ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select></label>';
    cont.innerHTML = '<div class="selector-modo-mapa" role="group" aria-label="Qué quieres consultar">' +
      chip('modo', 'ayuda', COLOR_ACOPIO, 'Dónde ayudar', filtrosMapa.modo === 'ayuda', puntosFiltro.length) +
      chip('modo', 'impacto', COLORES_GRAVEDAD.critica, 'Impacto reportado', filtrosMapa.modo === 'impacto', municipiosFiltro.length) + '</div>' +
      '<details class="panel-filtros-mapa"' + (panelAbierto ? ' open' : '') + '><summary>Filtrar esta vista <span id="resumen-filtros-mapa">' +
      resumenInicial + '</span></summary><div class="mapa-filtros-contenido">' + controlesModo +
      '<label class="control-filtro control-busqueda"><span>Buscar</span><input id="filtro-busqueda-mapa" type="search" value="' + esc(filtrosMapa.busqueda) + '" placeholder="Ej. Quibdó o banco de sangre"></label>' +
      '<button class="boton-limpiar" id="limpiar-filtros-mapa" type="button">Restablecer</button></div></details>';
    if (!cont.dataset.conectado) {
      cont.dataset.conectado = 'true';
      cont.addEventListener('click', function (e) {
        var b = e.target.closest('.chip-capa');
        if (!b) return;
        if (b.dataset.tipo === 'modo') {
          filtrosMapa.modo = b.dataset.clave;
          cerrarFichaPunto();
          pintarFiltrosMapa(); aplicarFiltrosMapa(true);
          return;
        }
        var grupo = b.dataset.tipo === 'gravedad' ? filtrosMapa.gravedades : filtrosMapa.puntos;
        grupo[b.dataset.clave] = !grupo[b.dataset.clave];
        b.classList.toggle('activa', grupo[b.dataset.clave]);
        b.setAttribute('aria-pressed', String(grupo[b.dataset.clave]));
        aplicarFiltrosMapa(true);
      });
    }
    var filtroDepartamento = document.getElementById('filtro-departamento');
    var filtroCiudad = document.getElementById('filtro-ciudad-mapa');
    var filtroOperacion = document.getElementById('filtro-operacion-mapa');
    if (filtroDepartamento) filtroDepartamento.addEventListener('change', function (e) { filtrosMapa.departamento = e.target.value; aplicarFiltrosMapa(true); });
    if (filtroCiudad) filtroCiudad.addEventListener('change', function (e) { filtrosMapa.ciudad = e.target.value; aplicarFiltrosMapa(true); });
    if (filtroOperacion) filtroOperacion.addEventListener('change', function (e) { filtrosMapa.operacion = e.target.value; aplicarFiltrosMapa(true); });
    document.getElementById('filtro-busqueda-mapa').addEventListener('input', function (e) { filtrosMapa.busqueda = e.target.value; aplicarFiltrosMapa(true); });
    document.getElementById('limpiar-filtros-mapa').addEventListener('click', function () {
      filtrosMapa = { modo: filtrosMapa.modo, gravedades: { critica: true, alta: true, media: true }, puntos: { acopio: true, sangre: true }, departamento: 'todos', ciudad: 'todas', operacion: 'todas', busqueda: '' };
      cerrarFichaPunto();
      pintarFiltrosMapa(); aplicarFiltrosMapa(true);
    });
    var resultados = document.getElementById('mapa-resultados');
    if (!resultados.dataset.conectado) {
      resultados.dataset.conectado = 'true';
      resultados.addEventListener('click', function (e) {
        var b = e.target.closest('[data-enfocar]');
        if (!b || !mapa) return;
        mapa.flyTo({ center: [+b.dataset.lon, +b.dataset.lat], zoom: 11, duration: duracionMapa(), essential: false });
        document.getElementById('mapa-seccion').scrollIntoView({ behavior: duracionMapa() ? 'smooth' : 'auto' });
        var punto = (datosMapa._puntos || []).filter(function (p) { return p._id === b.dataset.id; })[0];
        if (punto) seleccionarPunto(punto);
        var municipio = b.dataset.mpio && datosMapa._porCodigo[b.dataset.mpio];
        if (municipio) new maplibregl.Popup({ offset: 8, maxWidth: '320px' }).setLngLat([+b.dataset.lon, +b.dataset.lat]).setHTML(popupMunicipio(municipio)).addTo(mapa);
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
    function operacionDesdeDetalle(detalle) {
      var texto = normalizar(detalle);
      if (!texto || /(confirmar|consultar|contradictori|llama antes)/.test(texto)) return 'confirmar';
      return 'informacion_publicada';
    }
    function metadatosPunto(p) {
      var lista = p.tipo === 'acopio' ? ((datosMapa.ayuda && datosMapa.ayuda.acopios) || []) : ((datosMapa.ayuda && datosMapa.ayuda.sangre) || []);
      var coincidencia = lista.filter(function (x) {
        if (x.ciudad !== p.ciudad) return false;
        if (p.tipo === 'sangre') return p.registro_entidad && normalizar(x.entidad) === normalizar(p.registro_entidad);
        return (x.puntos || []).some(function (q) { return normalizar(q.nombre) === normalizar(p.nombre); });
      })[0];
      var subpunto = coincidencia && p.tipo === 'acopio' && (coincidencia.puntos || []).filter(function (q) {
        return normalizar(q.nombre) === normalizar(p.nombre);
      })[0];
      var fuenteDatos = subpunto && subpunto.fuente_url ? subpunto : coincidencia;
      var detalle = subpunto && subpunto.horario || (p.tipo === 'sangre' && coincidencia && coincidencia.donde) || '';
      var fechaFuente = fuenteDatos && fuenteDatos.fecha || coincidencia && coincidencia.fecha || '';
      var fechaRevision = fuenteDatos && fuenteDatos.fecha_revision || coincidencia && coincidencia.fecha_revision || '';
      var fechaRevisionIso = fuenteDatos && fuenteDatos.fecha_revision_iso || coincidencia && coincidencia.fecha_revision_iso || '';
      return {
        fuente_url: fuenteDatos && fuenteDatos.fuente_url || '',
        fuente_titulo: fuenteDatos && fuenteDatos.fuente_titulo || '',
        fuente_adicional_url: fuenteDatos && fuenteDatos.fuente_adicional_url || coincidencia && coincidencia.fuente_adicional_url || '',
        nivel_fuente: fuenteDatos ? nivelRegistroAyuda(fuenteDatos) : 'fuente_secundaria',
        fecha: fechaFuente || fechaRevision,
        fecha_iso: fechaFuente ? isoDesdeFechaCorta(fechaFuente) : String(fechaRevisionIso).slice(0, 10),
        etiqueta_fecha: fechaFuente ? 'Fecha de la fuente' : 'Revisado',
        detalle_operativo: detalle,
        operacion: operacionDesdeDetalle(detalle),
        precision_ubicacion: p.coordenadas_fuente ? 'ubicacion_contrastada' : 'direccion_geocodificada'
      };
    }
    datosMapa._puntos = geo.map(function (p, i) {
      return Object.assign({}, p, metadatosPunto(p), {
        _id: p.tipo + '|' + normalizar(p.ciudad) + '|' + normalizar(p.nombre)
      });
    });
    datosMapa._fcPuntos = coleccionPuntos(datosMapa._puntos);
    datosMapa._fcAcopios = coleccionPuntos(datosMapa._puntos.filter(function (p) { return p.tipo === 'acopio'; }));
    datosMapa._fcSangre = coleccionPuntos(datosMapa._puntos.filter(function (p) { return p.tipo === 'sangre'; }));
    var totalAcopios = ((datosMapa.ayuda && datosMapa.ayuda.acopios) || []).reduce(function (n, a) { return n + ((a.puntos || []).length); }, 0);
    var pinesAcopio = datosMapa._puntos.filter(function (p) { return p.tipo === 'acopio'; }).length;
    var notaCobertura = document.getElementById('nota-cobertura-mapa');
    if (notaCobertura) notaCobertura.textContent = pinesAcopio + ' de ' + totalAcopios + ' lugares de acopio tienen ubicación suficientemente precisa para el mapa; los otros ' +
      Math.max(0, totalAcopios - pinesAcopio) + ' siguen en la lista, sin inventar un pin.';
    conectarFichaPunto();
  }

  function coleccionPuntos(lista) {
    return { type: 'FeatureCollection', features: (lista || []).map(function (p) {
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [+p.lon, +p.lat] }, properties: Object.assign({}, p) };
    }) };
  }

  function coleccionPuntosMapa(lista, zoom) {
    lista = lista || [];
    zoom = Number.isFinite(+zoom) ? +zoom : 6;
    if (zoom >= 15.5 || !mapa) {
      return coleccionPuntos(lista.map(function (p) { return Object.assign({}, p, { es_grupo: false }); }));
    }
    var grupos = lista.map(function (p) { return [p]; });
    function centro(grupo) {
      return {
        lat: grupo.reduce(function (s, p) { return s + (+p.lat); }, 0) / grupo.length,
        lon: grupo.reduce(function (s, p) { return s + (+p.lon); }, 0) / grupo.length
      };
    }
    // Agrupa en píxeles de pantalla. Así dos controles de 44 px nunca quedan
    // superpuestos en la vista nacional, aun si pertenecen a ciudades distintas.
    var separacionMinima = 72, unir = true;
    while (unir) {
      unir = false;
      for (var i = 0; i < grupos.length && !unir; i += 1) {
        var a = mapa.project([centro(grupos[i]).lon, centro(grupos[i]).lat]);
        for (var j = i + 1; j < grupos.length; j += 1) {
          var b = mapa.project([centro(grupos[j]).lon, centro(grupos[j]).lat]);
          if (Math.hypot(a.x - b.x, a.y - b.y) < separacionMinima) {
            grupos[i] = grupos[i].concat(grupos[j]); grupos.splice(j, 1); unir = true; break;
          }
        }
      }
    }
    var salida = [];
    grupos.forEach(function (grupo, indice) {
      if (grupo.length === 1) {
        salida.push(Object.assign({}, grupo[0], { es_grupo: false }));
        return;
      }
      var posicion = centro(grupo);
      var ciudades = Array.from(new Set(grupo.map(function (p) { return p.ciudad; })));
      salida.push({
        tipo: 'grupo', es_grupo: true, point_count: grupo.length, lat: posicion.lat, lon: posicion.lon,
        ciudad: ciudades.length === 1 ? ciudades[0] : 'esta zona',
        nombre: grupo.length + ' puntos de ayuda', _id: 'grupo|' + indice
      });
    });
    return coleccionPuntos(salida);
  }

  function renderizarMarcadoresAyuda(lista) {
    if (!mapa) return;
    marcadoresAyuda.forEach(function (marcador) { marcador.remove(); });
    marcadoresAyuda = [];
    var coleccion = coleccionPuntosMapa(lista || [], mapa.getZoom());
    coleccion.features.forEach(function (feature) {
      var p = feature.properties || {}, esGrupo = p.es_grupo === true || p.es_grupo === 'true';
      var el = document.createElement('button');
      var etiquetaMarcador;
      el.type = 'button';
      el.className = 'marcador-ayuda ' + (esGrupo ? 'marcador-grupo-ayuda' : (p.tipo === 'sangre' ? 'marcador-sangre' : 'marcador-acopio'));
      if (esGrupo) {
        el.textContent = p.point_count;
        etiquetaMarcador = p.point_count + ' puntos de ayuda en ' + p.ciudad + '. Activar para acercar.';
        el.addEventListener('click', function (evento) {
          evento.stopPropagation();
          mapa.easeTo({ center: feature.geometry.coordinates, zoom: Math.min(16, Math.max(9, mapa.getZoom() + 2.2)), duration: duracionMapa(), essential: false });
        });
      } else {
        etiquetaMarcador = (p.tipo === 'sangre' ? 'Donación de sangre: ' : 'Punto de acopio: ') + p.nombre;
        el.dataset.puntoId = p._id;
        el.classList.toggle('seleccionado', p._id === puntoMapaActivoId);
        el.addEventListener('click', function (evento) {
          evento.stopPropagation(); seleccionarPunto(p);
        });
      }
      var marcador = new maplibregl.Marker({ element: el }).setLngLat(feature.geometry.coordinates);
      marcador.addTo(mapa);
      el.setAttribute('aria-label', etiquetaMarcador);
      el.title = etiquetaMarcador;
      marcadoresAyuda.push(marcador);
    });
    registrarDiagnosticoMapa();
  }

  function puntosFiltrados() {
    var q = normalizar(filtrosMapa.busqueda);
    return (datosMapa._puntos || []).filter(function (p) {
      return filtrosMapa.puntos[p.tipo] && (filtrosMapa.ciudad === 'todas' || p.ciudad === filtrosMapa.ciudad) &&
        (filtrosMapa.operacion === 'todas' || p.operacion === filtrosMapa.operacion) &&
        (!q || normalizar([p.nombre, p.ciudad, p.direccion, p.detalle_operativo, p.fuente_titulo].join(' ')).indexOf(q) !== -1);
    });
  }

  function aplicarFiltrosMapa(encuadrar) {
    var municipios = filtrosMapa.modo === 'impacto' ? municipiosFiltrados() : [];
    var puntos = filtrosMapa.modo === 'ayuda' ? puntosFiltrados() : [];
    if (puntoMapaActivoId && !puntos.some(function (p) { return p._id === puntoMapaActivoId; })) cerrarFichaPunto();
    var codigos = municipios.map(function (m) { return m._mpio; }).filter(Boolean);
    if (mapa && mapaListo) {
      ['afectados-relleno', 'afectados-borde'].forEach(function (id) {
        if (mapa.getLayer(id)) mapa.setFilter(id, ['in', ['get', 'mpio'], ['literal', codigos]]);
      });
      renderizarMarcadoresAyuda(puntos);
      actualizarEpicentro();
      if (encuadrar) encuadrarMapa(municipios, puntos);
    }
    var envoltura = document.querySelector('.mapa-envoltura');
    if (envoltura) envoltura.dataset.modo = filtrosMapa.modo;
    var resumenFiltros = document.getElementById('resumen-filtros-mapa');
    if (resumenFiltros) resumenFiltros.textContent = filtrosMapa.modo === 'ayuda'
      ? puntos.length + ' punto' + (puntos.length === 1 ? '' : 's') + (filtrosMapa.ciudad !== 'todas' ? ' · ' + filtrosMapa.ciudad : '')
      : municipios.length + ' municipio' + (municipios.length === 1 ? '' : 's') + ' con reporte';
    renderResultadosMapa(municipios, puntos);
    if (filtrosMapa.modo === 'impacto') renderZonasFiltradas();
  }

  function renderResultadosMapa(municipios, puntos) {
    municipios = municipios || (filtrosMapa.modo === 'impacto' ? municipiosFiltrados() : []);
    puntos = puntos || (filtrosMapa.modo === 'ayuda' ? puntosFiltrados() : []);
    var total = municipios.length + puntos.length;
    var cont = document.getElementById('mapa-resultados');
    if (!cont) return;
    var items = municipios.map(function (m) {
      return '<li><span class="resultado-tipo resultado-' + esc(m.gravedad) + '">Afectación ' + esc(NOMBRES_GRAVEDAD[m.gravedad]) + '</span>' +
        '<div class="resultado-info"><strong>' + esc(m.municipio) + ', ' + esc(m.departamento) + '</strong></div>' +
        '<div class="resultado-acciones"><button type="button" data-enfocar data-mpio="' + esc(m._mpio || '') + '" data-lat="' + m.lat + '" data-lon="' + m.lon + '"' +
        (mapaListo ? '' : ' disabled') + '>' + (mapaListo ? 'Ubicar en mapa' : 'Mapa cargando…') + '</button></div></li>';
    }).concat(puntos.map(function (p) {
      var seleccionado = p._id === puntoMapaActivoId;
      return '<li data-resultado-id="' + esc(p._id) + '"' + (seleccionado ? ' class="seleccionado" aria-current="true"' : '') + '><span class="resultado-tipo resultado-' + esc(p.tipo) + '">' + (p.tipo === 'acopio' ? 'Punto de acopio' : 'Donación de sangre') + '</span>' +
        '<div class="resultado-info"><strong>' + esc(p.nombre) + '</strong><small>' + esc(p.ciudad) + (p.direccion ? ' · ' + esc(p.direccion) : '') + '</small></div>' +
        '<div class="resultado-acciones"><button type="button" data-enfocar data-id="' + esc(p._id) + '" data-lat="' + p.lat + '" data-lon="' + p.lon + '"' +
        (mapaListo ? '' : ' disabled') + '>' + (mapaListo ? 'Ubicar en mapa' : 'Mapa cargando…') + '</button>' +
        enlaceRuta(p.lat, p.lon, p.nombre, 'enlace-ruta') + '</div></li>';
    }));
    var detalleResumen = filtrosMapa.modo === 'ayuda'
      ? puntos.length + ' punto' + (puntos.length === 1 ? '' : 's') + ' de ayuda' + (filtrosMapa.ciudad !== 'todas' ? ' en ' + filtrosMapa.ciudad : '')
      : municipios.length + ' municipio' + (municipios.length === 1 ? '' : 's') + ' con afectación reportada';
    var resumen = total + ' resultado' + (total === 1 ? '' : 's') + ': ' + detalleResumen;
    cont.innerHTML = '<span class="solo-lectores" role="status">' + esc(resumen) + '</span><details' + (!mapaListo || !total ? ' open' : '') + '><summary><strong>' + total + ' resultado' + (total === 1 ? '' : 's') + '</strong> · ' +
      esc(detalleResumen) + '</summary>' +
      (items.length ? '<ul class="lista-resultados-mapa">' + items.join('') + '</ul>' : '<div class="estado-datos">No hay resultados. Ajusta o restablece los filtros.</div>') + '</details>';
  }

  function actualizarEpicentro() {
    if (!mapa) return;
    if (filtrosMapa.modo !== 'impacto') {
      if (marcadorEpicentro) marcadorEpicentro.remove();
      marcadorEpicentro = null;
      return;
    }
    if (marcadorEpicentro) return;
    var sismo = datosMapa.sismo;
    if (sismo && sismo.epicentro && sismo.epicentro.lat) {
      var el = document.createElement('button');
      el.type = 'button'; el.className = 'marcador-epicentro'; el.setAttribute('aria-label', 'Epicentro del sismo');
      marcadorEpicentro = new maplibregl.Marker({ element: el })
        .setLngLat([sismo.epicentro.lon, sismo.epicentro.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(
          '<h4>Epicentro</h4><p>' + esc(sismo.epicentro.municipio || '') + ', ' + esc(sismo.epicentro.departamento || '') +
          '</p><p>Magnitud ' + esc(sismo.magnitud) + ' · Profundidad ' + esc(sismo.profundidad_km) + ' km</p>'))
        .addTo(mapa);
    }
  }

  function popupMunicipio(m) {
    var color = COLORES_GRAVEDAD[m.gravedad] || '#8A6420';
    return '<h4>' + esc(m.municipio) + ', ' + esc(m.departamento) + '</h4>' +
      '<span class="pop-gravedad" style="color:' + color + '">Gravedad ' + esc(NOMBRES_GRAVEDAD[m.gravedad] || m.gravedad || '') + '</span>' +
      '<p>' + esc(m.afectacion || '') + '</p>' +
      (m.fuentes && m.fuentes.length ? '<div class="pop-fuente">' + m.fuentes.map(function (f) { return enlaceFuente(f.url, f.titulo || 'fuente'); }).join(' · ') + '</div>' : '');
  }

  function htmlDetallePunto(p, incluirLista) {
    var esSangre = p.tipo === 'sangre';
    var fuenteOficial = p.nivel_fuente === 'fuente_oficial';
    var operacionTexto = p.operacion === 'informacion_publicada' ? 'Información publicada' : 'Confirmar antes de ir';
    var ubicacionTexto = p.precision_ubicacion === 'ubicacion_contrastada' ? 'Pin contrastado' : 'Dirección georreferenciada';
    return '<div class="detalle-punto"><h4 id="mapa-ficha-titulo">' + (esSangre ? '🩸 ' : '📦 ') + esc(p.nombre) + '</h4>' +
      '<p>' + esc(p.ciudad) + (p.direccion && p.direccion !== 'null' ? ' — ' + esc(p.direccion) : '') + '</p>' +
      '<div class="certeza-punto" aria-label="Certeza de la información">' +
      '<span class="certeza certeza-' + (fuenteOficial ? 'oficial' : 'secundaria') + '">' + (fuenteOficial ? '✓ Publicado por responsable' : '◉ Confirmación secundaria') + '</span>' +
      '<span class="certeza certeza-' + (p.operacion === 'informacion_publicada' ? 'operativa' : 'confirmar') + '">' + esc(operacionTexto) + '</span>' +
      '<span class="certeza certeza-ubicacion">' + esc(ubicacionTexto) + '</span></div>' +
      '<div class="pop-acciones">' + enlaceRuta(p.lat, p.lon, p.nombre, 'enlace-accion') +
      enlaceLlamarDesdeTexto(p.detalle_operativo, p.nombre, 'enlace-accion enlace-accion-secundaria') +
      enlaceFuente(p.fuente_url, p.fuente_titulo ? 'Ver ' + p.fuente_titulo : 'Ver evidencia') +
      (p.fuente_adicional_url ? enlaceFuente(p.fuente_adicional_url, 'Corroborar dirección y horarios') : '') +
      (incluirLista ? '<button type="button" class="enlace-lista-punto" data-ver-lista="' + esc(p._id) + '">Ver en la lista</button>' : '') + '</div>' +
      '<dl class="detalle-punto-datos"><div><dt>Antes de ir</dt><dd>' + esc(p.detalle_operativo || 'No hay horario publicado en este registro; confirma directamente con la entidad.') + '</dd></div>' +
      (p.fecha ? '<div><dt>' + esc(p.etiqueta_fecha || 'Revisado') + '</dt><dd>' + selloFecha(p.fecha_iso, p.fecha) + '</dd></div>' : '') +
      (datosMapa.meta && datosMapa.meta.ultima_actualizacion ? '<div><dt>Corte del portal</dt><dd>' + esc(datosMapa.meta.ultima_actualizacion) + '</dd></div>' : '') + '</dl>' +
      '<p class="pop-aviso">La ubicación no prueba que el punto siga recibiendo. Revisa la evidencia y confirma antes de desplazarte.</p>' +
      '<div class="detalle-punto-reporte">' + enlaceReporte(p.nombre + ' — ' + p.ciudad, esSangre ? 'Mapa de sangre' : 'Mapa de acopios') + '</div></div>';
  }

  function esMapaMovil() {
    return window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
  }

  function quitarPopupPunto() {
    var anterior = popupPuntoActivo;
    popupPuntoActivo = null;
    if (anterior) anterior.remove();
  }

  function sincronizarSeleccionPunto() {
    document.querySelectorAll('[data-punto-id]').forEach(function (el) {
      el.classList.toggle('seleccionado', el.dataset.puntoId === puntoMapaActivoId);
    });
    document.querySelectorAll('[data-resultado-id]').forEach(function (el) {
      var activo = el.dataset.resultadoId === puntoMapaActivoId;
      el.classList.toggle('seleccionado', activo);
      if (activo) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
    });
  }

  function cerrarFichaPunto() {
    quitarPopupPunto();
    puntoMapaActivoId = '';
    var ficha = document.getElementById('mapa-ficha-punto');
    var envoltura = document.querySelector('.mapa-envoltura');
    if (ficha) ficha.hidden = true;
    if (envoltura) envoltura.classList.remove('ficha-punto-abierta');
    sincronizarSeleccionPunto();
  }

  function seleccionarPunto(p) {
    if (!mapa || !p) return;
    quitarPopupPunto();
    puntoMapaActivoId = p._id;
    var ficha = document.getElementById('mapa-ficha-punto');
    var contenido = document.getElementById('mapa-ficha-contenido');
    var envoltura = document.querySelector('.mapa-envoltura');
    if (esMapaMovil() && ficha && contenido) {
      contenido.innerHTML = htmlDetallePunto(p, true);
      ficha.hidden = false;
      if (envoltura) envoltura.classList.add('ficha-punto-abierta');
    } else {
      if (ficha) ficha.hidden = true;
      if (envoltura) envoltura.classList.remove('ficha-punto-abierta');
      var popup = new maplibregl.Popup({ offset: 12, maxWidth: '360px' }).setLngLat([+p.lon, +p.lat]).setHTML(htmlDetallePunto(p, true)).addTo(mapa);
      popupPuntoActivo = popup;
      popup.on('close', function () {
        if (popupPuntoActivo !== popup) return;
        popupPuntoActivo = null; puntoMapaActivoId = ''; sincronizarSeleccionPunto();
      });
    }
    sincronizarSeleccionPunto();
  }

  function conectarFichaPunto() {
    if (fichaPuntoConectada) return;
    var ficha = document.getElementById('mapa-ficha-punto');
    var cerrar = document.getElementById('cerrar-ficha-punto');
    if (!ficha || !cerrar) return;
    fichaPuntoConectada = true;
    cerrar.addEventListener('click', cerrarFichaPunto);
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ver-lista]');
      if (!b) return;
      var resultado = document.querySelector('[data-resultado-id="' + CSS.escape(b.dataset.verLista) + '"]');
      var detalles = document.querySelector('#mapa-resultados details');
      if (detalles) detalles.open = true;
      if (resultado) resultado.scrollIntoView({ behavior: duracionMapa() ? 'smooth' : 'auto', block: 'center' });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && puntoMapaActivoId) cerrarFichaPunto(); });
  }

  function conectarClicsMapa() {
    if (!mapa || mapaEventosConectados) return;
    mapaEventosConectados = true;
    function capasVivas(lista) {
      return lista.filter(function (id) { return mapa.getLayer(id); });
    }
    mapa.on('click', function (e) {
      var ids = capasVivas(['afectados-relleno']);
      if (!ids.length) return;
      var fts = mapa.queryRenderedFeatures(e.point, { layers: ids });
      if (!fts.length) return;
      var f = fts[0], p = f.properties || {}, html = null;
      var m = datosMapa._porCodigo[p.mpio];
      if (m) html = popupMunicipio(m);
      if (html) new maplibregl.Popup({ offset: 8, maxWidth: '320px' }).setLngLat(f.geometry.type === 'Point' ? f.geometry.coordinates : e.lngLat).setHTML(html).addTo(mapa);
    });
    mapa.on('mousemove', function (e) {
      var ids = capasVivas(['afectados-relleno']);
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
    if (puntos.length === 1) { mapa.flyTo({ center: puntos[0], zoom: 11, duration: duracionMapa(), essential: false }); return; }
    var limites = puntos.reduce(function (b, p) { return b.extend(p); }, new maplibregl.LngLatBounds(puntos[0], puntos[0]));
    mapa.fitBounds(limites, { padding: 60, maxZoom: 10.5, duration: duracionMapa() });
  }

  /* ============ Arranque ============ */
  fetchJSON('data/app.json?v=20260813h', 'no-cache').then(function (r) {
    r = r || {};
    var meta = r.meta, sismo = r.sismo, balance = r.balance, zonas = r.zonas, ayuda = r.ayuda,
        pedagogia = r.pedagogia, benchmarks = r.benchmarks, fuentes = r.fuentes, verificacion = r.verificacion;

    pintarMeta(meta);
    pintarSismo(sismo);
    pintarBalance(balance);
    pintarLineas(ayuda);
    pintarCanales(ayuda);
    citasCompartidas = ayuda && ayuda.citas_compartidas || {};
    if (ayuda && ayuda.acopios) { acopiosDatos = ayuda.acopios; pintarSelectorCiudades(); }
    pintarSangre(ayuda);
    pintarBusqueda(ayuda);
    inicializarFiltrosAyuda(ayuda);
    aplicarFiltrosAyuda();
    pintarPedagogia(pedagogia);
    pintarCadenas(verificacion);
    pintarZonas(zonas);
    pintarBenchmarks(benchmarks);
    pintarFuentes(fuentes);
    datosMapa.resumen = r.resumen || null;

    if (zonas) {
      datosMapa.zonas = zonas || { municipios: [] };
      datosMapa.ayuda = ayuda;
      datosMapa.sismo = sismo;
      datosMapa.meta = meta;
      observarMapa();
    } else {
      cambiarEstadoMapa('No se pudieron cargar los datos de zonas. Usa las listas de información.', 'error');
      renderResultadosMapa();
    }
    // Gancho de solo lectura para la función opcional «Cerca de mí».
    window.__cuidar = {
      obtenerMapa: function () { return mapa; },
      obtenerPuntosVisibles: function () { return filtrosMapa.modo === 'ayuda' ? puntosFiltrados() : []; },
      datos: datosMapa
    };
  });
})();
