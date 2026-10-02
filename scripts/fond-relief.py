"""Assemble le fond relief de la carte météo (public/geo/fond-relief.jpg) depuis les tuiles NASA GIBS
(Blue Marble, Shaded Relief + Bathymetry, domaine public, crédit « NASA »).

Usage : python scripts/fond-relief.py public/geo/fond-relief.jpg   (nécessite Pillow)
Le script affiche l'origine et la taille en pixels monde z7 : à reporter dans FOND
(src/lib/carte-meteo/projection-france.ts) si l'emprise change.
"""
import math, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

Z = 7
N = 2 ** Z
LON_MIN, LON_MAX = -16.0, 20.0
LAT_MIN, LAT_MAX = 34.0, 58.0
BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8"


def tx(lon):
    return int(math.floor((lon + 180.0) / 360.0 * N))


def ty(lat):
    r = math.radians(lat)
    return int(math.floor((1.0 - math.log(math.tan(r) + 1.0 / math.cos(r)) / math.pi) / 2.0 * N))


x0, x1 = tx(LON_MIN), tx(LON_MAX)
y0, y1 = ty(LAT_MAX), ty(LAT_MIN)
print("tiles x", x0, x1, "y", y0, y1, "count", (x1 - x0 + 1) * (y1 - y0 + 1))


def get(xy):
    x, y = xy
    url = f"{BASE}/{Z}/{y}/{x}.jpeg"
    for _ in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return xy, r.read()
        except Exception as e:
            err = e
    raise RuntimeError(f"{url}: {err}")


coords = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
mosaic = Image.new("RGB", ((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256))
import io

with ThreadPoolExecutor(8) as ex:
    for (x, y), data in ex.map(get, coords):
        mosaic.paste(Image.open(io.BytesIO(data)).convert("RGB"), ((x - x0) * 256, (y - y0) * 256))

out = sys.argv[1]
mosaic.save(out, "JPEG", quality=72, optimize=True, progressive=True)
print("size px", mosaic.size, "origin world px", x0 * 256, y0 * 256, "world", N * 256)
