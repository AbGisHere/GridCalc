'use client';

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { colToLetters, type CellPos, type RangeBounds } from '@/engine/address';
import type { SpreadsheetEngine } from '@/engine/engine';
import { CellError, displayValue } from '@/engine/values';
import { fillTarget } from '@/state/fill';
import { selectionRange, type Selection } from '@/state/selection';
import type { RefMark } from './formulaTokens';
import { ColumnLayout, HEADER_HEIGHT, MIN_COL_WIDTH, ROW_HEADER_WIDTH, ROW_HEIGHT } from './geometry';

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
  onDoubleClick(pos: CellPos): void;
  onFill(source: RangeBounds, target: RangeBounds): void;
  onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void;
  /** Reports how many cells are currently mounted, to show virtualization at work. */
  onRenderStats?(rendered: number): void;
}

const OVERSCAN_ROWS = 6;
const OVERSCAN_COLS = 2;
const EDGE = 28;

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

  // Latest props for window-level listeners attached during drags.
  const live = useRef(props);
  live.current = props;

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
        if (top < el.scrollTop) el.scrollTop = top;
        else if (top + ROW_HEIGHT > el.scrollTop + viewH) el.scrollTop = top + ROW_HEIGHT - viewH;
        if (left < el.scrollLeft) el.scrollLeft = left;
        else if (left + layout.width(col) > el.scrollLeft + viewW) el.scrollLeft = left + layout.width(col) - viewW;
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

  /** Shared drag loop: tracks the pointer, auto-scrolls near edges, reports cell positions. */
  const startDrag = useCallback(
    (start: React.MouseEvent, onMove: (pos: CellPos) => void, onEnd?: () => void) => {
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
      const move = (e: MouseEvent) => {
        lastX = e.clientX;
        lastY = e.clientY;
        onMove(posFromClient(e.clientX, e.clientY));
      };
      const up = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        onEnd?.();
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      raf = requestAnimationFrame(tick);
    },
    [posFromClient],
  );

  const onCellsMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = posFromClient(e.clientX, e.clientY);
    const mode = live.current.onPointerDown(pos, e.shiftKey);
    if (mode === 'ref') e.preventDefault(); // keep focus (and caret) in the formula editor
    if (mode === 'none') return;
    if (mode === 'select' && !live.current.editing) {
      e.preventDefault();
      scrollerRef.current?.focus({ preventScroll: true });
    }
    startDrag(e, (p) => live.current.onPointerDrag(p, mode));
  };

  const onFillHandleDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const source = selectionRange(live.current.selection);
    let target: RangeBounds | null = null;
    startDrag(
      e,
      (p) => {
        target = fillTarget(source, p);
        setFillPreview(target);
      },
      () => {
        setFillPreview(null);
        if (target) live.current.onFill(source, target);
      },
    );
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

  const onHeaderMouseDown = (e: React.MouseEvent, kind: 'col' | 'row', index: number) => {
    if (e.button !== 0) return;
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

  const onResizeStart = (e: React.MouseEvent, col: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[col];
    const move = (ev: MouseEvent) => live.current.onColResize(col, Math.max(MIN_COL_WIDTH, startW + ev.clientX - startX));
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
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

  const cells: ReactNode[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const rec = engine.getRecord(r, c);
      if (!rec) continue;
      const v = rec.value;
      const isErr = v instanceof CellError;
      const cls =
        'cell' +
        (typeof v === 'number' ? ' num' : typeof v === 'boolean' ? ' bool' : isErr ? ' err' : '') +
        (rec.raw.startsWith('=') ? ' formula' : '');
      cells.push(
        <div
          key={`${r}:${c}`}
          className={cls}
          style={{ left: layout.x(c), top: r * ROW_HEIGHT, width: layout.width(c), height: ROW_HEIGHT }}
          title={isErr ? `${v.code} — ${v.origin ? `from ${v.origin}: ` : ''}${v.message}` : undefined}
        >
          {displayValue(v)}
        </div>,
      );
    }
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
        className={'col-header' + (inSel ? (fullCols ? ' full' : ' in-sel') : '')}
        style={{ left: ROW_HEADER_WIDTH + layout.x(c), width: layout.width(c) }}
        onMouseDown={(e) => onHeaderMouseDown(e, 'col', c)}
      >
        {colToLetters(c)}
        <div className="col-resizer" onMouseDown={(e) => onResizeStart(e, c)} />
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
        onMouseDown={(e) => onHeaderMouseDown(e, 'row', r)}
      >
        {r + 1}
      </div>,
    );
  }

  const isMulti = sel.r1 !== sel.r2 || sel.c1 !== sel.c2;
  const selRect = rect(sel);

  return (
    <div
      ref={scrollerRef}
      className="grid-scroller"
      tabIndex={0}
      onScroll={syncViewport}
      onKeyDown={props.onKeyDown}
      role="grid"
      aria-rowcount={rows}
      aria-colcount={layout.count}
      aria-label="Spreadsheet"
    >
      <div className="grid-canvas" style={{ width: ROW_HEADER_WIDTH + layout.total, height: HEADER_HEIGHT + rows * ROW_HEIGHT }}>
        <div className="col-headers" style={{ width: ROW_HEADER_WIDTH + layout.total }}>
          <div
            className="corner"
            title="Select all"
            onMouseDown={(e) => {
              e.preventDefault();
              props.onSelect({ anchor: { row: 0, col: 0 }, head: { row: rows - 1, col: layout.count - 1 } });
            }}
          />
          {colHeaders}
        </div>
        <div className="row-headers" style={{ height: rows * ROW_HEIGHT }}>
          {rowHeaders}
        </div>
        <div
          ref={cellsRef}
          className="cells"
          style={{ top: HEADER_HEIGHT, left: ROW_HEADER_WIDTH, width: layout.total, height: rows * ROW_HEIGHT }}
          onMouseDown={onCellsMouseDown}
          onDoubleClick={(e) => props.onDoubleClick(posFromClient(e.clientX, e.clientY))}
        >
          {vlines}
          {cells}
          {refMarks.map((m, i) => (
            <div key={i} className="ref-mark" style={{ ...rect(m.range), borderColor: m.color, background: `${m.color}14` }} />
          ))}
          {copyRange && <div className="copy-mark" style={rect(copyRange)} />}
          {isMulti && <div className="sel-range" style={selRect} />}
          <div className="active-cell" style={rect({ r1: active.row, c1: active.col, r2: active.row, c2: active.col })} />
          {fillPreview && <div className="fill-preview" style={rect(fillPreview)} />}
          {!editing && (
            <div
              className="fill-handle"
              title="Drag to fill"
              style={{ left: selRect.left + selRect.width - 4, top: selRect.top + selRect.height - 4 }}
              onMouseDown={onFillHandleDown}
            />
          )}
          {editing && (
            <div
              className="editor-anchor"
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{ left: layout.x(active.col), top: active.row * ROW_HEIGHT, minWidth: layout.width(active.col), height: ROW_HEIGHT }}
            >
              {editor}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
