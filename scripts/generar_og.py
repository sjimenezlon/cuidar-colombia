from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
img = Image.new('RGB', (W, H), '#FAF7F2')
d = ImageDraw.Draw(img)

# banda superior azul oscuro
d.rectangle([0, 0, W, 14], fill='#16324F')
# banda dorada fina
d.rectangle([0, 14, W, 20], fill='#C8862A')

def fuente(ruta, tam):
    try:
        return ImageFont.truetype(ruta, tam)
    except Exception:
        return ImageFont.load_default()

f_titulo = fuente('/System/Library/Fonts/Supplemental/Georgia Bold.ttf', 92)
f_sub = fuente('/System/Library/Fonts/Supplemental/Arial.ttf', 34)
f_mini = fuente('/System/Library/Fonts/Supplemental/Arial.ttf', 26)

# corazón sencillo (dos círculos + triángulo)
cx, cy, r = 150, 250, 52
d.ellipse([cx - 2*r, cy - r, cx, cy + r], fill='#1D5A8A')
d.ellipse([cx, cy - r, cx + 2*r, cy + r], fill='#1D5A8A')
d.polygon([(cx - 2*r + 8, cy + r*0.55), (cx + 2*r - 8, cy + r*0.55), (cx, cy + 2.6*r)], fill='#1D5A8A')

d.text((300, 180), 'Cuidar a', font=f_titulo, fill='#1F2933')
d.text((300, 285), 'Colombia', font=f_titulo, fill='#1D5A8A')

d.text((150, 445), 'Información trazable para ayudar tras el terremoto', font=f_sub, fill='#52606D')
d.text((150, 500), 'Donación · acopios · sangre · fuentes y fecha de revisión', font=f_mini, fill='#7B8794')
d.text((150, 560), 'cuidarcolombia.vercel.app', font=f_mini, fill='#C8862A')

img.save('assets/og.png', optimize=True)
print('og.png listo')
