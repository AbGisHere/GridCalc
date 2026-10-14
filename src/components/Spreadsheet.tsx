'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import {
  cellKey,
  colToLetters,
  inBounds,
  keyCol,
  keyRow,
  LAST_CELL_A1,
  normalizeRange,
  parseA1,
  parseRangeA1,
  rangeToA1,
  SHEET_COLS,
  SHEET_ROWS,
  toA1,
  type CellPos,
  type RangeBounds,
} from '@/engine/address';
import { SpreadsheetEngine, type CellEdit, type RecalcStats } from '@/engine/engine';
import type { FnDef } from '@/engine/functions';
import { explainRuntimeError, parseFormula } from '@/engine/parser';
import { normalizeFormula, shiftFormula } from '@/engine/references';
import { CellError, displayValue } from '@/engine/values';
import { parseCSV, parseTSV, toCSV } from '@/state/csv';
import { buildFill } from '@/state/fill';
import { History } from '@/state/history';
import { SAMPLE_SHEET, stressSheet } from '@/state/samples';
import { clampPos, jump, selectionRange, single, type Selection } from '@/state/selection';
import { DiagnosticsPanel, type DiagnosticView } from './DiagnosticsPanel';
import { comboboxAttrs, FormulaAssist } from './FormulaAssist';
import { FormulaBar } from './FormulaBar';
import { assistAt, canInsertRef, formulaRefs } from './formulaTokens';
import { FunctionsPanel } from './FunctionsPanel';
import { Icon } from './Icon';
import { ThemePicker } from './ThemePicker';
import { ToolMenu } from './ToolMenu';
import { ColumnWidthControl } from './ColumnWidthControl';
import { DemoGuide } from './DemoGuide';
import { defaultColumnWidths, fittedColumnWidths, ROW_HEIGHT } from './geometry';
import { Grid, type DragMode, type GridHandle } from './Grid';
import { StatusBar, type SelectionStats } from './StatusBar';

const STORAGE_KEY = 'gridcalc:sheet:v1';
const WIDTHS_KEY = 'gridcalc:widths:v1';

/** Saved sheets are untrusted input: keep only A1-addressed string cells inside the sheet bounds. */
function parseSavedSheet(json: string): Record<string, string> | null {
  const raw: unknown = JSON.parse(json);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data: Record<string, string> = {};
  for (const [addr, value] of Object.entries(raw)) {
    const ref = parseA1(addr);
    if (ref && inBounds(ref.row, ref.col) && typeof value === 'string') data[toA1(ref.row, ref.col)] = value;
  }
  return data;
}
const MAX_CLIPBOARD_CELLS = 250_000;
const MAX_IMPORT_MB = 20;

interface EditState {
  row: number;
  col: number;
  value: string;
  /** 'enter': started by typing (arrows commit); 'edit': F2 / double-click (arrows move the caret). */
  mode: 'enter' | 'edit';
  target: 'cell' | 'bar';
}

/** What an edit cost, for its status-bar message: "3 formulas recalculated in 0.2 ms". */
const recalcSummary = (s: RecalcStats) =>
  `${s.evaluated.toLocaleString()} formula${s.evaluated === 1 ? '' : 's'} recalculated in ${s.ms.toFixed(1)} ms`;

/** Status-bar message; `undo` offers to reverse the action that produced it (replacing the whole sheet). */
interface Toast {
  text: string;
  undo?: boolean;
}

interface Clip {
  range: RangeBounds;
  raws: string[][];
  text: string;
  cut: boolean;
}

/** Column widths for a freshly loaded sheet: each column as wide as its longest value. */
const contentWidths = (engine: SpreadsheetEngine) =>
  fittedColumnWidths(
    Object.keys(engine.toJSON()).map((a1) => {
      const p = parseA1(a1)!;
      return { col: p.col, text: displayValue(engine.getValue(p.row, p.col)) };
    }),
  );

const DEMOS = [
  { label: 'Sample sheet', detail: 'Working formulas, then one of each error to fix', data: () => SAMPLE_SHEET, guide: 'sample' as const },
  { label: '10k-row stress test', detail: '60,000 cells and 30,000 formulas', data: stressSheet, guide: 'stress' as const },
];

const SHORTCUTS: [string, string][] = [
  ['Arrows / Tab / Enter', 'Move, or start editing (Enter / F2)'],
  ['Shift + Arrows', 'Extend selection'],
  ['Ctrl/⌘ + Arrows', 'Jump to edge of data'],
  ['Type any key', 'Replace cell contents'],
  ['Esc', 'Cancel editing'],
  ['Esc, then Tab', 'Leave the sheet'],
  ['F6 / Shift + F6', 'Move between toolbar, formula bar and sheet'],
  ['Delete / Backspace', 'Clear selection'],
  ['Ctrl/⌘ + Z / Y', 'Undo / Redo'],
  ['Ctrl/⌘ + C / X / V', 'Copy / Cut / Paste (formulas re-target)'],
  ['Ctrl/⌘ + D / R', 'Fill down / right'],
  ['Drag the ▪ handle', 'Fill: copies formulas, continues series'],
  ['Click cells while typing a formula', 'Insert references'],
  ['F8 / Shift + F8', 'Next / previous error'],
  ['F9', 'Recalculate everything'],
];

export default function Spreadsheet() {
  const [engine] = useState(() => new SpreadsheetEngine());
  const [history] = useState(() => new History());
  const version = useSyncExternalStore(
    engine.subscribe,
    () => engine.version,
    () => engine.version,
  );
  const [, bumpHistory] = useReducer((x: number) => x + 1, 0);

  const [sel, setSel] = useState<Selection>(single(0, 0));
  const [edit, setEdit] = useState<EditState | null>(null);
  const [caret, setCaret] = useState(0);
  const [assistIdx, setAssistIdx] = useState(0);
  const [assistOff, setAssistOff] = useState(false);
  const [colWidths, setColWidths] = useState(defaultColumnWidths);
  const [showFns, setShowFns] = useState(false);
  const [demoGuide, setDemoGuide] = useState<'sample' | 'stress' | null>(null);
  const [diagHidden, setDiagHidden] = useState(false);
  const [copyRange, setCopyRange] = useState<RangeBounds | null>(null);
  const [rendered, setRendered] = useState(0);
  const [toast, setToast] = useState<Toast>();
  const [heldToast, setHeldToast] = useState<Toast>();
  const say = (text: string) => setToast({ text });
  const [loaded, setLoaded] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number>();

  const gridRef = useRef<GridHandle>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const barInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLElement>(null);
  const barWrapRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  /** Set by Escape on the grid: the next Tab leaves the sheet instead of moving to the next cell. */
  const tabOut = useRef(false);
  const assistId = useId();
  const refInsert = useRef<{ start: number; end: number; anchor: CellPos } | null>(null);
  const lastDrag = useRef('');
  const clipboard = useRef<Clip | null>(null);

  const active = sel.anchor;
  const activeAddress = toA1(active.row, active.col);

  // Safari's software keyboard resizes the visual viewport rather than the layout viewport.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => setViewportHeight(viewport.scale === 1 ? Math.round(viewport.height) : undefined);
    resize();
    viewport.addEventListener('resize', resize);
    return () => viewport.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (viewportHeight !== undefined && edit) gridRef.current?.scrollIntoView({ row: edit.row, col: edit.col });
  }, [viewportHeight, edit?.row, edit?.col]);

  // ------------------------------------------------------------------ persistence
  useEffect(() => {
    let data: Record<string, string> | null = null;
    let widths: string | null = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) data = parseSavedSheet(saved);
      widths = localStorage.getItem(WIDTHS_KEY);
      if (widths) {
        const w: unknown = JSON.parse(widths);
        if (Array.isArray(w) && w.length === SHEET_COLS && w.every((n) => Number.isFinite(n) && n > 0)) setColWidths(w);
      }
    } catch {
      data = null;
    }
    engine.load(data ?? SAMPLE_SHEET);
    if (!data) setDemoGuide('sample');
    if (!widths) setColWidths(contentWidths(engine));
    setLoaded(true);
    gridRef.current?.focus();
  }, [engine]);

  useEffect(() => {
    if (!loaded) return;
    const save = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(engine.toJSON()));
        setSavedVersion(engine.version);
        setSaveFailed(false);
      } catch {
        setSaveFailed(true);
      }
    };
    const t = setTimeout(save, 500);
    // Flush the debounce when leaving the page; a failed write remains visible while the page is open.
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pagehide', save);
    };
  }, [engine, version, loaded]);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTHS_KEY, JSON.stringify(colWidths));
    } catch {
      /* ignore */
    }
  }, [colWidths]);

  useEffect(() => {
    if (!toast || toast === heldToast) return;
    const t = setTimeout(() => setToast(undefined), 5000);
    return () => clearTimeout(t);
  }, [toast, heldToast]);

  useEffect(() => setDiagHidden(false), [active.row, active.col]);

  // ------------------------------------------------------------------ edits & history
  const apply = useCallback(
    (edits: CellEdit[], label: string) => {
      const changes = edits
        .map((e) => ({ ...e, before: engine.getRaw(e.row, e.col) }))
        .filter((e) => e.before !== e.raw);
      if (!changes.length) return false;
      history.push({ label, edits: changes, selection: sel });
      // Replaces any pending "Undo" in the status bar, which would otherwise point at the wrong action.
      setToast({ text: `${label}: ${recalcSummary(engine.setCells(changes))}` });
      bumpHistory();
      return true;
    },
    [engine, history, sel],
  );

  const undo = () => {
    const r = history.undo();
    if (!r) return;
    setDemoGuide(null);
    setEdit(null);
    const s = engine.setCells(r.edits);
    setSel(r.entry.selection);
    gridRef.current?.scrollIntoView(r.entry.selection.anchor);
    say(`Undid ${r.entry.label}: ${recalcSummary(s)}`);
    bumpHistory();
  };

  const redo = () => {
    const r = history.redo();
    if (!r) return;
    setDemoGuide(null);
    setEdit(null);
    const s = engine.setCells(r.edits);
    setSel(r.entry.selection);
    say(`Redid ${r.entry.label}: ${recalcSummary(s)}`);
    bumpHistory();
  };

  const replaceSheet = (data: Record<string, string>, label: string, guide: 'sample' | 'stress' | null = null) => {
    const edits: CellEdit[] = [];
    const current = engine.toJSON();
    const hadCells = engine.cellCount > 0;
    for (const a1 of Object.keys(current)) {
      if (!(a1 in data)) {
        const p = parseA1(a1)!;
        edits.push({ row: p.row, col: p.col, raw: '' });
      }
    }
    for (const [a1, raw] of Object.entries(data)) {
      const p = parseA1(a1);
      if (p) edits.push({ row: p.row, col: p.col, raw });
    }
    setEdit(null);
    setDemoGuide(guide);
    const replaced = apply(edits, label);
    // A new sheet gets a fresh layout: columns sized to their contents, so no value is cut off.
    setColWidths(contentWidths(engine));
    setSel(single(0, 0));
    gridRef.current?.scrollIntoView({ row: 0, col: 0 });
    gridRef.current?.focus();
    const s = engine.lastStats;
    const text = !engine.cellCount ? 'Sheet cleared' : s ? `${label}: ${engine.cellCount.toLocaleString()} cells, ${s.evaluated.toLocaleString()} formulas evaluated in ${s.ms.toFixed(0)} ms` : label;
    // No confirmation step: replacing the sheet is one undoable edit, and the message offers the undo right there.
    setToast({ text, undo: hadCells && replaced });
  };

  // ------------------------------------------------------------------ editing
  const activeInput = () => (edit?.target === 'bar' ? barInputRef.current : cellInputRef.current);

  const focusInputAt = (pos: number, target: 'cell' | 'bar' = edit?.target ?? 'cell') => {
    requestAnimationFrame(() => {
      const el = target === 'bar' ? barInputRef.current : cellInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const startEdit = (at: CellPos, initial: string | undefined, mode: EditState['mode'], target: EditState['target'] = 'cell') => {
    const value = initial ?? engine.getRaw(at.row, at.col);
    setEdit({ row: at.row, col: at.col, value, mode, target });
    setCaret(value.length);
    setAssistIdx(0);
    setAssistOff(false);
    refInsert.current = null;
  };

  const commitEdit = (dr = 0, dc = 0) => {
    if (!edit) return;
    apply([{ row: edit.row, col: edit.col, raw: normalizeFormula(edit.value) }], `Edit ${toA1(edit.row, edit.col)}`);
    setEdit(null);
    const next = clampPos({ row: edit.row + dr, col: edit.col + dc });
    setSel(single(next.row, next.col));
    gridRef.current?.scrollIntoView(next);
    gridRef.current?.focus();
  };

  const cancelEdit = () => {
    setEdit(null);
    gridRef.current?.focus();
  };

  const changeEdit = (value: string, pos: number) => {
    if (!edit) return;
    setEdit({ ...edit, value });
    setCaret(pos);
    setAssistIdx(0);
    setAssistOff(false);
    refInsert.current = null;
  };

  // Put the caret at the end when in-cell editing starts.
  const editKey = edit ? `${edit.row}:${edit.col}:${edit.target}` : '';
  useLayoutEffect(() => {
    if (!edit || edit.target !== 'cell') return;
    const el = cellInputRef.current;
    if (el && document.activeElement !== el) {
      el.focus();
      el.setSelectionRange(edit.value.length, edit.value.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editKey]);

  const assist = useMemo(() => (edit && !assistOff ? assistAt(edit.value, caret) : null), [edit, assistOff, caret]);
  const assistSel = Math.min(assistIdx, Math.max(0, (assist?.suggestions.length ?? 0) - 1));
  const suggesting = !!assist?.suggestions.length;

  // Live diagnostics check the formula once typing pauses, and not while the autocomplete is open,
  // so a half-typed name like =SU isn't flagged. The last result stays up while you keep typing.
  const [lint, setLint] = useState<string | null>(null);
  const editValue = edit?.value;
  useEffect(() => {
    if (editValue === undefined) return setLint(null);
    if (suggesting) return;
    const t = setTimeout(() => setLint(editValue), 500);
    return () => clearTimeout(t);
  }, [editValue, suggesting]);

  const acceptSuggestion = (def: FnDef) => {
    if (!edit || !assist?.prefix) return;
    const { start, text } = assist.prefix;
    const insert = `${def.name}(`;
    const value = edit.value.slice(0, start) + insert + edit.value.slice(start + text.length);
    const pos = start + insert.length;
    setEdit({ ...edit, value });
    setCaret(pos);
    focusInputAt(pos);
  };

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!edit) return;
    const suggestions = assist?.suggestions ?? [];
    if (suggestions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = suggestions.length;
        setAssistIdx((i) => (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        acceptSuggestion(suggestions[assistSel]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAssistOff(true);
        return;
      }
    }
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(e.shiftKey ? -1 : 1, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(0, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (arrows[e.key] && edit.mode === 'enter' && !edit.value.startsWith('=')) {
      e.preventDefault();
      commitEdit(...arrows[e.key]);
    }
  };

  // ------------------------------------------------------------------ selection & keyboard
  const hasValue = (r: number, c: number) => engine.getRecord(r, c) !== undefined;

  const move = (dr: number, dc: number, extend: boolean, toEdge: boolean) => {
    const base = extend ? sel.head : sel.anchor;
    const next = toEdge ? jump(base, dr, dc, hasValue) : clampPos({ row: base.row + dr, col: base.col + dc });
    setSel(extend ? { anchor: sel.anchor, head: next } : single(next.row, next.col));
    gridRef.current?.scrollIntoView(next);
  };

  const clearSelection = () => {
    const edits: CellEdit[] = [];
    engine.forEachInRange(selectionRange(sel), (row, col) => edits.push({ row, col, raw: '' }));
    apply(edits, 'Clear');
  };

  const fill = (source: RangeBounds, target: RangeBounds) => {
    apply(buildFill(source, target, (r, c) => engine.getRaw(r, c)), 'Fill');
    setSel({ anchor: { row: target.r1, col: target.c1 }, head: { row: target.r2, col: target.c2 } });
  };

  /** Ctrl+D / Ctrl+R: copy the first row/column of the selection across it (or the cell above/left if one row/col). */
  const fillFromEdge = (down: boolean) => {
    const r = selectionRange(sel);
    if (down) {
      const src = r.r1 === r.r2 ? r.r1 - 1 : r.r1;
      if (src < 0) return;
      fill({ ...r, r1: src, r2: src }, { ...r, r1: src });
    } else {
      const src = r.c1 === r.c2 ? r.c1 - 1 : r.c1;
      if (src < 0) return;
      fill({ ...r, c1: src, c2: src }, { ...r, c1: src });
    }
  };

  const onGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // keystrokes inside the cell editor
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;
    const lower = key.toLowerCase();
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const page = Math.max(1, Math.floor((window.innerHeight - 200) / ROW_HEIGHT));
    const releaseTab = tabOut.current;
    tabOut.current = key === 'Escape';

    if (mod && lower === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && lower === 'y') {
      e.preventDefault();
      redo();
    } else if (mod && lower === 'a') {
      e.preventDefault();
      setSel({ anchor: { row: 0, col: 0 }, head: { row: SHEET_ROWS - 1, col: SHEET_COLS - 1 } });
    } else if (mod && lower === 'd') {
      e.preventDefault();
      fillFromEdge(true);
    } else if (mod && lower === 'r') {
      e.preventDefault();
      fillFromEdge(false);
    } else if (mod && (lower === 'c' || lower === 'x' || lower === 'v')) {
      // Handled by the native copy/cut/paste events below.
    } else if (arrows[key]) {
      e.preventDefault();
      move(arrows[key][0], arrows[key][1], e.shiftKey, mod);
    } else if (key === 'Tab') {
      if (releaseTab) return; // Escape, then Tab: let the browser move focus out of the sheet.
      e.preventDefault();
      move(0, e.shiftKey ? -1 : 1, false, false);
    } else if (key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      move(-1, 0, false, false);
    } else if (key === 'Enter' || key === 'F2') {
      e.preventDefault();
      startEdit(active, undefined, 'edit');
    } else if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      clearSelection();
    } else if (key === 'Escape') {
      setCopyRange(null);
      clipboard.current = null;
    } else if (key === 'F8') {
      e.preventDefault();
      jumpToError(e.shiftKey);
    } else if (key === 'F9') {
      e.preventDefault();
      const s = engine.recalculateAll();
      say(`Recalculate all (F9): ${recalcSummary(s)}`);
    } else if (key === 'Home') {
      e.preventDefault();
      const next = mod ? { row: 0, col: 0 } : { row: active.row, col: 0 };
      setSel(single(next.row, next.col));
      gridRef.current?.scrollIntoView(next);
    } else if (key === 'End' && mod) {
      e.preventDefault();
      const b = engine.usedBounds();
      const next = b ? { row: b.r2, col: b.c2 } : { row: 0, col: 0 };
      setSel(single(next.row, next.col));
      gridRef.current?.scrollIntoView(next);
    } else if (key === 'PageDown' || key === 'PageUp') {
      e.preventDefault();
      move(key === 'PageDown' ? page : -page, 0, e.shiftKey, false);
    } else if (key.length === 1 && !mod && !e.altKey) {
      e.preventDefault();
      startEdit(active, key, 'enter');
    }
  };

  // ------------------------------------------------------------------ clipboard
  /** Clipboard events only belong to the grid when the grid itself (not an input or panel) has focus. */
  const fromGrid = (e: React.SyntheticEvent) => (e.target as HTMLElement).classList?.contains('grid-scroller');

  const onCopy = (e: React.ClipboardEvent, cut: boolean) => {
    if (!fromGrid(e)) return;
    const r = selectionRange(sel);
    const area = (r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1);
    if (area > MAX_CLIPBOARD_CELLS) {
      say(`Selection too large to copy (${area.toLocaleString()} cells).`);
      return;
    }
    const raws: string[][] = [];
    const shown: string[][] = [];
    for (let row = r.r1; row <= r.r2; row++) {
      const rr: string[] = [];
      const sr: string[] = [];
      for (let col = r.c1; col <= r.c2; col++) {
        rr.push(engine.getRaw(row, col));
        sr.push(displayValue(engine.getValue(row, col)));
      }
      raws.push(rr);
      shown.push(sr);
    }
    const text = shown.map((row) => row.join('\t')).join('\n');
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
    clipboard.current = { range: r, raws, text, cut };
    setCopyRange(r);
    say(`${cut ? 'Cut' : 'Copied'} ${rangeToA1(r)}`);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (!fromGrid(e)) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const dest = sel.anchor;
    const clip = clipboard.current;
    const edits: CellEdit[] = [];
    let rows: string[][];
    if (clip && text === clip.text) {
      const dRow = dest.row - clip.range.r1;
      const dCol = dest.col - clip.range.c1;
      rows = clip.raws.map((row) => row.map((raw) => (clip.cut ? raw : shiftFormula(raw, dRow, dCol))));
      if (clip.cut) {
        for (let r = clip.range.r1; r <= clip.range.r2; r++)
          for (let c = clip.range.c1; c <= clip.range.c2; c++) edits.push({ row: r, col: c, raw: '' });
        clipboard.current = null;
        setCopyRange(null);
      }
    } else {
      rows = parseTSV(text);
    }
    rows.forEach((row, i) => row.forEach((raw, j) => edits.push({ row: dest.row + i, col: dest.col + j, raw })));
    // Later edits win, so pasted cells overwrite the cleared cut source where they overlap.
    const dedup = new Map(edits.map((ed) => [cellKey(ed.row, ed.col), ed]));
    apply([...dedup.values()], 'Paste');
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    setSel({ anchor: dest, head: clampPos({ row: dest.row + h - 1, col: dest.col + w - 1 }) });
  };

  // ------------------------------------------------------------------ pointer
  const onPointerDown = (pos: CellPos, shift: boolean): DragMode => {
    lastDrag.current = `${pos.row}:${pos.col}`;
    if (edit && edit.value.startsWith('=')) {
      const c = activeInput()?.selectionStart ?? edit.value.length;
      const ri = refInsert.current;
      let range: [number, number] | null = null;
      if (ri && ri.end === c) range = [ri.start, ri.end];
      else if (canInsertRef(edit.value, c)) range = [c, c];
      if (range) {
        const text = toA1(pos.row, pos.col);
        const value = edit.value.slice(0, range[0]) + text + edit.value.slice(range[1]);
        refInsert.current = { start: range[0], end: range[0] + text.length, anchor: pos };
        setEdit({ ...edit, value });
        setCaret(range[0] + text.length);
        focusInputAt(range[0] + text.length);
        return 'ref';
      }
    }
    if (edit) commitEdit();
    setSel(shift ? { anchor: sel.anchor, head: pos } : single(pos.row, pos.col));
    return 'select';
  };

  const onPointerDrag = (pos: CellPos, mode: DragMode) => {
    const k = `${pos.row}:${pos.col}`;
    if (k === lastDrag.current) return;
    lastDrag.current = k;
    if (mode === 'select') {
      setSel((s) => ({ anchor: s.anchor, head: pos }));
    } else if (mode === 'ref') {
      const ri = refInsert.current;
      if (!ri) return;
      const text = rangeToA1(normalizeRange(ri.anchor, pos));
      const { start, end } = ri;
      setEdit((e) => (e ? { ...e, value: e.value.slice(0, start) + text + e.value.slice(end) } : e));
      ri.end = start + text.length;
      setCaret(ri.end);
      focusInputAt(ri.end);
    }
  };

  // ------------------------------------------------------------------ toolbar actions
  const applyFix = (fix: string) => {
    if (edit) {
      setEdit({ ...edit, value: fix });
      setCaret(fix.length);
      focusInputAt(fix.length);
    } else {
      apply([{ row: active.row, col: active.col, raw: fix }], `Fix ${activeAddress}`);
      gridRef.current?.focus();
    }
  };

  const goTo = (text: string): boolean => {
    const r = parseRangeA1(text);
    if (!r) {
      say(`"${text}" is not a valid cell or range.`);
      return false;
    }
    setEdit(null);
    setSel({ anchor: { row: r.r1, col: r.c1 }, head: { row: r.r2, col: r.c2 } });
    gridRef.current?.scrollIntoView({ row: r.r1, col: r.c1 });
    gridRef.current?.focus();
    return true;
  };

  /** Selects the next (or previous) error cell after the active one, wrapping around the sheet. */
  const jumpToError = (back: boolean) => {
    if (!errorKeys.length) return;
    const here = cellKey(active.row, active.col);
    const key = back ? (errorKeys.filter((k) => k < here).at(-1) ?? errorKeys.at(-1)!) : (errorKeys.find((k) => k > here) ?? errorKeys[0]);
    const next = { row: keyRow(key), col: keyCol(key) };
    if (edit) commitEdit();
    setSel(single(next.row, next.col));
    gridRef.current?.scrollIntoView(next);
    gridRef.current?.focus();
  };

  const insertFunction = (def: FnDef) => {
    const narrow = window.matchMedia('(max-width: 760px)').matches;
    const target = narrow ? 'bar' : edit?.target ?? 'cell';
    if (narrow) setShowFns(false);
    if (edit && edit.value.startsWith('=')) {
      const c = activeInput()?.selectionStart ?? edit.value.length;
      const value = edit.value.slice(0, c) + `${def.name}(` + edit.value.slice(c);
      const pos = c + def.name.length + 1;
      setEdit({ ...edit, value, target });
      setCaret(pos);
      focusInputAt(pos, target);
    } else {
      const value = `=${def.name}(`;
      startEdit(active, value, 'edit', target);
      focusInputAt(value.length, target);
    }
  };

  const exportCSV = () => {
    const b = engine.usedBounds();
    if (!b) return say('The sheet is empty.');
    const rows: string[][] = [];
    for (let r = 0; r <= b.r2; r++) {
      const row: string[] = [];
      for (let c = 0; c <= b.c2; c++) row.push(displayValue(engine.getValue(r, c)));
      rows.push(row);
    }
    const url = URL.createObjectURL(new Blob([toCSV(rows)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gridcalc.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = async (file: File) => {
    if (file.size > MAX_IMPORT_MB * 1024 * 1024) return say(`${file.name} is larger than ${MAX_IMPORT_MB} MB, so it wasn't imported.`);
    let rows: string[][];
    try {
      rows = parseCSV(await file.text());
    } catch {
      return say(`Couldn't read ${file.name}. Check that it's a text CSV file.`);
    }
    const data: Record<string, string> = {};
    let clipped = false;
    rows.forEach((row, r) =>
      row.forEach((raw, c) => {
        if (raw === '') return;
        if (r < SHEET_ROWS && c < SHEET_COLS) data[toA1(r, c)] = raw;
        else clipped = true;
      }),
    );
    replaceSheet(data, `Import ${file.name}`);
    if (clipped) setToast((t) => ({ text: `Imported ${file.name}. Cells outside A1:${LAST_CELL_A1} were left out.`, undo: t?.undo }));
  };

  /** F6 / Shift+F6 cycle focus between the toolbar, the name box and the sheet, as in desktop spreadsheets. */
  const onAppKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'F6') return;
    e.preventDefault();
    const regions = [toolbarRef.current, barWrapRef.current, workspaceRef.current];
    const current = regions.findIndex((r) => r?.contains(document.activeElement));
    const next = current < 0 ? 2 : (current + (e.shiftKey ? 2 : 1)) % 3;
    if (next === 2) gridRef.current?.focus();
    else regions[next]?.querySelector<HTMLElement>('button:not(:disabled), input')?.focus();
  };

  // ------------------------------------------------------------------ derived view state
  const activeRec = engine.getRecord(active.row, active.col);

  const diagView: DiagnosticView | null = useMemo(() => {
    if (edit) {
      if (suggesting || !lint?.startsWith('=') || lint.length < 2) return null;
      const d = parseFormula(lint).diagnostic;
      return d ? { kind: 'live', address: toA1(edit.row, edit.col), formula: lint, ...d } : null;
    }
    const rec = engine.getRecord(active.row, active.col);
    if (!rec) return null;
    if (rec.diagnostic) return { kind: 'syntax', address: activeAddress, formula: rec.raw, ...rec.diagnostic };
    if (rec.value instanceof CellError) {
      const v = rec.value;
      return {
        kind: 'runtime',
        address: activeAddress,
        formula: rec.raw,
        code: v.code,
        message: v.message,
        start: v.span?.start,
        end: v.span?.end,
        origin: v.origin,
        // An error passed on from another cell is fixed at its source, which the panel links to.
        ...(v.origin ? {} : explainRuntimeError(v.code, rec.raw)),
      };
    }
    return null;
    // `version` invalidates when values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit, lint, suggesting, engine, active.row, active.col, activeAddress, version]);

  const selStats: SelectionStats = useMemo(() => {
    const r = selectionRange(sel);
    const s: SelectionStats = { cells: (r.r2 - r.r1 + 1) * (r.c2 - r.c1 + 1), count: 0, numeric: 0, sum: 0, min: Infinity, max: -Infinity };
    if (s.cells === 1) return s;
    engine.forEachInRange(r, (_r, _c, rec) => {
      if (rec.value === null) return;
      s.count++;
      if (typeof rec.value === 'number') {
        s.numeric++;
        s.sum += rec.value;
        s.min = Math.min(s.min, rec.value);
        s.max = Math.max(s.max, rec.value);
      }
    });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, engine, version]);

  /** Every error cell in reading order, for the status bar's error count and F8 / Shift+F8. */
  const errorKeys = useMemo(() => {
    const keys: number[] = [];
    engine.forEachInRange({ r1: 0, c1: 0, r2: SHEET_ROWS - 1, c2: SHEET_COLS - 1 }, (r, c, rec) => {
      if (rec.value instanceof CellError) keys.push(cellKey(r, c));
    });
    return keys.sort((a, b) => a - b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, version]);

  const refMarks = useMemo(() => (edit ? formulaRefs(edit.value) : []), [edit]);
  const barValue = edit ? edit.value : (activeRec?.raw ?? '');
  const showDiag = !!diagView && !diagHidden;
  const assistOpen = (target: EditState['target']) => edit?.target === target && suggesting;

  // The docked panel takes its height from the bottom of the sheet: keep the active cell in view.
  useEffect(() => {
    if (showDiag) gridRef.current?.scrollIntoView(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDiag]);

  const selectionLabel = (() => {
    const r = selectionRange(sel);
    return r.r1 === r.r2 && r.c1 === r.c2 ? activeAddress : rangeToA1(r);
  })();

  /**
   * What a screen reader hears when the selection, the active cell's value or its diagnosis changes. The diagnostics
   * panel isn't a live region itself, so only this one-line summary is read, not its caret line and suggestion.
   */
  const announcement = (() => {
    const diagnosis = showDiag ? `. ${diagView!.message}${diagView!.fix ? ' A one-click fix is in the diagnostics panel.' : ''}` : '';
    if (edit) return showDiag ? `Problem in formula${diagnosis}` : '';
    if (selectionLabel !== activeAddress) return `${selectionLabel} selected, ${selStats.cells.toLocaleString()} cells`;
    if (!activeRec) return `${activeAddress}, blank`;
    const shown = `${activeAddress}, ${displayValue(activeRec.value)}${activeRec.value instanceof CellError ? ' error' : ''}`;
    return (activeRec.raw.startsWith('=') ? `${shown}, formula ${activeRec.raw}` : shown) + diagnosis;
  })();

  const cellEditor = edit && (
    <>
      <input
        ref={cellInputRef}
        className="cell-editor"
        aria-label={`Editing ${toA1(edit.row, edit.col)}`}
        value={edit.value}
        spellCheck={false}
        autoComplete="off"
        {...comboboxAttrs(assistId, assistOpen('cell'), assistSel)}
        style={{ width: Math.max(colWidths[edit.col] + 2, Math.min(560, edit.value.length * 8 + 24)) }}
        onChange={(e) => changeEdit(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onSelect={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? 0)}
        onFocus={() => edit.target !== 'cell' && setEdit({ ...edit, target: 'cell' })}
        onKeyDown={onEditorKeyDown}
      />
      {edit.target === 'cell' && assist && (
        <div className="assist-anchor">
          <FormulaAssist id={assistId} info={assist} selected={assistSel} onPick={acceptSuggestion} />
        </div>
      )}
    </>
  );

  const sheetActions: { label: string; detail: string; run(): void; disabled?: boolean }[] = [
    { label: 'Import CSV', detail: 'Replace the sheet with a .csv file', run: () => fileRef.current?.click() },
    { label: 'Export values as CSV', detail: 'Download calculated values; formulas are not included', run: exportCSV },
    { label: 'Clear', detail: 'Empty the sheet; Undo brings it back', run: () => replaceSheet({}, 'Clear sheet'), disabled: !engine.cellCount },
  ];

  // ------------------------------------------------------------------ render
  return (
    <div
      className={'app' + (edit ? ' is-editing' : '') + (viewportHeight && viewportHeight < 520 ? ' short-viewport' : '')}
      style={viewportHeight ? { '--app-height': `${viewportHeight}px` } as CSSProperties : undefined}
      onKeyDown={onAppKeyDown}
    >
      <header className="toolbar" ref={toolbarRef}>
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <svg viewBox="0 0 20 20" width="20" height="20">
              <rect x="1" y="1" width="18" height="18" rx="4" fill="currentColor" />
              <path d="M1 7.5h18M1 12.5h18M7.5 1v18M12.5 1v18" stroke="var(--bg)" strokeWidth="1.2" opacity=".6" />
              <rect x="7.5" y="7.5" width="5" height="5" fill="var(--bg)" />
            </svg>
          </span>
          <h1 className="brand-name">GridCalc</h1>
        </div>

        <div className="tool-group">
          <button className="tool" onClick={undo} disabled={!history.canUndo} title={`Undo ${history.peekUndoLabel() ?? ''} (Ctrl/⌘+Z)`}>
            <Icon name="undo" />
            <span className="tool-label">Undo</span>
          </button>
          <button className="tool" onClick={redo} disabled={!history.canRedo} title={`Redo ${history.peekRedoLabel() ?? ''} (Ctrl/⌘+Y)`}>
            <Icon name="redo" />
            <span className="tool-label">Redo</span>
          </button>
        </div>

        <div className="tool-group">
          <ToolMenu
            title="Demo sheets"
            label={
              <>
                Demos
                <Icon name="chevron" />
              </>
            }
          >
            {(close) =>
              DEMOS.map((d) => (
                <button
                  key={d.label}
                  className="menu-item"
                  onClick={() => {
                    close();
                    replaceSheet(d.data(), d.label, d.guide);
                  }}
                >
                  <b>{d.label}</b>
                  <span>{d.detail}</span>
                </button>
              ))
            }
          </ToolMenu>
        </div>

        <div className="tool-group">
          {/* Sheet actions share one menu, including a non-drag alternative to resizing columns. */}
          <ToolMenu
            className="end"
            title="Sheet actions"
            label={
              <>
                Sheet
                <Icon name="chevron" />
              </>
            }
          >
            {(close) => (
              <>
                {sheetActions.map((a) => (
                  <button
                    key={a.label}
                    className="menu-item"
                    disabled={a.disabled}
                    onClick={() => {
                      close();
                      a.run();
                    }}
                  >
                    <b>{a.label}</b>
                    <span>{a.detail}</span>
                  </button>
                ))}
                <ColumnWidthControl
                  key={active.col}
                  column={colToLetters(active.col)}
                  width={colWidths[active.col]}
                  onResize={(width) => setColWidths((ws) => ws.map((w, c) => c === active.col ? width : w))}
                />
                <div className="narrow-only"><ThemePicker /></div>
              </>
            )}
          </ToolMenu>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importCSV(f);
              e.target.value = '';
            }}
          />
        </div>

        <div className="tool-group right wide-only">
          <ToolMenu
            className="end"
            title="Theme"
            label={
              <>
                Theme
                <Icon name="chevron" />
              </>
            }
          >
            {() => <ThemePicker />}
          </ToolMenu>
          <ToolMenu className="end shortcuts" title="Keyboard shortcuts" label="Shortcuts">
            {() => (
              <table>
                <tbody>
                  {SHORTCUTS.map(([k, d]) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ToolMenu>
        </div>
      </header>

      <section className="bar-wrap" ref={barWrapRef} aria-label="Formula bar">
        <FormulaBar
          inputRef={barInputRef}
          address={selectionLabel}
          value={barValue}
          editing={edit?.target === 'bar'}
          combobox={comboboxAttrs(assistId, assistOpen('bar'), assistSel)}
          onNavigate={goTo}
          onFocus={() => {
            if (!edit) startEdit(active, undefined, 'edit', 'bar');
            else if (edit.target !== 'bar') setEdit({ ...edit, target: 'bar' });
          }}
          onChange={(value, pos) => (edit ? changeEdit(value, pos) : startEdit(active, value, 'edit', 'bar'))}
          onCaret={setCaret}
          onKeyDown={onEditorKeyDown}
          functionsOpen={showFns}
          onToggleFunctions={() => setShowFns((v) => !v)}
        />
        {demoGuide && !edit && (
          <DemoGuide
            kind={demoGuide}
            onTryFix={() => {
              setDemoGuide(null);
              goTo('H2');
            }}
            onLoadStress={() => replaceSheet(stressSheet(), '10k-row stress test', 'stress')}
            onGoTo={goTo}
            onDismiss={() => {
              setDemoGuide(null);
              gridRef.current?.focus();
            }}
          />
        )}
        {edit && (
          <div className="edit-actions" role="group" aria-label="Finish editing">
            <span>Editing <b>{toA1(edit.row, edit.col)}</b></span>
            <button onPointerDown={(e) => e.preventDefault()} onClick={cancelEdit}>Cancel</button>
            <button className="apply-edit" onPointerDown={(e) => e.preventDefault()} onClick={() => commitEdit()}>Apply</button>
          </div>
        )}
        {edit?.target === 'bar' && assist && (
          <div className="assist-anchor bar">
            <FormulaAssist id={assistId} info={assist} selected={assistSel} onPick={acceptSuggestion} />
          </div>
        )}
      </section>

      <main className="workspace" ref={workspaceRef}>
        <div className="grid-host" onCopy={(e) => onCopy(e, false)} onCut={(e) => onCopy(e, true)} onPaste={onPaste}>
          <Grid
            ref={gridRef}
            engine={engine}
            version={version}
            selection={sel}
            colWidths={colWidths}
            refMarks={refMarks}
            copyRange={copyRange}
            editing={!!edit}
            editor={cellEditor}
            onColResize={(col, w) => setColWidths((ws) => ws.map((x, i) => (i === col ? w : x)))}
            onSelect={(s) => {
              if (edit) commitEdit();
              setSel(s);
            }}
            onPointerDown={onPointerDown}
            onPointerDrag={onPointerDrag}
            onDoubleClick={(pos, touch) => {
              if (edit) return;
              setSel(single(pos.row, pos.col));
              startEdit(pos, undefined, 'edit', touch ? 'bar' : 'cell');
              if (touch) focusInputAt(engine.getRaw(pos.row, pos.col).length, 'bar');
            }}
            onFill={fill}
            onKeyDown={onGridKeyDown}
            onRenderStats={setRendered}
          />
          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
          {showDiag && (
            <DiagnosticsPanel
              view={diagView!}
              onApplyFix={applyFix}
              onGoTo={(a1) => goTo(a1)}
              onDismiss={() => setDiagHidden(true)}
            />
          )}
        </div>
        {showFns && (
          <FunctionsPanel
            onInsert={insertFunction}
            onClose={() => {
              setShowFns(false);
              gridRef.current?.focus();
            }}
          />
        )}
      </main>

      <StatusBar
        saveState={saveFailed ? 'failed' : !loaded || savedVersion !== version ? 'saving' : 'saved'}
        onExport={exportCSV}
        stats={selStats}
        recalc={engine.lastStats}
        rendered={rendered}
        totalCells={SHEET_ROWS * SHEET_COLS}
        usedCells={engine.cellCount}
        errors={errorKeys.length}
        onNextError={() => jumpToError(false)}
        message={toast?.text}
        onHold={(held) => setHeldToast(held ? toast : undefined)}
        onUndo={
          toast?.undo
            ? () => {
                undo();
                gridRef.current?.focus();
              }
            : undefined
        }
      />
    </div>
  );
}
