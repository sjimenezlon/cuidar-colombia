# Difusión v2 — menos plantilla, más producto real: capturas de la plataforma,
# cifras reales del contador y la URL protagonista en todas las piezas.
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PAPEL, TINTA, AZUL, AZUL_OSC, ORO, SUAVE, BORDE = '#FAF7F2', '#1F2933', '#1D5A8A', '#16324F', '#C8862A', '#52606D', '#E6DECF'
URL = 'cuidarcolombia.vercel.app'
STATS = [('97', 'datos verificados'), ('51', 'fuentes consultadas'), ('13', 'municipios monitoreados')]

def fuente(nombre, tam):
    rutas = {'serif-b': '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
             'serif-i': '/System/Library/Fonts/Supplemental/Georgia Italic.ttf',
             'sans-b': '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
             'sans': '/System/Library/Fonts/Supplemental/Arial.ttf'}
    return ImageFont.truetype(rutas[nombre], tam)

def lienzo(w, h):
    img = Image.new('RGB', (w, h), PAPEL)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 18], fill=AZUL_OSC)
    d.rectangle([0, 18, w, 27], fill=ORO)
    d.rectangle([0, h - 18, w, h], fill=AZUL_OSC)
    return img, d

def centrado(d, texto, f, y, color, w):
    ancho = d.textlength(texto, font=f)
    d.text(((w - ancho) / 2, y), texto, font=f, fill=color)
    return ancho

def kicker(d, w, y, texto='TERREMOTO EN COLOMBIA · M 7,4 · 10 DE AGOSTO'):
    f = fuente('sans-b', 30)
    espaciado = ' '.join(texto)  # tracking manual
    centrado(d, texto, f, y, ORO, w)

def barra_url(img, d, w, y, escala=1.0):
    f = fuente('sans-b', int(58 * escala))
    ancho = d.textlength(URL, font=f)
    x0, x1 = (w - ancho) / 2 - 54, (w + ancho) / 2 + 54
    d.rounded_rectangle([x0, y, x1, y + int(118 * escala)], radius=int(60 * escala), fill=AZUL_OSC)
    d.rounded_rectangle([x0, y, x1, y + int(118 * escala)], radius=int(60 * escala), outline=ORO, width=4)
    d.text(((w - ancho) / 2, y + int(26 * escala)), URL, font=f, fill='#FFFFFF')

def tarjeta_captura(img, ruta, w, y, ancho_obj, angulo=1.6):
    shot = Image.open(ruta).convert('RGB')
    alto_obj = int(shot.height * ancho_obj / shot.width)
    shot = shot.resize((ancho_obj, alto_obj), Image.LANCZOS)
    marco = Image.new('RGB', (ancho_obj + 28, alto_obj + 28), '#FFFFFF')
    marco.paste(shot, (14, 14))
    marco = marco.rotate(angulo, expand=True, fillcolor=None, resample=Image.BICUBIC)
    # sombra suave
    sombra = Image.new('RGBA', (marco.width + 60, marco.height + 60), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sombra)
    ds.rounded_rectangle([30, 38, marco.width + 30, marco.height + 38], radius=10, fill=(31, 41, 51, 70))
    sombra = sombra.filter(ImageFilter.GaussianBlur(16))
    x = (w - marco.width) // 2
    img.paste(sombra, (x - 30, y - 30), sombra)
    mascara = Image.new('L', marco.size, 0)
    dm = ImageDraw.Draw(mascara)
    dm.polygon([(0, 0), (marco.width, 0), (marco.width, marco.height), (0, marco.height)], fill=255)
    img.paste(marco, (x, y))
    return y + marco.height

def fila_stats(d, w, y, escala=1.0):
    f_num = fuente('serif-b', int(84 * escala))
    f_lab = fuente('sans', int(30 * escala))
    ancho_col = w // 3
    for i, (num, lab) in enumerate(STATS):
        cx = ancho_col * i + ancho_col // 2
        wn = d.textlength(num, font=f_num)
        d.text((cx - wn / 2, y), num, font=f_num, fill=ORO)
        wl = d.textlength(lab, font=f_lab)
        d.text((cx - wl / 2, y + int(104 * escala)), lab, font=f_lab, fill=SUAVE)

CAP_HERO, CAP_MAPA, CAP_VERI = sys.argv[1], sys.argv[2], sys.argv[3]

# ---------- STORY 1080x1920 ----------
img, d = lienzo(1080, 1920)
kicker(d, 1080, 90)
centrado(d, '¿Quieres ayudar?', fuente('serif-b', 108), 170, TINTA, 1080)
centrado(d, 'Hazlo seguro.', fuente('serif-b', 108), 300, AZUL, 1080)
d.rectangle([440, 452, 640, 458], fill=ORO)
centrado(d, 'Una sola página con todo lo verificado', fuente('sans', 40), 500, SUAVE, 1080)
centrado(d, 'para ayudar tras el terremoto.', fuente('sans', 40), 556, SUAVE, 1080)
fin = tarjeta_captura(img, CAP_HERO, 1080, 660, 900)
d = ImageDraw.Draw(img)
fila_stats(d, 1080, fin + 60)
barra_url(img, d, 1080, fin + 280)
centrado(d, 'Dona · Acopia · Dona sangre · Verifica cadenas', fuente('sans-b', 34), fin + 450, TINTA, 1080)
centrado(d, 'No intermediamos: cada enlace va directo al canal oficial.', fuente('sans', 28), fin + 510, SUAVE, 1080)
centrado(d, 'Creada por el profesor Santiago Jiménez Londoño', fuente('sans', 26), 1840, '#7B8794', 1080)
img.save('difusion/instagram-story-final.png', optimize=True)

# ---------- POST 1080x1350 ----------
img, d = lienzo(1080, 1350)
kicker(d, 1080, 60)
centrado(d, '¿Quieres ayudar?', fuente('serif-b', 76), 112, TINTA, 1080)
centrado(d, 'Hazlo seguro.', fuente('serif-b', 76), 204, AZUL, 1080)
d.rectangle([440, 312, 640, 318], fill=ORO)
centrado(d, 'Canales oficiales · acopios · sangre · cadenas falsas', fuente('sans', 33), 344, SUAVE, 1080)
fin = tarjeta_captura(img, CAP_HERO, 1080, 424, 830)
d = ImageDraw.Draw(img)
fila_stats(d, 1080, fin + 40, 0.8)
barra_url(img, d, 1080, fin + 208, 0.92)
centrado(d, 'Todo con fuente y fecha de verificación.', fuente('sans', 28), fin + 344, SUAVE, 1080)
img.save('difusion/instagram-post-final.png', optimize=True)

# ---------- FRAMES DE VIDEO 1080x1920 ----------
Y_URL = 1600

def frame_base():
    img, d = lienzo(1080, 1920)
    return img, d

def guardar(img, d, n):
    barra_url(img, d, 1080, Y_URL)
    img.save(f'difusion/v2_f{n}.png')

img, d = frame_base()
kicker(d, 1080, 300)
centrado(d, '¿Quieres', fuente('serif-b', 150), 430, TINTA, 1080)
centrado(d, 'ayudar?', fuente('serif-b', 150), 610, TINTA, 1080)
centrado(d, 'Hazlo seguro.', fuente('serif-b', 150), 790, AZUL, 1080)
d.rectangle([440, 1030, 640, 1038], fill=ORO)
centrado(d, 'Una sola página, verificada,', fuente('sans', 46), 1090, SUAVE, 1080)
centrado(d, 'para ayudar tras el terremoto.', fuente('sans', 46), 1155, SUAVE, 1080)
guardar(img, d, 1)

img, d = frame_base()
kicker(d, 1080, 380, 'CUIDAR A COLOMBIA')
centrado(d, 'Todo en un solo lugar,', fuente('serif-b', 84), 500, TINTA, 1080)
centrado(d, 'verificado.', fuente('serif-b', 84), 610, AZUL, 1080)
fila_stats(d, 1080, 850, 1.1)
centrado(d, 'Cada dato con su fuente y su fecha.', fuente('sans', 42), 1180, SUAVE, 1080)
guardar(img, d, 2)

for n, (cap, l1, l2) in [(3, (CAP_HERO, 'Canales oficiales de donación,', 'verificados uno a uno.')),
                          (4, (CAP_MAPA, 'Mapa: zonas afectadas, acopios', 'y sangre cerca de ti.')),
                          (5, (CAP_VERI, 'Detecta las cadenas falsas', 'antes de reenviarlas.'))]:
    img, d = frame_base()
    kicker(d, 1080, 170, 'CUIDAR A COLOMBIA')
    fin = tarjeta_captura(img, cap, 1080, 280, 920)
    d = ImageDraw.Draw(img)
    centrado(d, l1, fuente('sans-b', 54), fin + 120, TINTA, 1080)
    centrado(d, l2, fuente('sans-b', 54), fin + 195, TINTA, 1080)
    guardar(img, d, n)

img, d = frame_base()
kicker(d, 1080, 420, 'LA SOLIDARIDAD TAMBIÉN SE VERIFICA')
centrado(d, 'Entra, ayuda', fuente('serif-b', 130), 540, TINTA, 1080)
centrado(d, 'y comparte.', fuente('serif-b', 130), 700, AZUL, 1080)
d.rectangle([440, 920, 640, 928], fill=ORO)
fila_stats(d, 1080, 1010, 0.88)
centrado(d, 'Creada por el profesor Santiago Jiménez Londoño', fuente('sans', 30), 1820, '#7B8794', 1080)
guardar(img, d, 6)
print('piezas v2 listas')
