'use client';

import { useMemo, useState } from 'react';
import { FUNCTIONS, type Category, type FnDef } from '@/engine/functions';
import { Icon } from './Icon';

const ORDER: Category[] = ['Math', 'Statistical', 'Logical', 'Lookup', 'Text', 'Information'];

interface FunctionsPanelProps {
  address: string;
  onInsert(def: FnDef): void;
  onClose(): void;
}

/** Searchable reference with explicit insertion actions beside read-only examples. */
export function FunctionsPanel({ address, onInsert, onClose }: FunctionsPanelProps) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (f: FnDef) => !needle || f.name.toLowerCase().includes(needle) || f.description.toLowerCase().includes(needle);
    return ORDER.map((cat) => ({ cat, fns: FUNCTIONS.filter((f) => f.category === cat && match(f)) })).filter((g) => g.fns.length);
  }, [q]);

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
      <p className="fn-hint">Insert starts or updates a formula in <b>{address}</b>.</p>
      <input className="fn-search" aria-label="Search functions" placeholder="Search functions…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="fn-list">
        {groups.map((g) => (
          <section key={g.cat}>
            <h3>{g.cat}</h3>
            {g.fns.map((f) => (
              <div key={f.name} className="fn-item">
                <code className="fn-sig">{f.signature}</code>
                <span className="fn-desc">{f.description}</span>
                {f.example && <code className="fn-example">{f.example}</code>}
                <button className="fn-insert" onClick={() => onInsert(f)}>Insert {f.name}</button>
              </div>
            ))}
          </section>
        ))}
        {!groups.length && <p className="fn-empty">No function matches “{q}”. Try a function name or description.</p>}
      </div>
    </aside>
  );
}
