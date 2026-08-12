# Portada horizontal 1200x675 (16:9) para el boletín en Al Poniente.
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PAPEL, TINTA, AZUL, AZUL_OSC, ORO, SUAVE = '#FAF7F2', '#1F2933', '#1D5A8A', '#16324F', '#C8862A', '#52606D'
W, H = 1200, 675

def fuente(nombre, tam):
    rutas = {'serif-b': '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
             'sans-b': '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
             'sans': '/System/Library/Fonts/Supplemental/Arial.ttf'}
    return ImageFont.truetype(rutas[nombre], tam)

img = Image.new('RGB', (W, H), PAPEL)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 14], fill=AZUL_OSC)
d.rectangle([0, 14, W, 21], fill=ORO)
d.rectangle([0, H - 14, W, H], fill=AZUL_OSC)

# Columna izquierda: titular
d.text((70, 92), 'TERREMOTO EN COLOMBIA · M 7,4', font=fuente('sans-b', 25), fill=ORO)
d.text((66, 155), '¿Cómo donar', font=fuente('serif-b', 76), fill=TINTA)
d.text((66, 250), 'seguro?', font=fuente('serif-b', 76), fill=AZUL)
d.rectangle([70, 390, 240, 396], fill=ORO)
d.text((70, 424), 'Canales oficiales, acopios, sangre y', font=fuente('sans', 29), fill=SUAVE)
d.text((70, 464), 'cadenas falsas: todo trazable,', font=fuente('sans', 29), fill=SUAVE)
d.text((70, 504), 'con evidencia y fecha de revisión.', font=fuente('sans', 29), fill=SUAVE)

# Píldora con la URL
f_url = fuente('sans-b', 34)
url = 'cuidarcolombia.vercel.app'
ancho = d.textlength(url, font=f_url)
x0, y0 = 66, 566
d.rounded_rectangle([x0, y0, x0 + ancho + 76, y0 + 66], radius=36, fill=AZUL_OSC)
d.rounded_rectangle([x0, y0, x0 + ancho + 76, y0 + 66], radius=36, outline=ORO, width=3)
d.text((x0 + 38, y0 + 14), url, font=f_url, fill='#FFFFFF')

# Columna derecha: captura real inclinada con sombra
shot = Image.open(sys.argv[1]).convert('RGB')
ancho_obj = 500
alto_obj = int(shot.height * ancho_obj / shot.width)
shot = shot.resize((ancho_obj, alto_obj), Image.LANCZOS)
marco = Image.new('RGB', (ancho_obj + 24, alto_obj + 24), '#FFFFFF')
marco.paste(shot, (12, 12))
marco = marco.rotate(2.2, expand=True, resample=Image.BICUBIC, fillcolor='#FAF7F2')
sombra = Image.new('RGBA', (marco.width + 60, marco.height + 60), (0, 0, 0, 0))
ds = ImageDraw.Draw(sombra)
ds.rounded_rectangle([30, 40, marco.width + 30, marco.height + 40], radius=10, fill=(31, 41, 51, 75))
sombra = sombra.filter(ImageFilter.GaussianBlur(15))
x, y = 648, (H - marco.height) // 2 + 8
img.paste(sombra, (x - 30, y - 30), sombra)
img.paste(marco, (x, y))

img.save('difusion/alponiente-portada.png', optimize=True)
print('portada lista')
