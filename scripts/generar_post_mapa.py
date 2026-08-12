# Post IG 1080x1080 «¿Dónde ayudar? cerca de ti» — mapa dibujado con los puntos REALES
# de data/geo_puntos.json, en la estética editorial propia (Bodoni + SignPainter + sello).
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

# Titular
centrado('¿Dónde ayudar?', F('bodoni-b', 120), 52, TINTA)

acento = Image.new('RGBA', (700, 220), (0, 0, 0, 0))
da = ImageDraw.Draw(acento)
fs = F('sign', 120)
ws = da.textlength('cerca de ti', font=fs)
da.text(((700 - ws) / 2, 10), 'cerca de ti', font=fs, fill=ORO)
acento = acento.rotate(-2.5, expand=True, resample=Image.BICUBIC)
img.paste(acento, ((W - acento.width) // 2, 178), acento)
d = ImageDraw.Draw(img)

# ---- Mapa con los puntos reales ----
MX0, MY0, MX1, MY1 = 150, 350, 930, 820
LAT0, LAT1 = 2.6, 11.9      # sur, norte
LON0, LON1 = -78.2, -72.6   # oeste, este

def proyectar(lat, lon):
    x = MX0 + (lon - LON0) / (LON1 - LON0) * (MX1 - MX0)
    y = MY0 + (LAT1 - lat) / (LAT1 - LAT0) * (MY1 - MY0)
    return x, y

# Graticule punteado sutil
for i in range(1, 6):
    x = MX0 + i * (MX1 - MX0) / 6
    for yy in range(MY0, MY1, 18):
        d.line([(x, yy), (x, yy + 7)], fill='#DDD3BE', width=2)
for i in range(1, 4):
    yy = MY0 + i * (MY1 - MY0) / 4
    for x in range(MX0, MX1, 18):
        d.line([(x, yy), (x + 7, yy)], fill='#DDD3BE', width=2)

geo = json.load(open('data/geo_puntos.json'))['puntos']

# Epicentro: estrella
ex, ey = proyectar(4.8436, -76.2422)
for ang in range(0, 360, 45):
    r = 16 if ang % 90 == 0 else 8
    d.line([(ex, ey), (ex + r * math.cos(math.radians(ang)), ey + r * math.sin(math.radians(ang)))], fill=SELLO, width=4)
fes = F('sign', 34)
d.text((ex - 150, ey + 8), 'epicentro', font=fes, fill=SELLO)

def pin(x, y, color):
    d.polygon([(x - 8, y - 6), (x + 8, y - 6), (x, y + 10)], fill=color)
    d.ellipse([x - 9, y - 22, x + 9, y - 4], fill=color)
    d.ellipse([x - 3.5, y - 16.5, x + 3.5, y - 9.5], fill=PAPEL)

# Ciudades: etiqueta una vez, pines por punto (con leve dispersión angular por ciudad)
ciudades = {}
for p in geo:
    ciudades.setdefault(p['ciudad'], []).append(p)

ETIQ = {'Bogotá': (20, -18), 'Medellín': (22, -12), 'Cali': (18, 4), 'Barranquilla': (-192, -10),
        'Cartagena': (-140, 12), 'Bucaramanga': (18, -8), 'Santa Marta': (16, -4), 'Montería': (-122, -10),
        'Manizales': (-178, 16), 'Quibdó': (-104, -14), 'Ibagué': (16, 6), 'Villavicencio': (18, 16),
        'Armenia': (-118, 8), 'Pereira': (-116, 26)}
fciu = F('avenir-b', 26)
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
            radio = 14 + 4 * (n > 4)
            px, py = cx + radio * math.cos(ang), cy + radio * math.sin(ang)
        pin(px, py, SELLO if p['tipo'] == 'sangre' else TINTA)
    dx, dy = ETIQ.get(ciudad, (14, -4))
    d.text((cx + dx, cy + dy), ciudad, font=fciu, fill=GRIS)

# Leyenda mínima
fley = F('avenir', 27)
lx = 150
pin(lx + 8, 872, TINTA); d.text((lx + 30, 850), 'acopio', font=fley, fill=TINTA)
pin(lx + 190, 872, SELLO); d.text((lx + 212, 850), 'sangre', font=fley, fill=TINTA)
d.text((lx + 350, 850), '· todos con dirección y fuente', font=fley, fill=GRIS)

# Sello con la URL + CTA
sello = Image.new('RGBA', (860, 150), (0, 0, 0, 0))
ds = ImageDraw.Draw(sello)
fu = F('avenir-b', 50)
url = 'cuidarcolombia.vercel.app'
wu = ds.textlength(url, font=fu)
ds.rounded_rectangle([8, 12, 852, 138], radius=24, outline=SELLO, width=6)
ds.rounded_rectangle([20, 24, 840, 126], radius=16, outline=SELLO, width=2)
ds.text(((860 - wu) / 2, 40), url, font=fu, fill=SELLO)
sello = sello.rotate(-2.2, expand=True, resample=Image.BICUBIC)
img.paste(sello, ((W - sello.width) // 2, 962 - sello.height // 2), sello)
d = ImageDraw.Draw(img)
centrado('toca «Cerca de mí» y el mapa te lleva', F('sign', 40), 1018, TINTA)

img.save('difusion/instagram-post-mapa.png', optimize=True)
print('mapa listo')
