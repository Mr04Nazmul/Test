#!/usr/bin/env python3
"""Stream real OSM building footprints into small Cesium 3D geometry tiles.

Input: GeoJSON Sequence produced by osmium export from Geofabrik Bangladesh.
No satellite scraping, imaginary road geometry, or building-photo claims.
Unknown heights and facade colors are EXPLICITLY estimated by the renderer.
"""
import collections
import datetime
import json
import math
import os
import sys
from pathlib import Path

Z = 14
# Greater central Dhaka urban study extent, NOT the whole Dhaka district.
BBOX = (90.25, 23.65, 90.57, 24.03)
OUT = Path("data/3d-city")
TILES = OUT / "t"
MAX_RING = 90

def slippy(lon, lat):
    lat = min(85.0511, max(-85.0511, lat))
    n = 2 ** Z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)

def elevation(tags):
    def first_float(s):
        try:
            return float(str(s).split(";")[0].strip().removesuffix("m").strip())
        except (ValueError, TypeError):
            return None
    meters = first_float(tags.get("height"))
    if meters and 2 <= meters <= 300:
        return round(meters, 1), 1
    levels = first_float(tags.get("building:levels"))
    if levels and 1 <= levels <= 90:
        return round(levels * 3.2, 1), 1
    return 0, 0  # Client renders a deterministic visual estimate.

def palette(tags):
    t = str(tags.get("building", "")).lower()
    return {"commercial": 1, "retail": 1, "office": 2, "industrial": 3,
            "warehouse": 3, "school": 4, "university": 4,
            "hospital": 4, "residential": 0, "apartments": 0}.get(t, 0)

def area_m2(ring):
    # Fast planimetric area for sanity-checking building geometry.
    xscale = 111320 * math.cos(math.radians(ring[0][1]))
    pts = [(p[0] * xscale, p[1] * 111320) for p in ring]
    return abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1]
                   - pts[(i + 1) % len(pts)][0] * pts[i][1]
                   for i in range(len(pts))) / 2)

def simplify_ring(coords):
    if len(coords) < 4:
        return None
    pts = []
    for p in coords:
        if not isinstance(p, (list, tuple)) or len(p) < 2:
            continue
        lon, lat = round(float(p[0]), 6), round(float(p[1]), 6)
        if BBOX[0] - .01 <= lon <= BBOX[2] + .01 and BBOX[1] - .01 <= lat <= BBOX[3] + .01:
            if not pts or pts[-1] != [lon, lat]:
                pts.append([lon, lat])
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    if len(pts) < 3:
        return None
    if len(pts) > MAX_RING:
        step = math.ceil(len(pts) / MAX_RING)
        pts = pts[::step]
    if len(pts) < 3 or not (9 <= area_m2(pts) <= 250000):
        return None
    return pts

def feature_polygons(feat):
    geom = feat.get("geometry") or {}
    if geom.get("type") == "Polygon":
        return [geom.get("coordinates", [])]
    if geom.get("type") == "MultiPolygon":
        return geom.get("coordinates", [])[:25]
    return []

def build(source):
    buckets = collections.defaultdict(list)
    seen = set()
    count = estimated = 0
    with open(source, "r", encoding="utf-8") as inp:
        for line in inp:
            line = line.strip().lstrip(chr(30))
            if not line:
                continue
            try:
                item = json.loads(line)
            except ValueError:
                continue
            tags = item.get("properties") or {}
            if not tags.get("building") or tags.get("building") == "no":
                continue
            identifier = str(item.get("id", ""))
            for part_idx, polygon in enumerate(feature_polygons(item)):
                if not polygon:
                    continue
                ring = simplify_ring(polygon[0])
                if not ring:
                    continue
                lon = sum(p[0] for p in ring) / len(ring)
                lat = sum(p[1] for p in ring) / len(ring)
                if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
                    continue
                xy = slippy(lon, lat)
                key = (identifier, part_idx) if identifier else (xy, tuple(ring[:3]))
                if key in seen:
                    continue
                seen.add(key)
                h, verified = elevation(tags)
                estimated += int(not verified)
                # [exterior polygon, height (0=unknown), palette category]
                buckets[xy].append([ring, h, palette(tags)])
                count += 1
    if count < 500:
        raise RuntimeError(f"OSM extraction failed: only {count} real footprints")
    # Only delete old tiles after successful fresh extraction.
    import shutil
    if TILES.exists():
        shutil.rmtree(TILES)
    sizes = []
    for (x, y), records in sorted(buckets.items()):
        folder = TILES / str(Z) / str(x)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / f"{y}.json"
        target.write_text(json.dumps(records, separators=(",", ":")), encoding="utf-8")
        sizes.append(target.stat().st_size)
    manifest = {
        "ready": True, "zoom": Z, "bounds": list(BBOX),
        "tileCount": len(sizes), "buildingCount": count,
        "unknownHeightCount": estimated, "maxTileBytes": max(sizes),
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "dataSource": "Geofabrik Bangladesh OpenStreetMap extract",
        "attribution": "© OpenStreetMap contributors, ODbL 1.0",
        "licenseUrl": "https://www.openstreetmap.org/copyright",
        "accuracy": "Mapped footprints. Untagged heights and all facade colors are visualization estimates.",
        "completeness": "Tiles represent mapped buildings within the configured central Dhaka bounding box; unmapped structures are absent.",
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/build-dhaka-city-tiles.py build/dhaka.geojsonseq")
    build(sys.argv[1])
