'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface ToolMenuProps {
  label: React.ReactNode;
  /** Accessible name of the popup. */
  title: string;
  className?: string;
  /** Rendered while open; `close` shuts the popup and returns focus to its button. */
  children(close: () => void): React.ReactNode;
}

/** Toolbar button with a popup that closes on Escape (focus returns to the button) or on a click outside it. */
export function ToolMenu({ label, title, className, children }: ToolMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div
      className={'menu-wrap' + (className ? ` ${className}` : '')}
      ref={wrapRef}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        className={'tool' + (open ? ' on' : '')}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
      >
        {label}
      </button>
      {open && (
        <div className="menu-pop" id={id} role="region" aria-label={title}>
          {children(close)}
        </div>
      )}
    </div>
  );
}
