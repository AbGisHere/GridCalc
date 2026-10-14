'use client';

import { useLayoutEffect, useRef } from 'react';
import type { FnDef } from '@/engine/functions';
import { activeParam, signatureParams, type AssistInfo } from './formulaTokens';

interface FormulaAssistProps {
  /** Id of the listbox; options are `${id}-${index}`. */
  id: string;
  info: AssistInfo;
  selected: number;
  onPick(def: FnDef): void;
}

export type ComboboxAttrs = Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  'role' | 'aria-autocomplete' | 'aria-expanded' | 'aria-controls' | 'aria-activedescendant'
>;

/** ARIA wiring for an input that owns the suggestion listbox, so screen readers follow the highlighted option. */
export function comboboxAttrs(id: string, open: boolean, selected: number): ComboboxAttrs {
  return {
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    'aria-activedescendant': open ? `${id}-${selected}` : undefined,
  };
}

/** Autocomplete list for function names, plus a signature hint for the call around the caret. */
export function FormulaAssist({ id, info, selected, onPick }: FormulaAssistProps) {
  const { suggestions, call } = info;
  const boxRef = useRef<HTMLDivElement>(null);

  // Anchored to the editing cell, the popup can run past the right edge near the last visible columns: pull it back in.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.translate = '';
    const over = el.getBoundingClientRect().right - (window.innerWidth - 8);
    if (over > 0) el.style.translate = `${-over}px 0`;
  });

  if (!suggestions.length && !call) return null;

  return (
    <div className="assist" ref={boxRef} onMouseDown={(e) => e.preventDefault()}>
      {suggestions.length > 0 ? (
        <>
          <ul className="assist-list" role="listbox" id={id} aria-label="Functions">
            {suggestions.map((f, i) => (
              <li
                key={f.name}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === selected}
                className={i === selected ? 'selected' : ''}
                onClick={() => onPick(f)}
              >
                <span className="assist-name">{f.name}</span>
                <span className="assist-desc">{f.description}</span>
              </li>
            ))}
          </ul>
          <div className="assist-help">↑↓ to choose · Tab or Enter to insert · Esc to close</div>
        </>
      ) : (
        call && <Signature def={call.def} argIndex={call.argIndex} />
      )}
    </div>
  );
}

function Signature({ def, argIndex }: { def: FnDef; argIndex: number }) {
  const params = signatureParams(def.signature);
  const active = activeParam(params, argIndex);
  return (
    <div className="assist-signature">
      <div className="sig-line">
        <b>{def.name}</b>(
        {params.map((p, i) => (
          <span key={i}>
            {i > 0 && ', '}
            <span className={i === active ? 'sig-active' : ''}>{p}</span>
          </span>
        ))}
        )
      </div>
      <div className="sig-desc">{def.description}</div>
    </div>
  );
}
