const key = 'aanah-intro-theme-v1';
const themes = new Set(['default', 'dark', 'blue', 'green', 'peach']);
const toggle = document.querySelector('#themeToggle');
const menu = document.querySelector('#themeMenu');
const options = [...(menu?.querySelectorAll('[data-theme]') || [])];

export function applyTheme(theme) {
  const selected = themes.has(theme) ? theme : 'default';
  document.documentElement.dataset.theme = selected;
  if (toggle) toggle.dataset.theme = selected;
  for (const option of options) {
    option.setAttribute('aria-pressed', String(option.dataset.theme === selected));
  }
  try { localStorage.setItem(key, selected); } catch {}
}

try { applyTheme(localStorage.getItem(key)); } catch { applyTheme('default'); }

function closeMenu() {
  if (!menu || !toggle) return;
  menu.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
}

toggle?.addEventListener('click', () => {
  menu.hidden = !menu.hidden;
  toggle.setAttribute('aria-expanded', String(!menu.hidden));
});
menu?.addEventListener('click', event => {
  const option = event.target.closest('[data-theme]');
  if (!option) return;
  applyTheme(option.dataset.theme);
  window.dispatchEvent(new Event('themechange'));
  closeMenu();
  toggle.focus();
});
document.addEventListener('click', event => {
  if (!event.target.closest('.theme-picker')) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu && !menu.hidden) { closeMenu(); toggle.focus(); }
});
