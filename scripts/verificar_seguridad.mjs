import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const salida = join(raiz, 'public');
const esperados = new Set([
  '.well-known/security.txt',
  'assets/app.js',
  'assets/extras.js',
  'assets/favicon.svg',
  'assets/loader.js',
  'assets/og.png',
  'assets/styles.css',
  'assets/vendor/maplibre-gl.css',
  'assets/vendor/maplibre-gl.js',
  'data/app.json',
  'data/mapa.json',
  'index.html',
  'robots.txt'
]);

function archivosEn(directorio) {
  return readdirSync(directorio).flatMap((nombre) => {
    const ruta = join(directorio, nombre);
    return statSync(ruta).isDirectory() ? archivosEn(ruta) : [ruta];
  });
}

const publicados = archivosEn(salida).map((ruta) => relative(salida, ruta));
const inesperados = publicados.filter((ruta) => !esperados.has(ruta));
const faltantes = [...esperados].filter((ruta) => !publicados.includes(ruta));

if (inesperados.length || faltantes.length) {
  if (inesperados.length) console.error(`Archivos públicos inesperados: ${inesperados.join(', ')}`);
  if (faltantes.length) console.error(`Archivos públicos faltantes: ${faltantes.join(', ')}`);
  process.exitCode = 1;
}

const legibles = publicados.filter((ruta) => !/\.(?:png|jpg|jpeg|webp|woff2?)$/i.test(ruta));
const patronesSecretos = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|OPENAI_API_KEY|RESEND_API_KEY|VERCEL_TOKEN)\s*[:=]/i
];
const patronesPrivados = [/sjimenezlon@gmail\.com/i, /mailto:/i];

legibles.forEach((ruta) => {
  const contenido = readFileSync(join(salida, ruta), 'utf8');
  patronesSecretos.forEach((patron) => {
    if (patron.test(contenido)) {
      console.error(`Posible secreto expuesto en ${ruta}: ${patron}`);
      process.exitCode = 1;
    }
  });
  patronesPrivados.forEach((patron) => {
    if (patron.test(contenido)) {
      console.error(`Dato de contacto privado expuesto en ${ruta}: ${patron}`);
      process.exitCode = 1;
    }
  });
});

const funcion = readFileSync(join(raiz, 'api/sugerencias.mjs'), 'utf8');
if (!funcion.includes('process.env.SUGGESTIONS_TO_EMAIL') || !funcion.includes('process.env.RESEND_API_KEY') ||
    /sjimenezlon@gmail\.com/i.test(funcion)) {
  console.error('La función de sugerencias debe usar destinatario y credenciales privados del entorno.');
  process.exitCode = 1;
}

const html = readFileSync(join(salida, 'index.html'), 'utf8');
if (/<script[^>]+src=["']https?:\/\//i.test(html)) {
  console.error('El HTML público carga scripts desde un dominio externo.');
  process.exitCode = 1;
}

const configuracion = JSON.parse(readFileSync(join(raiz, 'vercel.json'), 'utf8'));
const encabezados = configuracion.headers?.find((regla) => regla.source === '/(.*)')?.headers || [];
const csp = encabezados.find((encabezado) => encabezado.key === 'Content-Security-Policy')?.value || '';
const referrer = encabezados.find((encabezado) => encabezado.key === 'Referrer-Policy')?.value || '';
const hsts = encabezados.find((encabezado) => encabezado.key === 'Strict-Transport-Security')?.value || '';
const directivasCsp = ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "script-src 'self'"];

if (!directivasCsp.every((directiva) => csp.includes(directiva)) || referrer !== 'no-referrer' || !hsts.includes('max-age=')) {
  console.error('Faltan encabezados de aislamiento o privacidad obligatorios.');
  process.exitCode = 1;
}

const reglaInicio = configuracion.headers?.find((regla) => regla.source === '/')?.headers || [];
const reglaDatos = configuracion.headers?.find((regla) => regla.source === '/data/(.*)')?.headers || [];
const cacheInicio = reglaInicio.find((encabezado) => encabezado.key === 'Cache-Control')?.value || '';
const cacheDatos = reglaDatos.find((encabezado) => encabezado.key === 'Cache-Control')?.value || '';
if (!cacheInicio.includes('max-age=0') || !cacheInicio.includes('must-revalidate') ||
    !cacheDatos.includes('max-age=0') || !cacheDatos.includes('must-revalidate')) {
  console.error('El HTML y los datos de emergencia deben revalidarse antes de reutilizar una copia local.');
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log(`Seguridad estática verificada: ${publicados.length} archivos permitidos, sin secretos detectados.`);
}
