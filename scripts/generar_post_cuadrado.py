# Post IG cuadrado clásico 1080x1080 — mismo sistema del v3, compuesto para el cuadrado.
from PIL import Image, ImageDraw, ImageFont

AZUL_OSC, PAPEL, ORO, TINTA = '#16324F', '#FAF7F2', '#C8862A', '#1F2933'
W = H = 1080

def fuente(nombre, tam):
    rutas = {'serif-b': '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
             'sans-b': '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
             'sans': '/System/Library/Fonts/Supplemental/Arial.ttf'}
    return ImageFont.truetype(rutas[nombre], tam)

img = Image.new('RGB', (W, H), AZUL_OSC)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 14], fill=ORO)
d.rectangle([0, H - 14, W, H], fill=ORO)

def centrado(texto, f, y, color):
    w = d.textlength(texto, font=f)
    d.text(((W - w) / 2, y), texto, font=f, fill=color)

centrado('TERREMOTO EN COLOMBIA', fuente('sans-b', 27), 52, ORO)
centrado('No dones a ciegas.', fuente('serif-b', 92), 100, PAPEL)
centrado('Todo lo verificado para ayudar, en un solo lugar:', fuente('sans', 33), 232, '#C4D2DE')

filas = [('$', 'Canales oficiales de donación'),
         ('A', 'Acopios en 13 ciudades'),
         ('S', 'Dónde donar sangre'),
         ('!', 'Cadenas falsas, desmentidas')]
y = 316
caja_x0, caja_x1 = 90, W - 90
for ini, texto in filas:
    d.rounded_rectangle([caja_x0, y, caja_x1, y + 86], radius=18, fill=PAPEL)
    d.ellipse([caja_x0 + 26, y + 22, caja_x0 + 68, y + 64], fill=AZUL_OSC)
    f_ini = fuente('sans-b', 30)
    wi = d.textlength(ini, font=f_ini)
    d.text((caja_x0 + 47 - wi / 2, y + 25), ini, font=f_ini, fill=ORO)
    d.text((caja_x0 + 94, y + 21), texto, font=fuente('sans-b', 37), fill=TINTA)
    y += 104

centrado('97 datos verificados · 51 fuentes · con fecha de corte', fuente('sans', 29), y + 12, '#C4D2DE')

f_url = fuente('sans-b', 52)
url = 'cuidarcolombia.vercel.app'
wu = d.textlength(url, font=f_url)
y_url = y + 74
d.rounded_rectangle([(W - wu) / 2 - 46, y_url, (W + wu) / 2 + 46, y_url + 100], radius=50, fill=PAPEL)
d.text(((W - wu) / 2, y_url + 20), url, font=f_url, fill=AZUL_OSC)

centrado('Guárdalo y compártelo: puede ayudar a alguien hoy.', fuente('sans-b', 31), y_url + 138, PAPEL)

img.save('difusion/instagram-post-cuadrado.png', optimize=True)
print('cuadrado listo')
