// Stacking test for CaptionsFromList.jsx: renders each page before and after
// a run, so stack_compare.py can check that nothing but the caption changed.
var HERE = File($.fileName).parent.parent.absoluteURI + "/"; // repo root (CaptionsFromList.jsx)
var DIR = File($.fileName).parent.absoluteURI + "/fixtures/"; // made by make_fixture.py
var CFL_TEST = true;
$.evalFile(File(HERE + "CaptionsFromList.jsx"));
var out = [];
app.pngExportPreferences.exportResolution = 72;
app.pngExportPreferences.pngExportRange = PNGExportRangeEnum.EXPORT_ALL;

function color(doc, name, rgb) {
  return doc.colors.add({ name: name, model: ColorModel.PROCESS, space: ColorSpace.RGB, colorValue: rgb });
}

function scenario(tag, setup) {
  var doc = app.documents.add(false);
  doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.POINTS;
  doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.POINTS;
  doc.documentPreferences.facingPages = false;
  doc.documentPreferences.pageWidth = "612pt"; doc.documentPreferences.pageHeight = "792pt";
  var pg = doc.pages[0], bottom = doc.layers[0];
  bottom.name = "Bottom";
  var top = doc.layers.add({ name: "Top" });
  var c = { red: color(doc, "R", [230, 30, 30]), blue: color(doc, "B", [30, 30, 230]),
    green: color(doc, "G", [30, 180, 30]), gray: color(doc, "Gy", [200, 200, 200]) };
  function box(kind, layer, b, fill) {
    var x = (kind === "text" ? pg.textFrames : pg.rectangles).add(layer, LocationOptions.AT_END, { geometricBounds: b });
    x.fillColor = fill; x.strokeColor = "None";
    return x;
  }
  var img = setup(box, top, bottom, c);
  img.place(File(DIR + "img/harbor.tif"));
  img.fit(FitOptions.FILL_PROPORTIONALLY);
  img.strokeColor = "None";
  doc.exportFile(ExportFormat.PNG_FORMAT, File(DIR + "stack/" + tag + "-before.png"), false);
  var ps = doc.paragraphStyles.add({ name: "Cap", pointSize: 9 }), res;
  app.doScript(function () { res = cflRun(doc, { list: File(DIR + "order/ok-harbor.csv"), pStyle: ps, oStyle: null, gap: 4 }); },
    ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, "x");
  doc.exportFile(ExportFormat.PNG_FORMAT, File(DIR + "stack/" + tag + "-after.png"), false);
  var cap = null, all = doc.allPageItems;
  for (var i = 0; i < all.length; i++) if (all[i].extractLabel(CFL_LABEL) !== "") cap = all[i];
  out.push(tag + "|" + res.counts.added + "|" + (cap ? cap.geometricBounds.join(",") : "") + "|" +
    (function () { var r = []; for (var k = 0; k < res.report.length; k++) r.push(res.report[k].join(" / ")); return r.join(" ; "); })());
  doc.close(SaveOptions.NO);
}

// 1. one layer: full-page background behind the image, text frame partly over the caption area
scenario("s1", function (box, top, bottom, c) {
  var bg = box("rect", bottom, [0, 0, 792, 612], c.gray);
  var hand = box("text", bottom, [326, 72, 336, 200], c.blue);
  var img = box("rect", bottom, [60, 72, 320, 540], "None");
  img.bringToFront(); hand.bringToFront();
  return img;
});
// 2. image between a red box (in front) and a blue box (behind) on Top; gray background on Bottom
scenario("s2", function (box, top, bottom, c) {
  box("rect", bottom, [0, 0, 792, 612], c.gray);
  var img = box("rect", top, [60, 72, 320, 540], "None");
  var red = box("rect", top, [40, 400, 100, 560], c.red);
  var blue = box("rect", top, [280, 40, 380, 300], c.blue);
  red.bringToFront(); blue.sendToBack();
  return img;
});
// 3. a green text frame in front of the image (another object type), image at the back of its layer
scenario("s3", function (box, top, bottom, c) {
  box("rect", bottom, [0, 0, 792, 612], c.gray);
  var img = box("rect", top, [60, 72, 320, 540], "None");
  var green = box("text", top, [100, 100, 160, 300], c.green);
  green.bringToFront(); img.sendToBack();
  return img;
});
out.join("\n");
