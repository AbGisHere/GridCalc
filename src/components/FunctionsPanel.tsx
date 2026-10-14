'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { FUNCTIONS, type Category, type FnDef } from '@/engine/functions';
import { Icon } from './Icon';

const ORDER: Category[] = ['Math', 'Statistical', 'Logical', 'Lookup', 'Text', 'Information'];

interface FunctionsPanelProps {
  address: string;
  onInsert(def: FnDef): void;
  onClose(): void;
}

/**
 * Searchable reference: one compact row per function, each row inserting it. The list is a single Tab stop
 * (arrow keys move within it), and the example of the focused or hovered function shows at the bottom.
 */
export function FunctionsPanel({ address, onInsert, onClose }: FunctionsPanelProps) {
  const [q, setQ] = useState('');
  const [shown, setShown] = useState<FnDef>();
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (f: FnDef) => !needle || f.name.toLowerCase().includes(needle) || f.description.toLowerCase().includes(needle);
    return ORDER.map((cat) => ({ cat, fns: FUNCTIONS.filter((f) => f.category === cat && match(f)) })).filter((g) => g.fns.length);
  }, [q]);
  const first = groups[0]?.fns[0];
  const example = (shown && groups.some((g) => g.fns.includes(shown)) ? shown : first) ?? null;

  const rows = () => [...(listRef.current?.querySelectorAll<HTMLButtonElement>('.fn-item') ?? [])];
  const onListKey = (e: React.KeyboardEvent) => {
    const list = rows();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[e.key];
    if (next === undefined || !list.length) return;
    e.preventDefault();
    list[Math.max(0, Math.min(list.length - 1, next))].focus();
  };

  return (
    <aside className="fn-panel" aria-label="Function reference" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <header>
        <h2>
          Functions <span className="count">{FUNCTIONS.length}</span>
        </h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close function list">
          <Icon name="close" />
        </button>
      </header>
      <p className="fn-hint">Choose a function to start or update a formula in <b>{address}</b>.</p>
      <input
        className="fn-search"
        aria-label="Search functions"
        placeholder="Search functions…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'ArrowDown' && onListKey(e)}
        autoFocus
      />
      {groups.length > 1 && (
        <nav className="fn-cats" aria-label="Function categories">
          {groups.map((g) => (
            <button key={g.cat} onClick={() => listRef.current?.querySelector<HTMLButtonElement>(`[data-cat="${g.cat}"] .fn-item`)?.focus()}>
              {g.cat}
            </button>
          ))}
        </nav>
      )}
      <div className="fn-list" ref={listRef} onKeyDown={onListKey}>
        {groups.map((g) => (
          <section key={g.cat} data-cat={g.cat} aria-labelledby={`${id}-${g.cat}`}>
            <h3 id={`${id}-${g.cat}`}>{g.cat}</h3>
            {g.fns.map((f) => (
              <button
                key={f.name}
                className="fn-item"
                tabIndex={f === first ? 0 : -1}
                aria-label={`Insert ${f.name}`}
                aria-describedby={`${id}-${f.name}`}
                onFocus={() => setShown(f)}
                onPointerEnter={() => setShown(f)}
                onClick={() => onInsert(f)}
              >
                <code className="fn-sig">{f.signature}</code>
                <span className="fn-desc" id={`${id}-${f.name}`}>{f.description}</span>
              </button>
            ))}
          </section>
        ))}
        {!groups.length && <p className="fn-empty">No function matches “{q}”. Try a function name or description.</p>}
      </div>
      {example?.example && (
        <p className="fn-detail">
          <span className="diag-label">Example</span> <code>{example.example}</code>
        </p>
      )}
    </aside>
  );
}
