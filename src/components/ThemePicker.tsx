'use client';

import { useSyncExternalStore } from 'react';

/** Read before the first paint by public/theme.js, which has its own copy of these ids and the key. */
const THEMES = [
  { id: 'system', label: 'System', detail: 'Light or dark, as your device is set' },
  { id: 'light', label: 'Light', detail: 'Light everywhere' },
  { id: 'dark', label: 'Dark', detail: 'Dark everywhere' },
  { id: 'semi', label: 'Semi', detail: 'Dark around a white sheet' },
] as const;
const THEME_KEY = 'gridcalc:theme';

type Theme = (typeof THEMES)[number]['id'];

/** The stored choice; with none, the page follows the system setting (public/theme.js applies it). */
function currentTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEMES.some((t) => t.id === saved) ? (saved as Theme) : 'system';
  } catch {
    return 'system';
  }
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/** Four swatches, each a small picture of the theme: the frame is the toolbar and panels, the inner block the sheet. */
export function ThemePicker() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'system');

  const pick = (id: Theme) => {
    try {
      if (id === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, id);
    } catch {
      // Private mode or blocked storage: the theme still applies until the page is reloaded.
    }
    // Setting the attribute last notifies subscribers once storage already holds the new choice.
    document.documentElement.dataset.theme = id === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : id;
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
