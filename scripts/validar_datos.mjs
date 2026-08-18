import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const errores = [];
const avisos = [];

async function json(ruta) {
  try { return JSON.parse(await readFile(resolve(raiz, ruta), 'utf8')); }
  catch (error) { errores.push(`${ruta}: JSON inválido o ausente (${error.message})`); return null; }
}

function exigir(condicion, mensaje) { if (!condicion) errores.push(mensaje); }
function urlValida(valor, permiteTel = false) {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' || (permiteTel && url.protocol === 'tel:');
  } catch { return false; }
}
function revisarUrl(url, contexto, permiteTel = false) {
  exigir(urlValida(url, permiteTel), `${contexto}: URL no permitida (${url || 'vacía'})`);
}
function revisarCitasAdicionales(item, contexto) {
  if (item?.fuente_adicional_url) {
    revisarUrl(item.fuente_adicional_url, `${contexto}.fuente_adicional_url`);
    exigir(Boolean(item.fuente_adicional_titulo), `${contexto}.fuente_adicional_titulo debe explicar la corroboración`);
  }
  for (const [i, cita] of (item?.fuentes_adicionales || []).entries()) {
    exigir(Boolean(cita.titulo && cita.alcance), `${contexto}.fuentes_adicionales[${i}] requiere título y alcance`);
    revisarUrl(cita.url, `${contexto}.fuentes_adicionales[${i}].url`);
    exigir(!cita.nivel_fuente || ['fuente_oficial', 'fuente_secundaria'].includes(cita.nivel_fuente),
      `${contexto}.fuentes_adicionales[${i}].nivel_fuente inválido`);
  }
}
function fechaCortaEs(iso) {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fecha = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(fecha.getTime()) ? null : `${fecha.getUTCDate()} ${meses[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
}
function isoDeFechaCortaEs(texto) {
  const meses = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };
  const partes = String(texto || '').toLowerCase().match(/^(\d{1,2})\s+([a-záéíóú]{3})\s+(\d{4})$/);
  return partes && meses[partes[2]] ? `${partes[3]}-${meses[partes[2]]}-${String(partes[1]).padStart(2, '0')}` : null;
}
function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
function revisarFechaRevision(item, ctx, fechaCorte) {
  exigir(!Number.isNaN(Date.parse(item?.fecha_revision_iso)), `${ctx}.fecha_revision_iso ausente o inválida`);
  const fechaIso = String(item?.fecha_revision_iso || '').slice(0, 10);
  exigir(item?.fecha_revision === fechaCortaEs(fechaIso), `${ctx}.fecha_revision no coincide con fecha_revision_iso`);
  exigir(!fechaCorte || !fechaIso || fechaIso <= fechaCorte, `${ctx}.fecha_revision_iso posterior al corte ${fechaCorte}`);
}
function revisarEstadoOperacion(item, ctx, corteIso) {
  if (!item || !item.estado_operacion) return;
  exigir(['recibiendo', 'programado', 'por_confirmar', 'finalizado'].includes(item.estado_operacion), `${ctx}.estado_operacion inválido`);
  exigir(!Number.isNaN(Date.parse(item.estado_actualizado_iso)), `${ctx}.estado_actualizado_iso requerido y debe ser ISO válido`);
  if (item.estado_nota) {
    exigir(typeof item.estado_nota === 'string' && item.estado_nota.length <= 500, `${ctx}.estado_nota debe ser texto de hasta 500 caracteres`);
    exigir(!/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(item.estado_nota), `${ctx}.estado_nota no debe exponer correos personales`);
    exigir(!/(?:\+?57[ .-]?)?3\d{2}[ .-]?\d{3}[ .-]?\d{4}/.test(item.estado_nota), `${ctx}.estado_nota no debe exponer teléfonos móviles`);
  }
  exigir(!corteIso || !item.estado_actualizado_iso || Date.parse(item.estado_actualizado_iso) <= Date.parse(corteIso),
    `${ctx}.estado_actualizado_iso no puede ser posterior al corte del portal`);
  const desde = item.estado_desde_iso ? Date.parse(item.estado_desde_iso) : null;
  const hasta = item.estado_hasta_iso ? Date.parse(item.estado_hasta_iso) : null;
  if (item.estado_desde_iso) exigir(!Number.isNaN(desde), `${ctx}.estado_desde_iso debe ser ISO válido`);
  if (item.estado_hasta_iso) exigir(!Number.isNaN(hasta), `${ctx}.estado_hasta_iso debe ser ISO válido`);
  if (Number.isFinite(desde) && Number.isFinite(hasta)) exigir(desde < hasta, `${ctx}: la ventana operativa debe terminar después de comenzar`);
  const corte = corteIso ? Date.parse(corteIso) : null;
  if (item.estado_operacion === 'recibiendo' && Number.isFinite(hasta) && Number.isFinite(corte)) {
    exigir(hasta > corte, `${ctx}: no puede figurar recibiendo después de terminar su ventana publicada`);
  }
  if (item.estado_operacion === 'programado' && Number.isFinite(desde) && Number.isFinite(corte)) {
    exigir(desde > corte, `${ctx}: una jornada programada debe comenzar después del corte del portal`);
  }
}
function revisarContactoMovilSecundario(texto, ctx, nivel) {
  const contieneMovil = /(?:\+?57[ .-]?)?3\d{2}[ .-]?\d{3}[ .-]?\d{4}/.test(String(texto || ''));
  exigir(nivel === 'fuente_oficial' || !contieneMovil, `${ctx}: no publicar teléfonos móviles desde una fuente secundaria`);
}
function revisarCanalFinancieroSecundario(canal, ctx) {
  if (canal?.verificacion?.nivel !== 'fuente_secundaria') return;
  const textoVisible = [canal.como_donar, canal.detalle_cuenta].filter(Boolean).join(' ');
  const transcribeIdentificador = /(?:cuenta(?:\s+de\s+(?:ahorros?|corriente))?|llave|daviplata|nequi|nit)[^\n.]{0,96}(?:\d[\s#.-]*){7,}/i.test(textoVisible);
  const transcribeCorreo = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(textoVisible);
  exigir(!transcribeIdentificador, `${ctx}: una fuente secundaria no puede transcribir cuentas, llaves, NIT ni identificadores financieros en campos visibles`);
  exigir(!transcribeCorreo, `${ctx}: una fuente secundaria no puede publicar correos para enviar comprobantes o datos personales`);
}

const [meta, ayuda, zonas, geo, verificacion, fuentes, sismo, balance] = await Promise.all([
  json('data/meta.json'), json('data/ayuda.json'), json('data/zonas.json'), json('data/geo_puntos.json'),
  json('data/verificacion.json'), json('data/fuentes.json'), json('data/sismo.json'), json('data/balance.json')
]);
const municipios = await json('data/municipios.geojson');
const fechaCorte = typeof meta?.iso === 'string' ? meta.iso.slice(0, 10) : null;

if (meta) {
  exigir(meta.evento_id === 'co-sismo-2026-08-10', 'meta.evento_id debe identificar este evento para evitar mezclar campañas');
  exigir(!Number.isNaN(Date.parse(meta.iso)), 'meta.iso debe ser una fecha ISO válida');
  // El corte se sella con la hora de la revisión, pero la publicación puede correr unos
  // minutos antes de esa marca. Un adelanto de minutos se avisa; solo se bloquea el corte
  // que de verdad viene del futuro, porque ese sí publicaría una verificación inexistente.
  const holguraCorte = 45 * 60 * 1000;
  exigir(Date.parse(meta.iso) <= Date.now() + holguraCorte, 'meta.iso no puede estar en el futuro');
  if (Date.parse(meta.iso) > Date.now()) {
    avisos.push('meta.iso está adelantado frente al reloj de la publicación: sella el corte con la hora real de la revisión');
  }
  exigir(!Number.isNaN(Date.parse(meta.proxima_revision_iso)), 'meta.proxima_revision_iso debe ser una fecha ISO válida');
  exigir(Date.parse(meta.proxima_revision_iso) > Date.parse(meta.iso), 'meta.proxima_revision_iso debe ser posterior al corte');
  exigir(Number(meta.vigencia_horas) > 0, 'meta.vigencia_horas debe ser mayor que cero');
  exigir(/^\d{4}\.\d{2}\.\d{2}-\d{4}$/.test(meta.version_publica || ''), 'meta.version_publica debe identificar el corte publicado');
  exigir(Boolean(meta.proceso), 'meta.proceso debe explicar brevemente la revisión');
}

if (ayuda) {
  exigir(ayuda.evento_id === meta?.evento_id, 'ayuda.evento_id no coincide con meta.evento_id');
  for (const [entidad, citas] of Object.entries(ayuda.citas_compartidas || {})) {
    exigir(Boolean(entidad && Array.isArray(citas) && citas.length), `ayuda.citas_compartidas.${entidad}: debe tener citas`);
    for (const [i, cita] of (citas || []).entries()) {
      exigir(Boolean(cita.titulo && cita.alcance), `ayuda.citas_compartidas.${entidad}[${i}]: requiere título y alcance`);
      revisarUrl(cita.url, `ayuda.citas_compartidas.${entidad}[${i}].url`);
      exigir(['fuente_oficial', 'fuente_secundaria'].includes(cita.nivel_fuente),
        `ayuda.citas_compartidas.${entidad}[${i}].nivel_fuente inválido`);
    }
  }
  exigir(Array.isArray(ayuda.canales) && ayuda.canales.length > 0, 'ayuda.canales debe tener elementos');
  const entidades = new Set();
  for (const [i, canal] of (ayuda.canales || []).entries()) {
    const ctx = `ayuda.canales[${i}] ${canal.entidad || ''}`;
    exigir(canal.entidad && !entidades.has(canal.entidad), `${ctx}: entidad ausente o duplicada`);
    entidades.add(canal.entidad);
    revisarUrl(canal.url_oficial, `${ctx}.url_oficial`);
    exigir(['fuente_oficial', 'fuente_secundaria'].includes(canal.verificacion?.nivel), `${ctx}: nivel de verificación inválido`);
    exigir(['verificado', 'confirmacion_secundaria'].includes(canal.verificacion?.estado), `${ctx}: estado de verificación inválido`);
    exigir(!Number.isNaN(Date.parse(canal.verificacion?.fecha_iso)), `${ctx}: fecha_iso inválida`);
    exigir(!fechaCorte || canal.verificacion?.fecha_iso <= fechaCorte, `${ctx}: fecha_iso no puede ser posterior al corte ${fechaCorte}`);
    exigir(canal.fecha_verificacion === fechaCortaEs(canal.verificacion?.fecha_iso), `${ctx}: fecha_verificacion no coincide con fecha_iso`);
    revisarUrl(canal.verificacion?.evidencia_url, `${ctx}.evidencia_url`);
    revisarCitasAdicionales(canal, ctx);
    revisarCanalFinancieroSecundario(canal, ctx);
  }
  for (const [tipo, lista] of [['acopios', ayuda.acopios], ['sangre', ayuda.sangre]]) {
    for (const [i, item] of (lista || []).entries()) {
      revisarEstadoOperacion(item, `ayuda.${tipo}[${i}]`, meta?.iso);
      revisarUrl(item.fuente_url, `ayuda.${tipo}[${i}].fuente_url`);
      revisarCitasAdicionales(item, `ayuda.${tipo}[${i}]`);
      exigir(['fuente_oficial', 'fuente_secundaria'].includes(item.nivel_fuente), `ayuda.${tipo}[${i}].nivel_fuente ausente o inválido`);
      revisarContactoMovilSecundario(tipo === 'sangre' ? item.donde : '', `ayuda.${tipo}[${i}]`, item.nivel_fuente);
      if (tipo === 'sangre') revisarFechaRevision(item, `ayuda.${tipo}[${i}]`, fechaCorte);
      if (tipo === 'acopios') {
        const fechaItem = isoDeFechaCortaEs(item.fecha);
        exigir(Boolean(fechaItem), `ayuda.${tipo}[${i}].fecha ausente o inválida`);
        exigir(!fechaCorte || !fechaItem || fechaItem <= fechaCorte, `ayuda.${tipo}[${i}].fecha posterior al corte ${fechaCorte}`);
        const nombresPunto = new Set();
        for (const [j, punto] of (item.puntos || []).entries()) {
          revisarEstadoOperacion(punto, `ayuda.${tipo}[${i}].puntos[${j}]`, meta?.iso);
          exigir(punto.nombre && !nombresPunto.has(normalizar(punto.nombre)), `ayuda.${tipo}[${i}].puntos[${j}]: nombre ausente o duplicado`);
          nombresPunto.add(normalizar(punto.nombre));
          revisarContactoMovilSecundario(punto.horario, `ayuda.${tipo}[${i}].puntos[${j}]`, punto.nivel_fuente || item.nivel_fuente);
          exigir(!punto.direccion_mapa || Boolean(punto.direccion), `ayuda.${tipo}[${i}].puntos[${j}]: direccion_mapa exige una dirección visible`);
          if (punto.fuente_url) {
            revisarUrl(punto.fuente_url, `ayuda.${tipo}[${i}].puntos[${j}].fuente_url`);
            exigir(['fuente_oficial', 'fuente_secundaria'].includes(punto.nivel_fuente), `ayuda.${tipo}[${i}].puntos[${j}].nivel_fuente ausente o inválido`);
            const fechaPunto = isoDeFechaCortaEs(punto.fecha);
            exigir(Boolean(fechaPunto), `ayuda.${tipo}[${i}].puntos[${j}].fecha ausente o inválida`);
            exigir(!fechaCorte || !fechaPunto || fechaPunto <= fechaCorte, `ayuda.${tipo}[${i}].puntos[${j}].fecha posterior al corte ${fechaCorte}`);
          }
        }
      }
    }
  }
  for (const [i, item] of (ayuda.busqueda || []).entries()) {
    const ctx = `ayuda.busqueda[${i}] ${item.mecanismo || ''}`;
    exigir(Boolean(item.mecanismo && item.entidad), `${ctx}: mecanismo o entidad ausente`);
    if (item.url) revisarUrl(item.url, `${ctx}.url`);
    revisarUrl(item.fuente_url, `${ctx}.fuente_url`);
    revisarCitasAdicionales(item, ctx);
    exigir(['fuente_oficial', 'fuente_secundaria'].includes(item.nivel_fuente), `${ctx}.nivel_fuente ausente o inválido`);
    exigir(['institucional', 'complementario'].includes(item.tipo_canal), `${ctx}.tipo_canal ausente o inválido`);
    revisarFechaRevision(item, ctx, fechaCorte);
  }
}

if (zonas) {
  revisarFechaRevision(zonas, 'zonas', fechaCorte);
  exigir(!meta?.iso || !zonas.fecha_revision_iso || Date.parse(zonas.fecha_revision_iso) <= Date.parse(meta.iso), 'zonas.fecha_revision_iso no puede ser posterior a meta.iso');
  const nivelesEvidencia = ['incluye_fuente_oficial', 'corroboracion_multiple', 'una_fuente_secundaria'];
  const nivelesFuente = ['fuente_oficial', 'fuente_secundaria'];
  const idsAlertas = new Set();
  for (const [i, alerta] of (zonas.alertas_oficiales || []).entries()) {
    const ctx = `zonas.alertas_oficiales[${i}] ${alerta.titulo || ''}`;
    exigir(Boolean(alerta.id && !idsAlertas.has(alerta.id)), `${ctx}: id ausente o duplicado`);
    idsAlertas.add(alerta.id);
    exigir(Boolean(alerta.titulo && alerta.tipo && alerta.autoridad && alerta.alcance && alerta.recomendacion), `${ctx}: faltan título, tipo, autoridad, alcance o recomendación`);
    exigir(['amarilla', 'naranja', 'roja'].includes(alerta.nivel), `${ctx}: nivel inválido`);
    exigir(!Number.isNaN(Date.parse(alerta.fecha_iso)), `${ctx}: fecha_iso ausente o inválida`);
    exigir(!meta?.iso || !alerta.fecha_iso || Date.parse(alerta.fecha_iso) <= Date.parse(meta.iso), `${ctx}: fecha posterior al corte del portal`);
    exigir(Number.isFinite(alerta.lat) && Number.isFinite(alerta.lon), `${ctx}: coordenadas inválidas`);
    revisarUrl(alerta.fuente_url, `${ctx}.fuente_url`);
    exigir(Boolean(alerta.fuente_titulo), `${ctx}: fuente_titulo requerido`);
    try {
      exigir(new URL(alerta.fuente_url).hostname.endsWith('.gov.co'), `${ctx}: una alerta oficial debe enlazar un dominio .gov.co`);
    } catch { /* revisarUrl ya registra la URL inválida */ }
  }
  const claves = new Set();
  for (const [i, m] of (zonas.municipios || []).entries()) {
    const ctx = `zonas.municipios[${i}] ${m.municipio || ''}`;
    const clave = `${m.municipio}|${m.departamento}`;
    exigir(m.municipio && m.departamento && !claves.has(clave), `${ctx}: municipio ausente o duplicado`);
    claves.add(clave);
    exigir(['critica', 'alta', 'media'].includes(m.gravedad), `${ctx}: gravedad inválida`);
    exigir(nivelesEvidencia.includes(m.nivel_evidencia), `${ctx}: nivel_evidencia ausente o inválido`);
    exigir(m.seguimiento_prioritario == null || typeof m.seguimiento_prioritario === 'boolean', `${ctx}: seguimiento_prioritario debe ser booleano`);
    exigir(!m.seguimiento_prioritario || m.gravedad === 'critica', `${ctx}: el seguimiento prioritario solo se permite para afectación crítica`);
    exigir(Number.isFinite(m.lat) && Number.isFinite(m.lon), `${ctx}: coordenadas inválidas`);
    exigir(Array.isArray(m.fuentes) && m.fuentes.length > 0, `${ctx}: debe tener al menos una fuente`);
    const urls = new Set();
    for (const [j, fuente] of (m.fuentes || []).entries()) {
      revisarUrl(fuente.url, `${ctx}.fuentes[${j}]`);
      exigir(Boolean(fuente.titulo && fuente.alcance), `${ctx}.fuentes[${j}]: requiere título y alcance explícito`);
      exigir(nivelesFuente.includes(fuente.nivel_fuente), `${ctx}.fuentes[${j}]: nivel_fuente inválido`);
      urls.add(fuente.url);
    }
    const tieneOficial = (m.fuentes || []).some(f => f.nivel_fuente === 'fuente_oficial');
    exigir(m.nivel_evidencia !== 'incluye_fuente_oficial' || tieneOficial, `${ctx}: declara fuente oficial pero ninguna cita es oficial`);
    exigir(m.nivel_evidencia !== 'corroboracion_multiple' || urls.size >= 2, `${ctx}: corroboración múltiple requiere al menos dos URL distintas`);
    exigir(m.nivel_evidencia !== 'una_fuente_secundaria' || (!tieneOficial && urls.size === 1), `${ctx}: una fuente secundaria debe tener exactamente una cita secundaria`);
  }
}

if (geo && ayuda) {
  exigir(geo.evento_id === ayuda.evento_id, 'geo_puntos.evento_id no coincide con ayuda.evento_id');
  const ciudadesAcopio = new Set((ayuda.acopios || []).map(x => x.ciudad));
  const ciudadesSangre = new Set((ayuda.sangre || []).map(x => x.ciudad));
  const puntos = new Set();
  const coordenadas = new Map();
  for (const [i, p] of (geo.puntos || []).entries()) {
    const ctx = `geo_puntos.puntos[${i}] ${p.nombre || ''}`;
    const clave = `${p.tipo}|${p.ciudad}|${p.nombre}`;
    exigir(['acopio', 'sangre'].includes(p.tipo), `${ctx}: tipo inválido`);
    exigir(Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180, `${ctx}: coordenadas inválidas`);
    if (p.coordenadas_fuente) revisarUrl(p.coordenadas_fuente, `${ctx}.coordenadas_fuente`);
    exigir(!puntos.has(clave), `${ctx}: punto duplicado`); puntos.add(clave);
    const claveCoordenada = `${p.lat.toFixed(5)}|${p.lon.toFixed(5)}`;
    exigir(!coordenadas.has(claveCoordenada), `${ctx}: comparte coordenadas exactas con ${coordenadas.get(claveCoordenada) || 'otro punto'}; requiere revisión manual`);
    coordenadas.set(claveCoordenada, p.nombre);
    const ciudades = p.tipo === 'acopio' ? ciudadesAcopio : ciudadesSangre;
    exigir(ciudades.has(p.ciudad), `${ctx}: la ciudad no existe en ayuda.${p.tipo === 'acopio' ? 'acopios' : 'sangre'}`);
    if (p.tipo === 'acopio') {
      const registro = (ayuda.acopios || []).find(x => x.ciudad === p.ciudad &&
        (x.puntos || []).some(q => normalizar(q.nombre) === normalizar(p.nombre)));
      exigir(Boolean(registro), `${ctx}: no coincide exactamente con un punto de acopio y podría enlazar evidencia incorrecta`);
    } else {
      exigir(Boolean(p.registro_entidad), `${ctx}: falta registro_entidad para enlazar su evidencia sin ambigüedad`);
      const registro = (ayuda.sangre || []).find(x => x.ciudad === p.ciudad && normalizar(x.entidad) === normalizar(p.registro_entidad));
      exigir(Boolean(registro), `${ctx}: registro_entidad no coincide con una campaña de sangre de la misma ciudad`);
    }
  }
}

if (verificacion) {
  exigir(Array.isArray(verificacion.metodologia?.principios) && verificacion.metodologia.principios.length >= 3, 'verificacion.metodologia debe publicar sus principios');
  for (const [i, a] of (verificacion.afirmaciones || []).entries()) {
    const ctx = `verificacion.afirmaciones[${i}]`;
    exigir(a.afirmacion && a.veredicto && a.realidad, `${ctx}: faltan campos`);
    exigir(['fuente_oficial', 'fuente_secundaria', 'guia_publica'].includes(a.nivel_fuente), `${ctx}: nivel_fuente inválido`);
    exigir(!Number.isNaN(Date.parse(a.verificado_iso)), `${ctx}: verificado_iso inválida`);
    exigir(!fechaCorte || a.verificado_iso <= fechaCorte, `${ctx}: verificado_iso no puede ser posterior al corte ${fechaCorte}`);
    revisarUrl(a.fuente_url, `${ctx}.fuente_url`);
    if (a.remitir_url) revisarUrl(a.remitir_url, `${ctx}.remitir_url`);
  }
  for (const [i, f] of (verificacion.fuentes_para_verificar || []).entries()) revisarUrl(f.url, `verificacion.fuentes_para_verificar[${i}].url`, true);
}

if (fuentes) {
  // El capítulo de transparencia solo sirve si cada enlace declara para qué se usa,
  // de qué tipo es y cuándo se comprobó: sin eso vuelve a ser una lista de logos.
  const gruposFuentes = new Set((fuentes.grupos || []).map((g) => g.id));
  exigir(gruposFuentes.size > 0, 'fuentes.grupos debe declarar al menos un grupo con id');
  for (const [i, g] of (fuentes.grupos || []).entries()) {
    exigir(Boolean(g.id && g.titulo && g.descripcion), `fuentes.grupos[${i}]: requiere id, título y descripción`);
  }
  for (const [i, f] of (fuentes.items || []).entries()) {
    const ctx = `fuentes.items[${i}] ${f.nombre || ''}`;
    revisarUrl(f.url, `${ctx}.url`);
    exigir(Boolean(f.nombre && f.descripcion), `${ctx}: requiere nombre y descripción`);
    exigir(Boolean(f.que_verifica), `${ctx}: debe declarar qué se verifica con esta fuente`);
    exigir(gruposFuentes.has(f.grupo), `${ctx}: grupo inexistente (${f.grupo || 'vacío'})`);
    exigir(Boolean(f.tipo), `${ctx}: requiere tipo de fuente`);
    exigir(['fuente_oficial', 'fuente_secundaria'].includes(f.nivel), `${ctx}: nivel inválido`);
    exigir(!Number.isNaN(Date.parse(f.ultima_consulta_iso)), `${ctx}: ultima_consulta_iso ausente o inválida`);
    exigir(!meta?.iso || Date.parse(f.ultima_consulta_iso) <= Date.parse(meta.iso),
      `${ctx}: la última consulta no puede ser posterior al corte del portal`);
    try {
      // Una entidad puede ser oficial en su propio dominio (.org, .com.co); lo que nunca
      // es un dominio verificable es el perfil de una red social ajena a la entidad.
      const enRedSocial = /(^|\.)(instagram\.com|facebook\.com|x\.com|twitter\.com|tiktok\.com|youtube\.com|t\.me|wa\.me)$/
        .test(new URL(f.url).hostname);
      exigir(!(f.nivel === 'fuente_oficial' && enRedSocial),
        `${ctx}: una publicación en red social no puede figurar como fuente oficial; el dominio propio de la entidad sí`);
    } catch { /* revisarUrl ya registra la URL inválida */ }
  }
}
for (const [i, f] of (sismo?.fuentes || []).entries()) revisarUrl(f.url, `sismo.fuentes[${i}].url`);
if (balance) {
  for (const [i, c] of (balance.cifras || []).entries()) revisarUrl(c.fuente_url, `balance.cifras[${i}].fuente_url`);
  exigir(!Number.isNaN(Date.parse(balance.fecha_corte_iso)), 'balance.fecha_corte_iso debe ser una fecha ISO válida');
  exigir(!meta?.iso || !balance.fecha_corte_iso || Date.parse(balance.fecha_corte_iso) <= Date.parse(meta.iso),
    'balance.fecha_corte_iso no puede ser posterior al corte del portal');
  exigir(['incluye_fuente_oficial', 'corroboracion_multiple', 'una_fuente_secundaria'].includes(balance.nivel_evidencia),
    'balance.nivel_evidencia ausente o inválido');
  exigir(typeof balance.fuente_primaria_disponible === 'boolean', 'balance.fuente_primaria_disponible debe ser booleano');
  revisarCitasAdicionales(balance, 'balance');
  const fuentesBalance = balance.fuentes_adicionales || [];
  const urlsBalance = new Set(fuentesBalance.map((cita) => cita.url));
  const tieneOficialBalance = fuentesBalance.some((cita) => cita.nivel_fuente === 'fuente_oficial');
  exigir(balance.nivel_evidencia !== 'corroboracion_multiple' || urlsBalance.size >= 2,
    'balance: corroboración múltiple requiere al menos dos fuentes distintas');
  exigir(balance.nivel_evidencia !== 'incluye_fuente_oficial' || tieneOficialBalance,
    'balance: declara fuente oficial, pero ninguna cita enlazada es oficial');
  exigir(balance.fuente_primaria_disponible || !tieneOficialBalance,
    'balance: fuente_primaria_disponible=false no puede acompañarse de una cita marcada oficial');
}
exigir(municipios?.type === 'FeatureCollection' && Array.isArray(municipios.features), 'municipios.geojson debe ser un FeatureCollection');

if (avisos.length) console.warn(avisos.map(x => `AVISO: ${x}`).join('\n'));
if (errores.length) {
  console.error(`Validación fallida (${errores.length}):\n${errores.map(x => `- ${x}`).join('\n')}`);
  process.exit(1);
}
console.log('Validación correcta: estructura, fuentes, coordenadas y niveles de evidencia consistentes.');
