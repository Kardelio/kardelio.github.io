#!/usr/bin/env python3
"""Add a EUR price column to a CSV exported from the MTG viewer.

Usage:  python3 price_cards.py cards.csv [output.csv]
        (output defaults to <input>-priced.csv)

Prices come from Scryfall (its "eur" / "eur_foil" prices are Cardmarket's). Foil rows get the foil price, other rows the
non-foil price. A row with no price on Scryfall gets an empty cell (a foil is never silently priced as non-foil).

Each different printing (set code + collector number) is looked up once, so duplicates reuse the first result. Lookups use
Scryfall's batch endpoint (up to 75 cards per request) with a pause between requests, well inside their rate limits
(https://scryfall.com/docs/api/rate-limits). Python 3 standard library only.
"""
import csv
import json
import sys
import time
import urllib.error
import urllib.request

API = "https://api.scryfall.com/cards/collection"
HEADERS = {
    "User-Agent": "kardelio-mtg-price-script/1.0",   # Scryfall asks every client to identify itself
    "Accept": "application/json;q=0.9,*/*;q=0.8",
    "Content-Type": "application/json",
}
BATCH = 75          # the most identifiers Scryfall accepts per request
PAUSE = 0.2         # seconds between requests (Scryfall asks for 50-100 ms minimum; this is 5 requests a second at most)
PRICE_COLUMN = "Price EUR"


def fetch_batch(identifiers):
    body = json.dumps({"identifiers": identifiers}).encode()
    for attempt in range(5):
        req = urllib.request.Request(API, data=body, headers=HEADERS, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                wait = int(e.headers.get("Retry-After", 0) or 0) or 5 * (attempt + 1)
                print(f"  Scryfall said {e.code}; waiting {wait}s and retrying", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
        except urllib.error.URLError as e:
            print(f"  network problem ({e.reason}); retrying", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    sys.exit("Giving up: Scryfall kept failing.")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else (src[:-4] if src.lower().endswith(".csv") else src) + "-priced.csv"

    with open(src, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or [])
        rows = list(reader)
    for needed in ("Set code", "Collector number", "Foil"):
        if needed not in fields:
            sys.exit(f"Input CSV has no '{needed}' column (is it an export from the viewer?)")

    key = lambda r: (r["Set code"].strip().lower(), r["Collector number"].strip())
    unique = list(dict.fromkeys(key(r) for r in rows if all(key(r))))
    print(f"{len(rows)} cards, {len(unique)} different printings to look up")

    prices = {}      # (set, number) -> {"eur": ..., "eur_foil": ...}
    for i in range(0, len(unique), BATCH):
        chunk = unique[i:i + BATCH]
        data = fetch_batch([{"set": s, "collector_number": n} for s, n in chunk])
        for card in data.get("data", []):
            prices[(card["set"].lower(), str(card["collector_number"]))] = card.get("prices", {})
        print(f"  looked up {min(i + BATCH, len(unique))}/{len(unique)}")
        if i + BATCH < len(unique):
            time.sleep(PAUSE)

    missing = 0
    for r in rows:
        p = prices.get(key(r), {})
        foil = r["Foil"].strip().lower() == "foil"
        value = p.get("eur_foil" if foil else "eur")
        if not value:
            missing += 1
        r[PRICE_COLUMN] = value or ""

    if PRICE_COLUMN not in fields:
        fields.append(PRICE_COLUMN)
    with open(dst, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\r\n")
        w.writeheader()
        w.writerows(rows)

    total = sum(float(r[PRICE_COLUMN]) for r in rows if r[PRICE_COLUMN])
    print(f"Wrote {dst}: {len(rows) - missing} priced, {missing} without a price, total about EUR {total:.2f}")


if __name__ == "__main__":
    main()
