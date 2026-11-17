// CaptionsFromList.jsx
// Adds captions to placed images in the active InDesign document from a
// list (CSV) that pairs image file names with caption text.
//
// The list:
//   - the first row must be the header File,Caption and nothing else
//   - column 1 = image file name as shown in the Links panel. Letter case
//     does not matter. The extension can be left off when the name has no
//     other dot and only one placed file has that name. Any other row that
//     does not give the full file name is not used; the report names the
//     file it would have matched.
//   - column 2 = caption text. A line break inside a cell becomes a forced
//     line break in the caption.
//   - save from Excel as "CSV UTF-8". Comma, semicolon and tab separators
//     are detected from the header row.
//   - if the file is not UTF-8 or a row cannot be read (for example a
//     caption with a comma but no quotes), the script stops before it
//     changes the document.
//
// For each image whose file name is in the list, the script places a text
// frame under the image frame, as wide as the image frame, and groups the
// two. Run it again after the list changes: the text in the captions it
// placed before is replaced, and no second frame is made. A caption whose
// image was relinked to a file of the same name in another folder is skipped
// unless you tick "Accept all same-name relinks matched by this list" in the dialog.
//
// It saves a report (CSV) next to the document. One Edit > Undo reverts
// the changes to the document.
//
// Linguist Coder - https://www.linguist-coder.com/

var CFL_LABEL = "captionsFromList";          // on a caption: id of its image frame
var CFL_TEXT_LABEL = "captionsFromListText"; // on a caption: the list text it was made from
var CFL_FILE_LABEL = "captionsFromListFile"; // on a caption: the image file name it was made for
var CFL_PATH_LABEL = "captionsFromListPath"; // on a caption: the full path of that file

// ---------- list ----------

// Returns the position of the first byte that is not valid UTF-8, or -1.
function cflUtf8Error(b) {
  var i = 0, n = b.length, c, d, need, lo, hi, k;
  while (i < n) {
    c = b.charCodeAt(i);
    if (c < 0x80) { i++; continue; }
    lo = 0x80; hi = 0xBF;
    if (c >= 0xC2 && c <= 0xDF) need = 1;
    else if (c >= 0xE0 && c <= 0xEF) { need = 2; if (c === 0xE0) lo = 0xA0; if (c === 0xED) hi = 0x9F; }
    else if (c >= 0xF0 && c <= 0xF4) { need = 3; if (c === 0xF0) lo = 0x90; if (c === 0xF4) hi = 0x8F; }
    else return i;
    for (k = 1; k <= need; k++) {
      d = i + k < n ? b.charCodeAt(i + k) : -1;
      if (k === 1 ? (d < lo || d > hi) : (d < 0x80 || d > 0xBF)) return i;
    }
    i += need + 1;
  }
  return -1;
}

function cflLineAt(s, pos) {
  var n = 1;
  for (var i = 0; i < pos; i++) {
    var c = s.charAt(i);
    if (c === "\n" || (c === "\r" && s.charAt(i + 1) !== "\n")) n++;
  }
  return n;
}

// Decodes bytes that cflUtf8Error has accepted.
function cflDecodeUtf8(b) {
  var out = [], i = 0, n = b.length, c, cp;
  while (i < n) {
    c = b.charCodeAt(i);
    if (c < 0x80) { cp = c; i += 1; }
    else if (c < 0xE0) { cp = ((c & 0x1F) << 6) | (b.charCodeAt(i + 1) & 0x3F); i += 2; }
    else if (c < 0xF0) { cp = ((c & 0x0F) << 12) | ((b.charCodeAt(i + 1) & 0x3F) << 6) | (b.charCodeAt(i + 2) & 0x3F); i += 3; }
    else {
      cp = ((c & 0x07) << 18) | ((b.charCodeAt(i + 1) & 0x3F) << 12) | ((b.charCodeAt(i + 2) & 0x3F) << 6) | (b.charCodeAt(i + 3) & 0x3F);
      i += 4;
    }
    if (cp > 0xFFFF) { cp -= 0x10000; out.push(String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF))); }
    else out.push(String.fromCharCode(cp));
  }
  return out.join("");
}

function cflReadText(file) {
  // open() may detect an encoding and skip a byte order mark, so switch to
  // binary after opening and read from the first byte.
  if (!file.open("r")) throw new Error("Cannot open " + file.fsName);
  var bytes;
  try {
    file.encoding = "BINARY";
    if (!file.seek(0)) throw new Error("Cannot read " + file.fsName + " from the start.");
    bytes = file.read();
    if (file.error) throw new Error("Cannot read " + file.fsName + ": " + file.error);
  } finally {
    file.close();
  }
  var bad = cflUtf8Error(bytes);
  if (bad >= 0) throw new Error("The list is not saved as UTF-8 (line " + cflLineAt(bytes, bad) +
    " of the file). In Excel, save it as CSV UTF-8.");
  var s = cflDecodeUtf8(bytes);
  if (s.charCodeAt(0) === 0xFEFF) s = s.substring(1);
  var nul = s.indexOf(String.fromCharCode(0));
  if (nul >= 0) throw new Error("Line " + cflLineAt(s, nul) + " of the list contains a NUL character. Check the file.");
  return s;
}

// Counts separators in the header row, outside quotes.
function cflDetectSeparator(text) {
  var counts = { ",": 0, ";": 0, "\t": 0 }, q = false, best = ",", n = 0;
  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i);
    if (c === '"') q = !q;
    else if (!q && (c === "\r" || c === "\n")) break;
    else if (!q && counts.hasOwnProperty(c)) counts[c]++;
  }
  for (var k in counts) if (counts.hasOwnProperty(k) && counts[k] > n) { n = counts[k]; best = k; }
  return best;
}

// RFC 4180 style: quoted cells may hold separators, "" and line breaks.
// Throws on quotes that do not follow those rules. Row numbers in the
// messages are spreadsheet rows.
function cflParseCsv(text, sep) {
  var rows = [], row = [], cell = "", q = false, i = 0, c;
  function bad(msg) { throw new Error("Row " + (rows.length + 1) + " of the list: " + msg); }
  while (i < text.length) {
    c = text.charAt(i);
    if (q) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') { cell += '"'; i += 2; continue; }
        q = false; i++;
        var next = text.charAt(i);
        if (i < text.length && next !== sep && next !== "\r" && next !== "\n") bad("text after a closing quote.");
        continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') {
      if (cell !== "") bad("a quote inside a cell that does not start with a quote.");
      q = true; i++; continue;
    }
    if (c === sep) { row.push(cell); cell = ""; i++; continue; }
    if (c === "\r" || c === "\n") {
      if (c === "\r" && text.charAt(i + 1) === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = ""; i++; continue;
    }
    cell += c; i++;
  }
  if (q) bad("a quote that is never closed.");
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function cflTrim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }

// Returns { rows: [{name, text, line}], problems: [[status, file, page, detail]] }
function cflLoadList(file) {
  var text = cflReadText(file);
  var rows = cflParseCsv(text, cflDetectSeparator(text));
  var h = rows.length ? rows[0] : [], extra = false;
  for (var x0 = 2; x0 < h.length; x0++) if (cflTrim(h[x0]) !== "") extra = true;
  if (h.length < 2 || extra || cflTrim(h[0]).toLowerCase() !== "file" || cflTrim(h[1]).toLowerCase() !== "caption")
    throw new Error("The first row of the list must be the header File,Caption, with no other columns.");
  var out = [], problems = [];
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r], line = r + 1;
    for (var x = 2; x < row.length; x++) {
      if (cflTrim(row[x]) !== "")
        throw new Error("Row " + line + " of the list has more than two columns. " +
          "A caption that contains the separator must be in quotes (Excel does this when it saves).");
    }
    var name = row.length ? cflTrim(row[0]) : "";
    var cap = row.length > 1 ? cflTrim(row[1].replace(/\r\n|\r/g, "\n")) : "";
    if (name === "" && cap === "") continue;
    if (name === "") { problems.push(["no file name (row ignored)", "", "", "row " + line]); continue; }
    var invalid = cap.indexOf(String.fromCharCode(0xFFFD)) >= 0;
    if (invalid) {
      // InDesign drops U+FFFD when the text goes into a frame. The row still
      // claims its file, so a looser row cannot supply other text.
      problems.push(["caption contains the replacement character U+FFFD (row has no usable text)", name, "", "row " + line]);
      cap = "";
    }
    out.push({ name: name, text: cap, line: line, invalid: invalid });
  }
  return { rows: out, problems: problems };
}

// ---------- document ----------

function cflPageName(item) {
  try { var p = item.parentPage; return p ? p.name : ""; } catch (e) { return ""; }
}

function cflOnParentPage(item) {
  try {
    var p = item.parentPage;
    return p && p.parent instanceof MasterSpread;
  } catch (e) { return false; }
}

function cflLocked(item) {
  try { return item.locked || item.itemLayer.locked; } catch (e) { return true; }
}

function cflHidden(item) {
  try { return !item.visible || !item.itemLayer.visible; } catch (e) { return false; }
}

function cflBaseName(lower) {
  var d = lower.lastIndexOf(".");
  return d > 0 ? lower.substring(0, d) : lower;
}

// Placed images outside parent pages, grouped by file.
// Returns { files: {path: {name, path, places: [{img, holder, page}], row, emptyRow}},
//           byName: {lower name: [paths]}, byBase: {lower base name: [paths]} }
function cflIndexImages(doc) {
  var files = {}, byName = {}, byBase = {}, graphics = doc.allGraphics;
  function add(map, key, path) {
    if (!map.hasOwnProperty(key)) map[key] = [];
    for (var j = 0; j < map[key].length; j++) if (map[key][j] === path) return;
    map[key].push(path);
  }
  for (var g = 0; g < graphics.length; g++) {
    var img = graphics[g], link = null;
    try { link = img.itemLink; } catch (e) {}
    if (!link || cflOnParentPage(img)) continue;
    var path = link.filePath, lower = link.name.toLowerCase();
    if (!files.hasOwnProperty(path)) files[path] = { name: link.name, path: path, places: [], row: null, emptyRow: 0 };
    files[path].places.push({ img: img, holder: img.parent, page: cflPageName(img.parent) });
    add(byName, lower, path);
    add(byBase, cflBaseName(lower), path);
  }
  return { files: files, byName: byName, byBase: byBase };
}

// Captions placed by an earlier run, keyed by the image frame id.
function cflEarlierCaptions(doc) {
  var map = {}, items = doc.allPageItems;
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (!(it instanceof TextFrame)) continue;
    var v = it.extractLabel(CFL_LABEL);
    if (v === "") continue;
    if (!map.hasOwnProperty(v)) map[v] = [];
    map[v].push(it);
  }
  return map;
}

function cflSetCaption(frame, text, pStyle, fileName, path) {
  frame.contents = text;
  frame.parentStory.paragraphs.everyItem().applyParagraphStyle(pStyle, true);
  frame.insertLabel(CFL_TEXT_LABEL, text);
  frame.insertLabel(CFL_FILE_LABEL, fileName);
  frame.insertLabel(CFL_PATH_LABEL, path);
}

function cflBoxesOverlap(a, b) {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

function cflContains(a, b) {
  return a[0] <= b[0] && a[1] <= b[1] && a[2] >= b[2] && a[3] >= b[3];
}

// Objects on the spread whose frame bounds overlap the caption frame, text
// frames first. Not counted: the caption's own image, hidden objects, and an
// object other than a text frame that covers the whole page from a layer
// below the image's layer (a background). A full-page object on the same
// layer or above is reported, marked "covers the page", because the script
// cannot tell whether it is in front of the caption.
function cflOverlaps(frame, holder, pg) {
  var spread = pg.parent, fb = frame.geometricBounds, pb = pg.bounds, mine = holder.itemLayer.index;
  var items = spread.allPageItems, texts = [], others = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it instanceof Group || it.id === frame.id || it.id === holder.id) continue;
    if (!(it.parent instanceof Spread || it.parent instanceof Group)) continue; // frame contents, anchored items
    if (cflHidden(it)) continue;
    var ob = it.geometricBounds;
    if (!cflBoxesOverlap(fb, ob)) continue;
    var kind = it.getElements()[0].constructor.name, page = kind !== "TextFrame" && cflContains(ob, pb);
    if (page && it.itemLayer.index > mine) continue; // layers[0] is the top layer
    (kind === "TextFrame" ? texts : others).push(kind + (page ? " (covers the page)" : ""));
  }
  var hits = texts.concat(others), out = hits.slice(0, 3);
  if (hits.length > 3) out.push((hits.length - 3) + " more");
  return out;
}

// Layout checks for a caption frame that was added or updated. They run
// after every caption is placed, so a frame that grew later is seen.
function cflCheck(c, report) {
  var frame = c.frame, pg = c.holder.parentPage, fb = frame.geometricBounds;
  function add(s, d) { report.push([c.what + ", " + s, c.name, c.page, d || ""]); }
  if (frame.parentStory.overflows) add("text overset");
  if (!pg) return;
  var pb = pg.bounds, mb = pg.marginPreferences.bottom;
  if (fb[0] >= pb[2]) add("frame is below the page");
  else if (fb[2] > pb[2]) add("frame runs past the bottom of the page");
  else if (fb[2] > pb[2] - mb) add("frame runs into the bottom margin");
  var hits = cflOverlaps(frame, c.holder, pg);
  if (hits.length) add("frame overlaps another object", hits.join("; "));
}

function cflRestoreLayer(doc, was) {
  // A locked layer cannot be made active by script, so unlock it for a moment.
  var relock = false;
  try {
    relock = was.locked;
    if (relock) was.locked = false;
    doc.activeLayer = was;
  } finally {
    if (relock) was.locked = true;
  }
}

function cflMakeCaption(holder, text, fileName, path, opt) {
  var b = holder.visibleBounds; // [y1, x1, y2, x2]
  var page = holder.parentPage;
  var top = b[2] + opt.gap;
  // New groups go on the active layer, and fail if that layer is locked.
  // Make the image's layer active while the frame and the group are made.
  var doc = page.parent.parent, was = doc.activeLayer, f = null, grp = null;
  try {
    doc.activeLayer = holder.itemLayer;
    f = page.textFrames.add(holder.itemLayer, LocationOptions.AT_END, {
      geometricBounds: [top, b[1], top + 20, b[3]]
    });
    f.sendToBack(holder); // directly behind the image; the group then keeps the image's place
    if (opt.oStyle) f.applyObjectStyle(opt.oStyle, true);
    // Fit the height to the text unless the object style already sizes the frame.
    if (f.textFramePreferences.autoSizingType === AutoSizingTypeEnum.OFF) {
      f.textFramePreferences.autoSizingReferencePoint = AutoSizingReferenceEnum.TOP_CENTER_POINT;
      f.textFramePreferences.autoSizingType = AutoSizingTypeEnum.HEIGHT_ONLY;
    }
    cflSetCaption(f, text, opt.pStyle, fileName, path);
    f.insertLabel(CFL_LABEL, String(holder.id));
    grp = page.groups.add([holder, f]);
  } finally {
    if (!grp && f) { try { f.remove(); } catch (e) {} }
    cflRestoreLayer(doc, was);
  }
  return { frame: f, group: grp };
}

function cflTake(row, paths, idx, report) {
  if (paths.length > 1) {
    if (row.text !== "")
      report.push(["matches more than one file (row ignored)", row.name, "", "row " + row.line + ": " + paths.join("; ")]);
    return;
  }
  var file = idx.files[paths[0]], first = file.row ? file.row.line : file.emptyRow;
  if (first) {
    report.push(["duplicate row (row " + first + " used)", row.name, "", "row " + row.line]);
    return;
  }
  if (row.text === "") file.emptyRow = row.line;
  else file.row = row;
}

// Matches list rows to placed files in passes over the whole list, so a row
// with the exact file name always wins over a looser one. For each file the
// first row that matches is used, even if its caption is empty.
// 1. the exact file name  2. a row with no dot, against names without extension
// 3. what is left: not in the document, or a near match that is reported only.
function cflMatchRows(rows, idx, report) {
  var pass2 = [], pass3 = [], i, row, key;
  for (i = 0; i < rows.length; i++) {
    row = rows[i]; key = row.name.toLowerCase();
    if (row.text === "" && !row.invalid) report.push(["empty caption (no text for this file)", row.name, "", "row " + row.line]);
    if (idx.byName.hasOwnProperty(key)) cflTake(row, idx.byName[key], idx, report);
    else pass2.push(row);
  }
  for (i = 0; i < pass2.length; i++) {
    row = pass2[i]; key = row.name.toLowerCase();
    if (key.indexOf(".") < 0 && idx.byBase.hasOwnProperty(key)) cflTake(row, idx.byBase[key], idx, report);
    else pass3.push(row);
  }
  for (i = 0; i < pass3.length; i++) {
    row = pass3[i]; key = row.name.toLowerCase();
    if (row.text === "") continue;
    var near = [], keys = [key, cflBaseName(key)];
    for (var k = 0; k < keys.length; k++) {
      if (!idx.byBase.hasOwnProperty(keys[k])) continue;
      for (var j = 0; j < idx.byBase[keys[k]].length; j++) {
        var nm = idx.files[idx.byBase[keys[k]][j]].name;
        if (("; " + near.join("; ") + ";").indexOf("; " + nm + ";") < 0) near.push(nm);
      }
    }
    if (near.length)
      report.push(["only a similar file name is placed (row ignored)", row.name, "", "row " + row.line + ": " + near.join("; ")]);
    else report.push(["in the list but not in the document", row.name, "", "row " + row.line]);
  }
}

// opt = { list: File, pStyle: ParagraphStyle, oStyle: ObjectStyle|null, gap: Number (points),
//         acceptMoved: Boolean }
// Returns { report: [[status, file, page, detail]], counts: {...}, restore: [settings not restored] }
// opt.notRestored gets the same list, so a run that throws can still show it.
function cflRun(doc, opt) {
  var loaded;
  try { loaded = cflLoadList(opt.list); } // throws before anything changes
  catch (e) { e.listError = true; throw e; }
  var report = loaded.problems.slice(0);
  var counts = { added: 0, updated: 0, unchanged: 0, skipped: 0 };
  var vp = doc.viewPreferences, saved = null, notRestored = [];
  opt.notRestored = notRestored;

  try {
    saved = { h: vp.horizontalMeasurementUnits, v: vp.verticalMeasurementUnits,
      o: vp.rulerOrigin, z: doc.zeroPoint };
    vp.horizontalMeasurementUnits = MeasurementUnits.POINTS;
    vp.verticalMeasurementUnits = MeasurementUnits.POINTS;
    vp.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
    doc.zeroPoint = [0, 0];

    var idx = cflIndexImages(doc);
    var earlier = cflEarlierCaptions(doc), visited = {}, checks = [];
    cflMatchRows(loaded.rows, idx, report);

    for (var path in idx.files) {
      if (!idx.files.hasOwnProperty(path)) continue;
      var file = idx.files[path], name = file.name, row = file.row;
      if (row && file.places.length > 1) {
        var pages = [];
        for (var q = 0; q < file.places.length; q++) pages.push(file.places[q].page || "pasteboard");
        report.push(["placed " + file.places.length + " times", name, pages.join(", "), "row " + row.line]);
      }
      for (var n = 0; n < file.places.length; n++) {
        var place = file.places[n], holder = place.holder, page = place.page;
        var id = String(holder.id), olds = earlier[id] || [], old = olds[0];
        visited[id] = true;

        if (!row) {
          if (olds.length) report.push(["has an earlier caption but no usable row now (left as is)", name, page, ""]);
          else if (!file.emptyRow) report.push(["no usable row in the list", name, page, ""]);
          continue;
        }

        var skip = "";
        if (cflHidden(holder)) skip = "image or its layer is hidden";
        else if (olds.length) {
          if (olds.length > 1) skip = olds.length + " caption frames carry this image's mark (copied?)";
          else if (old.extractLabel(CFL_FILE_LABEL).toLowerCase() !== name.toLowerCase())
            skip = "the image was relinked to a different file after the caption was made";
          else if (!(old.parent instanceof Group) || old.parent.id !== holder.parent.id)
            skip = "the caption is not grouped with this image";
          else if (old.previousTextFrame || old.nextTextFrame) skip = "the caption is threaded to another frame";
          else if (cflLocked(old)) skip = "the caption or its layer is locked";
          else if (cflHidden(old)) skip = "the caption or its layer is hidden";
        } else {
          if (page === "") skip = "image is on the pasteboard";
          else if (holder.parent instanceof Character) skip = "image is anchored in text";
          else if (holder.parent instanceof Group) skip = "image is inside a group";
          else if (!(holder.parent instanceof Spread)) skip = "image is inside another object";
          else if (cflLocked(holder)) skip = "image or its layer is locked";
        }
        if (skip) { report.push(["skipped: " + skip, name, page, "row " + row.line]); counts.skipped++; continue; }

        if (olds.length) {
          var was = old.extractLabel(CFL_PATH_LABEL);
          if (was !== path) {
            if (!opt.acceptMoved) {
              report.push(["skipped: the image was relinked to a file of the same name in another folder", name, page, "was " + was + "; now " + path]);
              counts.skipped++;
              continue;
            }
            report.push(["accepted: the image was relinked to a file of the same name in another folder", name, page, "was " + was + "; now " + path]);
            old.insertLabel(CFL_PATH_LABEL, path);
          }
          // Compare with the list text used last time, not with the frame:
          // InDesign may have changed quotes, and hand edits stay until the list changes.
          if (old.extractLabel(CFL_TEXT_LABEL) === row.text) { counts.unchanged++; continue; }
          cflSetCaption(old, row.text, opt.pStyle, name, path);
          counts.updated++;
          report.push(["updated", name, page, "row " + row.line]);
          checks.push({ frame: old, holder: holder, what: "updated", name: name, page: page });
          continue;
        }

        var made = cflMakeCaption(holder, row.text, name, path, opt);
        counts.added++;
        checks.push({ frame: made.frame, holder: holder, what: "added", name: name, page: page });
      }
    }

    for (var k = 0; k < checks.length; k++) cflCheck(checks[k], report);

    for (var e in earlier) {
      if (!earlier.hasOwnProperty(e) || visited.hasOwnProperty(e)) continue;
      for (var o = 0; o < earlier[e].length; o++)
        report.push(["caption whose image was not found (left as is)", "", cflPageName(earlier[e][o]),
          earlier[e][o].parentStory.contents.substring(0, 40)]);
    }
  } finally {
    if (saved) {
      try { vp.horizontalMeasurementUnits = saved.h; } catch (e1) { notRestored.push("horizontal ruler units"); }
      try { vp.verticalMeasurementUnits = saved.v; } catch (e2) { notRestored.push("vertical ruler units"); }
      try { vp.rulerOrigin = saved.o; } catch (e3) { notRestored.push("ruler origin"); }
      try { doc.zeroPoint = saved.z; } catch (e4) { notRestored.push("zero point"); }
      if (notRestored.length) report.push(["could not restore: " + notRestored.join(", "), "", "", ""]);
    }
  }
  return { report: report, counts: counts, restore: notRestored };
}

function cflCsvCell(s) {
  s = String(s);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function cflWriteReport(file, report) {
  var lines = ["Status,File,Page,Detail"];
  for (var i = 0; i < report.length; i++) {
    var r = report[i], c = [];
    for (var j = 0; j < r.length; j++) c.push(cflCsvCell(r[j]));
    lines.push(c.join(","));
  }
  file.encoding = "UTF-8";
  file.lineFeed = "Windows";
  if (!file.open("w")) throw new Error("Cannot write " + file.fsName);
  var wrote = file.write(String.fromCharCode(0xFEFF) + lines.join("\n") + "\n");
  var closed = file.close();
  if (!wrote || !closed) throw new Error("Writing " + file.fsName + " failed" + (file.error ? ": " + file.error : "."));
}

// ---------- dialog ----------

function cflAsk(doc) {
  var list = File.openDialog("Choose the caption list (CSV)", "CSV:*.csv;*.txt,All files:*.*");
  if (!list) return null;

  var pNames = [], pItems = doc.allParagraphStyles;
  for (var i = 0; i < pItems.length; i++) pNames.push(pItems[i].name);
  var oNames = ["(none)"], oItems = doc.allObjectStyles;
  for (var j = 0; j < oItems.length; j++) oNames.push(oItems[j].name);
  var pDefault = 0;
  for (var a = 0; a < pNames.length; a++) if (/caption/i.test(pNames[a])) { pDefault = a; break; }
  var oDefault = 0;
  for (var b = 0; b < oItems.length; b++) if (/caption/i.test(oItems[b].name)) { oDefault = b + 1; break; }

  var d = app.dialogs.add({ name: "Captions from List" });
  var col = d.dialogColumns.add();
  col.staticTexts.add({ staticLabel: "List: " + list.name });
  var r1 = col.dialogRows.add();
  r1.staticTexts.add({ staticLabel: "Paragraph style:", minWidth: 110 });
  var pDrop = r1.dropdowns.add({ stringList: pNames, selectedIndex: pDefault, minWidth: 220 });
  var r2 = col.dialogRows.add();
  r2.staticTexts.add({ staticLabel: "Object style:", minWidth: 110 });
  var oDrop = r2.dropdowns.add({ stringList: oNames, selectedIndex: oDefault, minWidth: 220 });
  var r3 = col.dialogRows.add();
  r3.staticTexts.add({ staticLabel: "Gap below image:", minWidth: 110 });
  var gap = r3.measurementEditboxes.add({ editValue: 4, editUnits: doc.viewPreferences.verticalMeasurementUnits });
  var moved = col.checkboxControls.add({ staticLabel: "Accept all same-name relinks matched by this list", checkedState: false });

  if (!d.show()) { d.destroy(); return null; }
  var opt = {
    list: list,
    pStyle: pItems[pDrop.selectedIndex],
    oStyle: oDrop.selectedIndex > 0 ? oItems[oDrop.selectedIndex - 1] : null,
    gap: gap.editValue, // measurementEditbox returns points
    acceptMoved: moved.checkedState
  };
  d.destroy();
  return opt;
}

function cflTwo(n) { return (n < 10 ? "0" : "") + n; }

// A new file for every run, so an earlier report is never overwritten.
function cflReportFile(doc, list) {
  var base = doc.name.replace(/\.indd$/i, ""), folder, t = new Date();
  try { folder = doc.filePath; } catch (e) { folder = Folder.desktop; }
  var stamp = t.getFullYear() + cflTwo(t.getMonth() + 1) + cflTwo(t.getDate()) + "-" +
    cflTwo(t.getHours()) + cflTwo(t.getMinutes()) + cflTwo(t.getSeconds());
  var f = File(folder + "/" + base + "-captions-" + stamp + ".csv"), n = 2;
  while (f.exists || f.fsName === list.fsName) f = File(folder + "/" + base + "-captions-" + stamp + "-" + (n++) + ".csv");
  return f;
}

// Returns { file, error }. Never throws, so the counts can still be shown.
function cflSaveReport(doc, list, report) {
  var rf = null;
  try {
    rf = cflReportFile(doc, list);
    cflWriteReport(rf, report);
    return { file: rf, error: "" };
  } catch (e) {
    return { file: rf, error: e.message };
  }
}

function cflMain() {
  if (!app.documents.length) { alert("Open a document first."); return; }
  var doc = app.activeDocument;
  var opt = cflAsk(doc);
  if (!opt) return;
  var result, err = null;
  try {
    app.doScript(function () {
      try { result = cflRun(doc, opt); } catch (e) { err = e; throw e; }
    }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "Captions from List");
  } catch (e0) {
    if (err && err.listError) {
      alert("The list was not used:\n" + err.message + "\n\nThe document was not changed.", "Captions from List");
      return;
    }
    var lost = opt.notRestored && opt.notRestored.length ? "\n\nCould not restore: " + opt.notRestored.join(", ") : "";
    alert("The script stopped:\n" + (err ? err.message : String(e0)) + lost +
      "\n\nCheck the document before you save it.", "Captions from List");
    return;
  }
  var c = result.counts, msg = "Added: " + c.added + "\nUpdated: " + c.updated +
    "\nUnchanged: " + c.unchanged + "\nSkipped: " + c.skipped;
  if (result.restore.length) msg += "\n\nCould not restore: " + result.restore.join(", ");
  if (result.report.length) {
    var saved = cflSaveReport(doc, opt.list, result.report);
    if (saved.error) msg += "\n\nThe report could not be saved: " + saved.error;
    else msg += "\n\nReport (" + result.report.length + " lines):\n" + saved.file.fsName;
  }
  alert(msg, "Captions from List");
}

if (typeof CFL_TEST === "undefined") cflMain();
