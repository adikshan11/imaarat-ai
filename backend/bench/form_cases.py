"""Seeded synthetic paper-form cases: what a proposer writes and in which script, for the form-reading benchmark."""

import json
import random

PLACES = {
    "en": ("400001", ("Mumbai", "Maharashtra"), ("Mumbai", "Maharashtra"), "Caveat"),
    "hi": ("110001", ("New Delhi", "Delhi"), ("नई दिल्ली", "दिल्ली"), "Kalam"),
    "ta": ("600001", ("Chennai", "Tamil Nadu"), ("சென்னை", "தமிழ்நாடு"), "Kavivanar"),
    "bn": ("700001", ("Kolkata", "West Bengal"), ("কলকাতা", "পশ্চিমবঙ্গ"), "Galada"),
    "te": ("500001", ("Hyderabad", "Telangana"), ("హైదరాబాద్", "తెలంగాణ"), "Lakki Reddy"),
    "ml": ("682001", ("Kochi", "Kerala"), ("കൊച്ചി", "കേരളം"), "Chilanka"),
    "gu": ("380001", ("Ahmedabad", "Gujarat"), ("અમદાવાદ", "ગુજરાત"), "Farsan"),
}
CONSTRUCTION = ["Frame", "Joisted Masonry", "Non-Combustible", "Masonry Non-Combustible", "Fire Resistive"]
HAZARDS = ["None", "Wind", "Hail", "Wildfire", "Flood", "Earthquake"]
OCCUPANCY = ["Warehouse", "Office", "Retail shop", "Garment unit", "Cold storage"]


def indian_rupees(amount: int) -> str:
    text = str(amount)
    head, tail = text[:-3], text[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    return ",".join(([head] if head else []) + groups + [tail])


def cases() -> list[dict]:
    rng = random.Random(20261006)
    built = []
    for lang, (pin, english_place, local_place, font) in PLACES.items():
        for number in range(3):
            city, state = local_place if number == 1 else english_place
            values = {
                "zip": pin,
                "address": f"{rng.randint(2, 98)}, {rng.choice(['MG Road', 'Station Road', 'Industrial Estate', 'Market Lane'])}",
                "city": city,
                "state": state,
                "occupancy_type": rng.choice(OCCUPANCY),
                "construction_type": rng.choice(CONSTRUCTION),
                "year_built": str(rng.randint(1975, 2022)),
                "num_stories": str(rng.randint(1, 9)),
                "square_footage": str(rng.randint(15, 600) * 100),
                "roof_age_years": str(rng.randint(1, 30)),
                "prior_claims_count_5yr": str(rng.randint(0, 3)),
                "cat_zone": rng.choice(HAZARDS),
                "seismic_zone": rng.choice(["II", "III", "IV", "V"]),
                "sprinkler_system": rng.choice(["yes", "no"]),
                "fire_alarm": rng.choice(["yes", "no"]),
                "flood_protection": rng.choice(["yes", "no"]),
                "building_value_inr": indian_rupees(rng.randint(20, 900) * 100_000),
                "plant_machinery_value_inr": indian_rupees(rng.randint(5, 300) * 100_000),
                "stock_inventory_value_inr": indian_rupees(rng.randint(5, 400) * 100_000),
                "other_contents_value_inr": indian_rupees(rng.randint(1, 50) * 100_000),
            }
            if number == 2:
                values["roof_age_years"] = ""
                values["other_contents_value_inr"] = ""
            built.append({"id": f"{lang}-{number + 1}", "lang": lang, "font": font, "values": values})
    return built


if __name__ == "__main__":
    print(json.dumps(cases(), ensure_ascii=False, indent=1))
