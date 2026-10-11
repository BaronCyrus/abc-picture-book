"""Art pipeline: raw generated PNGs -> trimmed, alpha-cleaned WebP sprites.

Usage (from the project root):
    uv run --with scipy --with numpy --with pillow python tools/art.py pull
    uv run --with scipy --with numpy --with pillow python tools/art.py slice <raw-name> [--min 900]
    uv run --with scipy --with numpy --with pillow python tools/art.py build
    uv run --with scipy --with numpy --with pillow python tools/art.py contact <out.jpg> <png>...

pull     moves ~/Downloads/abcbook_*.png into art/raw/
slice    splits a "sheet" image into its separate pieces (art/parts/<name>/<i>.png, reading order)
build    reads art/manifest.json and writes public/art/*.webp + src/data/art.json
contact  makes a labelled contact sheet for eyeballing
"""

import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art/raw"
PARTS = ROOT / "art/parts"
OUT = ROOT / "public/art"
MANIFEST = ROOT / "art/manifest.json"
ART_JSON = ROOT / "src/data/art.json"


def load_rgba(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGBA"))


def clean_alpha(a: np.ndarray) -> np.ndarray:
    """Generated PNGs come back ~98% opaque in the solid areas; stretch alpha to a true 0..255."""
    al = a[..., 3].astype(np.float32)
    al = np.clip((al - 10.0) / (242.0 - 10.0), 0.0, 1.0)
    out = a.copy()
    out[..., 3] = (al * 255.0 + 0.5).astype(np.uint8)
    return out


def bbox(al: np.ndarray, thr=10):
    ys, xs = np.where(al > thr)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def trim(a: np.ndarray, pad_frac=0.035) -> np.ndarray:
    x0, y0, x1, y1 = bbox(a[..., 3])
    crop = a[y0:y1, x0:x1]
    pad = int(round(max(crop.shape[0], crop.shape[1]) * pad_frac)) + 2
    out = np.zeros((crop.shape[0] + 2 * pad, crop.shape[1] + 2 * pad, 4), np.uint8)
    out[pad:pad + crop.shape[0], pad:pad + crop.shape[1]] = crop
    return out


def bleed(a: np.ndarray, rounds=6) -> np.ndarray:
    """Spread edge colours into fully transparent pixels so filtering never pulls in black."""
    rgb = a[..., :3].astype(np.float32)
    known = a[..., 3] > 0
    for _ in range(rounds):
        if known.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros(known.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh_rgb = np.roll(rgb, (dy, dx), axis=(0, 1))
            sh_known = np.roll(known, (dy, dx), axis=(0, 1))
            acc += sh_rgb * sh_known[..., None]
            cnt += sh_known
        fill = (~known) & (cnt > 0)
        rgb[fill] = acc[fill] / cnt[fill][..., None]
        known = known | fill
    out = a.copy()
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return out


def fit(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    s = max_side / max(w, h)
    if s >= 1:
        return img
    return img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def cmd_pull():
    RAW.mkdir(parents=True, exist_ok=True)
    n = 0
    for f in sorted((Path.home() / "Downloads").glob("abcbook_*.png")):
        dest = RAW / f.name.replace("abcbook_", "", 1)
        shutil.move(str(f), dest)
        print("pulled", dest.name)
        n += 1
    print(f"{n} file(s)")


def cmd_slice(name: str, min_area=900):
    a = clean_alpha(load_rgba(RAW / f"{name}.png"))
    mask = a[..., 3] > 40
    # Close hairline gaps so one piece stays one component.
    mask = ndimage.binary_closing(mask, iterations=2)
    labels, n = ndimage.label(mask)
    pieces = []
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        area = int((labels[sl] == i).sum())
        if area < min_area:
            continue
        pieces.append((i, sl, area))
    # reading order: rows (by vertical centre, bucketed) then left to right
    H = a.shape[0]
    pieces.sort(key=lambda p: (round(((p[1][0].start + p[1][0].stop) / 2) / (H / 6)), p[1][1].start))
    out_dir = PARTS / name
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    meta = []
    for k, (i, sl, area) in enumerate(pieces):
        grow = ndimage.binary_dilation(labels == i, iterations=4)
        piece = a.copy()
        piece[..., 3] = np.where(grow, piece[..., 3], 0)
        piece = trim(piece, 0.03)
        Image.fromarray(piece).save(out_dir / f"{k}.png")
        y, x = sl
        meta.append({"i": k, "x": x.start, "y": y.start, "w": x.stop - x.start, "h": y.stop - y.start, "area": area})
        print(f"  piece {k}: {x.stop - x.start}x{y.stop - y.start} at ({x.start},{y.start}) area {area}")
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=1))
    print(f"{len(pieces)} piece(s) -> {out_dir}")


def cmd_build():
    manifest = json.loads(MANIFEST.read_text("utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "thumb").mkdir(exist_ok=True)
    info = {}
    for name, spec in manifest.items():
        if name.startswith("_"):
            continue
        src = ROOT / "art" / spec["src"]
        if not src.exists():
            print("  MISSING", name, spec["src"])
            continue
        a = load_rgba(src)
        if spec.get("clean", True):
            a = clean_alpha(a)
        if spec.get("trim", True):
            a = trim(a, spec.get("pad", 0.035))
        if spec.get("box"):
            # Paste bottom-centred on a fixed canvas so swappable frames line up.
            bw, bh = spec["box"]
            x0, y0, x1, y1 = bbox(a[..., 3])
            crop = a[y0:y1, x0:x1]
            canvas = np.zeros((bh, bw, 4), np.uint8)
            ox = (bw - crop.shape[1]) // 2
            oy = bh - crop.shape[0] - spec.get("boxpad", 8)
            canvas[oy:oy + crop.shape[0], ox:ox + crop.shape[1]] = crop
            a = canvas
        if spec.get("flip"):
            a = a[:, ::-1]
        img = fit(Image.fromarray(bleed(a)), spec.get("max", 768))
        img.save(OUT / f"{name}.webp", "WEBP", quality=spec.get("q", 88), alpha_quality=95, method=6, exact=True)
        info[name] = {"w": img.width, "h": img.height}
        if spec.get("thumb"):
            fit(img, 168).save(OUT / "thumb" / f"{name}.webp", "WEBP", quality=84, alpha_quality=90, method=6, exact=True)
        print(f"  {name:22s} {img.width}x{img.height}  {(OUT / (name + '.webp')).stat().st_size // 1024} KB")
    ART_JSON.write_text(json.dumps(info, indent=1, sort_keys=True) + "\n")
    print(f"{len(info)} sprite(s)")


def cmd_contact(out: str, files, cell=300, cols=5, bg=(74, 118, 168)):
    files = [Path(f) for f in files]
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 22)), (30, 30, 36))
    d = ImageDraw.Draw(sheet)
    for k, f in enumerate(files):
        im = Image.open(f).convert("RGBA")
        im.thumbnail((cell - 12, cell - 12), Image.LANCZOS)
        tile = Image.new("RGBA", (cell, cell), bg + (255,))
        tile.alpha_composite(im, ((cell - im.width) // 2, (cell - im.height) // 2))
        x, y = (k % cols) * cell, (k // cols) * (cell + 22)
        sheet.paste(tile.convert("RGB"), (x, y))
        d.text((x + 6, y + cell + 4), f"{f.parent.name}/{f.stem}", fill=(240, 240, 240))
    sheet.save(out, quality=86)
    print("wrote", out)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
    elif args[0] == "pull":
        cmd_pull()
    elif args[0] == "slice":
        m = 900
        if "--min" in args:
            m = int(args[args.index("--min") + 1])
        cmd_slice(args[1], m)
    elif args[0] == "build":
        cmd_build()
    elif args[0] == "contact":
        cmd_contact(args[1], args[2:])
    else:
        print(__doc__)
