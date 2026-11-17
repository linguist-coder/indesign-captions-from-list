# InDesign Captions from List

An ExtendScript for Adobe InDesign that places image captions from a CSV list. Each row gives a file name from the Links panel and the caption for that image. The script puts a caption frame below each matching image, groups the two, and saves a report of anything it could not do.

- Video: https://youtu.be/zjFzvkvZHmM
- Written guide: https://www.linguist-coder.com/2026/11/indesign-image-captions-from-spreadsheet.html

## Install

1. Download `CaptionsFromList.jsx` from the [latest release](https://github.com/linguist-coder/indesign-captions-from-list/releases/latest).
2. In InDesign, open the Scripts panel (Window > Utilities > Scripts).
3. Right-click the User folder and choose Reveal in Explorer (Reveal in Finder on macOS).
4. Copy the file into that folder. It appears in the Scripts panel under User.

## The list

The first row must be `File,Caption`, with no other columns:

```text
File,Caption
harbor-01.jpg,"Harbor at dawn, 1968."
harbor-02,The same harbor in 2024.
```

In Excel, save it with File > Save As > CSV UTF-8 (Comma delimited). Semicolon and tab separators also work. The script stops without changing the document if the file is not UTF-8 or a row cannot be read.

## Use

1. Work on a copy of the document. Make a paragraph style for the captions.
2. Double-click `CaptionsFromList.jsx` in the Scripts panel and choose the CSV file.
3. In the dialog, choose the paragraph style, the object style (or "(none)") and the Gap below image. Leave "Accept all same-name relinks matched by this list" off on the first run.
4. Click OK. A message gives the counts. If there is anything to report, the report is saved next to the document (on the desktop if it is unsaved) as `<document>-captions-<date>.csv`.

One Edit > Undo removes the new caption frames and restores the previous caption text.

Run the script again with a revised list to update captions whose text changed. Captions whose text did not change are left alone, including your edits. The guide explains the report and the rerun rules.

## Not captioned

Images anchored in text, inside a group or another frame, on the pasteboard, hidden, or locked (or on a locked or hidden layer) are listed in the report instead. Images on parent pages and graphics pasted without a link are ignored.

## Tested with

Adobe InDesign 2026 (21.6) on Windows. Not tested on macOS or other InDesign versions. The test scripts and their logs are in [tests](tests).

## Custom scripts

Need a script for your own InDesign or Illustrator task? See [Work with me](https://www.linguist-coder.com/work-with-me.html).

## License

MIT. See [LICENSE](LICENSE).
