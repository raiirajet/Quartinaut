// 4.8: no user data stored or transmitted by this module.
export function sortCurrentPageResults(rows = [], order = 'relevance') {
  const result = [...rows];
  if (order === 'name') return result.sort((a,b) => String(a?.title || '').localeCompare(String(b?.title || ''), 'de-CH'));
  if (order === 'area') return result.sort((a,b) => String(a?.area || '').localeCompare(String(b?.area || ''), 'de-CH'));
  return result;
}
export function installAccessibilityShell(root = document) {
  const nav = root.querySelector('.bottom-nav');
  if (nav) {
    const sync = () => nav.querySelectorAll('.nav-item').forEach(item => {
      if (item.classList.contains('active')) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    sync();
    const observer = new MutationObserver(sync);
    nav.querySelectorAll('.nav-item').forEach(item => observer.observe(item, { attributes: true, attributeFilter: ['class'] }));
  }
  return true;
}
