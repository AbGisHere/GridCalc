// Applies the saved theme, or the system's light or dark, before the first paint so the page never flashes the wrong one.
// Kept in step with THEMES and THEME_KEY in src/components/ThemePicker.tsx.
(function () {
  var theme;
  try {
    theme = localStorage.getItem('gridcalc:theme');
  } catch (e) {}
  if (theme !== 'light' && theme !== 'dark' && theme !== 'semi') {
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
})();
