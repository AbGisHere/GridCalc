const PATHS = {
  undo: 'M6 4 2.5 7.5 6 11M3 7.5h7a3.5 3.5 0 0 1 0 7H8',
  redo: 'M10 4l3.5 3.5L10 11M13 7.5H6a3.5 3.5 0 0 0 0 7h2',
  import: 'M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 11v2.5h11V11',
  export: 'M8 10V2M4.5 5.5 8 2l3.5 3.5M2.5 11v2.5h11V11',
  chevron: 'M4.5 6.5 8 10l3.5-3.5',
};

/** 16px stroke icon in the current text colour; decorative, so the button's text names the action. */
export function Icon({ name }: { name: keyof typeof PATHS }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
