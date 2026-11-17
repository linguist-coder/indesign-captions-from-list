"""Make test images and caption lists for CaptionsFromList.jsx.

Images go to tests/fixtures/img/ (28 files).
Lists go to tests/fixtures/ :
  captions.csv       Excel-style "CSV UTF-8" (BOM, CRLF, quoted cells)
  captions-v2.csv    same list with two captions changed and one row removed
  captions-semi.csv  semicolon-separated (Excel in many European locales)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "fixtures"
IMG = OUT / "img"
IMG.mkdir(parents=True, exist_ok=True)
(OUT / "stack").mkdir(exist_ok=True)  # PNGs from stack_test.jsx

COLORS = ["#3b6ea5", "#a5523b", "#4f8a4b", "#8a6d3b", "#6b4f8a", "#3b8a85", "#8a3b62"]
try:
    FONT = ImageFont.truetype("arial.ttf", 64)
except OSError:
    FONT = ImageFont.load_default()

names = []
for i in range(1, 29):
    ext = "jpg" if i % 3 else "png"
    name = f"img-{i:03d}.{ext}"
    if i == 7:
        name = "IMG-007.JPG"           # upper-case on disk
    names.append(name)
    w, h = (1200, 800) if i % 4 else (800, 1000)
    im = Image.new("RGB", (w, h), COLORS[i % len(COLORS)])
    d = ImageDraw.Draw(im)
    d.text((40, 40), name, fill="white", font=FONT)
    fmt = "PNG" if name.lower().endswith("png") else "JPEG"
    im.save(IMG / name, fmt, dpi=(300, 300))

(OUT / "names.txt").write_text("\n".join(names), encoding="ascii")


def caption(i):
    return f"Figure {i}. Caption text for image {i}."


rows = []
for i in range(1, 29):
    n = names[i - 1]
    if i in (20, 21):
        continue                        # in the document, not in the list
    key = n
    if i == 1:
        key = "img-001"                 # no extension
    if i == 2:
        key = "IMG-002.JPG"             # different case
    if i == 7:
        key = "img-007.jpg"             # file on disk is IMG-007.JPG
    if i == 27:
        key = "  img-027.JPG  "         # spaces, case, and .png on disk
    text = caption(i)
    if i == 3:
        text = 'Harbor at dawn, "before the storm", 1968.'   # comma and quotes
    if i == 6:
        text = "Café terrace, Ålesund\nPhoto: A. Nørgaard"  # line break in cell
    if i == 9:
        text = ""                       # empty caption
    if i == 11:
        text = "A long caption that should wrap onto several lines in a narrow frame. " * 3
    rows.append((key, text.strip()))

rows.insert(5, ("img-004.jpg", "Second row for the same image."))  # duplicate row
rows.append(("interview", "Matches interview.jpg and interview.tif."))   # ambiguous base name
rows.append(("shared.jpg", "Same file name in two folders."))            # ambiguous full name
rows.append(("map.v2", "Map, second version."))                         # dot in the base name
rows.append(("img-099.jpg", "This image is not in the document."))
rows.append(("cover.jpg", "Cover photo."))                               # relinked later to another folder
rows.append(("low.jpg", "An image at the very bottom of the page."))     # caption falls below the page


def cell(s):
    if any(c in s for c in ',;"\n'):
        return '"' + s.replace('"', '""') + '"'
    return s


def write(path, rows, sep):
    lines = [sep.join(["File", "Caption"])] + [sep.join([cell(a), cell(b)]) for a, b in rows]
    path.write_bytes(("﻿" + "\r\n".join(lines) + "\r\n").encode("utf-8"))


write(OUT / "captions.csv", rows, ",")
write(OUT / "captions-semi.csv", rows, ";")

v2 = []
for k, t in rows:
    if k == "img-010.jpg":
        t = "Figure 10 (revised). New wording from the editor."
    if k == "img-012.png":
        t = "Figure 12 (revised)."
    if k == "img-013.jpg":
        continue                        # editor dropped this caption
    v2.append((k, t))
v2 = [(k, "Figure 8 (revised).") if k == "img-008.jpg" else (k, t) for k, t in v2]   # caption is threaded
v2 = [(k, "Figure 18 (revised). " + "A much longer caption for an image near the page bottom. " * 4)
      if k.startswith("img-018") else (k, t) for k, t in v2]
v2.append(("relinked.jpg", "Caption for the relinked file."))
write(OUT / "captions-v2.csv", v2, ",")

# extra images: same base name, same name in two folders, a dot in the base name, a relink target
def img(path, label, fmt):
    path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.new("RGB", (1200, 800), "#555555")
    ImageDraw.Draw(im).text((40, 40), label, fill="white", font=FONT)
    im.save(path, fmt, dpi=(300, 300))
img(IMG / "interview.jpg", "interview.jpg", "JPEG")
img(IMG / "interview.tif", "interview.tif", "TIFF")
img(IMG / "a" / "shared.jpg", "a/shared.jpg", "JPEG")
img(IMG / "b" / "shared.jpg", "b/shared.jpg", "JPEG")
img(IMG / "map.v2.jpg", "map.v2.jpg", "JPEG")
img(IMG / "relinked.jpg", "relinked.jpg", "JPEG")
img(IMG / "a" / "cover.jpg", "a/cover.jpg", "JPEG")
img(IMG / "b" / "cover.jpg", "b/cover.jpg", "JPEG")
img(IMG / "harbor.tif", "harbor.tif", "TIFF")
img(IMG / "map.jpg", "map.jpg", "JPEG")
img(IMG / "photo.jpg.tif", "photo.jpg.tif", "TIFF")
img(IMG / "low.jpg", "low.jpg", "JPEG")

# lists the script must refuse before it changes anything
BAD = OUT / "bad"
BAD.mkdir(exist_ok=True)
NL = "\r\n"


def raw(name, lines, enc="utf-8", bom=True):
    text = NL.join(lines) + NL
    (BAD / name).write_bytes((("﻿" if bom else "") + text).encode(enc))


raw("unquoted-comma.csv", ["File,Caption", "img-001.jpg,Harbor, 1968"])
raw("unclosed-quote.csv", ["File,Caption", 'img-001.jpg,"Harbor 1968', "img-002.jpg,Second"])
raw("no-header.csv", ["img-001.jpg,Harbor", "img-002.jpg,Second"])
raw("quoted-header-semi.csv", ['"File, name";"Caption, text"', "img-001.jpg;Harbor"])
raw("quote-mid-cell.csv", ["File,Caption", 'img-001.jpg,A 5" screen'])
raw("ansi.csv", ["File,Caption", "img-001.jpg,Café"], enc="cp1252", bom=False)
raw("utf16.csv", ["File,Caption", "img-001.jpg,Café"], enc="utf-16", bom=False)
raw("extra-header.csv", ["File,Caption,Notes", "img-001.jpg,Harbor,"])
raw("nul.csv", ["File,Caption", "img-001.jpg,Har" + chr(0) + "bor"])
(BAD / "utf16-ascii.csv").write_bytes("File,Caption\r\nimg-001.jpg,Harbor\r\n".encode("utf-16"))  # BOM, ASCII only
(BAD / "ansi-cr.csv").write_bytes("File,Caption\rimg-001.jpg,Caf\xe9\r".encode("cp1252"))        # old Mac line ends

# match order: an exact row must win wherever it is in the list
ORD = OUT / "order"
ORD.mkdir(exist_ok=True)


def lst(name, rows):
    write(ORD / name, rows, ",")


lst("jpg-first.csv", [("harbor.jpg", "From the .jpg row."), ("harbor.tif", "From the exact row.")])
lst("tif-first.csv", [("harbor.tif", "From the exact row."), ("harbor.jpg", "From the .jpg row.")])
lst("base-first.csv", [("harbor", "From the row without extension."), ("harbor.tif", "From the exact row.")])
lst("only-jpg.csv", [("harbor.jpg", "From the .jpg row."), ("map.v2", "Map, second version.")])
# a valid UTF-8 list may contain U+FFFD itself
lst("fffd.csv", [("harbor.tif", "Unknown sign " + chr(0xFFFD) + " in the source.")])
lst("blank-exact.csv", [("harbor.tif", ""), ("harbor", "From the row without extension.")])
lst("stem.csv", [("photo.jpg", "From the photo.jpg row."), ("harbor.tif", "From the exact row.")])
lst("ok-harbor.csv", [("harbor.tif", "From the exact row.")])
lst("fffd-exact.csv", [("harbor.tif", "Bad sign " + chr(0xFFFD) + " here."), ("harbor", "From the row without extension.")])
print("ok", len(names), "images,", len(rows), "rows")
