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
  /(?:AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|OPENAI_API_KEY|VERCEL_TOKEN)\s*[:=]/i
];

legibles.forEach((ruta) => {
  const contenido = readFileSync(join(salida, ruta), 'utf8');
  patronesSecretos.forEach((patron) => {
    if (patron.test(contenido)) {
      console.error(`Posible secreto expuesto en ${ruta}: ${patron}`);
      process.exitCode = 1;
    }
  });
});

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

if (!process.exitCode) {
  console.log(`Seguridad estática verificada: ${publicados.length} archivos permitidos, sin secretos detectados.`);
}
