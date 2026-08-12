# Pieza única v2 — mapa limpio: pines al centro, ciudades en columnas laterales con
# líneas guía (cero colisiones). Paleta nueva: verde profundo, crema, oro y coral.
import json, math
from PIL import Image, ImageDraw, ImageFont

VERDE, CREMA, ORO, CORAL, GUIA = '#173F31', '#F3EDDF', '#D9A441', '#E4572E', '#4E7263'
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

img = Image.new('RGB', (W, H), VERDE)
grano = Image.effect_noise((W, H), 13).convert('L')
img = Image.composite(Image.new('RGB', (W, H), '#0F3226'), img, grano.point(lambda p: 14 if p > 128 else 0))
d = ImageDraw.Draw(img)

def centrado(texto, f, y, color):
    w = d.textlength(texto, font=f)
    d.text(((W - w) / 2, y), texto, font=f, fill=color)

# Kicker
fk = F('avenir-b', 25)
tk = 'TERREMOTO EN COLOMBIA · AGOSTO 2026'
wk = d.textlength(tk, font=fk)
xk = (W - wk) / 2
d.text((xk, 56), tk, font=fk, fill=ORO)
d.rectangle([xk - 130, 69, xk - 26, 72], fill=CORAL)
d.rectangle([xk + wk + 26, 69, xk + wk + 130, 72], fill=CORAL)

# Gancho
d.text((176, 94), 'No dones', font=F('bodoni-b', 124), fill=CREMA)
acento = Image.new('RGBA', (560, 200), (0, 0, 0, 0))
da = ImageDraw.Draw(acento)
fs = F('sign', 128)
ws = da.textlength('a ciegas', font=fs)
da.text(((560 - ws) / 2, 10), 'a ciegas', font=fs, fill=ORO)
acento = acento.rotate(-3, expand=True, resample=Image.BICUBIC)
img.paste(acento, (W - acento.width - 122, 212), acento)
d = ImageDraw.Draw(img)

centrado('Acopios, sangre y canales oficiales — verificados y en el mapa:', F('avenir', 30), 388, CREMA)

# ---- Mapa: pines al centro, etiquetas en columnas laterales ----
MX0, MY0, MX1, MY1 = 330, 460, 750, 850
LAT0, LAT1 = 2.6, 11.9
LON0, LON1 = -78.2, -72.6

def proyectar(lat, lon):
    x = MX0 + (lon - LON0) / (LON1 - LON0) * (MX1 - MX0)
    y = MY0 + (LAT1 - lat) / (LAT1 - LAT0) * (MY1 - MY0)
    return x, y

def pin(x, y, color, e=1.0):
    d.polygon([(x - 7 * e, y - 5 * e), (x + 7 * e, y - 5 * e), (x, y + 9 * e)], fill=color)
    d.ellipse([x - 8 * e, y - 19 * e, x + 8 * e, y - 3 * e], fill=color)
    d.ellipse([x - 3 * e, y - 14 * e, x + 3 * e, y - 8 * e], fill=VERDE)

geo = json.load(open('data/geo_puntos.json'))['puntos']
ciudades = {}
for p in geo:
    ciudades.setdefault(p['ciudad'], []).append(p)

# Epicentro
ex, ey = proyectar(4.8436, -76.2422)
for ang in range(0, 360, 45):
    r = 15 if ang % 90 == 0 else 7
    d.line([(ex, ey), (ex + r * math.cos(math.radians(ang)), ey + r * math.sin(math.radians(ang)))], fill=CORAL, width=4)

# Pines por ciudad y centroides
info = []
for ciudad, puntos in ciudades.items():
    lat = sum(p['lat'] for p in puntos) / len(puntos)
    lon = sum(p['lon'] for p in puntos) / len(puntos)
    cx, cy = proyectar(lat, lon)
    info.append({'ciudad': ciudad, 'cx': cx, 'cy': cy, 'n': len(puntos), 'puntos': puntos})

for c in info:
    n = c['n']
    for i, p in enumerate(c['puntos']):
        if n == 1:
            px, py = c['cx'], c['cy']
        else:
            ang = 2 * math.pi * i / n
            radio = 11 + 3 * (n > 4)
            px, py = c['cx'] + radio * math.cos(ang), c['cy'] + radio * math.sin(ang)
        pin(px, py, CORAL if p['tipo'] == 'sangre' else CREMA, 0.85)

# Columnas laterales con líneas guía
fciu = F('avenir-b', 27)
izquierda = sorted([c for c in info if c['cx'] < (MX0 + MX1) / 2], key=lambda c: c['cy'])
derecha = sorted([c for c in info if c['cx'] >= (MX0 + MX1) / 2], key=lambda c: c['cy'])

def columna(lista, lado):
    if not lista: return
    y0, y1 = MY0 - 10, MY1 + 10
    paso = (y1 - y0) / max(1, len(lista) - 1) if len(lista) > 1 else 0
    for i, c in enumerate(lista):
        ly = y0 + i * paso if len(lista) > 1 else (y0 + y1) / 2
        etiqueta = c['ciudad'] + ' (' + str(c['n']) + ')'
        wl = d.textlength(etiqueta, font=fciu)
        if lado == 'izq':
            lx = 210 - wl
            d.text((lx, ly - 16), etiqueta, font=fciu, fill=CREMA)
            d.line([(218, ly), (c['cx'] - 16, c['cy'])], fill=GUIA, width=2)
        else:
            lx = 1010 - wl
            d.text((lx, ly - 16), etiqueta, font=fciu, fill=CREMA)
            d.line([(lx - 10, ly), (c['cx'] + 16, c['cy'])], fill=GUIA, width=2)

columna(izquierda, 'izq')
columna(derecha, 'der')

# Leyenda
fley = F('avenir', 26)
pin(200, 906, CREMA); d.text((220, 886), 'acopio', font=fley, fill=CREMA)
pin(362, 906, CORAL); d.text((382, 886), 'sangre', font=fley, fill=CREMA)
for ang in range(0, 360, 45):
    r = 13 if ang % 90 == 0 else 6
    d.line([(524, 898), (524 + r * math.cos(math.radians(ang)), 898 + r * math.sin(math.radians(ang)))], fill=CORAL, width=3)
d.text((548, 886), 'epicentro', font=fley, fill=CREMA)
d.text((706, 886), '· 30 puntos verificados', font=fley, fill='#9DB8AA')

# URL en píldora crema sólida
f_url = F('avenir-b', 54)
url = 'cuidarcolombia.vercel.app'
wu = d.textlength(url, font=f_url)
pastilla = Image.new('RGBA', (int(wu) + 120, 122), (0, 0, 0, 0))
dp = ImageDraw.Draw(pastilla)
dp.rounded_rectangle([4, 4, pastilla.width - 4, 118], radius=58, fill=CREMA)
dp.text((60, 26), url, font=f_url, fill=VERDE)
pastilla = pastilla.rotate(-1.6, expand=True, resample=Image.BICUBIC)
img.paste(pastilla, ((W - pastilla.width) // 2, 950), pastilla)
d = ImageDraw.Draw(img)

img.save('difusion/instagram-post-limpio.png', optimize=True)
print('pieza limpia lista')
