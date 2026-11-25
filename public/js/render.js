// small html builders shared by every page that shows books, listings or orders
import { escapeHtml, formatPrice } from './ui.js';
import { CONDITION_LABELS } from './shared/validate-listing.js';

// a plain cover with the title always sits underneath, so a slow or broken open library image still shows something
export function coverHtml(book) {
  const fallback = `
    <span class="cover-fallback" aria-hidden="true">
      <span class="cover-fallback__title">${escapeHtml(book.title)}</span>
      ${book.author ? `<span class="cover-fallback__author">${escapeHtml(book.author)}</span>` : ''}
    </span>`;
  if (!book.coverUrl) {
    return fallback;
  }
  return `${fallback}<img class="cover-img" src="${escapeHtml(book.coverUrl)}" alt="Cover of ${escapeHtml(book.title)}" loading="lazy">`;
}

// load and error don't bubble, so listen in the capture phase to catch every cover on the page
document.addEventListener('load', (event) => {
  if (event.target.classList?.contains('cover-img')) {
    // open library answers some missing covers with a tiny blank gif instead of an error
    if (event.target.naturalWidth < 10) {
      event.target.remove();
    } else {
      event.target.classList.add('is-loaded');
    }
  }
}, true);

document.addEventListener('error', (event) => {
  if (event.target.classList?.contains('cover-img')) {
    event.target.remove();
  }
}, true);

export function conditionBadge(condition) {
  return `<span class="badge badge--${escapeHtml(condition)}">${escapeHtml(CONDITION_LABELS[condition] ?? condition)}</span>`;
}

export function badge(kind, label) {
  return `<span class="badge badge--${escapeHtml(kind)}">${escapeHtml(label)}</span>`;
}

export function thumbHtml(book) {
  return `<div class="row__thumb">${coverHtml(book)}</div>`;
}

export function bookCardHtml(item) {
  const offers = `${item.offerCount} offer${item.offerCount === 1 ? '' : 's'}`;
  return `
    <a class="book-card" href="/book.html?id=${escapeHtml(item._id)}">
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
