'use client';

import type { FnDef } from '@/engine/functions';
import { activeParam, signatureParams, type AssistInfo } from './formulaTokens';

interface FormulaAssistProps {
  info: AssistInfo;
  selected: number;
  onPick(def: FnDef): void;
}

/** Autocomplete list for function names, plus a signature hint for the call around the caret. */
export function FormulaAssist({ info, selected, onPick }: FormulaAssistProps) {
  const { suggestions, call } = info;
  if (!suggestions.length && !call) return null;

  return (
    <div className="assist" onMouseDown={(e) => e.preventDefault()}>
      {suggestions.length > 0 ? (
        <ul className="assist-list" role="listbox">
          {suggestions.map((f, i) => (
            <li key={f.name} role="option" aria-selected={i === selected} className={i === selected ? 'selected' : ''} onClick={() => onPick(f)}>
              <span className="assist-name">{f.name}</span>
              <span className="assist-desc">{f.description}</span>
            </li>
          ))}
          <li className="assist-help">↑↓ to choose · Tab or Enter to insert</li>
        </ul>
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
