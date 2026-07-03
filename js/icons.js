// Single-family line-icon set (24x24, stroke-based, currentColor) so the UI
// never falls back to emoji or mismatched glyphs. No bundler in this project,
// so icons are hand-authored SVG rather than an npm icon package.
const ICON_PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1V9.5" />',
  list: '<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.5" cy="6" r="0.75" fill="currentColor" stroke="none" /><circle cx="3.5" cy="12" r="0.75" fill="currentColor" stroke="none" /><circle cx="3.5" cy="18" r="0.75" fill="currentColor" stroke="none" />',
  dumbbell: '<rect x="1.5" y="9" width="3" height="6" rx="1" /><rect x="19.5" y="9" width="3" height="6" rx="1" /><rect x="5.5" y="7" width="2.5" height="10" rx="1" /><rect x="16" y="7" width="2.5" height="10" rx="1" /><line x1="8" y1="12" x2="16" y2="12" />',
  history: '<circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />',
  trending: '<polyline points="3 17 9 11 13 15 21 6" /><polyline points="15 6 21 6 21 12" />',
  play: '<polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none" />',
  x: '<line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" />',
  check: '<polyline points="5 13 10 18 19 7" />',
  circle: '<circle cx="12" cy="12" r="8" />',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />',
  chevronRight: '<polyline points="9 18 15 12 9 6" />',
  edit: '<path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />',
  trash: '<polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />',
};

function Icon(name, cls = '') {
  const inner = ICON_PATHS[name];
  if (!inner) return '';
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

window.Icon = Icon;
