import type { CellEdit } from '@/engine/engine';
import type { Selection } from './selection';

interface HistoryEdit extends CellEdit {
  before: string;
}

interface HistoryEntry {
  label: string;
  edits: HistoryEdit[];
  /** Selection when the action happened, restored on undo/redo. */
  selection: Selection;
}

/** Command-style undo/redo: each entry stores before/after raw text for the cells it touched. */
export class History {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  constructor(private readonly limit = 500) {}

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): { edits: CellEdit[]; entry: HistoryEntry } | undefined {
    const entry = this.undoStack.pop();
    if (!entry) return undefined;
    this.redoStack.push(entry);
    return { entry, edits: entry.edits.map((e) => ({ row: e.row, col: e.col, raw: e.before })) };
  }

  redo(): { edits: CellEdit[]; entry: HistoryEntry } | undefined {
    const entry = this.redoStack.pop();
    if (!entry) return undefined;
    this.undoStack.push(entry);
    return { entry, edits: entry.edits.map(({ row, col, raw }) => ({ row, col, raw })) };
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  peekUndoLabel(): string | undefined {
    return this.undoStack[this.undoStack.length - 1]?.label;
  }

  peekRedoLabel(): string | undefined {
    return this.redoStack[this.redoStack.length - 1]?.label;
  }
}
