const state = { entries: [], highlights: [], highlightedKeys: new Set(), filtered: [], page: 1, pageSize: 10 };
const els = {
  entries: document.querySelector('#entries'), highlights: document.querySelector('#highlights'), search: document.querySelector('#searchInput'),
  pageSize: document.querySelector('#pageSize'), prev: document.querySelector('#prevPage'), next: document.querySelector('#nextPage'), pageInfo: document.querySelector('#pageInfo'),
  entryCount: document.querySelector('#entryCount'), latestDate: document.querySelector('#latestDate'),
  dailyPage: document.querySelector('#dailyPage'), highlightsPage: document.querySelector('#highlightsPage'),
  dailyLink: document.querySelector('#dailyLink'), highlightsLink: document.querySelector('#highlightsLink')
};
const fmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function dateLabel(date) { const [y,m,d] = date.split('-').map(Number); return fmt.format(new Date(Date.UTC(y, m - 1, d))); }
function keyFor(item) { return `${item.date}|${(item.title || '').toLowerCase()}`; }
function isHighlighted(entry) { return entry.highlight || state.highlightedKeys.has(keyFor(entry)) || state.highlights.some(h => h.date === entry.date && entry.title.toLowerCase().includes(h.title.split(' ')[0].toLowerCase())); }
function setView(view) {
  const showHighlights = view === 'highlights';
  els.dailyPage.hidden = showHighlights;
  els.highlightsPage.hidden = !showHighlights;
  els.dailyLink.classList.toggle('active', !showHighlights);
  els.highlightsLink.classList.toggle('active', showHighlights);
}
function syncRoute() { setView(location.hash.replace('#','') === 'highlights' ? 'highlights' : 'daily'); }
function applyFilter() {
  const q = els.search.value.trim().toLowerCase();
  state.filtered = !q ? [...state.entries] : state.entries.filter(e => [e.date,e.title,e.summary,...(e.tags||[]),...(e.items||[])].join(' ').toLowerCase().includes(q));
  state.page = 1; render();
}
function renderHighlights() {
  els.highlights.innerHTML = state.highlights.map((item, index) => `
    <article class="highlight-card ${index === 0 ? 'featured-highlight' : ''}">
      <div class="highlight-date">${dateLabel(item.date)}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <div class="highlight-footer">
        <span>${escapeHtml(item.accent || 'milestone')}</span>
        <div class="mini-tags">${(item.tags||[]).slice(0,3).map(tag => `<em>${escapeHtml(tag)}</em>`).join('')}</div>
      </div>
    </article>`).join('');
}
function render() {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const pageEntries = state.filtered.slice(start, start + state.pageSize);
  els.entries.innerHTML = pageEntries.length ? pageEntries.map(entry => {
    const hot = isHighlighted(entry);
    return `<article class="entry ${hot ? 'highlighted-entry' : ''}">
      <div class="entry-header">
        <div><h2>${escapeHtml(entry.title)} ${hot ? '<span class="highlight-badge">Highlight</span>' : ''}</h2><p>${escapeHtml(entry.summary)}</p></div>
        <time datetime="${escapeHtml(entry.date)}">${dateLabel(entry.date)}</time>
      </div>
      ${(entry.items||[]).length ? `<ul>${entry.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      ${(entry.tags||[]).length ? `<div class="tags">${entry.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
    </article>`;
  }).join('') : '<div class="empty">No diary entries match that search.</div>';
  els.pageInfo.textContent = `Page ${state.page} of ${totalPages}`;
  els.prev.disabled = state.page <= 1;
  els.next.disabled = state.page >= totalPages;
}
async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}
async function init() {
  const [entries, highlights] = await Promise.all([fetchJson('data/entries.json'), fetchJson('data/highlights.json')]);
  state.entries = entries.sort((a,b) => b.date.localeCompare(a.date));
  state.highlights = highlights.sort((a,b) => b.date.localeCompare(a.date));
  state.highlightedKeys = new Set(state.highlights.map(keyFor));
  state.filtered = [...state.entries];
  els.entryCount.textContent = state.entries.length;
  els.latestDate.textContent = state.entries[0]?.date || '—';
  renderHighlights(); render(); syncRoute();
}
els.search.addEventListener('input', applyFilter);
els.pageSize.addEventListener('change', () => { state.pageSize = Number(els.pageSize.value); state.page = 1; render(); });
els.prev.addEventListener('click', () => { state.page--; render(); scrollTo({ top: 0, behavior: 'smooth' }); });
els.next.addEventListener('click', () => { state.page++; render(); scrollTo({ top: 0, behavior: 'smooth' }); });
window.addEventListener('hashchange', syncRoute);
init().catch(err => { console.error(err); els.entries.innerHTML = '<div class="empty">Could not load diary entries.</div>'; });
