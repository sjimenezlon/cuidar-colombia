# Frames del video de invitación (1080x1920): tarjetas de marca + capturas reales.
import sys
from PIL import Image, ImageDraw, ImageFont

PAPEL, TINTA, AZUL, AZUL_OSC, ORO, SUAVE = '#FAF7F2', '#1F2933', '#1D5A8A', '#16324F', '#C8862A', '#52606D'
W, H = 1080, 1920

def fuente(nombre, tam):
    rutas = {'serif-b': '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
             'sans-b': '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
             'sans': '/System/Library/Fonts/Supplemental/Arial.ttf'}
    return ImageFont.truetype(rutas[nombre], tam)

def base():
    img = Image.new('RGB', (W, H), PAPEL)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 22], fill=AZUL_OSC)
    d.rectangle([0, 22, W, 32], fill=ORO)
    d.rectangle([0, H - 22, W, H], fill=AZUL_OSC)
    return img, d

def centrado(d, texto, f, y, color):
    w = d.textlength(texto, font=f)
    d.text(((W - w) / 2, y), texto, font=f, fill=color)

def corazon(d, cx, cy, r, color):
    d.ellipse([cx - 2 * r, cy - r, cx, cy + r], fill=color)
    d.ellipse([cx, cy - r, cx + 2 * r, cy + r], fill=color)
    d.polygon([(cx - 2 * r + int(r * .16), cy + int(r * .55)), (cx + 2 * r - int(r * .16), cy + int(r * .55)), (cx, cy + int(2.6 * r))], fill=color)

# Frame 1 — título
img, d = base()
corazon(d, W // 2, 560, 60, AZUL)
centrado(d, 'Cuidar a', fuente('serif-b', 130), 760, TINTA)
centrado(d, 'Colombia', fuente('serif-b', 130), 910, AZUL)
centrado(d, 'Tras el terremoto,', fuente('sans', 48), 1120, SUAVE)
centrado(d, 'una sola página trazable', fuente('sans', 48), 1185, SUAVE)
centrado(d, 'para ayudar.', fuente('sans', 48), 1250, SUAVE)
img.save('difusion/f1.png')

# Frames 2-4 — capturas reales con leyenda
capturas = [
    (sys.argv[1], 'Canales de donación,', 'con evidencia y fecha.'),
    (sys.argv[2], 'Mapa en vivo: zonas afectadas,', 'acopios y sangre cerca de ti.'),
    (sys.argv[3], 'Verifica las cadenas falsas', 'antes de reenviarlas.'),
]
for i, (ruta, l1, l2) in enumerate(capturas, start=2):
    img, d = base()
    centrado(d, 'cuidarcolombia.vercel.app', fuente('sans-b', 40), 130, ORO)
    shot = Image.open(ruta).convert('RGB')
    ancho_obj = W - 120
    alto_obj = int(shot.height * ancho_obj / shot.width)
    shot = shot.resize((ancho_obj, alto_obj), Image.LANCZOS)
    marco = Image.new('RGB', (ancho_obj + 24, alto_obj + 24), '#FFFFFF')
    marco.paste(shot, (12, 12))
    y0 = 340
    img.paste(marco, ((W - marco.width) // 2, y0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([(W - marco.width) // 2, y0, (W + marco.width) // 2, y0 + marco.height], radius=4, outline='#E6DECF', width=3)
    centrado(d, l1, fuente('sans-b', 52), y0 + marco.height + 120, TINTA)
    centrado(d, l2, fuente('sans-b', 52), y0 + marco.height + 190, TINTA)
    img.save(f'difusion/f{i}.png')

# Frame 5 — llamado a la acción
img, d = base()
corazon(d, W // 2, 500, 52, ORO)
centrado(d, 'Entra, ayuda', fuente('serif-b', 110), 680, TINTA)
centrado(d, 'y comparte.', fuente('serif-b', 110), 815, TINTA)
f_url = fuente('sans-b', 58)
url = 'cuidarcolombia.vercel.app'
w = d.textlength(url, font=f_url)
d.rounded_rectangle([(W - w) / 2 - 50, 1030, (W + w) / 2 + 50, 1150], radius=60, fill=AZUL)
centrado(d, url, f_url, 1055, '#FFFFFF')
centrado(d, 'Todo trazable, con fuentes y fechas.', fuente('sans', 40), 1260, SUAVE)
centrado(d, 'La solidaridad también se verifica.', fuente('sans', 40), 1320, SUAVE)
centrado(d, 'Creada por el profesor Santiago Jiménez Londoño', fuente('sans', 30), 1760, '#7B8794')
img.save('difusion/f5.png')
print('frames listos')
