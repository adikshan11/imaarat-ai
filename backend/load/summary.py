import csv
import sys

rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8")))
print("| Endpoint | Requests | Failures | Req/s | p50 ms | p95 ms | p99 ms | Max ms |")
print("|---|---:|---:|---:|---:|---:|---:|---:|")
for row in rows:
    name = f"{row['Type']} {row['Name']}".strip()
    print(f"| {name} | {row['Request Count']} | {row['Failure Count']} | {float(row['Requests/s']):.1f} | {row['50%']} | {row['95%']} | {row['99%']} | {float(row['Max Response Time']):.0f} |")
