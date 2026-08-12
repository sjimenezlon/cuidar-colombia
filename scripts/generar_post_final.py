# LA pieza única de Instagram (1080x1080): gancho + mapa real de puntos + sello con URL.
import json, math
from PIL import Image, ImageDraw, ImageFont

PAPEL, TINTA, ORO, SELLO, GRIS = '#F5EFE3', '#16324F', '#C8862A', '#A63D2F', '#8A8272'
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
grano = Image.effect_noise((W, H), 14).convert('L')
img = Image.composite(Image.new('RGB', (W, H), '#E9E0CE'), img, grano.point(lambda p: 12 if p > 128 else 0))
d = ImageDraw.Draw(img)

def centrado(texto, f, y, color):
    w = d.textlength(texto, font=f)
    d.text(((W - w) / 2, y), texto, font=f, fill=color)

# Kicker con filetes
fk = F('avenir-b', 25)
tk = 'TERREMOTO EN COLOMBIA · AGOSTO 2026'
wk = d.textlength(tk, font=fk)
xk = (W - wk) / 2
d.text((xk, 58), tk, font=fk, fill=SELLO)
d.rectangle([xk - 140, 71, xk - 26, 74], fill=ORO)
d.rectangle([xk + wk + 26, 71, xk + wk + 140, 74], fill=ORO)

# Gancho: Bodoni + SignPainter en la misma línea visual
d.text((176, 96), 'No dones', font=F('bodoni-b', 128), fill=TINTA)
acento = Image.new('RGBA', (560, 200), (0, 0, 0, 0))
da = ImageDraw.Draw(acento)
fs = F('sign', 132)
ws = da.textlength('a ciegas', font=fs)
da.text(((560 - ws) / 2, 10), 'a ciegas', font=fs, fill=ORO)
acento = acento.rotate(-3, expand=True, resample=Image.BICUBIC)
img.paste(acento, (W - acento.width - 118, 218), acento)
d = ImageDraw.Draw(img)

centrado('Acopios, sangre y canales, con evidencia y en el mapa:', F('avenir', 31), 398, TINTA)

# ---- Mapa con los puntos reales ----
MX0, MY0, MX1, MY1 = 170, 470, 910, 830
LAT0, LAT1 = 2.6, 11.9
LON0, LON1 = -78.2, -72.6

def proyectar(lat, lon):
    x = MX0 + (lon - LON0) / (LON1 - LON0) * (MX1 - MX0)
    y = MY0 + (LAT1 - lat) / (LAT1 - LAT0) * (MY1 - MY0)
    return x, y

for i in range(1, 6):
    x = MX0 + i * (MX1 - MX0) / 6
    for yy in range(MY0, MY1, 18):
        d.line([(x, yy), (x, yy + 7)], fill='#DDD3BE', width=2)
for i in range(1, 4):
    yy = int(MY0 + i * (MY1 - MY0) / 4)
    for x in range(MX0, MX1, 18):
        d.line([(x, yy), (x + 7, yy)], fill='#DDD3BE', width=2)

geo = json.load(open('data/geo_puntos.json'))['puntos']

ex, ey = proyectar(4.8436, -76.2422)
for ang in range(0, 360, 45):
    r = 14 if ang % 90 == 0 else 7
    d.line([(ex, ey), (ex + r * math.cos(math.radians(ang)), ey + r * math.sin(math.radians(ang)))], fill=SELLO, width=4)
d.text((196, 630), 'epicentro', font=F('sign', 32), fill=SELLO)
d.line([(302, 664), (ex - 14, ey - 8)], fill=SELLO, width=2)

def pin(x, y, color, e=1.0):
    d.polygon([(x - 7 * e, y - 5 * e), (x + 7 * e, y - 5 * e), (x, y + 9 * e)], fill=color)
    d.ellipse([x - 8 * e, y - 19 * e, x + 8 * e, y - 3 * e], fill=color)
    d.ellipse([x - 3 * e, y - 14 * e, x + 3 * e, y - 8 * e], fill=PAPEL)

ciudades = {}
for p in geo:
    ciudades.setdefault(p['ciudad'], []).append(p)

ETIQ = {'Bogotá': (18, -16), 'Medellín': (20, -12), 'Cali': (20, 12), 'Barranquilla': (-200, 0),
        'Cartagena': (-158, -30), 'Bucaramanga': (-40, 14), 'Santa Marta': (14, -4), 'Montería': (16, 6),
        'Manizales': (-218, 48), 'Quibdó': (-92, -14), 'Ibagué': (14, 4), 'Villavicencio': (-70, 16),
        'Armenia': (-104, 8)}
fciu = F('avenir-b', 24)
for ciudad, puntos in ciudades.items():
    lat = sum(p['lat'] for p in puntos) / len(puntos)
    lon = sum(p['lon'] for p in puntos) / len(puntos)
    cx, cy = proyectar(lat, lon)
    n = len(puntos)
    for i, p in enumerate(puntos):
        if n == 1:
            px, py = cx, cy
        else:
            ang = 2 * math.pi * i / n
            radio = 12 + 3 * (n > 4)
            px, py = cx + radio * math.cos(ang), cy + radio * math.sin(ang)
        pin(px, py, SELLO if p['tipo'] == 'sangre' else TINTA, 0.9)
    dx, dy = ETIQ.get(ciudad, (12, -4))
    d.text((cx + dx, cy + dy), ciudad, font=fciu, fill=GRIS)

# Leyenda
fley = F('avenir', 26)
pin(196, 862, TINTA); d.text((216, 842), 'acopio', font=fley, fill=TINTA)
pin(360, 862, SELLO); d.text((380, 842), 'sangre', font=fley, fill=TINTA)
d.text((510, 842), '· todos con dirección y fuente', font=fley, fill=GRIS)

# Sello con URL
sello = Image.new('RGBA', (860, 148), (0, 0, 0, 0))
ds = ImageDraw.Draw(sello)
fu = F('avenir-b', 50)
url = 'cuidarcolombia.vercel.app'
wu = ds.textlength(url, font=fu)
ds.rounded_rectangle([8, 10, 852, 136], radius=24, outline=SELLO, width=6)
ds.rounded_rectangle([20, 22, 840, 124], radius=16, outline=SELLO, width=2)
ds.text(((860 - wu) / 2, 38), url, font=fu, fill=SELLO)
sello = sello.rotate(-2.2, expand=True, resample=Image.BICUBIC)
img.paste(sello, ((W - sello.width) // 2, 958 - sello.height // 2), sello)
d = ImageDraw.Draw(img)

centrado('la solidaridad también se verifica', F('sign', 38), 1014, TINTA)

img.save('difusion/instagram-post-final-unico.png', optimize=True)
print('pieza única lista')
