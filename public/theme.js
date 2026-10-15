// Applies the saved theme, or the system's light or dark, before the first paint so the page never flashes the wrong one.
// With no saved theme it keeps following the system setting while the page is open.
// Kept in step with THEMES and THEME_KEY in src/components/ThemePicker.tsx.
(function () {
  var query = matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    var theme;
    try {
      theme = localStorage.getItem('gridcalc:theme');
    } catch (e) {}
    if (theme !== 'light' && theme !== 'dark' && theme !== 'semi') theme = query.matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
  }
  apply();
  query.addEventListener('change', apply);
})();
