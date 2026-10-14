'use client';

import { useState } from 'react';

/** Read before the first paint by public/theme.js, which has its own copy of these ids and the key. */
const THEMES = [
  { id: 'light', label: 'Light', detail: 'Light everywhere' },
  { id: 'dark', label: 'Dark', detail: 'Dark everywhere' },
  { id: 'semi', label: 'Semi', detail: 'Dark around a white sheet' },
] as const;
const THEME_KEY = 'gridcalc:theme';

type Theme = (typeof THEMES)[number]['id'];

/** Three swatches, each a small picture of the theme: the frame is the toolbar and panels, the inner block the sheet. */
export function ThemePicker() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme as Theme);

  const pick = (id: Theme) => {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      // Private mode or blocked storage: the theme still applies until the page is reloaded.
    }
  };

  return (
    <div className="theme-picker" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          className="theme-option"
          role="radio"
          aria-checked={theme === t.id}
          onClick={() => pick(t.id)}
        >
          <span className={`theme-swatch ${t.id}`} aria-hidden />
          <b>{t.label}</b>
          <span className="theme-detail">{t.detail}</span>
        </button>
      ))}
    </div>
  );
}
