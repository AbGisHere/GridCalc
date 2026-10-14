# Roadmap

Planned features that are not built yet. Shipped work is recorded in [CHANGELOG.md](CHANGELOG.md); an item moves there when it is released.

## Planned

### Quote bare comparison criteria

`=SUMIF(A2:A10, >10)` means "sum the values in A2:A10 that are greater than 10", but the criterion must be a string: `=SUMIF(A2:A10, ">10")`. Today the parser reports `Unexpected operator '>': expected a value.` and its fix deletes the operator, offering `=SUMIF(A2:A10, 10)`. That fix parses but changes the meaning to "equal to 10".

- **Detection.** When a comparison operator (`>`, `<`, `>=`, `<=`, `=`, `<>`) starts an argument, the parser reports a missing quote instead of a missing value: `Criteria like >10 need quotes.`, with the caret under `>10`.
- **Fix.** The one-click fix wraps the operator and the value after it in quotes: `=SUMIF(A2:A10, ">10")`. It must also work for text and cell values: `<>done` becomes `"<>done"`, and `>B1` becomes `">"&B1` so the criterion still follows B1.
- **Scope.** The quote fix only applies inside the criteria arguments of `SUMIF`, `SUMIFS`, `COUNTIF`, `COUNTIFS` and `AVERAGEIF`. Anywhere else, the current message and fix stay.
- **Tests.** Each operator, number, text and cell-reference criteria, and the multi-criteria functions, checking that every fix parses and gives the intended result.

### Select the data region first with Cmd/Ctrl+A

Today Cmd/Ctrl+A always selects the whole sheet (`Spreadsheet.tsx`, the `mod && lower === 'a'` branch). It should work as in Excel:

- **First press.** Select the current region: the rectangle of non-empty cells connected to the active cell (expand the selection while any cell along its edges, including diagonals, has content). With a range already selected, start from the active cell.
- **Second press.** When the selection already equals the current region, select the whole sheet.
- **Empty cell.** If the active cell is empty and has no non-empty neighbours, the first press selects the whole sheet.
- **Scale.** Find the region from the cell store, not the DOM, and stop expanding at the sheet edges, so it stays fast on the 10k-row stress test.
- **Feedback.** The status bar says what was selected, for example `Selected A1:D12 (data). Press again for the whole sheet.`
- **Tests.** A single block, blocks touching only at a corner, gaps that split regions, an empty sheet, and the press-again step.

### Copy a selection as an image

A "Copy as image" action (in the Sheet menu, with a keyboard shortcut) that puts a PNG of the selected range on the clipboard, ready to paste into a chat, document or slide.

- **Rendering.** Draw the range on a `<canvas>` from the cell store, not from the DOM: the grid is virtualized, so most of a large selection isn't mounted. Use the displayed values (not formulas), the current column widths, alignment and gridlines, at `devicePixelRatio` for sharp text. Optionally include the column letters and row numbers.
- **Theme.** Use the sheet's colours in the active theme; semi uses its white sheet.
- **Clipboard.** `navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])`, created inside the click or key handler so Safari accepts it. Where image clipboard writes aren't supported or are refused, offer "Download PNG" instead and say why.
- **Limits.** Cap the size (for example 4,000 × 4,000 px, or a cell count) and explain the limit in the status bar instead of freezing the tab, like the fill limit.
- **Security.** Text is drawn with `fillText`, never parsed as HTML; `blob:` is already allowed in the CSP's `img-src`, and no new origin is needed.
- **Tests.** Canvas size for a range, the size limit, and the fallback path when `ClipboardItem` is missing.

### Share a sheet by link

Share a sheet as a URL without any server storage. The whole sheet is encoded in the link, so opening the link restores the sheet.

- **Encoding.** Serialize the non-empty cells (raw input and formulas, not computed values; the engine recalculates on load), compress with deflate (`CompressionStream`), base64url-encode, and put the result in the URL fragment: `/#<data>`.
- **Privacy.** The fragment is never sent to the server, so the server never sees the sheet and nothing is stored. Anyone with the link can read the sheet, and the link stays in browser history and wherever it is pasted. The UI must make this clear.
- **UI.** A "Copy share link" button. Opening a shared link loads that sheet, with a prompt before it replaces the local autosaved sheet.
- **Security.** A link is untrusted input. Decoding reuses the `localStorage` validation (`readCells`), caps the compressed and decompressed sizes to block decompression bombs, and fails safely to an error message on bad data.
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
