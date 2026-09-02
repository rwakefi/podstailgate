#!/usr/bin/env python3
"""Download gallery photos and rewrite js/photos.js to local paths."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTOS_JS = ROOT / "js" / "photos.js"
OUT = ROOT / "images" / "gallery"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}


def load_photos() -> dict:
    text = PHOTOS_JS.read_text()
    match = re.search(r"=\s*(\{.*\})\s*;?\s*$", text, re.S)
    if not match:
        raise SystemExit("Could not parse photos.js")
    return json.loads(match.group(1))


def filename_for(url: str, used: set[str]) -> str:
    name = url.rsplit("/", 1)[-1].split("?", 1)[0]
    name = re.sub(r"[^A-Za-z0-9._-]", "-", name)
    if not name.lower().endswith((".jpeg", ".jpg", ".png", ".webp")):
        name += ".jpeg"
    base, ext = name.rsplit(".", 1)
    candidate = name
    i = 2
    while candidate in used:
        candidate = f"{base}-{i}.{ext}"
        i += 1
    used.add(candidate)
    return candidate


def download(url: str, dest: Path) -> None:
    subprocess.check_call(
        ["curl", "-fsSL", "-A", UA["User-Agent"], "-o", str(dest), url],
        timeout=60,
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    data = load_photos()
    used: set[str] = set()
    local = {"tennessee": [], "vault": []}
    seen_urls: dict[str, str] = {}
    total = sum(len(v) for v in data.values())
    n = 0
    for group, urls in data.items():
        for url in urls:
            n += 1
            if url in seen_urls:
                local[group].append(seen_urls[url])
                continue
            name = filename_for(url, used)
            dest = OUT / name
            if not dest.exists() or dest.stat().st_size < 1000:
                print(f"[{n}/{total}] {name}")
                download(url, dest)
            rel = f"images/gallery/{name}"
            seen_urls[url] = rel
            local[group].append(rel)
    PHOTOS_JS.write_text("window.PODS_PHOTOS = " + json.dumps(local, indent=2) + ";\n")
    print(f"Wrote {PHOTOS_JS} with {len(local['tennessee'])} + {len(local['vault'])} photos")


if __name__ == "__main__":
    main()
