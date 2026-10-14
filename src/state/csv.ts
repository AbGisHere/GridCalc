/** RFC 4180-style CSV parsing: quoted fields, escaped quotes (""), CRLF or LF line endings. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Text starting with = + - @ (or tab/CR) is prefixed with ' so Excel and Sheets don't run it as a formula
 * when the file is opened (CSV injection). Plain numbers like -5 are left alone.
 */
const neutralize = (s: string) => (/^[=+\-@\t\r]/.test(s) && !Number.isFinite(Number(s)) ? `'${s}` : s);

export function toCSV(rows: string[][]): string {
  const esc = (raw: string) => {
    const s = neutralize(raw);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

/** Tab-separated text, as copied from/pasted into other spreadsheets. */
export function parseTSV(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines.map((l) => l.split('\t'));
}
