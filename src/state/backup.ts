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
  if (!backup.cells || typeof backup.cells !== 'object' || Array.isArray(backup.cells)) return null;
  const cells: Record<string, string> = {};
  for (const [address, value] of Object.entries(backup.cells)) {
    const ref = parseA1(address);
    if (!ref || !inBounds(ref.row, ref.col) || toA1(ref.row, ref.col) !== address || typeof value !== 'string') return null;
    cells[address] = value;
  }
  return cells;
}
