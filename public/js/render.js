// small html builders shared by every page that shows books, listings or orders
import { escapeHtml, formatPrice } from './ui.js';
import { CONDITION_LABELS } from './shared/validate-listing.js';

export function coverHtml(book) {
  if (book.coverUrl) {
    return `<img src="${escapeHtml(book.coverUrl)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy">`;
  }
  // the title is printed next to every cover, so the stand in is hidden from screen readers
  return `<span class="cover-fallback" aria-hidden="true">${escapeHtml(book.title)}</span>`;
}

export function conditionBadge(condition) {
  return `<span class="badge badge--${escapeHtml(condition)}">${escapeHtml(CONDITION_LABELS[condition] ?? condition)}</span>`;
}

export function badge(kind, label) {
  return `<span class="badge badge--${escapeHtml(kind)}">${escapeHtml(label)}</span>`;
}

export function thumbHtml(book) {
  return `<div class="row__thumb">${coverHtml(book)}</div>`;
}

export function bookCardHtml(item, i = 0) {
  const offers = `${item.offerCount} offer${item.offerCount === 1 ? '' : 's'}`;
  return `
    <a class="book-card" href="/book.html?id=${escapeHtml(item._id)}" style="--i: ${i}">
      <div class="book-card__cover">${coverHtml(item)}</div>
      <h3 class="book-card__title">${escapeHtml(item.title)}</h3>
      <p class="book-card__author">${escapeHtml(item.author)}</p>
      <p class="book-card__meta"><span class="price price--from">${formatPrice(item.minPricePaise)}</span><span>${offers}</span></p>
    </a>`;
}

export function starsHtml(rating, count) {
  if (!count) {
    return '<span class="stars">No ratings yet</span>';
  }
  const label = `Rated ${rating} out of 5 by ${count} buyer${count === 1 ? '' : 's'}`;
  return `<span class="stars" aria-label="${label}" role="img"><span class="stars__icon" aria-hidden="true">★</span> ${rating.toFixed(1)} <span aria-hidden="true">(${count})</span></span>`;
}

const STATUS_LABELS = { placed: 'Placed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

export function statusBadge(status) {
  return badge(status, STATUS_LABELS[status] ?? status);
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(value) {
  return dateFormat.format(new Date(value));
}

// the last 6 hex digits of the id are unique enough to read out to a seller and much friendlier than 24
export function orderNumber(id) {
  return `#${String(id).slice(-6).toUpperCase()}`;
}
