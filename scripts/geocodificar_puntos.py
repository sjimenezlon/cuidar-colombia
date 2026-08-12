# Geocodifica los puntos de acopio y sangre VERIFICADOS (direcciones ya publicadas
# por fuentes oficiales) usando Nominatim, validando que el resultado caiga a menos
# de 30 km del centro de su ciudad. Un punto que no geocodifica bien queda sin
# coordenadas: aparece en la lista textual pero no en el mapa.
import json, time, math, subprocess, urllib.parse

CENTROS = {
    "Bogotá": (4.711, -74.072), "Medellín": (6.244, -75.581), "Cali": (3.452, -76.532),
    "Pereira": (4.813, -75.696), "Manizales": (5.07, -75.514), "Armenia": (4.534, -75.681),
    "Quibdó": (5.695, -76.661), "Barranquilla": (10.964, -74.797), "Bucaramanga": (7.119, -73.123),
    "Cartagena": (10.391, -75.479), "Ibagué": (4.439, -75.232), "Santa Marta": (11.24, -74.199),
    "Montería": (8.748, -75.881), "Villavicencio": (4.142, -73.627),
}

# Overrides revisados manualmente. `None` excluye del mapa una dirección que
# Nominatim ubica en una vía homónima pero que todavía no tiene un pin confirmado.
COORDENADAS_REVISADAS = {
    ("acopio", "Bogotá", "Cruz Roja — sede administrativa"): None,
    ("sangre", "Medellín", "Cruz Roja — donación de sangre"): {
        "lat": 6.22830,
        "lon": -75.57713,
        "coordenadas_fuente": "https://maps.app.goo.gl/TWybfCdMBJ8N8ysd7",
    },
}

# (tipo, ciudad, nombre, consulta_nominatim, direccion_publicada)
PUNTOS = [
    ("acopio", "Bogotá", "Universidad Jorge Tadeo Lozano", "Carrera 4 22-61, Bogotá", "Carrera 4 #22-61"),
    ("acopio", "Bogotá", "Punto Usaquén", "Calle 161A 7F-55, Bogotá", "Calle 161A #7F-55"),
    ("acopio", "Bogotá", "Centro Comercial Unicentro", "Unicentro, Bogotá", "Carrera 15 #124-30"),
    ("acopio", "Bogotá", "Estadio El Campín", "Estadio El Campín, Bogotá", "Av. NQS entre calles 53B Bis y 57"),
    ("acopio", "Bogotá", "Cruz Roja — sede administrativa", "Carrera 24 73-38, Bogotá", "Carrera 24 #73-38"),
    ("acopio", "Medellín", "Banco Arquidiocesano de Alimentos", "Carrera 52 30A-97, Medellín", "Carrera 52 #30A-97"),
    ("acopio", "Medellín", "Fundación Saciar", "Carrera 50 25-261, Medellín", "Carrera 50 #25-261"),
    ("acopio", "Medellín", "Alcaldía de Medellín", "Alcaldía de Medellín", "Hall principal"),
    ("acopio", "Medellín", "Terminal del Norte", "Terminal del Norte, Medellín", "Local 9840"),
    ("acopio", "Medellín", "Universidad EAFIT", "Universidad EAFIT, Medellín", "Placa cubierta"),
    ("acopio", "Cali", "Plazoleta Jairo Varela", "Plazoleta Jairo Varela, Cali", None),
    ("acopio", "Cali", "Escuela Nacional del Deporte", "Escuela Nacional del Deporte, Cali", None),
    ("acopio", "Cali", "Unidad Deportiva Alberto Galindo", "Unidad Deportiva Alberto Galindo, Cali", "Ciudadela Petronio"),
    ("acopio", "Cali", "Banco de Alimentos de Cali", "Calle 24 6-103, Cali", "Calle 24 #6-103"),
    ("acopio", "Manizales", "Coliseo Menor de Manizales", "Coliseo Menor, Manizales", None),
    ("acopio", "Quibdó", "Acopio Los Ángeles — San Gabriel", "Calle 27A 23-44, Quibdó", "Calle 27A #23-44"),
    ("acopio", "Barranquilla", "Centro de acopio Barranquillita", "Carrera 43 6-120, Barranquilla", "Carrera 43 #6-120"),
    ("acopio", "Bucaramanga", "Alcaldía de Bucaramanga", "Alcaldía de Bucaramanga", "Primer piso"),
    ("acopio", "Bucaramanga", "Idesan", "Calle 48 27A-48, Bucaramanga", "Calle 48 #27A-48, Sotomayor"),
    ("acopio", "Bucaramanga", "Lotería de Santander", "Calle 36 carrera 21, Bucaramanga", "Calle 36 con carrera 21"),
    ("acopio", "Bucaramanga", "Banco de Alimentos", "Carrera 20 11-46, Bucaramanga", "Carrera 20 #11-46, San Francisco"),
    ("acopio", "Cartagena", "Coliseo Bernardo Caraballo", "Coliseo Bernardo Caraballo, Cartagena", None),
    ("acopio", "Ibagué", "Centro Comercial Multicentro", "Multicentro, Ibagué", None),
    ("acopio", "Santa Marta", "Sede Ogricc — El Cundí", "Calle 16 14A-08, Santa Marta", "Calle 16 #14A-08"),
    ("acopio", "Montería", "Coliseo Miguel Happy Lora", "Coliseo Happy Lora, Montería", None),
    ("sangre", "Bogotá", "IDCBIS — Banco Distrital de Sangre", "Carrera 32 12-81, Bogotá", "Carrera 32 #12-81"),
    ("sangre", "Bogotá", "Cruz Roja — donación de sangre", "Avenida Carrera 68 68B-31, Bogotá", "Av. Carrera 68 #68B-31"),
    ("sangre", "Medellín", "Cruz Roja — donación de sangre", "Carrera 52 25-310, Medellín", "Carrera 52 #25-310"),
    ("sangre", "Cali", "Banco Regional Cruz Roja", "Carrera 38 Bis 5-91, Cali", "Cra. 38 Bis #5-91, San Fernando"),
    ("sangre", "Cali", "Hospital Universitario del Valle", "Hospital Universitario del Valle, Cali", "Calle 5 #36-08"),
    ("sangre", "Cali", "Fundación Valle del Lili", "Fundación Valle del Lili, Cali", "Torre 2, piso 4"),
    ("sangre", "Manizales", "Jornada Palogrande (Cruz Roja)", "Estadio Palogrande, Manizales", "Cancha auxiliar de Palogrande"),
    ("sangre", "Armenia", "Cruz Roja — Banco Regional", "Avenida Bolívar 23 Norte-60, Armenia", "Av. Bolívar #23 Norte-60"),
    ("sangre", "Cartagena", "Cruz Roja — donación de sangre", "Calle 30 44D-71, Cartagena", "Calle 30 #44D-71"),
    ("sangre", "Villavicencio", "Cruz Roja — donación de sangre", "Carrera 30 39-30, Villavicencio", "Carrera 30 #39-30"),
    ("sangre", "Barranquilla", "Institución Universitaria de Barranquilla", "Institución Universitaria de Barranquilla", "Cra. 45 #40-22"),
]

def distancia_km(a, b):
    dlat = math.radians(a[0] - b[0]); dlon = math.radians(a[1] - b[1])
    x = math.sin(dlat/2)**2 + math.cos(math.radians(a[0]))*math.cos(math.radians(b[0]))*math.sin(dlon/2)**2
    return 6371 * 2 * math.asin(math.sqrt(x))

resultado, sin_geo = [], []
for tipo, ciudad, nombre, consulta, direccion in PUNTOS:
    clave = (tipo, ciudad, nombre)
    if clave in COORDENADAS_REVISADAS:
        coordenadas = COORDENADAS_REVISADAS[clave]
        if coordenadas is None:
            sin_geo.append(f"{ciudad} — {nombre}")
            print(f"SIN   {ciudad:14} {nombre} (requiere revisión manual)")
            continue
        lat, lon = coordenadas["lat"], coordenadas["lon"]
        resultado.append({"tipo": tipo, "ciudad": ciudad, "nombre": nombre, "direccion": direccion,
                          "lat": lat, "lon": lon, "coordenadas_fuente": coordenadas["coordenadas_fuente"]})
        print(f"OK*   {ciudad:14} {nombre[:44]:46} {lat:.4f},{lon:.4f}")
        continue
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": consulta + ", Colombia", "format": "json", "limit": 1, "countrycodes": "co"})
    lat = lon = None
    try:
        salida = subprocess.run(
            ["curl", "-s", "--max-time", "15",
             "-H", "User-Agent: CuidarColombia/1.0 (plataforma humanitaria; sjimenezlon@gmail.com)", url],
            capture_output=True, text=True, check=True).stdout
        hits = json.loads(salida)
        if hits:
            lat, lon = float(hits[0]["lat"]), float(hits[0]["lon"])
            if distancia_km((lat, lon), CENTROS[ciudad]) > 30:
                lat = lon = None  # geocodificó en otra parte: descartar
    except Exception as e:
        print("error", nombre, e)
    if lat:
        resultado.append({"tipo": tipo, "ciudad": ciudad, "nombre": nombre, "direccion": direccion, "lat": round(lat, 5), "lon": round(lon, 5)})
        print(f"OK    {ciudad:14} {nombre[:44]:46} {lat:.4f},{lon:.4f}")
    else:
        sin_geo.append(f"{ciudad} — {nombre}")
        print(f"SIN   {ciudad:14} {nombre}")
    time.sleep(1.2)

with open("data/geo_puntos.json", "w") as f:
    json.dump({"puntos": resultado}, f, ensure_ascii=False, indent=1)
print(f"\n{len(resultado)} geocodificados, {len(sin_geo)} sin coordenadas: {sin_geo}")
