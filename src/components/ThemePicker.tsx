'use client';

import { useSyncExternalStore } from 'react';

/** Read before the first paint by public/theme.js, which has its own copy of these ids and the key. */
const THEMES = [
  { id: 'light', label: 'Light', detail: 'Light everywhere' },
  { id: 'dark', label: 'Dark', detail: 'Dark everywhere' },
  { id: 'semi', label: 'Semi', detail: 'Dark around a white sheet' },
] as const;
const THEME_KEY = 'gridcalc:theme';

type Theme = (typeof THEMES)[number]['id'];

function currentTheme(): Theme {
  const theme = document.documentElement.dataset.theme;
  return theme === 'dark' || theme === 'semi' ? theme : 'light';
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/** Three swatches, each a small picture of the theme: the frame is the toolbar and panels, the inner block the sheet. */
export function ThemePicker() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'light');

  const pick = (id: Theme) => {
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
          tabIndex={theme === t.id ? 0 : -1}
          onClick={() => pick(t.id)}
          onKeyDown={(e) => {
            const index = THEMES.findIndex((option) => option.id === t.id);
            let next: number;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % THEMES.length;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index + THEMES.length - 1) % THEMES.length;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = THEMES.length - 1;
            else return;
            e.preventDefault();
            pick(THEMES[next].id);
            e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
          }}
        >
          <span className={`theme-swatch ${t.id}`} aria-hidden />
          <b>{t.label}</b>
          <span className="theme-detail">{t.detail}</span>
        </button>
      ))}
    </div>
  );
}
