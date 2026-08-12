# Piezas de Instagram (story 1080x1920 y post 1080x1350) para Cuidar a Colombia.
# Texto 100 % controlado: la marca es la trazabilidad de cada registro.
from PIL import Image, ImageDraw, ImageFont

PAPEL, CREMA, TINTA, AZUL, AZUL_OSC, ORO = '#FAF7F2', '#F3EDE3', '#1F2933', '#1D5A8A', '#16324F', '#C8862A'
SUAVE = '#52606D'

def fuente(nombre, tam):
    rutas = {
        'serif-b': '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
        'serif': '/System/Library/Fonts/Supplemental/Georgia.ttf',
        'sans-b': '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        'sans': '/System/Library/Fonts/Supplemental/Arial.ttf',
    }
    return ImageFont.truetype(rutas[nombre], tam)

def corazon(d, cx, cy, r, color):
    d.ellipse([cx - 2 * r, cy - r, cx, cy + r], fill=color)
    d.ellipse([cx, cy - r, cx + 2 * r, cy + r], fill=color)
    d.polygon([(cx - 2 * r + int(r * 0.16), cy + int(r * 0.55)),
               (cx + 2 * r - int(r * 0.16), cy + int(r * 0.55)),
               (cx, cy + int(2.6 * r))], fill=color)

FILAS = [
    ('#1D5A8A', 'Canales de donación con evidencia'),
    ('#2E7D4F', 'Puntos de acopio en tu ciudad'),
    ('#C62828', 'Dónde donar sangre'),
    ('#C8862A', 'Mapa de zonas afectadas'),
    ('#7A1815', 'Verifica las cadenas falsas'),
]

def pieza(ancho, alto, ruta):
    img = Image.new('RGB', (ancho, alto), PAPEL)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, ancho, 26], fill=AZUL_OSC)
    d.rectangle([0, 26, ancho, 38], fill=ORO)
    es_story = alto > 1500
    y = int(alto * (0.09 if es_story else 0.075))

    corazon(d, ancho // 2, y + 60, 46, AZUL)
    y += 190

    t1, t2 = fuente('serif-b', 118 if es_story else 104), fuente('serif-b', 118 if es_story else 104)
    for linea, color in [('Cuidar a', TINTA), ('Colombia', AZUL)]:
        w = d.textlength(linea, font=t1)
        d.text(((ancho - w) / 2, y), linea, font=t1, fill=color)
        y += (134 if es_story else 118)
    y += 30

    sub = fuente('sans', 44 if es_story else 40)
    for linea in ['Una sola página, trazable,', 'para ayudar tras el terremoto.']:
        w = d.textlength(linea, font=sub)
        d.text(((ancho - w) / 2, y), linea, font=sub, fill=SUAVE)
        y += (62 if es_story else 56)
    y += int(alto * 0.045)

    fs = fuente('sans-b', 42 if es_story else 38)
    alto_fila = 108 if es_story else 96
    margen = 100
    for color, texto in FILAS:
        d.rounded_rectangle([margen, y, ancho - margen, y + alto_fila - 18], radius=22,
                            fill='#FFFFFF', outline='#E6DECF', width=2)
        d.ellipse([margen + 34, y + (alto_fila - 18) // 2 - 15, margen + 64, y + (alto_fila - 18) // 2 + 15], fill=color)
        d.text((margen + 96, y + (alto_fila - 18 - 48) // 2), texto, font=fs, fill=TINTA)
        y += alto_fila
    y += int(alto * 0.035)

    url_f = fuente('sans-b', 56 if es_story else 50)
    url = 'cuidarcolombia.vercel.app'
    w = d.textlength(url, font=url_f)
    d.rounded_rectangle([(ancho - w) / 2 - 44, y - 22, (ancho + w) / 2 + 44, y + 78], radius=50, fill=AZUL)
    d.text(((ancho - w) / 2, y - 4), url, font=url_f, fill='#FFFFFF')
    y += 130

    pie = fuente('sans', 30 if es_story else 28)
    for linea in ['Todo con evidencia y fecha de revisión.',
                  'No intermediamos ni recaudamos: revisa el nivel de cada fuente.']:
        w = d.textlength(linea, font=pie)
        d.text(((ancho - w) / 2, y), linea, font=pie, fill=SUAVE)
        y += 42

    cred = fuente('sans', 26)
    linea = 'Creada por el profesor Santiago Jiménez Londoño · sjimenezlon.co'
    w = d.textlength(linea, font=cred)
    d.text(((ancho - w) / 2, alto - 70), linea, font=cred, fill='#7B8794')

    img.save(ruta, optimize=True)
    print('ok', ruta)

pieza(1080, 1920, 'difusion/instagram-story-limpia.png')
pieza(1080, 1350, 'difusion/instagram-post-limpio.png')
