import assert from 'node:assert/strict';
import sugerencias from '../api/sugerencias.mjs';

function respuesta() {
  return {
    encabezados: {}, estado: 0, cuerpo: null,
    setHeader(nombre, valor) { this.encabezados[nombre] = valor; },
    status(estado) { this.estado = estado; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; }
  };
}

async function ejecutar({ method = 'POST', headers = {}, body = {} } = {}) {
  const res = respuesta();
  await sugerencias({ method, headers, body, socket: {} }, res);
  return res;
}

assert.equal((await ejecutar({ method: 'GET' })).estado, 405);
assert.equal((await ejecutar({ headers: {
  origin: 'https://sitio-malicioso.example', 'sec-fetch-site': 'cross-site', 'content-type': 'application/json'
} })).estado, 403);
assert.equal((await ejecutar({ headers: {} })).estado, 415);
assert.equal((await ejecutar({ headers: { 'content-type': 'application/json' }, body: {
  mensaje: 'muy corto', inicio: Date.now() - 1000
} })).estado, 400);

let llamado = false;
const fetchReal = globalThis.fetch;
globalThis.fetch = async (_url, opciones) => {
  llamado = true;
  globalThis.__correoPrueba = JSON.parse(opciones.body);
  return { ok: true, status: 200 };
};
process.env.RESEND_API_KEY = 're_prueba_local';
process.env.SUGGESTIONS_TO_EMAIL = 'privado@example.invalid';

const trampa = await ejecutar({ headers: { 'content-type': 'application/json' }, body: {
  empresa: 'robot', mensaje: 'Este mensaje supera el mínimo', inicio: Date.now() - 1000
} });
assert.equal(trampa.estado, 200);
assert.equal(llamado, false);

const valido = await ejecutar({ headers: { 'content-type': 'application/json' }, body: {
  tipo: 'dato', registro: 'Punto <b>central</b>\nBcc: atacante@example.com',
  mensaje: 'Revisar <script>alert(1)</script> con la fuente oficial.', inicio: Date.now() - 1000
} });
assert.equal(valido.estado, 200);
assert.equal(globalThis.__correoPrueba.to[0], 'privado@example.invalid');
assert.ok(!globalThis.__correoPrueba.subject.includes('\n'));
assert.ok(globalThis.__correoPrueba.html.includes('&lt;script&gt;'));
assert.ok(!globalThis.__correoPrueba.html.includes('<script>'));

globalThis.fetch = fetchReal;
delete globalThis.__correoPrueba;
delete process.env.RESEND_API_KEY;
delete process.env.SUGGESTIONS_TO_EMAIL;
console.log('Formulario verificado: validación, privacidad, trampa antirobot y escape de contenido correctos.');
