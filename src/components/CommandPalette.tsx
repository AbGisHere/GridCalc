'use client';

import { Fragment, useEffect, useId, useMemo, useState } from 'react';
import { Icon } from './Icon';

export interface Command {
  group: string;
  label: string;
  detail?: string;
  /** Shortcut as the keyboard prints it. */
  keys?: string;
  run(): void;
}

interface CommandPaletteProps {
  commands: Command[];
  /** Commands made from the query itself (go to a cell, insert a function), listed before the matches. */
  fromQuery(query: string): Command[];
  onClose(): void;
}

/** Every action in one searchable list, opened with Ctrl/⌘+K: the input keeps focus and arrow keys move the highlight. */
export function CommandPalette({ commands, fromQuery, onClose }: CommandPaletteProps) {
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  const id = useId();
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = commands.filter((c) => {
      const text = `${c.group} ${c.label} ${c.detail ?? ''}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
    // Groups keep their order; inside a group, commands whose own name matches come first ("dark" puts Dark theme above System).
    const rank = (c: Command) => commands.findIndex((x) => x.group === c.group) * 2 + (words.every((w) => c.label.toLowerCase().includes(w)) ? 0 : 1);
    return [...fromQuery(q), ...matches.sort((a, b) => rank(a) - rank(b))];
  }, [q, commands, fromQuery]);
  const active = Math.min(at, results.length - 1);

  useEffect(() => {
    document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [id, active]);

  const run = (c: Command) => {
    onClose();
    c.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = results.length;
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      onClose();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && n) {
      e.preventDefault();
      setAt((active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if (e.key === 'Enter' && n) {
      e.preventDefault();
      run(results[active]);
    }
  };

  return (
    <div className="palette-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Commands">
        <div className="palette-field">
          <Icon name="search" />
          <input
            role="combobox"
            aria-label="Search commands"
            aria-expanded
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={results.length ? `${id}-${active}` : undefined}
            placeholder="Search commands, functions or cells"
            value={q}
            spellCheck={false}
            autoComplete="off"
            autoFocus
            onChange={(e) => {
              setQ(e.target.value);
              setAt(0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>
        <ul className="palette-list" id={`${id}-list`} role="listbox" aria-label="Commands">
          {results.map((c, i) => (
            <Fragment key={`${c.group}:${c.label}`}>
              {c.group !== results[i - 1]?.group && (
                <li className="palette-group" role="presentation">
                  {c.group}
                </li>
              )}
              <li
                id={`${id}-${i}`}
                className="palette-item"
                role="option"
                aria-selected={i === active}
                onPointerMove={() => i !== active && setAt(i)}
                onClick={() => run(c)}
              >
                <span className="palette-text">
                  <b>{c.label}</b>
                  {c.detail && <span>{c.detail}</span>}
                </span>
                {c.keys && <kbd>{c.keys}</kbd>}
              </li>
            </Fragment>
          ))}
        </ul>
        {!results.length && <p className="palette-empty">Nothing matches “{q}”. Try a command, a function name or a cell like B12.</p>}
      </div>
    </div>
  );
}
