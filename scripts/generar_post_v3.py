# Post IG v3 (1080x1350) — pensado para alcance: gancho imperativo, alto contraste
# (fondo azul profundo), lista útil de guardar/compartir y URL protagonista.
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

AZUL_OSC, PAPEL, ORO, AZUL, TINTA = '#16324F', '#FAF7F2', '#C8862A', '#1D5A8A', '#1F2933'
W, H = 1080, 1350

def fuente(nombre, tam):
    rutas = {'serif-b': '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
             'sans-b': '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
             'sans': '/System/Library/Fonts/Supplemental/Arial.ttf'}
    return ImageFont.truetype(rutas[nombre], tam)

img = Image.new('RGB', (W, H), AZUL_OSC)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 16], fill=ORO)
d.rectangle([0, H - 16, W, H], fill=ORO)

def centrado(texto, f, y, color):
    w = d.textlength(texto, font=f)
    d.text(((W - w) / 2, y), texto, font=f, fill=color)

# Gancho
centrado('TERREMOTO EN COLOMBIA', fuente('sans-b', 30), 70, ORO)
centrado('No dones', fuente('serif-b', 124), 130, PAPEL)
centrado('a ciegas.', fuente('serif-b', 124), 280, ORO)
centrado('Todo lo verificado para ayudar, en un solo lugar:', fuente('sans', 36), 460, '#C4D2DE')

# Lista útil (blanca, de guardar)
filas = [('💳', 'Canales oficiales de donación'),
         ('📦', 'Acopios en 13 ciudades'),
         ('🩸', 'Dónde donar sangre'),
         ('🛑', 'Cadenas falsas, desmentidas')]
y = 550
caja_x0, caja_x1 = 90, W - 90
for icono, texto in filas:
    d.rounded_rectangle([caja_x0, y, caja_x1, y + 96], radius=20, fill=PAPEL)
    d.ellipse([caja_x0 + 28, y + 26, caja_x0 + 72, y + 70], fill=AZUL_OSC)
    # icono como texto simple no-emoji: círculo azul con inicial dorada
    ini = {'💳': '$', '📦': 'A', '🩸': 'S', '🛑': '!'}[icono]
    f_ini = fuente('sans-b', 34)
    wi = d.textlength(ini, font=f_ini)
    d.text((caja_x0 + 50 - wi / 2, y + 28), ini, font=f_ini, fill=ORO)
    d.text((caja_x0 + 100, y + 24), texto, font=fuente('sans-b', 40), fill=TINTA)
    y += 116

# Credibilidad
centrado('97 datos verificados · 51 fuentes · con fecha de corte', fuente('sans', 32), y + 18, '#C4D2DE')

# URL gigante
f_url = fuente('sans-b', 56)
url = 'cuidarcolombia.vercel.app'
wu = d.textlength(url, font=f_url)
y_url = y + 92
d.rounded_rectangle([(W - wu) / 2 - 50, y_url, (W + wu) / 2 + 50, y_url + 112], radius=56, fill=PAPEL)
d.text(((W - wu) / 2, y_url + 24), url, font=f_url, fill=AZUL_OSC)

# CTA compartir
centrado('Guárdalo y compártelo: puede ayudar a alguien hoy.', fuente('sans-b', 34), y_url + 152, PAPEL)

img.save('difusion/instagram-post-v3.png', optimize=True)
print('post v3 listo')
