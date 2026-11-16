import '../header.js';
import { api } from '../api.js';
import { escapeHtml } from '../ui.js';
import { bookCardHtml } from '../render.js';

const SHELF_SIZE = 6;

async function fillShelf(selector, query, emptyText) {
  const shelf = document.querySelector(selector);
  try {
    const { items } = await api(`/books?${query}&limit=${SHELF_SIZE}`);
    shelf.innerHTML = items.length ? items.map(bookCardHtml).join('') : `<p class="muted">${emptyText}</p>`;
  } catch {
    shelf.innerHTML = '<p class="muted">Couldn\'t load these books. Try refreshing the page.</p>';
  }
}

async function fillGenres() {
  const genres = await api('/genres');
  document.querySelector('#genre-chips').innerHTML = genres
    .map((g) => `<a class="chip" href="/catalog.html?genre=${encodeURIComponent(g.slug)}">${escapeHtml(g.name)}</a>`)
    .join('');
}

await Promise.all([
  fillGenres(),
  fillShelf('#recent', 'sort=newest', 'Nothing listed yet. Be the first to sell a book.'),
  fillShelf('#cheap', 'condition=used&sort=price_asc', 'No used copies on sale right now.'),
]);
