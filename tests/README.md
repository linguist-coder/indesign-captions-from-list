# Tests

These scripts build their own InDesign documents, call the captioning function directly and write a text log. They run on Windows through COM. They do not use the active document, and they close every document they open.

The dialog and the final message are not covered here. The relink option is passed as a setting.

## Requirements

- Windows with Adobe InDesign 2026. For another version, change `InDesign.Application.2026` in `run_jsx.ps1`.
- Python 3 with Pillow (`pip install pillow`).

## Run

From this folder:

```bash
python make_fixture.py
powershell -NoProfile -File run_jsx.ps1 test_captions.jsx test-log.txt
powershell -NoProfile -File run_jsx.ps1 stack_test.jsx stack-log.txt
python stack_compare.py stack-log.txt
```

`make_fixture.py` writes test images and lists to `fixtures/` (not in the repository) and creates `fixtures/stack/` for the PNGs. The test scripts find `CaptionsFromList.jsx` one folder up and the fixtures in `fixtures/`.

## Files

| File | What it does |
|---|---|
| `make_fixture.py` | Test images (including files with the same name in different folders, an upper-case name, and a TIFF and a JPEG with the same base name) and the lists: Excel-style CSV with a byte order mark, a semicolon version, a revised version, broken lists in `bad/`, and short lists in `order/` for row priority |
| `test_captions.jsx` | A 20-page document. First run, rerun, revised list, hand edits, relinks, a document in millimeters with a moved zero point, undo, runs forced to fail part way, eleven broken lists, report names and a report that cannot be written |
| `stack_test.jsx` | Exports each test page to PNG before and after a run |
| `stack_compare.py` | Checks that the only pixels that changed are inside the new caption frame or up to 4 pt below it |
| `probe_layer_order.jsx` | Checks which layer is in front and that a full-page object on a front layer is reported |
| `run_jsx.ps1` | Runs a JSX file in InDesign and saves what it returns |

## Logs

`test-log.txt`, `stack-log.txt` and `probe-log.txt` are the logs from the published version. In paths, `<repo>` stands for the folder this repository was in. The report file names in the last line carry the date and time of the run.

Not forced in a test: a failure to restore the measurement units, ruler origin or zero point, and a seek or read error on the list.
