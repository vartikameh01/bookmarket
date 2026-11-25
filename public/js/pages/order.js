import { requireUser } from '../header.js';
import { api } from '../api.js';
import { escapeHtml, formatPrice, setFieldError, showFieldErrors, toast } from '../ui.js';
import { conditionBadge, formatDate, orderNumber, statusBadge, thumbHtml } from '../render.js';

await requireUser();

const container = document.querySelector('#order');
const id = new URLSearchParams(location.search).get('id') || '';
const STEPS = ['placed', 'shipped', 'delivered'];

function timelineHtml(status) {
  if (status === 'cancelled') {
    return '<ol class="timeline timeline--cancelled"><li>Cancelled. The books went back on sale.</li></ol>';
  }
  const reached = STEPS.indexOf(status);
  return `<ol class="timeline">${STEPS.map(
    (step, i) => `<li class="${i <= reached ? 'is-done' : ''}">${step[0].toUpperCase()}${step.slice(1)}</li>`,
  ).join('')}</ol>`;
}

function itemHtml(item) {
  const title = item.book
    ? `<a class="row__title" href="/book.html?id=${item.book._id}">${escapeHtml(item.title)}</a>`
    : `<span class="row__title">${escapeHtml(item.title)}</span>`;
  return `
    <li class="row">
      ${thumbHtml({ title: item.title, coverUrl: item.book?.coverUrl })}
      <div class="row__main">
        ${title}
        <div class="row__meta">${conditionBadge(item.condition)} <span>${formatPrice(item.pricePaise)} × ${item.quantity}</span></div>
      </div>
      <div class="row__actions"><span class="price line-total">${formatPrice(item.pricePaise * item.quantity)}</span></div>
    </li>`;
}

const COMMENT_MAX = 300;

function ratingHtml(order) {
  if (order.rating) {
    const r = order.rating;
    return `
      <section class="rating-box given-rating" aria-labelledby="rating-title">
        <h2 id="rating-title">Your rating for ${escapeHtml(order.seller?.name ?? 'the seller')}</h2>
        <span class="stars" role="img" aria-label="${r.stars} out of 5 stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span>
        ${r.comment ? `<p>“${escapeHtml(r.comment)}”</p>` : ''}
      </section>`;
  }
  if (order.status !== 'delivered') {
    return '';
  }
  const stars = [5, 4, 3, 2, 1]
    .map((n) => `<input type="radio" id="rate-${n}" name="stars" value="${n}"><label for="rate-${n}" title="${n} star${n === 1 ? '' : 's'}"><span aria-hidden="true">★</span><span class="visually-hidden">${n} star${n === 1 ? '' : 's'}</span></label>`)
    .join('');
  return `
    <section class="rating-box" aria-labelledby="rating-title">
      <h2 id="rating-title">How was ${escapeHtml(order.seller?.name ?? 'the seller')}?</h2>
      <form id="rating-form" class="form" novalidate>
        <p class="form-error" role="alert"></p>
        <fieldset class="star-input" id="rate-stars" aria-describedby="rate-stars-error">
          <legend>Your rating</legend>
          <div class="star-input__stars">${stars}</div>
          <p class="field__error" id="rate-stars-error"></p>
        </fieldset>
        <div class="field">
          <label for="rate-comment">Comment <span class="muted">(optional)</span></label>
          <textarea id="rate-comment" name="comment" maxlength="${COMMENT_MAX}" placeholder="Was the book as described? Did it arrive quickly?" aria-describedby="rate-comment-count rate-comment-error"></textarea>
          <p class="char-count" id="rate-comment-count">0 / ${COMMENT_MAX}</p>
          <p class="field__error" id="rate-comment-error"></p>
        </div>
        <div><button class="btn btn--primary" type="submit">Submit rating</button></div>
      </form>
    </section>`;
}

function wireRatingForm(order) {
  const form = document.querySelector('#rating-form');
  if (!form) {
    return;
  }
  const formError = form.querySelector('.form-error');
  const count = form.querySelector('#rate-comment-count');
  form.addEventListener('input', () => {
    count.textContent = `${form.elements.comment.value.length} / ${COMMENT_MAX}`;
  });
  form.addEventListener('change', () => setFieldError(form, 'stars', ''));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.textContent = '';
    const stars = Number(form.elements.stars.value);
    if (!stars) {
      showFieldErrors(form, { stars: 'Pick 1 to 5 stars' });
      return;
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      render(await api(`/orders/${order._id}/rating`, { method: 'POST', body: { stars, comment: form.elements.comment.value } }));
      toast('Thanks for rating the seller');
    } catch (err) {
      const unmatched = err.errors ? showFieldErrors(form, err.errors) : [err.message];
      formError.textContent = unmatched.join(' ');
      button.disabled = false;
    }
  });
}

function render(order) {
  const a = order.shipping;
  document.title = `Order ${orderNumber(order._id)} · Bookmarket`;
  container.innerHTML = `
    <div class="page-head">
      <h1>Order ${orderNumber(order._id)}</h1>
      <a href="/orders.html">All my orders</a>
    </div>
    <div class="order-detail">
      <div>
        <p class="row__meta">${statusBadge(order.status)} <span>Placed ${formatDate(order.createdAt)}</span> <span>Sold by ${escapeHtml(order.seller?.name ?? 'a seller')}</span></p>
        ${timelineHtml(order.status)}
        <ul class="rows">${order.items.map(itemHtml).join('')}</ul>
        ${ratingHtml(order)}
      </div>
      <aside class="order-summary side-panel">
        <div class="summary-line summary-line--total"><span>Total paid</span><span class="price">${formatPrice(order.totalPaise)}</span></div>
        <p class="muted">Payment ${escapeHtml(order.paymentRef)}</p>
        <div>
          <h2>Delivering to</h2>
          <address class="address">
            ${escapeHtml(a.name)}<br>
            ${escapeHtml(a.line1)}<br>
            ${a.line2 ? `${escapeHtml(a.line2)}<br>` : ''}
            ${escapeHtml(a.city)}, ${escapeHtml(a.state)} ${escapeHtml(a.pincode)}<br>
            Phone ${escapeHtml(a.phone)}
          </address>
        </div>
        ${
          order.status === 'placed'
            ? `<button class="btn btn--danger" type="button" id="cancel">Cancel this order</button>
               <p class="field__hint">You can cancel until the seller ships it.</p>`
            : ''
        }
      </aside>
    </div>`;

  wireRatingForm(order);

  document.querySelector('#cancel')?.addEventListener('click', async (event) => {
    if (!confirm('Cancel this order? The books go back on sale and you are not charged.')) {
      return;
    }
    event.target.disabled = true;
    try {
      render(await api(`/orders/${order._id}/cancel`, { method: 'POST' }));
      toast('Order cancelled');
    } catch (err) {
      toast(err.message, { type: 'error' });
      render(await api(`/orders/${order._id}`));
    }
  });
}

try {
  render(await api(`/orders/${encodeURIComponent(id)}`));
} catch (err) {
  container.innerHTML = `
    <div class="empty-state">
      <h2>Order not found</h2>
      <p>${escapeHtml(err.message)}</p>
      <p><a class="btn" href="/orders.html">All my orders</a></p>
    </div>`;
}
