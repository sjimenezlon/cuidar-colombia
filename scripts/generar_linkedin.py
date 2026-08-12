# Imagen para LinkedIn 1200x627 — enfoque profesional: tecnología cívica + cifras.
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

AZUL_OSC, PAPEL, ORO, TINTA = '#16324F', '#FAF7F2', '#C8862A', '#1F2933'
W, H = 1200, 627

def fuente(nombre, tam):
    rutas = {'serif-b': '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
             'sans-b': '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
             'sans': '/System/Library/Fonts/Supplemental/Arial.ttf'}
    return ImageFont.truetype(rutas[nombre], tam)

img = Image.new('RGB', (W, H), AZUL_OSC)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 12], fill=ORO)
d.rectangle([0, H - 12, W, H], fill=ORO)

d.text((70, 66), 'TECNOLOGÍA CÍVICA · TERREMOTO EN COLOMBIA', font=fuente('sans-b', 23), fill=ORO)
d.text((66, 122), 'La solidaridad', font=fuente('serif-b', 60), fill=PAPEL)
d.text((66, 198), 'también se verifica.', font=fuente('serif-b', 60), fill=ORO)

d.text((70, 316), '97 datos verificados · 51 fuentes ·', font=fuente('sans', 26), fill='#C4D2DE')
d.text((70, 354), 'georreferenciación y verificación diaria', font=fuente('sans', 26), fill='#C4D2DE')
d.text((70, 392), 'asistida por IA. Sin recaudar un peso.', font=fuente('sans', 26), fill='#C4D2DE')

f_url = fuente('sans-b', 33)
url = 'cuidarcolombia.vercel.app'
wu = d.textlength(url, font=f_url)
x0, y0 = 66, 470
d.rounded_rectangle([x0, y0, x0 + wu + 72, y0 + 64], radius=34, fill=PAPEL)
d.text((x0 + 36, y0 + 13), url, font=f_url, fill=AZUL_OSC)

# Captura real a la derecha
shot = Image.open(sys.argv[1]).convert('RGB')
ancho_obj = 420
alto_obj = int(shot.height * ancho_obj / shot.width)
shot = shot.resize((ancho_obj, alto_obj), Image.LANCZOS)
marco = Image.new('RGB', (ancho_obj + 22, alto_obj + 22), '#FFFFFF')
marco.paste(shot, (11, 11))
marco = marco.rotate(2.0, expand=True, resample=Image.BICUBIC, fillcolor=AZUL_OSC)
sombra = Image.new('RGBA', (marco.width + 60, marco.height + 60), (0, 0, 0, 0))
ds = ImageDraw.Draw(sombra)
ds.rounded_rectangle([30, 40, marco.width + 30, marco.height + 40], radius=10, fill=(0, 0, 0, 110))
sombra = sombra.filter(ImageFilter.GaussianBlur(15))
x, y = 738, (H - marco.height) // 2
img.paste(sombra, (x - 30, y - 30), sombra)
img.paste(marco, (x, y))

img.save('difusion/linkedin-post.png', optimize=True)
print('linkedin listo')
