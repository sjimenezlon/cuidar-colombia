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
function fechaCortaEs(iso) {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fecha = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(fecha.getTime()) ? null : `${fecha.getUTCDate()} ${meses[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`;
}

const [meta, ayuda, zonas, geo, verificacion, fuentes, sismo, balance] = await Promise.all([
  json('data/meta.json'), json('data/ayuda.json'), json('data/zonas.json'), json('data/geo_puntos.json'),
  json('data/verificacion.json'), json('data/fuentes.json'), json('data/sismo.json'), json('data/balance.json')
]);
const municipios = await json('data/municipios.geojson');
const fechaCorte = typeof meta?.iso === 'string' ? meta.iso.slice(0, 10) : null;

if (meta) {
  exigir(!Number.isNaN(Date.parse(meta.iso)), 'meta.iso debe ser una fecha ISO válida');
  exigir(Number(meta.vigencia_horas) > 0, 'meta.vigencia_horas debe ser mayor que cero');
  exigir(Boolean(meta.proceso), 'meta.proceso debe explicar brevemente la revisión');
}

if (ayuda) {
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
    if (canal.verificacion?.nivel === 'fuente_secundaria' && canal.detalle_cuenta) {
      errores.push(`${ctx}: no se permite publicar una cuenta respaldada solo por fuente secundaria`);
    }
  }
  for (const [tipo, lista] of [['acopios', ayuda.acopios], ['sangre', ayuda.sangre]]) {
    for (const [i, item] of (lista || []).entries()) revisarUrl(item.fuente_url, `ayuda.${tipo}[${i}].fuente_url`);
  }
}

if (zonas) {
  const claves = new Set();
  for (const [i, m] of (zonas.municipios || []).entries()) {
    const ctx = `zonas.municipios[${i}] ${m.municipio || ''}`;
    const clave = `${m.municipio}|${m.departamento}`;
    exigir(m.municipio && m.departamento && !claves.has(clave), `${ctx}: municipio ausente o duplicado`);
    claves.add(clave);
    exigir(['critica', 'alta', 'media'].includes(m.gravedad), `${ctx}: gravedad inválida`);
    exigir(Number.isFinite(m.lat) && Number.isFinite(m.lon), `${ctx}: coordenadas inválidas`);
    exigir(Array.isArray(m.fuentes) && m.fuentes.length > 0, `${ctx}: debe tener al menos una fuente`);
    for (const [j, fuente] of (m.fuentes || []).entries()) revisarUrl(fuente.url, `${ctx}.fuentes[${j}]`);
  }
}

if (geo && ayuda) {
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

for (const [i, f] of (fuentes?.items || []).entries()) revisarUrl(f.url, `fuentes.items[${i}].url`);
for (const [i, f] of (sismo?.fuentes || []).entries()) revisarUrl(f.url, `sismo.fuentes[${i}].url`);
for (const [i, c] of (balance?.cifras || []).entries()) revisarUrl(c.fuente_url, `balance.cifras[${i}].fuente_url`);
exigir(municipios?.type === 'FeatureCollection' && Array.isArray(municipios.features), 'municipios.geojson debe ser un FeatureCollection');

if (avisos.length) console.warn(avisos.map(x => `AVISO: ${x}`).join('\n'));
if (errores.length) {
  console.error(`Validación fallida (${errores.length}):\n${errores.map(x => `- ${x}`).join('\n')}`);
  process.exit(1);
}
console.log('Validación correcta: estructura, fuentes, coordenadas y niveles de evidencia consistentes.');
