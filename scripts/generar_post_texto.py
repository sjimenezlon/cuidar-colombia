# Pieza única tipográfica (1080x1080): sin mapa ni ubicaciones — gancho, lista y la página.
# Paleta verde/crema/oro/coral; Bodoni + SignPainter + Avenir Next.
import math
from PIL import Image, ImageDraw, ImageFont

PAPEL, TINTA, AZUL, AZUL_OSC, ORO = '#FAF7F2', '#1F2933', '#1D5A8A', '#16324F', '#C8862A'
W = H = 1080

def F(nombre, tam):
    rutas = {
        'bodoni-b': ('/System/Library/Fonts/Supplemental/Bodoni 72.ttc', 2),
        'sign': ('/System/Library/Fonts/Supplemental/SignPainter.ttc', 0),
        'avenir-b': ('/System/Library/Fonts/Avenir Next.ttc', 0),
        'avenir': ('/System/Library/Fonts/Avenir Next.ttc', 5),
    }
    ruta, idx = rutas[nombre]
    return ImageFont.truetype(ruta, tam, index=idx)

img = Image.new('RGB', (W, H), PAPEL)
grano = Image.effect_noise((W, H), 13).convert('L')
img = Image.composite(Image.new('RGB', (W, H), '#E9E0CE'), img, grano.point(lambda p: 12 if p > 128 else 0))
d = ImageDraw.Draw(img)

def centrado(texto, f, y, color):
    w = d.textlength(texto, font=f)
    d.text(((W - w) / 2, y), texto, font=f, fill=color)

# Kicker con filetes
fk = F('avenir-b', 26)
tk = 'UNA GUÍA VERIFICADA PARA AYUDAR'
wk = d.textlength(tk, font=fk)
xk = (W - wk) / 2
d.text((xk, 78), tk, font=fk, fill=ORO)
d.rectangle([xk - 140, 92, xk - 28, 95], fill=ORO)
d.rectangle([xk + wk + 28, 92, xk + wk + 140, 95], fill=ORO)

# Gancho
centrado('¿Dónde donar?', F('bodoni-b', 144), 148, TINTA)

acento = Image.new('RGBA', (860, 220), (0, 0, 0, 0))
da = ImageDraw.Draw(acento)
fs = F('sign', 108)
ws = da.textlength('¿y cómo hacerlo bien?', font=fs)
da.text(((860 - ws) / 2, 20), '¿y cómo hacerlo bien?', font=fs, fill=AZUL)
acento = acento.rotate(-2.2, expand=True, resample=Image.BICUBIC)
img.paste(acento, ((W - acento.width) // 2, 348), acento)
d = ImageDraw.Draw(img)

# Subrayado a mano
puntos = []
for i in range(0, 361, 8):
    x = 360 + i
    puntos.append((x, 578 + 6 * math.sin(i / 34.0)))
d.line(puntos, fill=ORO, width=5, joint='curve')

# Lista con chulos dibujados
lineas = ['Canales oficiales de donación',
          'Mapa interactivo de acopios',
          'Dónde donar sangre',
          'Fuentes confiables, verificadas']
fl = F('avenir', 43)
ancho_max = max(d.textlength(t, font=fl) for t in lineas)
x_chulo = (W - ancho_max - 70) / 2
y = 626
for t in lineas:
    d.line([(x_chulo, y + 28), (x_chulo + 14, y + 43), (x_chulo + 41, y + 7)], fill=ORO, width=7, joint='curve')
    d.text((x_chulo + 70, y), t, font=fl, fill=TINTA)
    y += 76

# La página: píldora crema
f_url = F('avenir-b', 50)
url = 'cuidarcolombia.vercel.app'
wu = d.textlength(url, font=f_url)
pastilla = Image.new('RGBA', (int(wu) + 124, 126), (0, 0, 0, 0))
dp = ImageDraw.Draw(pastilla)
dp.rounded_rectangle([4, 4, pastilla.width - 4, 122], radius=60, fill=AZUL_OSC)
dp.text((62, 27), url, font=f_url, fill='#FFFFFF')
pastilla = pastilla.rotate(-1.6, expand=True, resample=Image.BICUBIC)
img.paste(pastilla, ((W - pastilla.width) // 2, 936), pastilla)
d = ImageDraw.Draw(img)

img.save('difusion/instagram-post-texto.png', optimize=True)
print('pieza tipográfica lista')
