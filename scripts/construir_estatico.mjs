import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const salida = join(raiz, 'public');
const archivosPublicos = [
  'index.html',
  'assets/app.js',
  'assets/extras.js',
  'assets/loader.js',
  'assets/og.png',
  'assets/styles.css',
  'data/ayuda.json',
  'data/balance.json',
  'data/benchmarks.json',
  'data/fuentes.json',
  'data/geo_puntos.json',
  'data/meta.json',
  'data/municipios.geojson',
  'data/pedagogia.json',
  'data/sismo.json',
  'data/verificacion.json',
  'data/zonas.json'
];

rmSync(salida, { recursive: true, force: true });
archivosPublicos.forEach((ruta) => {
  const destino = join(salida, ruta);
  mkdirSync(dirname(destino), { recursive: true });
  cpSync(join(raiz, ruta), destino);
});

console.log(`Salida pública preparada: ${archivosPublicos.length} archivos permitidos.`);
