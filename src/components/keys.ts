/** Shortcut labels as the keyboard prints them: ⌘ on Apple devices, Ctrl elsewhere. */
const apple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export const KEYS = {
  undo: { label: apple ? '⌘Z' : 'Ctrl+Z', aria: 'Control+Z Meta+Z' },
  redo: { label: apple ? '⇧⌘Z' : 'Ctrl+Y', aria: 'Control+Y Meta+Shift+Z' },
  fix: { label: apple ? '⌘.' : 'Ctrl+.', aria: 'Control+. Meta+.' },
  palette: { label: apple ? '⌘K' : 'Ctrl+K', aria: 'Control+K Meta+K' },
  fillDown: { label: apple ? '⌘D' : 'Ctrl+D' },
  fillRight: { label: apple ? '⌘R' : 'Ctrl+R' },
  selectAll: { label: apple ? '⌘A' : 'Ctrl+A' },
};
