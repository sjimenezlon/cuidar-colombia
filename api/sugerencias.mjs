import { createHash, randomUUID } from 'node:crypto';

const limites = new Map();
const TIPOS = {
  dato: 'Dato desactualizado o incorrecto',
  sugerencia: 'Sugerencia para mejorar',
  seguridad: 'Privacidad o seguridad',
  otro: 'Otro'
};

function respuesta(res, estado, cuerpo) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(estado).json(cuerpo);
}

function texto(valor, maximo) {
  return String(valor || '').replace(/\0/g, '').trim().slice(0, maximo);
}

function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[caracter]);
}

function origenPermitido(req) {
  const sitio = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (sitio && !['same-origin', 'none'].includes(sitio)) return false;
  const origen = String(req.headers.origin || '');
  if (!origen) return true;
  try {
    const host = new URL(origen).hostname;
    const despliegue = String(process.env.VERCEL_URL || '').toLowerCase().split(':')[0];
    return host === 'cuidarcolombia.vercel.app' || host === 'localhost' || host === '127.0.0.1' ||
      (!!despliegue && host === despliegue);
  } catch { return false; }
}

function excedeLimite(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'desconocida').split(',')[0].trim();
  const clave = createHash('sha256').update(ip).digest('hex');
  const ahora = Date.now();
  const ventana = 10 * 60 * 1000;
  for (const [k, valor] of limites) if (ahora - valor.inicio > ventana) limites.delete(k);
  const actual = limites.get(clave);
  if (!actual || ahora - actual.inicio > ventana) {
    limites.set(clave, { inicio: ahora, cantidad: 1 });
    return false;
  }
  actual.cantidad += 1;
  return actual.cantidad > 5;
}

export default async function sugerencias(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respuesta(res, 405, { ok: false, mensaje: 'Método no permitido.' });
  }
  if (!origenPermitido(req)) return respuesta(res, 403, { ok: false, mensaje: 'Solicitud no permitida.' });
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return respuesta(res, 415, { ok: false, mensaje: 'Formato no permitido.' });
  }
  if (Number(req.headers['content-length'] || 0) > 12_000) return respuesta(res, 413, { ok: false, mensaje: 'El mensaje es demasiado grande.' });
  if (excedeLimite(req)) return respuesta(res, 429, { ok: false, mensaje: 'Recibimos varios intentos. Espera unos minutos y vuelve a probar.' });

  let cuerpo = req.body || {};
  if (typeof cuerpo === 'string') {
    try { cuerpo = JSON.parse(cuerpo); } catch { return respuesta(res, 400, { ok: false, mensaje: 'No pudimos leer el formulario.' }); }
  }
  if (!cuerpo || Array.isArray(cuerpo) || typeof cuerpo !== 'object') {
    return respuesta(res, 400, { ok: false, mensaje: 'No pudimos leer el formulario.' });
  }
  if (JSON.stringify(cuerpo).length > 12_000) {
    return respuesta(res, 413, { ok: false, mensaje: 'El mensaje es demasiado grande.' });
  }
  if (texto(cuerpo.empresa, 80)) return respuesta(res, 200, { ok: true });

  const tipo = TIPOS[cuerpo.tipo] ? cuerpo.tipo : 'otro';
  const mensaje = texto(cuerpo.mensaje, 2000);
  const registro = texto(cuerpo.registro, 180);
  const seccion = texto(cuerpo.seccion, 100);
  const contacto = texto(cuerpo.contacto, 160);
  const pagina = texto(cuerpo.pagina, 300);
  const inicio = Number(cuerpo.inicio || 0);

  if (mensaje.length < 12) return respuesta(res, 400, { ok: false, mensaje: 'Cuéntanos un poco más para poder revisarlo.' });
  if (!inicio || Date.now() - inicio < 800 || Date.now() - inicio > 24 * 60 * 60 * 1000) {
    return respuesta(res, 400, { ok: false, mensaje: 'Actualiza el formulario e inténtalo de nuevo.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const destinatario = process.env.SUGGESTIONS_TO_EMAIL;
  if (!apiKey || !destinatario) {
    console.error('[sugerencias] El servicio de correo no está configurado.');
    return respuesta(res, 503, { ok: false, mensaje: 'El formulario está temporalmente fuera de servicio. Intenta más tarde.' });
  }

  const detalle = [
    ['Tipo', TIPOS[tipo]], ['Registro', registro || 'No indicado'], ['Sección', seccion || 'No indicada'],
    ['Página', pagina || 'No indicada'], ['Contacto opcional', contacto || 'No proporcionado'], ['Mensaje', mensaje]
  ];
  const html = `<h2>Nuevo reporte de Cuidar a Colombia</h2>${detalle.map(([nombre, valor]) =>
    `<p><strong>${escaparHtml(nombre)}:</strong><br>${escaparHtml(valor).replace(/\n/g, '<br>')}</p>`).join('')}`;
  const contenido = detalle.map(([nombre, valor]) => `${nombre}: ${valor}`).join('\n\n');
  const remitente = process.env.SUGGESTIONS_FROM_EMAIL || 'Cuidar a Colombia <onboarding@resend.dev>';
  const asuntoRegistro = registro.replace(/[\r\n]+/g, ' ').slice(0, 70);

  try {
    const envio = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `sugerencia-${randomUUID()}`
      },
      body: JSON.stringify({
        from: remitente,
        to: [destinatario],
        subject: `[Cuidar a Colombia] ${TIPOS[tipo]}${asuntoRegistro ? ` — ${asuntoRegistro}` : ''}`,
        html,
        text: contenido
      })
    });
    if (!envio.ok) {
      console.error('[sugerencias] Resend rechazó el envío:', envio.status);
      return respuesta(res, 502, { ok: false, mensaje: 'No pudimos enviar el reporte. Intenta nuevamente en unos minutos.' });
    }
    return respuesta(res, 200, { ok: true, mensaje: 'Gracias. Recibimos tu reporte y lo revisaremos.' });
  } catch (error) {
    console.error('[sugerencias] Falló el proveedor de correo:', error?.message || 'error desconocido');
    return respuesta(res, 502, { ok: false, mensaje: 'No pudimos enviar el reporte. Intenta nuevamente en unos minutos.' });
  }
}
