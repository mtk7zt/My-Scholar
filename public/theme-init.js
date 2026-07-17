(() => {
  try {
    const saved = localStorage.getItem('scholar_theme');
    const preference = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    const resolved = preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : preference === 'system' ? 'light' : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  } catch { document.documentElement.dataset.theme = 'dark'; }
})();
