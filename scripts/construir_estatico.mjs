import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const salida = join(raiz, 'public');
const archivosPublicos = [
  'index.html',
  'robots.txt',
  '.well-known/security.txt',
  'assets/app.js',
  'assets/extras.js',
  'assets/favicon.svg',
  'assets/loader.js',
  'assets/og.png',
  'assets/styles.css'
];

const archivosAplicacion = [
  'meta', 'sismo', 'balance', 'zonas', 'ayuda', 'pedagogia', 'benchmarks', 'fuentes', 'verificacion'
];

function leerJson(ruta) {
  return JSON.parse(readFileSync(join(raiz, ruta), 'utf8'));
}

function dominiosEn(valor, dominios) {
  if (typeof valor === 'string' && /^https:\/\//.test(valor)) {
    try { dominios.add(new URL(valor).hostname); } catch { /* URL validada antes de construir */ }
    return;
  }
  if (Array.isArray(valor)) valor.forEach((item) => dominiosEn(item, dominios));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((item) => dominiosEn(item, dominios));
}

rmSync(salida, { recursive: true, force: true });
archivosPublicos.forEach((ruta) => {
  const destino = join(salida, ruta);
  mkdirSync(dirname(destino), { recursive: true });
  cpSync(join(raiz, ruta), destino);
});

const aplicacion = Object.fromEntries(archivosAplicacion.map((nombre) => [nombre, leerJson(`data/${nombre}.json`)]));
const mapa = {
  municipios: leerJson('data/municipios.geojson'),
  geo: leerJson('data/geo_puntos.json')
};
const dominios = new Set();
dominiosEn(aplicacion, dominios);
dominiosEn(mapa.geo, dominios);
aplicacion.resumen = {
  registros: (aplicacion.ayuda.canales || []).length + (aplicacion.ayuda.acopios || []).length +
    (aplicacion.ayuda.sangre || []).length + (aplicacion.ayuda.busqueda || []).length +
    (aplicacion.verificacion.afirmaciones || []).length + (aplicacion.zonas.municipios || []).length +
    (mapa.geo.puntos || []).length,
  fuentes: dominios.size,
  municipios: (aplicacion.zonas.municipios || []).length,
  lugares_acopio: (aplicacion.ayuda.acopios || []).reduce((total, registro) => total + (registro.puntos || []).length, 0),
  pines_acopio: (mapa.geo.puntos || []).filter((punto) => punto.tipo === 'acopio').length,
  pines_sangre: (mapa.geo.puntos || []).filter((punto) => punto.tipo === 'sangre').length
};

// El HTML es un respaldo funcional mientras carga JavaScript o si este falla.
// Sincronizarlo en cada build evita publicar cifras y cortes antiguos.
const htmlPublico = join(salida, 'index.html');
let html = readFileSync(htmlPublico, 'utf8');
const reemplazos = [
  [/(<strong id="fecha-actualizacion">)[^<]*(<\/strong>)/, `$1${aplicacion.meta.ultima_actualizacion}$2`],
  [/(<div class="aviso-vigencia[^>]*" id="aviso-vigencia"[^>]*>)[\s\S]*?(<\/div>)/,
    `$1<strong>Información vigente</strong><span>Próxima: ${aplicacion.meta.proxima_revision}</span>$2`],
  [/(<strong id="contx-0">)[^<]*(<\/strong>)/, `$1${aplicacion.resumen.registros}$2`],
  [/(<strong id="contx-1">)[^<]*(<\/strong>)/, `$1${aplicacion.resumen.fuentes}$2`],
  [/(<strong id="contx-2">)[^<]*(<\/strong>)/, `$1${aplicacion.resumen.municipios}$2`],
  [/(<p class="pie-fecha" id="pie-actualizacion">)[^<]*(<\/p>)/,
    `$1Última actualización: ${aplicacion.meta.ultima_actualizacion}$2`]
];
reemplazos.forEach(([patron, valor]) => { html = html.replace(patron, valor); });
writeFileSync(htmlPublico, html);

mkdirSync(join(salida, 'data'), { recursive: true });
writeFileSync(join(salida, 'data/app.json'), JSON.stringify(aplicacion));
writeFileSync(join(salida, 'data/mapa.json'), JSON.stringify(mapa));

mkdirSync(join(salida, 'assets/vendor'), { recursive: true });
cpSync(join(raiz, 'node_modules/maplibre-gl/dist/maplibre-gl.js'), join(salida, 'assets/vendor/maplibre-gl.js'));
cpSync(join(raiz, 'node_modules/maplibre-gl/dist/maplibre-gl.css'), join(salida, 'assets/vendor/maplibre-gl.css'));

console.log(`Salida pública preparada: ${archivosPublicos.length + 4} archivos permitidos; datos agrupados en 2 solicitudes.`);
