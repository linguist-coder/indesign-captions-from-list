"""Compares the before/after PNGs from stack_test.jsx. Everything that changed
must lie inside the caption frame, plus 4 pt below it for descenders (72 ppi, so 1 px = 1 pt)."""
import sys
from pathlib import Path
from PIL import Image, ImageChops

DIR = Path(__file__).resolve().parent / "fixtures" / "stack"
for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    tag, added, bounds, report = line.split("|")
    y1, x1, y2, x2 = [float(v) for v in bounds.split(",")]
    a = Image.open(DIR / f"{tag}-before.png").convert("RGB")
    b = Image.open(DIR / f"{tag}-after.png").convert("RGB")
    diff = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > 24 else 0)
    box = diff.getbbox()
    inside = box is None or (box[0] >= x1 - 1 and box[1] >= y1 - 1 and box[2] <= x2 + 1 and box[3] <= y2 + 4)
    print(f"{tag}: added={added} caption=({y1:.0f},{x1:.0f},{y2:.0f},{x2:.0f}) changed={box} only inside caption={inside}")
    print(f"    report: {report}")
