const state = {
  entries: [],
  highlights: [],
  highlightedKeys: new Set(),
  filtered: [],
  page: 1,
  pageSize: 10,
  monetization: { ideas: [], log: [], last_idea_index: 0 },
  filters: { model: 'all', effort: 'all', price: 'all' }
};

const els = {
  entries: document.querySelector('#entries'),
  highlights: document.querySelector('#highlights'),
  monetizationIdeas: document.querySelector('#monetizationIdeas'),
  monetizationLog: document.querySelector('#monetizationLog'),
  filterResults: document.querySelector('#filterResults'),
  search: document.querySelector('#searchInput'),
  pageSize: document.querySelector('#pageSize'),
  prev: document.querySelector('#prevPage'),
  next: document.querySelector('#nextPage'),
  pageInfo: document.querySelector('#pageInfo'),
  entryCount: document.querySelector('#entryCount'),
  latestDate: document.querySelector('#latestDate'),
  dailyPage: document.querySelector('#dailyPage'),
  highlightsPage: document.querySelector('#highlightsPage'),
  monetizationPage: document.querySelector('#monetizationPage'),
  dailyLink: document.querySelector('#dailyLink'),
  highlightsLink: document.querySelector('#highlightsLink'),
  monetizationLink: document.querySelector('#monetizationLink')
};

const fmt = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&gt;','>':'&lt;',"'":'&#39;','"':'&quot;'}[c]));
}

function dateLabel(date) {
  const [y,m,d] = date.split('-').map(Number);
  return fmt.format(new Date(Date.UTC(y, m - 1, d)));
}

function keyFor(item) {
  return `${item.date}|${(item.title || '').toLowerCase()}`;
}

function isHighlighted(entry) {
  return entry.highlight || state.highlightedKeys.has(keyFor(entry)) ||
    state.highlights.some(h => h.date === entry.date && entry.title.toLowerCase().includes(h.title.split(' ')[0].toLowerCase()));
}

function setView(view) {
  const showHighlights = view === 'highlights';
  const showMonetization = view === 'monetization';
  els.dailyPage.hidden = showHighlights || showMonetization;
  els.highlightsPage.hidden = !showHighlights && !showMonetization;
  els.monetizationPage.hidden = !showMonetization;
  els.dailyLink.classList.toggle('active', !showHighlights && !showMonetization);
  els.highlightsLink.classList.toggle('active', showHighlights);
  els.monetizationLink.classList.toggle('active', showMonetization);
}

function syncRoute() {
  const hash = location.hash.replace('#','');
  if (hash === 'highlights') setView('highlights');
  else if (hash === 'monetization') setView('monetization');
  else setView('daily');
}

function applyFilter() {
  const q = els.search.value.trim().toLowerCase();
  state.filtered = !q ? [...state.entries] :
    state.entries.filter(e =>
      [e.date, e.title, e.summary, ...(e.tags||[]), ...(e.items||[])].join(' ').toLowerCase().includes(q)
    );
  state.page = 1;
  render();
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

function getFilteredIdeas() {
  const { model, effort, price } = state.filters;
  return state.monetization.ideas.filter(idea => {
    if (model !== 'all' && idea.model !== model) return false;
    if (effort !== 'all' && idea.effort !== effort) return false;
    if (price !== 'all') {
      const p = idea.price_usd || 0;
      if (price === '0-50' && (p < 0 || p > 50)) return false;
      if (price === '50-200' && (p < 50 || p > 200)) return false;
      if (price === '200+' && p < 200) return false;
    }
    return true;
  });
}

function renderMonetization() {
  const { ideas, log, last_idea_index: idx } = state.monetization;
  const filtered = getFilteredIdeas();
  const currentIdea = ideas[idx % Math.max(ideas.length, 1)];

  // Results count
  els.filterResults.innerHTML = filtered.length === ideas.length
    ? `<strong>${ideas.length}</strong> ideas — showing all`
    : `<strong>${filtered.length}</strong> of ${ideas.length} ideas match the current filters`;

  els.monetizationIdeas.innerHTML = filtered.length ? filtered.map(idea => {
    const isCurrent = idea.id === currentIdea?.id;
    const priceClass = idea.price_usd >= 200 ? 'high' : '';
    const modelLabel = idea.model ? idea.model.charAt(0).toUpperCase() + idea.model.slice(1) : '';
    return `
    <article class="monetization-card ${isCurrent ? 'current-idea' : ''}">
      <div class="idea-header">
        <h3>${escapeHtml(idea.title)}</h3>
        ${idea.price_usd ? `<span class="idea-price ${priceClass}">~$${idea.price_usd}/mo</span>` : ''}
      </div>
      <p>${escapeHtml(idea.summary)}</p>
      <div class="idea-meta">
        ${modelLabel ? `<span class="idea-model-tag">${escapeHtml(modelLabel)}</span>` : ''}
        <span class="idea-effort ${idea.effort || ''}">${escapeHtml(idea.effort || '')}</span>
      </div>
      ${idea.notes ? `<p class="idea-notes">${escapeHtml(idea.notes)}</p>` : ''}
    </article>`;
  }).join('') : '<div class="empty">No ideas match the current filters. Try adjusting the categories above.</div>';

  els.monetizationLog.innerHTML = log.length
    ? `<h4>Delivery log</h4><ul>${log.slice(-5).reverse().map(l => `<li><time>${l.delivered_at ? l.delivered_at.split('T')[0] : '—'}</time>: ${escapeHtml(l.idea_title || l.idea_id || '—')}</li>`).join('')}</ul>`
    : '';
}

function setupFilterPills(containerId, filterKey) {
  const container = document.querySelector(`#${containerId}`);
  if (!container) return;
  container.addEventListener('click', e => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    container.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.filters[filterKey] = btn.dataset.value;
    renderMonetization();
  });
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

async function init() {
  const [entries, highlights, monetization] = await Promise.all([
    fetchJson('data/entries.json'),
    fetchJson('data/highlights.json'),
    fetchJson('data/monetization.json').catch(() => ({ ideas: [], log: [], last_idea_index: 0 }))
  ]);
  state.entries = entries.sort((a,b) => b.date.localeCompare(a.date));
  state.highlights = highlights.sort((a,b) => b.date.localeCompare(a.date));
  state.highlightedKeys = new Set(state.highlights.map(keyFor));
  state.filtered = [...state.entries];
  state.monetization = monetization;
  els.entryCount.textContent = state.entries.length;
  els.latestDate.textContent = state.entries[0]?.date || '—';
  renderHighlights();
  renderMonetization();
  render();
  syncRoute();
}

els.search.addEventListener('input', applyFilter);
els.pageSize.addEventListener('change', () => { state.pageSize = Number(els.pageSize.value); state.page = 1; render(); });
els.prev.addEventListener('click', () => { state.page--; render(); scrollTo({ top: 0, behavior: 'smooth' }); });
els.next.addEventListener('click', () => { state.page++; render(); scrollTo({ top: 0, behavior: 'smooth' }); });
window.addEventListener('hashchange', syncRoute);

// Setup filter listeners
setupFilterPills('filterModel', 'model');
setupFilterPills('filterEffort', 'effort');
setupFilterPills('filterPrice', 'price');

init().catch(err => { console.error(err); els.entries.innerHTML = '<div class="empty">Could not load diary entries.</div>'; });
