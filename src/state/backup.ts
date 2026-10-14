import { inBounds, parseA1, toA1 } from '@/engine/address';

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

/** Versioned raw cell data, so formulas survive independently of browser storage. */
export function toBackup(cells: Record<string, string>): string {
  return JSON.stringify({ format: 'gridcalc', version: 1, cells });
}

/** Reject the entire file if any cell is invalid; never restore a silently truncated backup. */
export function parseBackup(text: string): Record<string, string> | null {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const backup = raw as Record<string, unknown>;
  if (backup.format !== 'gridcalc' || backup.version !== 1) return null;
  return readCells(backup.cells, true);
}

/**
 * Untrusted cell maps (backups, browser storage): A1-addressed string cells inside the sheet. `strict` rejects the
 * whole map on any bad cell, as a backup must; otherwise bad cells are skipped and addresses normalized.
 */
export function readCells(raw: unknown, strict: boolean): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cells: Record<string, string> = {};
  for (const [address, value] of Object.entries(raw)) {
    const ref = parseA1(address);
    const a1 = ref && inBounds(ref.row, ref.col) && typeof value === 'string' ? toA1(ref.row, ref.col) : null;
    if (a1 && (!strict || a1 === address)) cells[a1] = value as string;
    else if (strict) return null;
  }
  return cells;
}
