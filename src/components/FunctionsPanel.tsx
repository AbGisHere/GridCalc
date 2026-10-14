'use client';

import { useMemo, useState } from 'react';
import { FUNCTIONS, type Category, type FnDef } from '@/engine/functions';

const ORDER: Category[] = ['Math', 'Statistical', 'Logical', 'Lookup', 'Text', 'Information'];

interface FunctionsPanelProps {
  onInsert(def: FnDef): void;
  onClose(): void;
}

/** Searchable reference of every supported function; clicking one inserts it. */
export function FunctionsPanel({ onInsert, onClose }: FunctionsPanelProps) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (f: FnDef) => !needle || f.name.toLowerCase().includes(needle) || f.description.toLowerCase().includes(needle);
    return ORDER.map((cat) => ({ cat, fns: FUNCTIONS.filter((f) => f.category === cat && match(f)) })).filter((g) => g.fns.length);
  }, [q]);

  return (
    <aside className="fn-panel" aria-label="Function reference">
      <header>
        <h2>
          Functions <span className="count">{FUNCTIONS.length}</span>
        </h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close function list">
          ×
        </button>
      </header>
      <input className="fn-search" placeholder="Search functions…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="fn-list">
        {groups.map((g) => (
          <section key={g.cat}>
            <h3>{g.cat}</h3>
            {g.fns.map((f) => (
              <button key={f.name} className="fn-item" onClick={() => onInsert(f)} title="Insert into the active cell">
                <code className="fn-sig">{f.signature}</code>
                <span className="fn-desc">{f.description}</span>
                {f.example && <code className="fn-example">{f.example}</code>}
              </button>
            ))}
          </section>
        ))}
        {!groups.length && <p className="fn-empty">No function matches “{q}”.</p>}
      </div>
    </aside>
  );
}
