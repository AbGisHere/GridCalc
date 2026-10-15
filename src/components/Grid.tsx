'use client';

import { Fragment, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { cellKey, colToLetters, type CellPos, type RangeBounds } from '@/engine/address';
import type { SpreadsheetEngine } from '@/engine/engine';
import { CellError, displayValue } from '@/engine/values';
import { fillTarget } from '@/state/fill';
import { selectionRange, type Selection } from '@/state/selection';
import type { RefMark } from './formulaTokens';
import { clampColumnWidth, ColumnLayout, HEADER_HEIGHT, ROW_HEADER_WIDTH, ROW_HEIGHT } from './geometry';
import { trackPointer, trackTap } from './pointer';

export type DragMode = 'select' | 'ref' | 'none';

export interface GridHandle {
  focus(): void;
  scrollIntoView(pos: CellPos): void;
}

interface GridProps {
  ref?: Ref<GridHandle>;
  engine: SpreadsheetEngine;
  version: number;
  selection: Selection;
  colWidths: number[];
  refMarks: RefMark[];
  copyRange: RangeBounds | null;
  editing: boolean;
  /** The in-cell editor; positioned over the active cell. */
  editor: ReactNode;
  onColResize(col: number, width: number): void;
  onSelect(sel: Selection): void;
  onPointerDown(pos: CellPos, shiftKey: boolean): DragMode;
  onPointerDrag(pos: CellPos, mode: DragMode): void;
  onDoubleClick(pos: CellPos, touch: boolean): void;
  onFill(source: RangeBounds, target: RangeBounds): void;
  onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void;
  /** Reports how many cells are currently mounted, to show virtualization at work. */
  onRenderStats?(rendered: number): void;
}

const OVERSCAN_ROWS = 6;
const OVERSCAN_COLS = 2;
const EDGE = 28;
/** Room left around a cell scrolled into view, so the fill handle and the touch grip on its corners aren't cut off. */
const REVEAL_MARGIN = 8;
/** Longest the recalculation wave can take: the deepest delay plus the fade (see .recalc in globals.css). */
const WAVE_MS = 1300;

interface Viewport {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Grid(props: GridProps) {
  const { engine, selection, colWidths, refMarks, copyRange, editing, editor, ref } = props;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState<Viewport>({ top: 0, left: 0, width: 1200, height: 800 });
  const [fillPreview, setFillPreview] = useState<RangeBounds | null>(null);
  const layout = useMemo(() => new ColumnLayout(colWidths), [colWidths]);
  const rows = engine.rows;
  const hintId = useId();
  const cellId = (r: number, c: number) => `${hintId}-${r}-${c}`;
  const pointerType = useRef('mouse');

  // Latest props for window-level listeners attached during drags.
  const live = useRef(props);
  live.current = props;

  // The cells the last edit recalculated, kept until the wave has played out so cells scrolled into view later
  // don't light up. Keyed by version, so an edit mid-wave restarts it.
  const [wave, setWave] = useState<{ id: number; depths: ReadonlyMap<number, number> } | null>(null);
  useEffect(() => {
    const depths = engine.lastWave;
    setWave(depths.size ? { id: props.version, depths } : null);
    if (!depths.size) return;
    const t = setTimeout(() => setWave(null), WAVE_MS);
    return () => clearTimeout(t);
  }, [engine, props.version]);

  // ----------------------------------------------------------- viewport tracking
  const frame = useRef(0);
  const syncViewport = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      setVp({ top: el.scrollTop, left: el.scrollLeft, width: el.clientWidth, height: el.clientHeight });
    });
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current!;
    setVp({ top: el.scrollTop, left: el.scrollLeft, width: el.clientWidth, height: el.clientHeight });
    const ro = new ResizeObserver(syncViewport);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncViewport]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => scrollerRef.current?.focus({ preventScroll: true }),
      scrollIntoView: ({ row, col }) => {
        const el = scrollerRef.current;
        if (!el) return;
        const viewH = el.clientHeight - HEADER_HEIGHT;
        const viewW = el.clientWidth - ROW_HEADER_WIDTH;
        const top = row * ROW_HEIGHT;
        const left = layout.x(col);
        const bottom = top + ROW_HEIGHT + REVEAL_MARGIN;
        const right = left + layout.width(col) + REVEAL_MARGIN;
        if (top - REVEAL_MARGIN < el.scrollTop) el.scrollTop = Math.max(0, top - REVEAL_MARGIN);
        else if (bottom > el.scrollTop + viewH) el.scrollTop = bottom - viewH;
        if (left - REVEAL_MARGIN < el.scrollLeft) el.scrollLeft = Math.max(0, left - REVEAL_MARGIN);
        else if (right > el.scrollLeft + viewW) el.scrollLeft = right - viewW;
      },
    }),
    [layout],
  );

  // ----------------------------------------------------------- visible window
  const r0 = Math.max(0, Math.floor(vp.top / ROW_HEIGHT) - OVERSCAN_ROWS);
  const r1 = Math.min(rows - 1, Math.ceil((vp.top + vp.height) / ROW_HEIGHT) + OVERSCAN_ROWS);
  const c0 = Math.max(0, layout.indexAt(vp.left) - OVERSCAN_COLS);
  const c1 = Math.min(layout.count - 1, layout.indexAt(vp.left + vp.width) + OVERSCAN_COLS);

  const rendered = (r1 - r0 + 1) * (c1 - c0 + 1);
  useEffect(() => live.current.onRenderStats?.(rendered), [rendered]);

  // ----------------------------------------------------------- pointer handling
  const posFromClient = useCallback(
    (x: number, y: number): CellPos => {
      const rect = cellsRef.current!.getBoundingClientRect();
      const row = Math.min(rows - 1, Math.max(0, Math.floor((y - rect.top) / ROW_HEIGHT)));
      const col = layout.indexAt(Math.max(0, x - rect.left));
      return { row, col };
    },
    [layout, rows],
  );

  /** Shared drag loop for mouse, pen and touch: tracks the pointer, auto-scrolls near edges, reports cell positions. */
  const startDrag = useCallback(
    (start: React.PointerEvent, onMove: (pos: CellPos) => void, onEnd?: (committed: boolean) => void) => {
      let lastX = start.clientX;
      let lastY = start.clientY;
      let raf = 0;
      const tick = () => {
        const el = scrollerRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          let dx = 0;
          let dy = 0;
          if (lastY > r.bottom - EDGE) dy = ROW_HEIGHT;
          else if (lastY < r.top + HEADER_HEIGHT + 4) dy = -ROW_HEIGHT;
          if (lastX > r.right - EDGE) dx = 40;
          else if (lastX < r.left + ROW_HEADER_WIDTH + 4) dx = -40;
          if (dx || dy) {
            el.scrollTop += dy;
            el.scrollLeft += dx;
            onMove(posFromClient(lastX, lastY));
          }
        }
        raf = requestAnimationFrame(tick);
      };
      const move = (e: PointerEvent) => {
        lastX = e.clientX;
        lastY = e.clientY;
        onMove(posFromClient(e.clientX, e.clientY));
      };
      trackPointer(start, move, (committed) => {
        cancelAnimationFrame(raf);
        onEnd?.(committed);
      });
      raf = requestAnimationFrame(tick);
    },
    [posFromClient],
  );

  const onCellsPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const pos = posFromClient(e.clientX, e.clientY);
    if (e.pointerType === 'touch') {
      trackTap(e, () => {
        const mode = live.current.onPointerDown(pos, e.shiftKey);
        if (mode === 'select') scrollerRef.current?.focus({ preventScroll: true });
      });
      return;
    }
    const mode = live.current.onPointerDown(pos, e.shiftKey);
    if (mode === 'ref') e.preventDefault(); // keep focus (and caret) in the formula editor
    if (mode === 'none') return;
    if (mode === 'select' && !live.current.editing) {
      e.preventDefault();
      scrollerRef.current?.focus({ preventScroll: true });
    }
    startDrag(e, (p) => live.current.onPointerDrag(p, mode));
  };

  const onFillHandleDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    const source = selectionRange(live.current.selection);
    let target: RangeBounds | null = null;
    startDrag(
      e,
      (p) => {
        target = fillTarget(source, p);
        setFillPreview(target);
      },
      (committed) => {
        setFillPreview(null);
        if (committed && target) live.current.onFill(source, target);
      },
    );
  };

  /** Touch has no drag-to-select (a drag scrolls), so the grip drags the selection's top-left corner instead. */
  const onGripDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    const fixed = { row: sel.r2, col: sel.c2 };
    startDrag(e, (p) => live.current.onSelect({ anchor: fixed, head: p }));
  };

  const selectColumns = (col: number, shift: boolean) => {
    const a = shift ? selection.anchor.col : col;
    live.current.onSelect({ anchor: { row: 0, col: a }, head: { row: rows - 1, col } });
    scrollerRef.current?.focus({ preventScroll: true });
  };

  const selectRows = (row: number, shift: boolean) => {
    const a = shift ? selection.anchor.row : row;
    live.current.onSelect({ anchor: { row: a, col: 0 }, head: { row, col: layout.count - 1 } });
    scrollerRef.current?.focus({ preventScroll: true });
  };

  const onHeaderPointerDown = (e: React.PointerEvent, kind: 'col' | 'row', index: number) => {
    if (e.button !== 0 || !e.isPrimary) return;
    if (e.pointerType === 'touch') {
      trackTap(e, () => kind === 'col' ? selectColumns(index, e.shiftKey) : selectRows(index, e.shiftKey));
      return;
    }
    e.preventDefault();
    if (kind === 'col') {
      selectColumns(index, e.shiftKey);
      const anchor = e.shiftKey ? selection.anchor.col : index;
      startDrag(e, (p) => live.current.onSelect({ anchor: { row: 0, col: anchor }, head: { row: rows - 1, col: p.col } }));
    } else {
      selectRows(index, e.shiftKey);
      const anchor = e.shiftKey ? selection.anchor.row : index;
      startDrag(e, (p) => live.current.onSelect({ anchor: { row: anchor, col: 0 }, head: { row: p.row, col: layout.count - 1 } }));
    }
  };

  const onResizeStart = (e: React.PointerEvent, col: number) => {
    e.stopPropagation();
    if (e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[col];
    trackPointer(e, (ev) => live.current.onColResize(col, clampColumnWidth(startW + ev.clientX - startX)));
  };

  // ----------------------------------------------------------- render helpers
  const sel = selectionRange(selection);
  const active = selection.anchor;
  const rect = (b: RangeBounds) => ({
    left: layout.x(b.c1),
    top: b.r1 * ROW_HEIGHT,
    width: layout.x(b.c2 + 1) - layout.x(b.c1),
    height: (b.r2 - b.r1 + 1) * ROW_HEIGHT,
  });
  const fullCols = sel.r1 === 0 && sel.r2 === rows - 1;
  const fullRows = sel.c1 === 0 && sel.c2 === layout.count - 1;

  // Screen readers get a sparse ARIA grid: one row per visible row, holding a row header and its non-empty cells (plus the
  // active cell, which aria-activedescendant points at), each placed by aria-rowindex/aria-colindex. Index 1 is the header row and column.
  const gridRows: ReactNode[] = [];
  const recalced: ReactNode[] = [];
  const activeShown = active.row >= r0 && active.row <= r1 && active.col >= c0 && active.col <= c1;
  for (let r = r0; r <= r1; r++) {
    const cells: ReactNode[] = [];
    for (let c = c0; c <= c1; c++) {
      const rec = engine.getRecord(r, c);
      const place = { left: layout.x(c), top: r * ROW_HEIGHT, width: layout.width(c), height: ROW_HEIGHT };
      const aria = {
        id: cellId(r, c),
        role: 'gridcell',
        'aria-colindex': c + 2,
        'aria-selected': r >= sel.r1 && r <= sel.r2 && c >= sel.c1 && c <= sel.c2,
      };
      if (!rec) {
        if (r === active.row && c === active.col) cells.push(<div key={`${r}:${c}`} className="cell" style={place} {...aria} />);
        continue;
      }
      const depth = wave?.depths.get(cellKey(r, c));
      if (depth) {
        recalced.push(
          <div
            key={`${r}:${c}`}
            className="recalc"
            style={{ left: layout.x(c), top: r * ROW_HEIGHT, width: layout.width(c), height: ROW_HEIGHT, '--depth': Math.min(depth, 8) } as CSSProperties}
          />,
        );
      }
      const v = rec.value;
      const isErr = v instanceof CellError;
      const cls =
        'cell' +
        (typeof v === 'number' ? ' num' : typeof v === 'boolean' ? ' bool' : isErr ? ' err' : '');
      cells.push(
        <div
          key={`${r}:${c}`}
          className={cls}
          style={place}
          title={isErr ? `${v.code} — ${v.origin ? `from ${v.origin}: ` : ''}${v.message}` : undefined}
          {...aria}
        >
          {displayValue(v)}
        </div>,
      );
    }
    gridRows.push(
      <div key={r} role="row" aria-rowindex={r + 2}>
        <span className="sr-only" role="rowheader" aria-colindex={1}>
          {r + 1}
        </span>
        {cells}
      </div>,
    );
  }

  // Vertical grid lines for the visible window (horizontal lines are a CSS background).
  const vlines: ReactNode[] = [];
  for (let c = c0; c <= c1; c++) {
    vlines.push(
      <div key={`v${c}`} className="vline" style={{ left: layout.x(c + 1) - 1, top: r0 * ROW_HEIGHT, height: (r1 - r0 + 1) * ROW_HEIGHT }} />,
    );
  }

  const colHeaders: ReactNode[] = [];
  for (let c = c0; c <= c1; c++) {
    const inSel = c >= sel.c1 && c <= sel.c2;
    colHeaders.push(
      <div
        key={c}
        role="columnheader"
        aria-colindex={c + 2}
        className={'col-header' + (inSel ? (fullCols ? ' full' : ' in-sel') : '')}
        style={{ left: ROW_HEADER_WIDTH + layout.x(c), width: layout.width(c) }}
        onPointerDown={(e) => onHeaderPointerDown(e, 'col', c)}
      >
        {colToLetters(c)}
        <div className="col-resizer" aria-hidden onPointerDown={(e) => onResizeStart(e, c)} />
      </div>,
    );
  }

  const rowHeaders: ReactNode[] = [];
  for (let r = r0; r <= r1; r++) {
    const inSel = r >= sel.r1 && r <= sel.r2;
    rowHeaders.push(
      <div
        key={r}
        className={'row-header' + (inSel ? (fullRows ? ' full' : ' in-sel') : '')}
        style={{ top: r * ROW_HEIGHT }}
        onPointerDown={(e) => onHeaderPointerDown(e, 'row', r)}
      >
        {r + 1}
      </div>,
    );
  }

  const isMulti = sel.r1 !== sel.r2 || sel.c1 !== sel.c2;
  const selRect = rect(sel);

  return (
    <>
    <p id={hintId} className="sr-only">
      Arrow keys move between cells. Type to replace a cell, or press Enter or F2 to edit it. Press Escape, then Tab, to
      leave the sheet. F6 moves between the toolbar, the formula bar, the demo guide and the sheet.
    </p>
    <div
      ref={scrollerRef}
      className="grid-scroller"
      tabIndex={0}
      onScroll={syncViewport}
      onKeyDown={props.onKeyDown}
      onPointerDownCapture={(e) => { pointerType.current = e.pointerType; }}
      role="grid"
      aria-roledescription="spreadsheet"
      aria-label="Spreadsheet"
      aria-describedby={hintId}
      aria-multiselectable
      aria-rowcount={rows + 1}
      aria-colcount={layout.count + 1}
      aria-activedescendant={activeShown && !editing ? cellId(active.row, active.col) : undefined}
    >
      <div className="grid-canvas" role="presentation" style={{ width: ROW_HEADER_WIDTH + layout.total, height: HEADER_HEIGHT + rows * ROW_HEIGHT }}>
        <div className="col-headers" role="row" aria-rowindex={1} style={{ width: ROW_HEADER_WIDTH + layout.total }}>
          <div
            aria-hidden
            className="corner"
            title="Select all"
            onClick={() => {
              props.onSelect({ anchor: { row: 0, col: 0 }, head: { row: rows - 1, col: layout.count - 1 } });
              scrollerRef.current?.focus({ preventScroll: true });
            }}
          />
          {colHeaders}
        </div>
        {/* The visible row numbers; screen readers get them as each row's header instead. */}
        <div className="row-headers" aria-hidden style={{ height: rows * ROW_HEIGHT }}>
          {rowHeaders}
        </div>
        <div
          ref={cellsRef}
          className="cells"
          role="presentation"
          style={{ top: HEADER_HEIGHT, left: ROW_HEADER_WIDTH, width: layout.total, height: rows * ROW_HEIGHT }}
          onPointerDown={onCellsPointerDown}
          onDoubleClick={(e) => props.onDoubleClick(posFromClient(e.clientX, e.clientY), pointerType.current === 'touch')}
        >
          {vlines}
          <Fragment key={wave?.id}>{recalced}</Fragment>
          {gridRows}
          {refMarks.map((m, i) => (
            <div key={i} className="ref-mark" style={{ ...rect(m.range), color: m.color }} />
          ))}
          {copyRange && <div className="copy-mark" style={rect(copyRange)} />}
          {isMulti && <div className="sel-range" style={selRect} />}
          <div className="active-cell" style={rect({ r1: active.row, c1: active.col, r2: active.row, c2: active.col })} />
          {fillPreview && <div className="fill-preview" style={rect(fillPreview)} />}
          {!editing && (
            <>
              <div className="sel-grip" style={{ left: selRect.left, top: selRect.top }} onPointerDown={onGripDown} />
              <div
                className="fill-handle"
                title="Drag to fill"
                style={{ left: selRect.left + selRect.width, top: selRect.top + selRect.height }}
                onPointerDown={onFillHandleDown}
              />
            </>
          )}
          {editing && (
            <div
              className="editor-anchor"
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{ left: layout.x(active.col), top: active.row * ROW_HEIGHT, minWidth: layout.width(active.col), height: ROW_HEIGHT }}
            >
              {editor}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
