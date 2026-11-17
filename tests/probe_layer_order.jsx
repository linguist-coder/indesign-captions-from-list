// Probe: layer index order and the full-page overlay check. documents.add(false) only.
var HERE = File($.fileName).parent.parent.absoluteURI + "/"; // repo root (CaptionsFromList.jsx)
var DIR = File($.fileName).parent.absoluteURI + "/fixtures/"; // made by make_fixture.py
var CFL_TEST = true;
$.evalFile(File(HERE + "CaptionsFromList.jsx"));
var out = [];
var doc = app.documents.add(false);
try {
  doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.POINTS;
  doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.POINTS;
  doc.documentPreferences.pageWidth = "612pt"; doc.documentPreferences.pageHeight = "792pt";
  var art = doc.layers.itemByName("Layer 1");
  var back = doc.layers.add({ name: "Background" }); back.move(LocationOptions.AT_END);
  var front = doc.layers.add({ name: "Corrections" }); front.move(LocationOptions.AT_BEGINNING);
  for (var i = 0; i < doc.layers.length; i++) out.push("layer " + i + " " + doc.layers[i].name + " index=" + doc.layers[i].index);
  var pg = doc.pages[0];
  var r = pg.rectangles.add(art, LocationOptions.AT_END, { geometricBounds: [60, 72, 320, 540] });
  r.place(File(DIR + "img/harbor.tif"));
  var over = pg.rectangles.add(front, LocationOptions.AT_END, { geometricBounds: [0, 0, 792, 612] });
  over.fillColor = "None"; over.strokeColor = "None";
  var bg = pg.rectangles.add(back, LocationOptions.AT_END, { geometricBounds: [0, 0, 792, 612] });
  var cap = pg.textFrames.add(art, LocationOptions.AT_END, { geometricBounds: [324, 72, 340, 540] });
  out.push("over layer=" + over.itemLayer.name + " idx=" + over.itemLayer.index + " parent=" + over.parent.constructor.name + " visible=" + over.visible + " bounds=" + over.geometricBounds);
  out.push("image layer idx=" + r.itemLayer.index + " page bounds=" + pg.bounds);
  out.push("contains=" + cflContains(over.geometricBounds, pg.bounds));
  out.push("allPageItems=" + pg.parent.allPageItems.length);
  var red = doc.colors.add({ name: "R", model: ColorModel.PROCESS, space: ColorSpace.RGB, colorValue: [255, 0, 0] });
  var blu = doc.colors.add({ name: "B", model: ColorModel.PROCESS, space: ColorSpace.RGB, colorValue: [0, 0, 255] });
  var t0 = pg.rectangles.add(doc.layers[0], LocationOptions.AT_END, { geometricBounds: [600, 100, 700, 200] }); t0.fillColor = red;
  var t2 = pg.rectangles.add(doc.layers[2], LocationOptions.AT_BEGINNING, { geometricBounds: [600, 100, 700, 200] }); t2.fillColor = blu;
  app.pngExportPreferences.exportResolution = 72; app.pngExportPreferences.pngExportRange = PNGExportRangeEnum.EXPORT_RANGE; app.pngExportPreferences.pageString = "1";
  doc.exportFile(ExportFormat.PNG_FORMAT, File(DIR + "probe.png"));
  out.push("overlaps=" + cflOverlaps(cap, r, pg).join("; "));
} catch (e) { out.push("ERR " + e + " line " + e.line); }
doc.close(SaveOptions.NO);
out.join("\n");
