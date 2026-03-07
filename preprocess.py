#!/usr/bin/env python3
"""Preprocess baby name CSVs into optimized JSON files for the web app."""

import csv
import json
import os
from collections import defaultdict

NAMES_DIR = "names"
DATA_DIR = "data"
DETAILS_DIR = os.path.join(DATA_DIR, "details")
YEAR_START = 1880
YEAR_END = 2024


def main():
    os.makedirs(DETAILS_DIR, exist_ok=True)

    # {(name, gender): {year: {count, rank}}}
    name_data = defaultdict(dict)
    # {year: {gender: [(name, count), ...]}}
    yearly_top = {}
    # {(name, gender): total_count}
    totals = defaultdict(int)

    for year in range(YEAR_START, YEAR_END + 1):
        filepath = os.path.join(NAMES_DIR, f"yob{year}.txt")
        if not os.path.exists(filepath):
            continue

        gender_rank = {"F": 0, "M": 0}
        year_data = {"F": [], "M": []}

        with open(filepath, newline="") as f:
            reader = csv.reader(f)
            for row in reader:
                name, gender, count_str = row[0], row[1], row[2]
                count = int(count_str)
                gender_rank[gender] += 1
                rank = gender_rank[gender]

                name_data[(name, gender)][year] = {"count": count, "rank": rank}
                totals[(name, gender)] += count

                if rank <= 20:
                    year_data[gender].append({"name": name, "count": count})

        yearly_top[year] = year_data

    # 1. names_index.json — sorted by total count descending
    names_index = sorted(
        [{"n": name, "g": gender, "t": total} for (name, gender), total in totals.items()],
        key=lambda x: x["t"],
        reverse=True,
    )
    with open(os.path.join(DATA_DIR, "names_index.json"), "w") as f:
        json.dump(names_index, f, separators=(",", ":"))
    print(f"names_index.json: {len(names_index)} entries")

    # 2. yearly_top.json
    with open(os.path.join(DATA_DIR, "yearly_top.json"), "w") as f:
        json.dump(yearly_top, f, separators=(",", ":"))
    print(f"yearly_top.json: {len(yearly_top)} years")

    # 3. Per-name detail files
    count = 0
    for (name, gender), years in name_data.items():
        detail = {"name": name, "gender": gender, "years": {str(y): v for y, v in years.items()}}
        filename = f"{name}_{gender}.json"
        with open(os.path.join(DETAILS_DIR, filename), "w") as f:
            json.dump(detail, f, separators=(",", ":"))
        count += 1
    print(f"detail files: {count}")


if __name__ == "__main__":
    main()
