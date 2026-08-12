# Post IG cuadrado 1080x1080 — cartel editorial: Bodoni 72 + SignPainter + Avenir Next,
# papel con grano, subrayado a mano y URL como sello de caucho. Cero estética de plantilla.
import math
from PIL import Image, ImageDraw, ImageFont

PAPEL, TINTA, ORO, SELLO = '#F5EFE3', '#16324F', '#C8862A', '#A63D2F'
W = H = 1080

def F(nombre, tam):
    rutas = {
        'bodoni-b': ('/System/Library/Fonts/Supplemental/Bodoni 72.ttc', 2),
        'bodoni': ('/System/Library/Fonts/Supplemental/Bodoni 72.ttc', 0),
        'sign': ('/System/Library/Fonts/Supplemental/SignPainter.ttc', 0),
        'avenir-b': ('/System/Library/Fonts/Avenir Next.ttc', 0),
        'avenir': ('/System/Library/Fonts/Avenir Next.ttc', 5),
    }
    ruta, idx = rutas[nombre]
    return ImageFont.truetype(ruta, tam, index=idx)

img = Image.new('RGB', (W, H), PAPEL)

# Grano de papel sutil
grano = Image.effect_noise((W, H), 14).convert('L')
img = Image.composite(Image.new('RGB', (W, H), '#E9E0CE'), img, grano.point(lambda p: 12 if p > 128 else 0))
d = ImageDraw.Draw(img)

def centrado(texto, f, y, color):
    w = d.textlength(texto, font=f)
    d.text(((W - w) / 2, y), texto, font=f, fill=color)
    return w

# Kicker con filetes
fk = F('avenir-b', 26)
tk = 'TERREMOTO EN COLOMBIA · AGOSTO 2026'
wk = d.textlength(tk, font=fk)
xk = (W - wk) / 2
d.text((xk, 74), tk, font=fk, fill=SELLO)
d.rectangle([xk - 150, 88, xk - 28, 91], fill=ORO)
d.rectangle([xk + wk + 28, 88, xk + wk + 150, 91], fill=ORO)

# Titular Bodoni + acento pintado a mano
centrado('No dones', F('bodoni-b', 162), 108, TINTA)

acento = Image.new('RGBA', (760, 300), (0, 0, 0, 0))
da = ImageDraw.Draw(acento)
fs = F('sign', 190)
ws = da.textlength('a ciegas', font=fs)
da.text(((760 - ws) / 2, 20), 'a ciegas', font=fs, fill=ORO)
acento = acento.rotate(-3, expand=True, resample=Image.BICUBIC)
img.paste(acento, ((W - acento.width) // 2, 262), acento)
d = ImageDraw.Draw(img)

# Subrayado a mano (onda)
puntos = []
for i in range(0, 361, 8):
    x = 360 + i
    puntos.append((x, 532 + 6 * math.sin(i / 34.0)))
d.line(puntos, fill=SELLO, width=5, joint='curve')

# Lista tipográfica con chulos dibujados
lineas = ['Canales de donación con evidencia',
          'Acopios y sangre en 13 ciudades',
          'Mapa de las zonas afectadas',
          'Cadenas falsas, desmentidas']
fl = F('avenir', 39)
ancho_max = max(d.textlength(t, font=fl) for t in lineas)
x_chulo = (W - ancho_max - 66) / 2
y = 574
for t in lineas:
    d.line([(x_chulo, y + 26), (x_chulo + 13, y + 40), (x_chulo + 38, y + 6)], fill=ORO, width=7, joint='curve')
    d.text((x_chulo + 66, y), t, font=fl, fill=TINTA)
    y += 66

# Sello de caucho con la URL
sello = Image.new('RGBA', (860, 170), (0, 0, 0, 0))
ds = ImageDraw.Draw(sello)
fu = F('avenir-b', 52)
url = 'cuidarcolombia.vercel.app'
wu = ds.textlength(url, font=fu)
ds.rounded_rectangle([8, 18, 852, 152], radius=26, outline=SELLO, width=6)
ds.rounded_rectangle([20, 30, 840, 140], radius=18, outline=SELLO, width=2)
ds.text(((860 - wu) / 2, 50), url, font=fu, fill=SELLO)
sello = sello.rotate(-2.4, expand=True, resample=Image.BICUBIC)
img.paste(sello, ((W - sello.width) // 2, 918 - sello.height // 2), sello)
d = ImageDraw.Draw(img)

# Firma humana
fs2 = F('sign', 42)
centrado('la solidaridad también se verifica', fs2, 1002, TINTA)

img.save('difusion/instagram-post-editorial.png', optimize=True)
print('editorial listo')
