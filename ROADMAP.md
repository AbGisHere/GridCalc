# Roadmap

Planned features that are not built yet. Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md); an item moves there when it is released.

## Planned

### Share a sheet by link

Share a sheet as a URL without any server storage. The whole sheet is encoded in the link, so opening the link restores the sheet.

- **Encoding.** Serialize the non-empty cells (raw input and formulas, not computed values; the engine recalculates on load), compress with deflate (`CompressionStream`), base64url-encode, and put the result in the URL fragment: `/#<data>`.
- **Privacy.** The fragment is never sent to the server, so the server never sees the sheet and nothing is stored. Anyone with the link can read the sheet, and the link stays in browser history and wherever it is pasted. The UI must make this clear.
- **UI.** A "Copy share link" button. Opening a shared link loads that sheet, with a prompt before it replaces the local autosaved sheet.
- **Security.** A link is untrusted input. Decoding reuses the `localStorage` validation (`parseSavedSheet`), caps the compressed and decompressed sizes to block decompression bombs, and fails safely to an error message on bad data.
- **Limits.** Many apps truncate URLs longer than a few thousand characters. Show the link length, and warn or refuse when a sheet is too large to share this way.
- **Tests.** Encode/decode round trip, malformed and oversized links, and formulas that survive the round trip unchanged.

### Double-click a column edge to auto-fit

Double-clicking the resize handle on a column header's right edge sets that column to the width of its widest content, as in Excel and Google Sheets. Dragging the handle keeps working as it does now.

- **Measuring.** Columns can hold up to 100,000 rows, and only about 30 are in the DOM, so the width comes from the cell store, not the DOM. Measure the displayed text of every non-empty cell in the column with the same canvas text measurement the grid uses for text spill, plus the cell padding. Fit the header letter too, and keep the minimum column width.
- **Scale.** The stress test has 10,000 rows per column. Measuring them takes a few milliseconds; if a column ever gets slow, cap the scan or measure only the longest strings.
- **Selection.** With several whole columns selected, double-clicking any of their edges fits each of them, as in Excel.
- **Undo.** Column widths are not in the undo history yet. Decide whether auto-fit (and resizing in general) should be undoable.
- **Rows.** Rows have a fixed height and no resize handle, so auto-fit applies to columns only.

### Multiple sheets and cross-sheet references

Several sheets in one workbook, shown as tabs, with formulas that read other sheets: `=SUM(A1:A10, Sales!A1:A10)`, or `'Q1 sales'!B2` when the name has spaces. This is the syntax Excel and Google Sheets use, so formulas copied from them keep working. (`&` can't be the marker: it already joins text.)

- **Engine.** Cell keys gain a sheet id. The dependency graph and range index work across sheets, so editing `Sales!A1` recalculates the formulas on other sheets that read it, and Tarjan's SCC finds loops that pass through several sheets.
- **Diagnostics.** An unknown sheet gets a caret under its name and a "did you mean" fix, like an unknown function: `Unknown sheet 'Sales2'. Did you mean Sales?`. An error passed on from another sheet names and links to `Sales!B4`.
- **Renaming and deleting.** Renaming a sheet rewrites every reference to it. Deleting one turns those references into `#REF!` and can be undone.
- **Editing.** Autocomplete offers sheet names after `=` or `,`. Clicking a cell on another tab while typing a formula inserts `Sales!B4`.
- **Storage.** The saved format gains a list of sheets; v1 saves load as a single sheet. CSV import and export work on the active sheet.
- **Order.** Build this before share-by-link, so a shared link carries the whole workbook from the start.
