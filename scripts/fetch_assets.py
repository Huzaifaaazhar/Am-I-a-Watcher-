#!/usr/bin/env python3
"""
Fetch and process the CC0 asset set. Re-runnable; writes public/ASSETS.md.

    python3 scripts/fetch_assets.py          # fetch anything missing
    python3 scripts/fetch_assets.py --force  # re-fetch everything

Needs Python 3 with Pillow and numpy. Nothing here is committed by hand - if
an asset is in public/ it got there through this script, and ASSETS.md is
generated from the same manifest, so the licence record cannot drift from what
actually shipped.

Two texture budgets are produced for every map, 2048 for desktop and 1024 for
mobile, per the build standard - except leaves, which are never more than a few
dozen pixels on screen and so cap at 1024.

Everything is lossy WebP, at a quality chosen per map type. Lossless was tried
first and is a trap: a photographic normal map has noise in every pixel, so
lossless WebP cannot find anything to exploit and the 2048 normal came out at
7.3 MB on its own.

AO and roughness are packed into one ARM texture (AO in red, roughness in
green, metalness in blue) rather than shipped as two single-channel files.
That is the glTF convention, it halves the fetches, and it is what the leaf
atlas already uses.

KTX2 would be better than WebP - GPU-compressed, a fraction of the VRAM - but
it needs the KTX-Software or Basis encoder, and neither is available here. If
`toktx` ever is, that is the upgrade.
"""

from __future__ import annotations

import argparse
import io
import json
import shutil
import sys
import urllib.request
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit("needs Pillow and numpy:  pip install Pillow numpy")

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
TIMEOUT = 180
# Pillow refuses large images by default as a decompression-bomb guard; the
# source textures are legitimately big.
Image.MAX_IMAGE_PIXELS = 200_000_000

SIZES = {"2k": 2048, "1k": 1024}
# Leaves are small on screen; a 2048 atlas is detail nobody can resolve.
LEAF_SIZES = {"2k": 1024, "1k": 512}

# Quality per map type. Normals get the most because a normal map's errors
# show up as shading faults across a whole surface, not as local mush.
Q_COLOUR = 86
Q_NORMAL = 94
Q_DATA = 90


@dataclass
class Asset:
    key: str
    name: str
    provider: str
    licence: str
    source: str
    note: str = ""
    files: list[str] = field(default_factory=list)


MANIFEST: list[Asset] = []


def get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "am-i-a-watcher/1.0"})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def save_maps(
    image: Image.Image,
    out_dir: Path,
    stem: str,
    *,
    quality: int,
    sizes: dict[str, int] | None = None,
) -> list[str]:
    """Writes one map at both budgets. Returns repo-relative paths."""
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for label, size in (sizes or SIZES).items():
        resized = image.resize((size, size), Image.LANCZOS)
        path = out_dir / f"{stem}_{label}.webp"
        # method=6 is the slowest, smallest setting; this runs rarely.
        resized.save(path, "WEBP", quality=quality, method=6)
        written.append(str(path.relative_to(ROOT)))
    return written


# --------------------------------------------------------------------- HDRI


def fetch_hdri(slug: str, resolution: str, force: bool) -> None:
    out = PUBLIC / "hdr" / f"{slug}_{resolution}.hdr"
    files = json.loads(get(f"https://api.polyhaven.com/files/{slug}"))
    url = files["hdri"][resolution]["hdr"]["url"]

    if force or not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(get(url))
        print(f"  hdr  {out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB")

    info = json.loads(get(f"https://api.polyhaven.com/info/{slug}"))
    MANIFEST.append(
        Asset(
            key=slug,
            name=info.get("name", slug),
            provider="Poly Haven",
            licence="CC0",
            source=f"https://polyhaven.com/a/{slug}",
            note=f"{resolution} equirectangular HDR. Image-based lighting only; never drawn as a backdrop.",
            files=[str(out.relative_to(ROOT))],
        )
    )


# ------------------------------------------------------------------ ambientCG

# ambientCG ships one zip per material. Colour and normal travel as-is;
# AO and roughness get packed together into an ARM texture below.
ACG_DIRECT = {"Color": ("color", Q_COLOUR), "NormalGL": ("normal", Q_NORMAL)}


def fetch_ambientcg(asset_id: str, resolution: str, out_name: str, force: bool) -> None:
    out_dir = PUBLIC / "textures" / out_name
    marker = out_dir / f"color_{list(SIZES)[0]}.webp"
    written: list[str] = []

    if force or not marker.exists():
        url = f"https://ambientcg.com/get?file={asset_id}_{resolution}-JPG.zip"
        with zipfile.ZipFile(io.BytesIO(get(url))) as archive:
            names = archive.namelist()

            def read(suffix: str) -> Image.Image | None:
                match = next((n for n in names if n.endswith(f"_{suffix}.jpg")), None)
                if not match:
                    print(f"  warn {asset_id}: no {suffix} map")
                    return None
                with archive.open(match) as handle:
                    return Image.open(io.BytesIO(handle.read()))

            for suffix, (stem, quality) in ACG_DIRECT.items():
                image = read(suffix)
                if image:
                    written += save_maps(image, out_dir, stem, quality=quality.__int__())

            # ARM: ambient occlusion -> red, roughness -> green, metalness ->
            # blue. Bark is dielectric, so blue is zero throughout.
            ao = read("AmbientOcclusion")
            rough = read("Roughness")
            if ao and rough:
                size = ao.size
                arm = Image.merge(
                    "RGB",
                    (
                        ao.convert("L"),
                        rough.convert("L").resize(size, Image.LANCZOS),
                        Image.new("L", size, 0),
                    ),
                )
                written += save_maps(arm, out_dir, "arm", quality=Q_DATA)
        for path in written:
            print(f"  tex  {path}")
    else:
        written = [str(p.relative_to(ROOT)) for p in sorted(out_dir.glob("*.webp"))]

    MANIFEST.append(
        Asset(
            key=asset_id,
            name=f"{asset_id} ({resolution} source)",
            provider="ambientCG",
            licence="CC0",
            source=f"https://ambientcg.com/view?id={asset_id}",
            note="Colour, OpenGL normal, roughness and AO. Split to 2048 and 1024.",
            files=written,
        )
    )


# ------------------------------------------------------------- leaf atlas


def detect_grid(alpha: "np.ndarray") -> int:
    """
    How many cells across a cut-out atlas is, read off its alpha channel.

    Projecting alpha onto each axis gives solid bands where leaves sit and
    near-empty gutters between them; the number of bands is the grid size.
    Beats hardcoding 3, which would silently mis-slice if the atlas is ever
    swapped for another set.
    """
    def bands(projection: "np.ndarray") -> int:
        filled = projection > (projection.max() * 0.02)
        count, previous = 0, False
        for value in filled:
            if value and not previous:
                count += 1
            previous = bool(value)
        return count

    across = bands(alpha.sum(axis=0))
    down = bands(alpha.sum(axis=1))
    grid = max(across, down)
    return grid if 1 <= grid <= 8 else 3


def fetch_leaf_atlas(asset_id: str, resolution: str, force: bool) -> None:
    """
    Leaf cards, from a purpose-built cut-out atlas.

    An earlier version segmented a photoscanned plant model instead. It does
    not work: every leaf on such a sheet belongs to one connected UV island,
    so the biggest region is the whole plant, and the crops came out as
    clumps streaked with the atlas's black padding. A LeafSet is already cut
    out, already gridded, and already has a real opacity map.
    """
    out_dir = PUBLIC / "textures" / "leaf"
    marker = out_dir / f"atlas_{list(LEAF_SIZES)[0]}.webp"
    written: list[str] = []
    grid = 3

    if force or not marker.exists():
        url = f"https://ambientcg.com/get?file={asset_id}_{resolution}-PNG.zip"
        with zipfile.ZipFile(io.BytesIO(get(url))) as archive:
            names = archive.namelist()

            def read(suffix: str) -> Image.Image | None:
                match = next((n for n in names if n.endswith(f"_{suffix}.png")), None)
                if not match:
                    return None
                with archive.open(match) as handle:
                    return Image.open(io.BytesIO(handle.read()))

            colour = read("Color")
            opacity = read("Opacity")
            normal = read("NormalGL")
            rough = read("Roughness")
            if colour is None or opacity is None:
                sys.exit(f"{asset_id}: expected Color and Opacity maps")

            colour = colour.convert("RGB")
            opacity = opacity.convert("L").resize(colour.size, Image.LANCZOS)
            atlas = colour.copy()
            atlas.putalpha(opacity)
            grid = detect_grid(np.array(opacity, dtype=np.float32))

            written += save_maps(
                atlas, out_dir, "atlas", quality=Q_NORMAL, sizes=LEAF_SIZES
            )
            if normal:
                written += save_maps(
                    normal.convert("RGB"), out_dir, "atlas_normal",
                    quality=Q_NORMAL, sizes=LEAF_SIZES,
                )
            if rough:
                # No AO map in a leaf set, and it would be meaningless on a
                # flat card anyway, so red is left open and blue stays
                # dielectric.
                size = colour.size
                arm = Image.merge(
                    "RGB",
                    (
                        Image.new("L", size, 255),
                        rough.convert("L").resize(size, Image.LANCZOS),
                        Image.new("L", size, 0),
                    ),
                )
                written += save_maps(
                    arm, out_dir, "atlas_arm", quality=Q_DATA, sizes=LEAF_SIZES
                )

        (out_dir / "atlas.json").write_text(
            json.dumps({"grid": grid, "cells": grid * grid}, indent=2) + "\n"
        )
        written.append(str((out_dir / "atlas.json").relative_to(ROOT)))
        for path in written:
            print(f"  leaf {path}")
    else:
        written = [str(p.relative_to(ROOT)) for p in sorted(out_dir.iterdir())]
        grid = json.loads((out_dir / "atlas.json").read_text())["grid"]

    MANIFEST.append(
        Asset(
            key=asset_id,
            name=f"{asset_id} ({resolution} source)",
            provider="ambientCG",
            licence="CC0",
            source=f"https://ambientcg.com/view?id={asset_id}",
            note=(
                f"Cut-out broadleaf atlas, {grid}x{grid} cells, detected from the opacity channel "
                "rather than hardcoded. Colour carries opacity in its alpha; roughness is packed "
                "into the green of an ARM map."
            ),
            files=written,
        )
    )


# ------------------------------------------------------------------- record


def write_assets_md() -> None:
    lines = [
        "# Assets",
        "",
        "Every third-party asset in this project, with its source and licence.",
        "",
        "**Generated by `scripts/fetch_assets.py` — do not edit by hand.** Add an asset to the",
        "manifest in that script and re-run it, so this record cannot drift from what shipped.",
        "",
        "All of it is CC0: free to use, no attribution required. It is credited anyway.",
        "",
        "No official or copyrighted font, logo or film asset is reproduced anywhere in this",
        "project. Drop-in points for fan assets are marked `// FAN ASSET SLOT` in the source.",
        "",
    ]
    for asset in MANIFEST:
        lines += [
            f"## {asset.name}",
            "",
            f"- **Provider:** {asset.provider}",
            f"- **Licence:** {asset.licence}",
            f"- **Source:** {asset.source}",
        ]
        if asset.note:
            lines.append(f"- **Note:** {asset.note}")
        lines += ["- **Files:**", ""]
        for path in asset.files:
            lines.append(f"  - `{path}`")
        lines.append("")

    total = sum(
        (ROOT / path).stat().st_size
        for asset in MANIFEST
        for path in asset.files
        if (ROOT / path).exists()
    )
    lines += [
        "---",
        "",
        f"Total shipped asset weight: **{total / 1024 / 1024:.1f} MB**.",
        "",
        "Every texture exists at two budgets, `_2k` (desktop) and `_1k` (mobile). Leaves cap at",
        "1024/512 - they are never more than a few dozen pixels on screen.",
        "",
        "All WebP, lossy, quality per map type: colour 86, normal 94, packed data 90. Lossless",
        "was tried and is a trap for photographic maps - a 2048 normal came out at 7.3 MB alone,",
        "because noise in every pixel leaves nothing to exploit.",
        "",
        "AO and roughness ship packed as `arm` (AO red, roughness green, metalness blue), the",
        "glTF convention, rather than as two single-channel files.",
        "",
        "KTX2 would be preferable - GPU-compressed, a fraction of the VRAM - but it needs the",
        "KTX-Software or Basis encoder, which is not available in this environment.",
        "",
    ]
    (PUBLIC / "ASSETS.md").write_text("\n".join(lines))
    print(f"\n  wrote public/ASSETS.md  ({total / 1024 / 1024:.1f} MB of assets)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="re-fetch everything")
    parser.add_argument("--clean", action="store_true", help="delete fetched assets first")
    args = parser.parse_args()

    if args.clean:
        for path in (PUBLIC / "hdr", PUBLIC / "textures"):
            shutil.rmtree(path, ignore_errors=True)

    print("fetching assets...")
    fetch_hdri("kloofendal_misty_morning", "1k", args.force)
    fetch_ambientcg("Bark014", "2K", "bark", args.force)
    fetch_leaf_atlas("LeafSet024", "2K", args.force)
    write_assets_md()


if __name__ == "__main__":
    main()
