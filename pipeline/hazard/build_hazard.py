"""Build the India pincode hazard table (seismic zone, flood share, IMD cyclone grade) from open government data."""

from __future__ import annotations

import argparse
import csv
import json
import re
import urllib.request
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import shapely
from pypdf import PdfReader

HERE = Path(__file__).resolve().parent
BHARATLAS = "https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev"
SOURCES = {
    "pincodes": {
        "file": "Datagov_Pincode_Boundaries.parquet",
        "url": f"{BHARATLAS}/postal/boundaries/Datagov_Pincode_Boundaries.parquet",
        "origin": "India Post pincode boundaries, data.gov.in (May 2025)",
        "licence": "Government Open Data License - India",
    },
    "districts": {
        "file": "LGD_Districts.parquet",
        "url": f"{BHARATLAS}/admin/districts/LGD_Districts.parquet",
        "origin": "District boundaries with Local Government Directory codes",
        "licence": "Government Open Data License - India",
    },
    "seismic": {
        "file": "Seismic_Zones.parquet",
        "url": f"{BHARATLAS}/environment/seismic/Seismic_Zones.parquet",
        "origin": "Seismic zones of India, IS 1893 (Part 1):2016, data.gov.in",
        "licence": "Government Open Data License - India",
    },
    "flood": {
        "file": "NDEM_All_India_Flood_Innundation_1998_to_2022.parquet",
        "url": f"{BHARATLAS}/environment/ndem-floods-1998-2022/NDEM_All_India_Flood_Innundation_1998_to_2022.parquet",
        "origin": "NRSC / NDEM satellite-observed flood inundation 1998-2022",
        "licence": "Published by the aggregator as CC0; NRSC terms not verified",
    },
    "chennai_inundation": {
        "file": "chennai_inundation.kml",
        "url": "https://data.opencity.in/dataset/022dd080-e927-40d7-897d-adf3ee98ad69/resource/ceddf53f-03c0-4866-8ba8-5e84c8007a85/download/814ca028-4c84-4bd0-aa67-6dbaeb9b6ba5.kml",
        "origin": "Greater Chennai Corporation, inundation points with depth (OpenCity, updated November 2025)",
        "licence": "Public domain, as published on OpenCity",
    },
    "chennai_2015": {
        "file": "chennai_2015.kml",
        "url": "https://data.opencity.in/dataset/022dd080-e927-40d7-897d-adf3ee98ad69/resource/80ed2fa7-1150-4f55-8125-682ab55282ac/download/93d2905a-a580-482d-96b0-4d9ccf5273ef.kml",
        "origin": "Greater Chennai Corporation, flooding points in 2015 (OpenCity)",
        "licence": "Public domain, as published on OpenCity",
    },
    "bengaluru_vulnerable": {
        "file": "bengaluru_vulnerable.kml",
        "url": "https://data.opencity.in/dataset/b03218ea-4b7c-4fa9-ab67-b9054d7ecc4c/resource/a7d8a01f-1fbc-41e1-85f0-f15ea16b2d27/download/6b3c63b0-f461-4e9c-a2c2-006f734c5b41.kml",
        "origin": "BBMP, locations vulnerable to flooding in Bengaluru Urban (OpenCity, updated November 2025)",
        "licence": "Public domain, as published on OpenCity",
    },
    "bengaluru_flood_prone": {
        "file": "bengaluru_flood_prone.kml",
        "url": "https://data.opencity.in/dataset/b03218ea-4b7c-4fa9-ab67-b9054d7ecc4c/resource/d90fe768-caba-4c6e-b6b5-a75acd5e88a9/download/00fb1229-dcfd-4f59-813f-885e0c629add.kml",
        "origin": "BBMP, flood-prone locations (OpenCity)",
        "licence": "Public domain, as published on OpenCity",
    },
    "bengaluru_low_lying": {
        "file": "bengaluru_low_lying.kml",
        "url": "https://data.opencity.in/dataset/b03218ea-4b7c-4fa9-ab67-b9054d7ecc4c/resource/62ceac3b-f6e2-4dd1-ae9f-be80b1f2fda8/download/8e87a2fc-e014-4c6e-81f1-d5cb4db57a46.kml",
        "origin": "BBMP, low-lying areas (OpenCity)",
        "licence": "Public domain, as published on OpenCity",
    },
    "towns": {
        "file": "is1893_town_zones.csv",
        "url": "https://archive.org/details/gov.in.is.1893.1.2016",
        "origin": "IS 1893 (Part 1):2016 Annex E, seismic zone of towns with population over 3 lakh (Census 2011), with Amendment 1 spelling; applied within 10 km of each town's head post office",
        "licence": "Zone values are facts from the Indian Standard; the standard itself is BIS copyright",
    },
    "cyclone": {
        "file": "imd_cyclone_hazard.pdf",
        "url": "https://rsmcnewdelhi.imd.gov.in/uploads/climatology/hazard.pdf",
        "origin": "IMD RSMC New Delhi, Cyclone hazard prone districts of India (June 2023), tables 1.1 and 1.2",
        "licence": "No licence stated; government publication, cited with attribution",
    },
}
ZONES = {"Seismic Zone-II": 2, "Seismic Zone-III": 3, "Seismic Zone-IV": 4, "Seismic Zone-V": 5}
ROMAN = {2: "II", 3: "III", 4: "IV", 5: "V"}
IMD_GRADE_COUNTS = {"P1": 12, "P2": 25, "P3": 48, "P4": 15}
TOWN_RADIUS_KM = 10.0
CITY_LAYERS = {
    "Greater Chennai Corporation": ("Chennai", ["chennai_inundation", "chennai_2015"]),
    "BBMP Bengaluru": ("Bengaluru Urban", ["bengaluru_vulnerable", "bengaluru_flood_prone", "bengaluru_low_lying"]),
}
OFFICE_SUFFIX = re.compile(r"\s+(h\.?\s?p?\.?\s?o\.?|g\.?\s?p\.?\s?o\.?|s\.?\s?o\.?|b\.?\s?o\.?)$", re.I)
IMD_STATES = [
    "Andaman &", "Andhra", "Pradesh (AP)", "AP", "Odisha", "Puducherry", "West Bengal", "Daman & Diu",
    "Dadra & Nagar Haveli", "Gujarat", "Lakshadweep", "Tamil Nadu", "Goa", "Karnataka", "Kerala", "Maharastra",
]


def fetch(name: str, raw_dir: Path) -> Path:
    path = raw_dir / SOURCES[name]["file"]
    if not path.exists():
        raw_dir.mkdir(parents=True, exist_ok=True)
        print(f"downloading {SOURCES[name]['url']}")
        urllib.request.urlretrieve(SOURCES[name]["url"], path)
    return path


def geometries(path: Path, columns: list[str], geometry: str) -> tuple[dict[str, list], np.ndarray]:
    table = pq.read_table(path, columns=[*columns, geometry])
    shapes = shapely.make_valid(shapely.from_wkb(table.column(geometry).to_numpy(zero_copy_only=False)))
    return {name: table.column(name).to_pylist() for name in columns}, shapes


def cyclone_grades(pdf: Path, crosswalk: Path) -> dict[str, tuple[str, str]]:
    text = "\n".join(page.extract_text() for page in PdfReader(pdf).pages[8:12])
    rows = []
    for line in text.splitlines():
        match = re.match(r"^\s*(.+?)\s+(P[1-4])\s*$", line)
        if not match or match.group(1).strip().startswith("Total"):
            continue
        name = match.group(1).strip()
        for state in IMD_STATES:
            if name.startswith(state + " ") and name != "Dadra & Nagar Haveli":
                name = name[len(state):].strip()
                break
        rows.append((name, match.group(2)))
    counts = Counter(grade for _, grade in rows)
    if len(rows) != 100 or dict(counts) != IMD_GRADE_COUNTS:
        raise ValueError(f"IMD tables parsed to {len(rows)} rows {dict(counts)}, expected 100 {IMD_GRADE_COUNTS}")

    mapping = {row["imd_district"]: row for row in csv.DictReader(crosswalk.open(encoding="utf-8"))}
    unmapped = [name for name, _ in rows if name not in mapping]
    if unmapped:
        raise ValueError(f"IMD districts missing from the crosswalk: {unmapped}")
    grades: dict[str, tuple[str, str]] = {}
    for name, grade in rows:
        for district in mapping[name]["lgd_districts"].split(";"):
            grades[district] = (grade, f"IMD lists {name}" if mapping[name]["note"] == "same" else f"IMD lists {name} ({mapping[name]['note']})")
    return grades


def kml_points(path: Path) -> np.ndarray:
    text = path.read_text(encoding="utf-8")
    coordinates = re.findall(r"<Point>\s*<coordinates>\s*([-\d.]+),([-\d.]+)", text)
    return shapely.points(np.array([[float(x), float(y)] for x, y in coordinates]))


def town_centres(offices: list[str], points: np.ndarray, towns: Path) -> tuple[list[tuple[str, str, float, float]], list[str]]:
    ranked: dict[str, list[tuple[int, int]]] = {}
    for index, office in enumerate(offices):
        name = (office or "").strip()
        match = OFFICE_SUFFIX.search(name)
        rank = 0 if match and re.match(r"(?i)h|g", match.group(1)) else 1 if match and re.match(r"(?i)s", match.group(1)) else 2
        ranked.setdefault(OFFICE_SUFFIX.sub("", name).strip().lower(), []).append((rank, index))
    centres, skipped = [], []
    for row in csv.DictReader(towns.open(encoding="utf-8")):
        names = [row["post_office_name"]] if row["post_office_name"] else [part.strip(" )") for part in row["town"].split("(")]
        candidates = sorted(item for name in names for item in ranked.get(name.lower(), []) if item[0] < 2)
        best = [index for rank, index in candidates if rank == candidates[0][0]] if candidates else []
        if len(best) != 1:
            skipped.append(f"{row['town']} ({'ambiguous' if best else 'no post office match'})")
            continue
        point = points[best[0]]
        centres.append((row["town"], row["zone"], shapely.get_x(point), shapely.get_y(point)))
    return centres, skipped


def build(raw_dir: Path, out_json: Path, out_csv: Path) -> None:
    pin_cols, pins = geometries(fetch("pincodes", raw_dir), ["Pincode", "Office_Name"], "geometry")
    dist_cols, districts = geometries(fetch("districts", raw_dir), ["dtname", "stname", "dist_lgd"], "geometry")
    zone_cols, zones = geometries(fetch("seismic", raw_dir), ["seismic_zo"], "geom")
    _, floods = geometries(fetch("flood", raw_dir), [], "geometry")
    grades = cyclone_grades(fetch("cyclone", raw_dir), HERE / "imd_district_crosswalk.csv")

    names = Counter(dist_cols["dtname"])
    missing = [name for name in grades if names[name] != 1]
    if missing:
        raise ValueError(f"crosswalk targets not found exactly once in the district file: {missing}")

    count = len(pins)
    points = shapely.point_on_surface(pins)
    district_of = np.full(count, -1)
    point_idx, district_idx = shapely.STRtree(districts).query(points, predicate="within")
    district_of[point_idx] = district_idx

    labelled = [i for i, label in enumerate(zone_cols["seismic_zo"]) if label in ZONES]
    zone_level = np.array([ZONES[zone_cols["seismic_zo"][i]] for i in labelled])
    pin_idx, zone_idx = shapely.STRtree(zones[labelled]).query(pins, predicate="intersects")
    overlap = shapely.area(shapely.intersection(pins[pin_idx], zones[labelled][zone_idx]))
    pin_area = shapely.area(pins)
    share = np.zeros((count, 6))
    np.add.at(share, (pin_idx, zone_level[zone_idx]), overlap)
    share = share / np.where(pin_area > 0, pin_area, 1)[:, None]

    pin_idx, flood_idx = shapely.STRtree(floods).query(pins, predicate="intersects")
    flooded = np.zeros(count)
    np.add.at(flooded, pin_idx, shapely.area(shapely.intersection(pins[pin_idx], floods[flood_idx])))
    flood_pct = np.clip(100 * flooded / np.where(pin_area > 0, pin_area, 1), 0, 100)

    centres, skipped = town_centres(pin_cols["Office_Name"], points, HERE / "is1893_town_zones.csv")
    lon, lat = np.radians(shapely.get_x(points)), np.radians(shapely.get_y(points))
    town_zone = np.full(count, None, dtype=object)
    town_name = np.full(count, None, dtype=object)
    nearest = np.full(count, np.inf)
    for town, zone, x, y in centres:
        a = np.sin((lat - np.radians(y)) / 2) ** 2 + np.cos(lat) * np.cos(np.radians(y)) * np.sin((lon - np.radians(x)) / 2) ** 2
        distance = 2 * 6371.0 * np.arcsin(np.sqrt(a))
        closer = (distance <= TOWN_RADIUS_KM) & (distance < nearest)
        town_zone[closer], town_name[closer], nearest[closer] = zone, town, distance[closer]

    city_points = np.zeros(count, dtype=int)
    city_source = np.full(count, None, dtype=object)
    pin_tree = shapely.STRtree(pins)
    for source, (district, layers) in CITY_LAYERS.items():
        points = np.concatenate([kml_points(fetch(layer, raw_dir)) for layer in layers])
        point_idx, pin_idx = pin_tree.query(points, predicate="within")
        np.add.at(city_points, pin_idx, 1)
        covered = np.array([dist_cols["dtname"][d] == district if d >= 0 else False for d in district_of]) | (np.bincount(pin_idx, minlength=count) > 0)
        city_source[covered] = source
        print(f"{source}: {len(points)} points, {len(set(point_idx.tolist()))} inside a PIN code, {int(covered.sum())} PIN codes covered")

    records = []
    for i in range(count):
        d = district_of[i]
        district = dist_cols["dtname"][d] if d >= 0 else None
        touched = [level for level in range(2, 6) if share[i, level] > 0.01]
        dominant = int(np.argmax(share[i])) if share[i].max() > 0 else None
        grade, grade_note = grades.get(district, (None, None)) if district else (None, None)
        map_zone = ROMAN.get(dominant)
        records.append({
            "pincode": str(pin_cols["Pincode"][i]),
            "district": district,
            "state": dist_cols["stname"][d].title() if d >= 0 else None,
            "district_lgd": int(dist_cols["dist_lgd"][d]) if d >= 0 else None,
            "seismic_zone": town_zone[i] or map_zone,
            "seismic_zone_map": map_zone,
            "seismic_zone_max": ROMAN.get(max(touched)) if touched else None,
            "seismic_source": f"IS 1893 town list: {town_name[i]}" if town_zone[i] else "zone map",
            "flood_area_pct": round(float(flood_pct[i]), 1),
            "urban_flood_points": int(city_points[i]) if city_source[i] else None,
            "urban_flood_source": city_source[i],
            "cyclone_grade": grade,
            "cyclone_note": grade_note,
        })

    with out_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    fields = ["district", "state", "district_lgd", "seismic_zone", "seismic_zone_map", "seismic_zone_max", "seismic_source", "flood_area_pct", "urban_flood_points", "urban_flood_source", "cyclone_grade", "cyclone_note"]
    payload = {
        "built_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fields": fields,
        "sources": {name: {key: value for key, value in source.items() if key != "file"} for name, source in SOURCES.items()},
        "pincodes": {record["pincode"]: [record[field] for field in fields] for record in records},
    }
    out_json.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"pincodes {count}, with district {int((district_of >= 0).sum())}")
    changed = sum(1 for r in records if r["seismic_zone"] != r["seismic_zone_map"])
    print(f"town list: {len(centres)} towns placed, {int((town_zone != None).sum())} pincodes within {TOWN_RADIUS_KM:g} km, {changed} differ from the map")  # noqa: E711 - elementwise NumPy comparison; "is not None" would compare the whole array
    print("towns skipped:", skipped)
    print("seismic zone", Counter(r["seismic_zone"] for r in records))
    print("cyclone graded pincodes", Counter(r["cyclone_grade"] for r in records))
    print("pincodes with any flood history", sum(r["flood_area_pct"] > 0 for r in records), "with >= 10%", sum(r["flood_area_pct"] >= 10 for r in records))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=HERE / "raw")
    parser.add_argument("--out-json", type=Path, default=HERE.parent.parent / "backend" / "data" / "hazard" / "pincode_hazard.json")
    parser.add_argument("--out-csv", type=Path, default=HERE.parent / "dbt" / "seeds" / "pincode_hazard.csv")
    args = parser.parse_args()
    args.out_json.parent.mkdir(parents=True, exist_ok=True)
    args.out_csv.parent.mkdir(parents=True, exist_ok=True)
    build(args.raw_dir, args.out_json, args.out_csv)
