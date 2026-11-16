import '../header.js';
import { api } from '../api.js';
import { escapeHtml, toast } from '../ui.js';
import { bookCardHtml } from '../render.js';

const FILTER_KEYS = ['q', 'genre', 'condition', 'min', 'max', 'sort'];
const params = new URLSearchParams(location.search);
const form = document.querySelector('#filter-form');
const filters = document.querySelector('#filters');
const results = document.querySelector('#results');
const resultsHead = document.querySelector('#results-head');
const pagination = document.querySelector('#pagination');
const title = document.querySelector('#catalog-title');

// the query string is the only state, so a bookmark or the back button brings the same view back
function fillForm() {
  form.elements.q.value = params.get('q') || '';
  form.elements.genre.value = params.get('genre') || '';
  form.elements.min.value = params.get('min') || '';
  form.elements.max.value = params.get('max') || '';
  form.elements.sort.value = params.get('sort') || 'newest';
  const condition = form.querySelector(`input[name="condition"][value="${CSS.escape(params.get('condition') || '')}"]`);
  (condition ?? form.querySelector('input[name="condition"][value=""]')).checked = true;
}

function hrefWith(changes) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value === '' || value === null || value === undefined) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  const query = next.toString();
  return `/catalog.html${query ? `?${query}` : ''}`;
}

// drop empty fields so the url stays readable, and go back to page 1 because the old page may not exist
function applyFilters() {
  const values = Object.fromEntries(new FormData(form));
  const changes = { page: '' };
  for (const key of FILTER_KEYS) {
    changes[key] = key === 'sort' && values.sort === 'newest' ? '' : String(values[key] ?? '').trim();
  }
  location.assign(hrefWith(changes));
}

function pageList(page, pages) {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const list = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) {
      list.push('gap');
    }
    list.push(n);
  });
  return list;
}

function renderPagination(page, pages) {
  if (pages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  const parts = [];
  if (page > 1) {
    parts.push(`<a href="${hrefWith({ page: page - 1 })}" rel="prev">← Prev</a>`);
  }
  for (const n of pageList(page, pages)) {
    if (n === 'gap') {
      parts.push('<span class="is-gap" aria-hidden="true">…</span>');
    } else if (n === page) {
      parts.push(`<span aria-current="page">${n}</span>`);
    } else {
      parts.push(`<a href="${hrefWith({ page: n })}" aria-label="Page ${n}">${n}</a>`);
    }
  }
  if (page < pages) {
    parts.push(`<a href="${hrefWith({ page: page + 1 })}" rel="next">Next →</a>`);
  }
  pagination.innerHTML = parts.join('');
}

async function load() {
  const query = new URLSearchParams();
  for (const key of [...FILTER_KEYS, 'page']) {
    if (params.get(key)) {
      query.set(key, params.get(key));
    }
  }
  let data;
  try {
    data = await api(`/books?${query}`);
  } catch (err) {
    results.innerHTML = '';
    toast(err.message, { type: 'error' });
    return;
  }

  const q = params.get('q');
  title.textContent = q ? `Results for “${q}”` : 'Browse books';
  document.title = `${q ? `${q} · ` : ''}Browse books · Bookmarket`;

  if (!data.items.length) {
    resultsHead.textContent = '';
    results.innerHTML = `
      <div class="empty-state">
        <h2>No books match${q ? ` “${escapeHtml(q)}”` : ''}</h2>
        <p>Try a shorter search or fewer filters.</p>
        <p><a class="btn" href="/catalog.html">Clear all filters</a></p>
      </div>`;
    renderPagination(1, 0);
    return;
  }

  const from = (data.page - 1) * 12 + 1;
  const to = from + data.items.length - 1;
  resultsHead.textContent = `Showing ${from} to ${to} of ${data.total} book${data.total === 1 ? '' : 's'}`;
  results.innerHTML = `<div class="grid">${data.items.map(bookCardHtml).join('')}</div>`;
  renderPagination(data.page, data.pages);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  applyFilters();
});
// selects and radios apply straight away, price boxes wait for Apply or Enter so typing "250" doesn't load three times
form.addEventListener('change', (event) => {
  if (event.target.matches('select, input[type="radio"]')) {
    applyFilters();
  }
});

// keep the panel shut on phones so results show first, and say how many filters are on
filters.open = matchMedia('(min-width: 56rem)').matches;
const activeCount = ['genre', 'condition', 'min', 'max'].filter((k) => params.get(k)).length;
filters.querySelector('summary').textContent = activeCount ? `Filters (${activeCount} on)` : 'Filters';

const genres = await api('/genres');
form.elements.genre.append(...genres.map((g) => new Option(g.name, g.slug)));
fillForm();
await load();
