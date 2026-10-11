"""Tile screenshots into one sheet: python tools/montage.py out.jpg cols cellWidth img..."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

out, cols, cw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = [Path(f) for f in sys.argv[4:]]
ims = []
for f in files:
    im = Image.open(f).convert("RGB")
    im = im.resize((cw, round(im.height * cw / im.width)), Image.LANCZOS)
    ims.append((f.stem, im))
ch = max(im.height for _, im in ims) + 18
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, rows * ch), (24, 24, 30))
d = ImageDraw.Draw(sheet)
for k, (name, im) in enumerate(ims):
    x, y = (k % cols) * cw, (k // cols) * ch
    sheet.paste(im, (x, y))
    d.text((x + 4, y + im.height + 3), name, fill=(235, 235, 235))
sheet.save(out, quality=84)
print("wrote", out, sheet.size)
