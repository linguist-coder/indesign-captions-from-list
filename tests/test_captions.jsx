// Test harness for CaptionsFromList.jsx.
// Builds its own documents with documents.add(false), runs the script core
// and returns a text log. Never touches activeDocument.
var HERE = File($.fileName).parent.parent.absoluteURI + "/"; // repo root (CaptionsFromList.jsx)
var DIR = File($.fileName).parent.absoluteURI + "/fixtures/"; // made by make_fixture.py
var CFL_TEST = true;
$.evalFile(File(HERE + "CaptionsFromList.jsx"));

var prevUI = app.scriptPreferences.userInteractionLevel;
app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
var log = [];
function say(s) { log.push(s); }

function names() {
  var f = File(DIR + "names.txt"); f.open("r"); var s = f.read(); f.close();
  return s.split(/\r?\n/);
}

function build() {
  var doc = app.documents.add(false);
  doc.documentPreferences.pagesPerDocument = 20;
  doc.documentPreferences.facingPages = false;
  doc.documentPreferences.pageWidth = "612pt";
  doc.documentPreferences.pageHeight = "792pt";
  var vp = doc.viewPreferences;
  vp.horizontalMeasurementUnits = MeasurementUnits.POINTS;
  vp.verticalMeasurementUnits = MeasurementUnits.POINTS;
  vp.rulerOrigin = RulerOrigin.PAGE_ORIGIN;

  var ps = doc.paragraphStyles.add({ name: "Caption", pointSize: 9, leading: 11, fontStyle: "Italic" });
  // objectStyles.add gives a black 1pt stroke even with basedOn, so set it.
  doc.objectStyles.add({ name: "Caption Frame", basedOn: doc.objectStyles.itemByName("[Basic Text Frame]"),
    strokeColor: "None", strokeWeight: 0 });
  var locked = doc.layers.add({ name: "Locked art" });
  var hidden = doc.layers.add({ name: "Hidden art" });
  var art = doc.layers.itemByName("Layer 1");
  var back = doc.layers.add({ name: "Background" });
  back.move(LocationOptions.AT_END);                       // the bottom layer
  var front = doc.layers.add({ name: "Corrections" });
  front.move(LocationOptions.AT_BEGINNING);                // the top layer (layers[0])
  var N = names();
  var env = { doc: doc, ps: ps, os: doc.objectStyles.itemByName("Caption Frame"), frames: {}, art: art };

  function place(page, file, b, layer) {
    var r = page.rectangles.add(layer || art, LocationOptions.AT_END, { geometricBounds: b });
    r.place(File(DIR + "img/" + file));
    r.fit(FitOptions.FILL_PROPORTIONALLY);
    r.fit(FitOptions.CENTER_CONTENT);
    return r;
  }

  // Parent page image (must be ignored).
  place(doc.masterSpreads[0].pages[0], N[0], [20, 520, 70, 590]);

  for (var i = 1; i <= 28; i++) {
    var file = N[i - 1];
    var pg = doc.pages[Math.floor((i - 1) / 2)];
    var top = (i % 2) ? 60 : 420;
    var b = [top, 72, top + 260, 540];
    if (i === 11) b = [top, 72, top + 200, 200];           // narrow frame, long caption
    if (i === 12) {                                          // anchored in text
      var tf = doc.pages[14].textFrames.add(art, LocationOptions.AT_END, { geometricBounds: [60, 72, 400, 540] });
      tf.contents = "Text with an inline image: ";
      var ip = tf.insertionPoints[-1];
      var r12 = ip.rectangles.add({ geometricBounds: [0, 0, 100, 150] });
      r12.place(File(DIR + "img/" + file));
      r12.fit(FitOptions.FILL_PROPORTIONALLY);
      continue;
    }
    if (i === 18) b = [600, 72, 780, 540];                   // near page bottom
    var layer = i === 24 ? locked : (i === 17 ? hidden : null);
    var r = place(pg, file, b, layer);
    env.frames[i] = r;
    if (i === 10) r.rotationAngle = 8;
    if (i === 22) {
      var box = pg.rectangles.add(art, LocationOptions.AT_END, { geometricBounds: [b[0] - 6, b[1] - 6, b[0], b[3]] });
      pg.groups.add([r, box]);
    }
    if (i === 26) r.move([700, 100]);                         // to the pasteboard
    if (i === 13) {                                           // an object on top of the image
      env.overlay = pg.rectangles.add(art, LocationOptions.AT_BEGINNING, { geometricBounds: [b[0] + 20, 400, b[0] + 60, 520] });
      env.overlay.fillColor = "Black";
    }
    if (i === 15) {                                           // text that wraps around the image
      r.textWrapPreferences.textWrapMode = TextWrapModes.BOUNDING_BOX_TEXT_WRAP;
      env.body = pg.textFrames.add(art, LocationOptions.AT_END, { geometricBounds: [40, 60, 400, 552] }); // encloses the image
      env.body.contents = new Array(30).join("Body text that wraps around the image. ");
    }
    if (i === 16) {                                           // a hand-made caption already there
      var hand = pg.textFrames.add(art, LocationOptions.AT_END, { geometricBounds: [b[2] + 4, 72, b[2] + 20, 300] });
      hand.contents = "Hand-made caption";
      // a full-page background on the bottom layer, and a full-page overlay on the top layer
      var bg = pg.rectangles.add(back, LocationOptions.AT_END, { geometricBounds: [0, 0, 792, 612] });
      bg.fillColor = "Black"; bg.fillTint = 8;
      var over = pg.rectangles.add(front, LocationOptions.AT_END, { geometricBounds: [0, 0, 792, 612] });
      over.fillColor = "None"; over.strokeColor = "None";
    }
    if (i === 1) {                                            // a hidden object where the caption goes
      var hid = pg.rectangles.add(art, LocationOptions.AT_END, { geometricBounds: [326, 100, 340, 300] });
      hid.visible = false;
    }
  }
  place(doc.pages[15], N[4], [60, 72, 320, 540]);           // img-005 again
  place(doc.pages[16], "interview.jpg", [60, 72, 320, 540]);
  place(doc.pages[16], "interview.tif", [420, 72, 680, 540]);
  place(doc.pages[17], "a/shared.jpg", [60, 72, 320, 540]);
  place(doc.pages[17], "b/shared.jpg", [420, 72, 680, 540]);
  place(doc.pages[18], "map.v2.jpg", [60, 72, 320, 540]);
  env.cover = place(doc.pages[18], "a/cover.jpg", [420, 72, 680, 540]);
  place(doc.pages[19], "low.jpg", [700, 72, 790, 540]);           // the caption lands below the page
  locked.locked = true;
  hidden.visible = false;
  return env;
}

function run(env, csv, quiet, accept) {
  var res;
  app.doScript(function () {
    res = cflRun(env.doc, { list: File(DIR + csv), pStyle: env.ps, oStyle: env.os, gap: 4, acceptMoved: !!accept });
  }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "Captions from List");
  var c = res.counts;
  say("== " + csv + " added=" + c.added + " updated=" + c.updated + " unchanged=" + c.unchanged + " skipped=" + c.skipped);
  if (!quiet) for (var i = 0; i < res.report.length; i++) say("   " + res.report[i].join(" | "));
  return res;
}

function captionOf(doc, holderId) {
  var items = doc.allPageItems;
  for (var i = 0; i < items.length; i++)
    if (items[i] instanceof TextFrame && items[i].extractLabel(CFL_LABEL) === String(holderId)) return items[i];
  return null;
}

// Where every line of a story sits, to see whether wrapped text moved.
function layoutSig(frame) {
  var out = [], lines = frame.lines;
  for (var i = 0; i < lines.length; i++)
    out.push(lines[i].characters[0].index + "@" + Math.round(lines[i].baseline * 100) + "," +
      Math.round(lines[i].horizontalOffset * 100));
  return lines.length + " lines|" + out.join(";");
}

function smallDoc() {
  var doc = app.documents.add(false);
  doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.POINTS;
  doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.POINTS;
  doc.documentPreferences.pageWidth = "612pt";
  doc.documentPreferences.pageHeight = "792pt";
  var ps = doc.paragraphStyles.add({ name: "Caption", pointSize: 9, leading: 11 });
  var a = doc.pages[0].rectangles.add({ geometricBounds: [60, 72, 320, 540] });
  a.place(File(DIR + "img/harbor.tif")); a.fit(FitOptions.FILL_PROPORTIONALLY);
  var b = doc.pages[0].rectangles.add({ geometricBounds: [420, 72, 680, 540] });
  b.place(File(DIR + "img/map.jpg")); b.fit(FitOptions.FILL_PROPORTIONALLY);
  var c = doc.pages[0].rectangles.add({ geometricBounds: [330, 72, 400, 300] });
  c.place(File(DIR + "img/photo.jpg.tif")); c.fit(FitOptions.FILL_PROPORTIONALLY);
  return { doc: doc, ps: ps, os: null, harbor: a, map: b, photo: c };
}

function zIndex(item) {
  // position among the top-level items of the spread (0 = front)
  var top = item;
  while (top.parent instanceof Group) top = top.parent;
  var items = top.parent.pageItems;
  for (var i = 0; i < items.length; i++) if (items[i].id === top.id) return i;
  return -1;
}

try {
  // ---- A. lists that must be refused
  var bad = ["unquoted-comma.csv", "unclosed-quote.csv", "no-header.csv", "quoted-header-semi.csv",
    "quote-mid-cell.csv", "ansi.csv", "utf16.csv", "extra-header.csv", "nul.csv", "utf16-ascii.csv", "ansi-cr.csv"];
  for (var bi = 0; bi < bad.length; bi++) {
    try {
      var L = cflLoadList(File(DIR + "bad/" + bad[bi]));
      say("!! " + bad[bi] + " was accepted: " + L.rows.length + " rows, header ok");
      for (var lr = 0; lr < L.rows.length; lr++) say("     row " + L.rows[lr].line + ": " + L.rows[lr].name + " = " + L.rows[lr].text);
    } catch (e) { say("ok refused " + bad[bi] + ": " + e.message); }
  }

  // ---- B. first run, rerun, edits by hand, revised list
  var env = build();
  var wrap15 = env.frames[15].textWrapPreferences.textWrapMode;
  var sig15 = layoutSig(env.body);
  run(env, "captions.csv");
  // stacking is checked by rendering, in stack_test.jsx (pageItems lists items by type, not by stacking order)
  say("-- img-015 text wrap unchanged: " + (env.frames[15].textWrapPreferences.textWrapMode == wrap15));
  var sig15b = layoutSig(env.body);
  say("-- wrapped body text: " + sig15.split("|")[0] + " before, " + sig15b.split("|")[0] + " after, every line in the same place: " + (sig15 === sig15b));
  var c1 = captionOf(env.doc, env.frames[1].id), hb = env.frames[1].visibleBounds;
  say("-- img-001 gap = " + (c1.geometricBounds[0] - hb[2]) + " pt");
  env.doc.save(File(DIR + "test-run2.indd"));
  env.doc.exportFile(ExportFormat.PDF_TYPE, File(DIR + "test-run2.pdf"), false,
    app.pdfExportPresets.itemByName("[High Quality Print]"));
  run(env, "captions.csv");

  // hand changes before the revised list
  var c10 = captionOf(env.doc, env.frames[10].id);
  c10.move(undefined, [0, 30]);
  say("-- moved caption of img-010 down 30pt, top=" + Math.round(c10.geometricBounds[0]));
  var c8 = captionOf(env.doc, env.frames[8].id);                // thread it to a new frame
  var extra = env.doc.pages[3].textFrames.add(env.art, LocationOptions.AT_END, { geometricBounds: [700, 400, 760, 540] });
  c8.nextTextFrame = extra;
  var g25 = env.frames[25].parent;                               // copy a caption group
  g25.duplicate(undefined, [0, -200]);
  env.frames[19].graphics[0].itemLink.relink(File(DIR + "img/relinked.jpg"));   // relink
  env.frames[23].remove();                                       // delete an image, keep its caption
  env.cover.graphics[0].itemLink.relink(File(DIR + "img/b/cover.jpg"));   // same name, other folder
  var c14 = captionOf(env.doc, env.frames[14].id);              // a pasted copy of a caption, original deleted
  var copy14 = env.doc.pages[10].textFrames.add(env.art, LocationOptions.AT_END, { geometricBounds: [700, 72, 720, 300] });
  copy14.contents = c14.parentStory.contents;
  var labs = [CFL_LABEL, CFL_TEXT_LABEL, CFL_FILE_LABEL, CFL_PATH_LABEL];
  for (var li = 0; li < labs.length; li++) copy14.insertLabel(labs[li], c14.extractLabel(labs[li]));
  c14.remove();
  captionOf(env.doc, env.frames[28].id).visible = false;        // a hidden caption
  run(env, "captions-v2.csv");
  run(env, "captions-v2.csv", false, true);                      // accept the moved image
  run(env, "captions-v2.csv", false, true);                      // nothing left to accept
  var v10 = captionOf(env.doc, env.frames[10].id);
  say("-- img-010 after v2: top=" + Math.round(v10.geometricBounds[0]) + " text=" + v10.parentStory.contents);
  env.doc.close(SaveOptions.NO);

  // ---- C. mm, spread origin, moved zero point, locked active layer
  var env3 = build();
  var vp = env3.doc.viewPreferences;
  vp.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS;
  vp.verticalMeasurementUnits = MeasurementUnits.MILLIMETERS;
  vp.rulerOrigin = RulerOrigin.SPREAD_ORIGIN;
  env3.doc.zeroPoint = [10, 10];
  var lk = env3.doc.layers.itemByName("Locked art");
  lk.locked = false; env3.doc.activeLayer = lk; lk.locked = true;
  run(env3, "captions.csv", true);
  say("-- settings after: units=" + vp.horizontalMeasurementUnits + "/" + vp.verticalMeasurementUnits +
    " origin=" + vp.rulerOrigin + " zero=" + env3.doc.zeroPoint + " active=" + env3.doc.activeLayer.name +
    " locked=" + env3.doc.activeLayer.locked);
  vp.horizontalMeasurementUnits = MeasurementUnits.POINTS; vp.verticalMeasurementUnits = MeasurementUnits.POINTS;
  vp.rulerOrigin = RulerOrigin.PAGE_ORIGIN; env3.doc.zeroPoint = [0, 0];
  var m1 = captionOf(env3.doc, env3.frames[1].id), mb = env3.frames[1].visibleBounds;
  say("-- img-001 gap in the mm document = " + (m1.geometricBounds[0] - mb[2]) + " pt, left edge diff = " +
    (m1.geometricBounds[1] - mb[1]));
  env3.doc.close(SaveOptions.NO);

  // ---- D. semicolon list, then one undo
  var env2 = build();
  var before = env2.doc.allPageItems.length;
  run(env2, "captions-semi.csv", true);
  var after = env2.doc.allPageItems.length;
  env2.doc.undo();
  say("-- semi: page items before=" + before + " after run=" + after + " after one undo=" + env2.doc.allPageItems.length);

  // ---- E. a run that fails part way, then one undo
  var before2 = env2.doc.allPageItems.length, inside = -1, inner = null;
  try {
    app.doScript(function () {
      try {
        cflRun(env2.doc, { list: File(DIR + "captions.csv"), pStyle: env2.ps, oStyle: env2.os, gap: 4 });
        inside = env2.doc.allPageItems.length;
        throw new Error("forced stop");
      } catch (e6) { inner = e6; throw e6; }
    }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "Captions from List");
  } catch (e5) { say("-- forced stop caught: outer=" + e5.message + " inner=" + inner.message + " items inside the run=" + inside); }
  say("-- failed run: page items before=" + before2 + " after=" + env2.doc.allPageItems.length);

  // ---- G. undo after a run that only updates text
  run(env2, "captions.csv", true);
  var g10 = captionOf(env2.doc, env2.frames[10].id);
  run(env2, "captions-v2.csv", true);
  var afterV2 = g10.parentStory.contents;
  env2.doc.undo();
  say("-- undo of an update run: after v2=" + afterV2.substring(0, 30) + " | after undo=" + g10.parentStory.contents.substring(0, 30) +
    " | label=" + g10.extractLabel(CFL_TEXT_LABEL).substring(0, 30));

  // ---- H. match order and encoding, one small document per list
  var lists = ["jpg-first.csv", "tif-first.csv", "base-first.csv", "only-jpg.csv", "fffd.csv", "blank-exact.csv", "stem.csv", "fffd-exact.csv"];
  for (var hi = 0; hi < lists.length; hi++) {
    var sd = smallDoc();
    run(sd, "order/" + lists[hi]);
    var hc = captionOf(sd.doc, sd.harbor.id), mc = captionOf(sd.doc, sd.map.id);
    var pc = captionOf(sd.doc, sd.photo.id);
    say("   harbor.tif caption: " + (hc ? hc.parentStory.contents : "(none)") + " | map.jpg caption: " + (mc ? mc.parentStory.contents : "(none)") +
      " | photo.jpg.tif caption: " + (pc ? pc.parentStory.contents : "(none)"));
    sd.doc.close(SaveOptions.NO);
  }

  // ---- J. failures inside the run: while placing, and while restoring the active layer
  var fails = ["place", "layer"];
  for (var fi = 0; fi < fails.length; fi++) {
    var envJ = build(), b4 = envJ.doc.allPageItems.length, layerB4 = envJ.doc.activeLayer.name, msgJ = "";
    var keepSet = cflSetCaption, keepLayer = cflRestoreLayer, calls = 0;
    if (fails[fi] === "place") cflSetCaption = function (f, t, p, n, pa) { if (++calls === 5) throw new Error("forced failure while placing"); keepSet(f, t, p, n, pa); };
    else cflRestoreLayer = function (d, w) { if (++calls === 5) throw new Error("forced failure while restoring the layer"); keepLayer(d, w); };
    try {
      app.doScript(function () {
        try { cflRun(envJ.doc, { list: File(DIR + "captions.csv"), pStyle: envJ.ps, oStyle: envJ.os, gap: 4 }); }
        catch (eJ) { msgJ = eJ.message; throw eJ; }
      }, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "Captions from List");
    } catch (eJ2) {}
    cflSetCaption = keepSet; cflRestoreLayer = keepLayer;
    var labelled = 0, all = envJ.doc.allPageItems;
    for (var ai = 0; ai < all.length; ai++) if (all[ai].extractLabel(CFL_LABEL) !== "") labelled++;
    say("-- failure " + fails[fi] + ": message=" + msgJ + " | page items before=" + b4 + " after=" + all.length +
      " | captions left=" + labelled + " | active layer " + layerB4 + " -> " + envJ.doc.activeLayer.name);
    envJ.doc.close(SaveOptions.NO);
  }

  // ---- K. a report that cannot be written
  var keepRF = cflReportFile;
  cflReportFile = function () { return File("C:/no-such-folder-cfl/report.csv"); };
  var sv = cflSaveReport(null, File(DIR + "captions.csv"), [["x", "", "", ""]]);
  cflReportFile = keepRF;
  say("-- report write failure: error=" + sv.error);

  // ---- L. facing pages: the same page coordinates on both pages of a spread
  var fd = app.documents.add(false);
  fd.documentPreferences.facingPages = true;
  fd.documentPreferences.pagesPerDocument = 3;
  fd.documentPreferences.pageWidth = "612pt";
  fd.documentPreferences.pageHeight = "792pt";
  fd.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.POINTS;
  fd.viewPreferences.verticalMeasurementUnits = MeasurementUnits.POINTS;
  fd.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
  var fps = fd.paragraphStyles.add({ name: "Caption", pointSize: 9, leading: 11 });
  var lp = fd.pages[1], rp = fd.pages[2];                        // pages 2 and 3 share a spread
  var fl = lp.rectangles.add({ geometricBounds: [60, 72, 320, 540] });
  fl.place(File(DIR + "img/harbor.tif")); fl.fit(FitOptions.FILL_PROPORTIONALLY);
  var fr = rp.rectangles.add({ geometricBounds: [60, 72, 320, 540] });
  fr.place(File(DIR + "img/map.jpg")); fr.fit(FitOptions.FILL_PROPORTIONALLY);
  rp.textFrames.add({ geometricBounds: [322, 72, 400, 540], contents: "Body text on the right page." });
  say("-- facing pages: spread of page 2 has " + lp.parent.pages.length + " pages, page 3 on the same spread: " + (lp.parent.id === rp.parent.id));
  var fcsv = File(DIR + "facing.csv");                           // written here, so no fixture is needed
  fcsv.encoding = "UTF-8"; fcsv.open("w"); fcsv.write("File,Caption\nharbor.tif,Left page.\nmap.jpg,Right page.\n"); fcsv.close();
  run({ doc: fd, ps: fps, os: null }, "facing.csv");
  fcsv.remove();
  say("-- facing pages: ruler origin after = " + fd.viewPreferences.rulerOrigin);
  fd.close(SaveOptions.NO);

  // ---- F. report file names
  env2.doc.save(File(DIR + "test-names.indd"));
  var f1 = cflReportFile(env2.doc, File(DIR + "captions.csv"));
  cflWriteReport(f1, [["x", "", "", ""]]);
  var f2 = cflReportFile(env2.doc, File(DIR + "captions.csv"));
  say("-- report names: " + f1.name + " then " + f2.name);
  f1.remove();
  env2.doc.close(SaveOptions.NO);
} catch (e) {
  say("ERROR " + e + " line " + e.line);
} finally {
  app.scriptPreferences.userInteractionLevel = prevUI;
}
log.join("\n");
