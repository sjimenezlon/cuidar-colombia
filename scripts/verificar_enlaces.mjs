import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const archivos = ['ayuda.json', 'balance.json', 'benchmarks.json', 'fuentes.json', 'geo_puntos.json', 'pedagogia.json', 'sismo.json', 'verificacion.json', 'zonas.json'];
const urls = new Set();

function visitar(valor) {
  if (Array.isArray(valor)) return valor.forEach(visitar);
  if (!valor || typeof valor !== 'object') return;
  for (const [clave, item] of Object.entries(valor)) {
    if ((clave === 'url' || clave.endsWith('_url')) && typeof item === 'string' && item.startsWith('https://')) urls.add(item);
    else visitar(item);
  }
}
for (const archivo of archivos) visitar(JSON.parse(await readFile(resolve(raiz, 'data', archivo), 'utf8')));
const html = await readFile(resolve(raiz, 'index.html'), 'utf8');
for (const coincidencia of html.matchAll(/href=["'](https:\/\/[^"']+)["']/g)) urls.add(coincidencia[1].replace(/&amp;/g, '&'));

const lista = [...urls];
const resultados = [];
let indice = 0;
async function trabajador() {
  while (indice < lista.length) {
    const url = lista[indice++];
    let estado = 0;
    try {
      const respuesta = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'CuidarColombia-LinkCheck/1.0' } });
      estado = respuesta.status;
      await respuesta.body?.cancel();
    } catch { estado = 0; }
    resultados.push({ estado, url });
  }
}
await Promise.all(Array.from({ length: 8 }, trabajador));
resultados.sort((a, b) => a.estado - b.estado || a.url.localeCompare(b.url));
for (const r of resultados) console.log(`${String(r.estado || 'ERR').padEnd(4)} ${r.url}`);
const rotos = resultados.filter(r => r.estado === 404 || r.estado === 410);
if (rotos.length) {
  console.error(`\n${rotos.length} enlace(s) definitivamente roto(s).`);
  process.exit(1);
}
console.log(`\n${resultados.length} enlaces revisados; 403/429/ERR requieren revisión humana y no se consideran rotos automáticamente.`);
