import os
import random
from datetime import date

from locust import HttpUser, between, task

PINCODES = ["600001", "560001", "400001", "110001", "171001", "700001", "682001"]
CONSTRUCTION = ["Frame", "Joisted Masonry", "Non-Combustible", "Masonry Non-Combustible", "Fire Resistive"]
OCCUPANCY = ["Office", "Retail", "Warehouse", "Manufacturing", "Hotel"]
HAZARDS = ["None", "Flood", "Earthquake", "Wind"]


def proposal() -> dict[str, str]:
    return {
        "property_id": f"LOAD-{random.randint(1, 10**9)}",
        "address": "12 MG Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "zip": random.choice(PINCODES),
        "latitude": "12.9716",
        "longitude": "77.5946",
        "construction_type": random.choice(CONSTRUCTION),
        "year_built": str(random.randint(1960, 2024)),
        "square_footage": str(random.randint(2000, 80000)),
        "occupancy_type": random.choice(OCCUPANCY),
        "num_stories": str(random.randint(1, 12)),
        "sprinkler_system": random.choice(["Y", "N"]),
        "fire_alarm": random.choice(["true", "false"]),
        "cat_zone": random.choice(HAZARDS),
        "seismic_zone": random.choice(["II", "III", "IV", "V"]),
        "building_value_inr": str(random.randint(5, 500) * 1_000_000),
        "stock_inventory_value_inr": str(random.randint(0, 200) * 1_000_000),
        "prior_claims_count_5yr": str(random.randint(0, 4)),
        "submission_date": date.today().isoformat(),
    }


class Reader(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        if os.environ.get("BYPASS"):
            self.client.headers["x-vercel-protection-bypass"] = os.environ["BYPASS"]

    @task(5)
    def hazard(self):
        self.client.get(f"/hazard/{random.choice(PINCODES)}", name="/hazard/[pincode]")

    @task(1)
    def unknown_hazard(self):
        with self.client.get("/hazard/999999", name="/hazard/[unknown]", catch_response=True) as response:
            if response.status_code == 404:
                response.success()

    @task(3)
    def preview(self):
        self.client.post("/underwrite/preview", data=proposal())

    @task(2)
    def history(self):
        self.client.get("/underwrite/history", params={"limit": 20, "sort": random.choice(["created", "score", "value"])}, name="/underwrite/history")

    @task(2)
    def portfolio(self):
        self.client.get("/underwrite/portfolio")

    @task(2)
    def dashboard_graphql(self):
        query = "{ portfolio { submissions average_score } history(limit: 20, sort: SCORE) { total rows { id property_id risk_score } } }"
        with self.client.post("/graphql", json={"query": query}, name="/graphql dashboard", catch_response=True) as response:
            if response.status_code == 200 and "errors" in response.json():
                response.failure(str(response.json()["errors"])[:200])

    @task(2)
    def status(self):
        self.client.get("/status")


class Underwriter(Reader):
    @task(2)
    def submit(self):
        self.client.post("/underwrite/submit", data=proposal())
