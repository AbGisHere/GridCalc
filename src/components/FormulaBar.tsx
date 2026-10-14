'use client';

import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import type { ComboboxAttrs } from './FormulaAssist';
import { highlightSegments } from './formulaTokens';

interface FormulaBarProps {
  inputRef: Ref<HTMLInputElement>;
  address: string;
  value: string;
  editing: boolean;
  combobox: ComboboxAttrs;
  onNavigate(text: string): boolean;
  onFocus(): void;
  onChange(value: string, caret: number): void;
  onCaret(caret: number): void;
  onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void;
  functionsOpen: boolean;
  onToggleFunctions(): void;
}

/** Name box + formula input with a syntax-highlighting overlay behind transparent text. */
export function FormulaBar(props: FormulaBarProps) {
  const { value, address } = props;
  const overlayRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLInputElement | null>(null);
  const [nameText, setNameText] = useState(address);
  const [nameFocused, setNameFocused] = useState(false);
  const segments = useMemo(() => highlightSegments(value), [value]);
  const isFormula = value.startsWith('=');

  useEffect(() => {
    if (!nameFocused) setNameText(address);
  }, [address, nameFocused]);

  const syncScroll = () => {
    if (overlayRef.current && innerRef.current) overlayRef.current.scrollLeft = innerRef.current.scrollLeft;
  };
  useEffect(syncScroll);

  const setRefs = (el: HTMLInputElement | null) => {
    innerRef.current = el;
    const r = props.inputRef;
    if (typeof r === 'function') r(el);
    else if (r) (r as React.RefObject<HTMLInputElement | null>).current = el;
  };

  return (
    <div className="formula-bar">
      <input
        className="name-box"
        aria-label="Cell address — type a reference like B12 or A1:C5 and press Enter"
        value={nameText}
        spellCheck={false}
        onFocus={(e) => {
          setNameFocused(true);
          e.target.select();
        }}
        onBlur={() => setNameFocused(false)}
        onChange={(e) => setNameText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (props.onNavigate(nameText)) (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setNameText(address);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <button
        className={'fx-button' + (props.functionsOpen ? ' on' : '')}
        title="Browse functions"
        aria-label="Browse functions"
        aria-expanded={props.functionsOpen}
        onClick={props.onToggleFunctions}
      >
        <i>ƒ</i>x
      </button>
      <div className={'fb-field' + (props.editing ? ' editing' : '')}>
        {isFormula && (
          <div className="fb-overlay" ref={overlayRef} aria-hidden>
            <span className="fb-overlay-inner">
              {segments.map((s, i) => (
                <span key={i} className={`tok-${s.kind}`} style={s.color ? { color: s.color } : undefined}>
                  {s.text}
                </span>
              ))}
            </span>
          </div>
        )}
        <input
          ref={setRefs}
          className={'fb-input' + (isFormula ? ' highlighted' : '')}
          aria-label="Formula bar"
          {...props.combobox}
          value={value}
          spellCheck={false}
          autoComplete="off"
          onFocus={props.onFocus}
          onChange={(e) => props.onChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
          onSelect={(e) => props.onCaret((e.target as HTMLInputElement).selectionStart ?? 0)}
          onKeyDown={props.onKeyDown}
          onScroll={syncScroll}
          onKeyUp={syncScroll}
        />
      </div>
    </div>
  );
}
