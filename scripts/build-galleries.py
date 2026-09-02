#!/usr/bin/env python3
"""Regenerate data/galleries.json from the folders under photos/.

Usage:
    python3 scripts/build-galleries.py

- Every subfolder of photos/ becomes a gallery whose slug is the folder name.
- Existing title / date / blurb / cover values in data/galleries.json are kept.
- New folders get sensible defaults you can edit afterward.
- Photo order = alphabetical by filename. To pin a custom order, keep the
  "photos" list in data/galleries.json and just add new files to the end.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "photos"
OUT = ROOT / "data" / "galleries.json"
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

NOTE = (
    "Each gallery: slug (also the folder name under photos/), title, date "
    '(YYYY-MM-DD or ""), blurb, cover image, and the ordered photos list. '
    "Run scripts/build-galleries.py to regenerate the photos list from the folders on disk."
)


def load_existing() -> dict[str, dict]:
    if not OUT.exists():
        return {}
    data = json.loads(OUT.read_text())
    return {g["slug"]: g for g in data.get("galleries", [])}


def main() -> None:
    existing = load_existing()
    galleries = []
    folders = sorted([p for p in PHOTOS.iterdir() if p.is_dir()]) if PHOTOS.exists() else []
    for folder in folders:
        slug = folder.name
        files_on_disk = sorted(
            f"photos/{slug}/{p.name}" for p in folder.iterdir() if p.suffix.lower() in EXTS
        )
        prev = existing.get(slug, {})
        prev_photos = [p for p in prev.get("photos", []) if p in set(files_on_disk)]
        ordered = prev_photos + [p for p in files_on_disk if p not in set(prev_photos)]
        galleries.append(
            {
                "slug": slug,
                "title": prev.get("title", slug.replace("-", " ").title()),
                "date": prev.get("date", ""),
                "blurb": prev.get("blurb", ""),
                "cover": prev.get("cover") if prev.get("cover") in ordered else (ordered[0] if ordered else ""),
                "photos": ordered,
            }
        )
    OUT.write_text(json.dumps({"note": NOTE, "galleries": galleries}, indent=2) + "\n")
    for g in galleries:
        print(f"{g['slug']}: {len(g['photos'])} photos")


if __name__ == "__main__":
    main()
