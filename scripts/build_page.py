"""Assemble the single-file surcharge map page.

Usage:
    python3 scripts/build_page.py LEAFLET_CSS MAPDATA_JSON OUT_HTML

LEAFLET_CSS  path to leaflet.css (Leaflet 1.9.4, from `npm pack leaflet@1.9.4`)
MAPDATA_JSON output of scripts/build_data.py
OUT_HTML     where to write the page, e.g. build/index.html
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main(css_path, data_path, out_path):
    page = (ROOT / "scripts" / "page_template.html").read_text(encoding="utf-8")
    parts = {
        "/*LEAFLETCSS*/": pathlib.Path(css_path).read_text(encoding="utf-8"),
        "/*DATA*/": pathlib.Path(data_path).read_text(encoding="utf-8"),
        "/*SURCHARGE*/": (ROOT / "src" / "surcharge.js").read_text(encoding="utf-8"),
    }
    for marker, content in parts.items():
        if page.count(marker) != 1:
            sys.exit(f"template must contain {marker} exactly once")
        page = page.replace(marker, content)
    out = pathlib.Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    print(f"wrote {out} ({len(page)} chars)")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
