import { getCurrentUser } from '../header.js';
import { api, loginUrl } from '../api.js';
import { escapeHtml, formatPrice, toast } from '../ui.js';
import { conditionBadge, starsHtml } from '../render.js';

const container = document.querySelector('#book');
const id = new URLSearchParams(location.search).get('id') || '';

let book;
try {
  book = await api(`/books/${encodeURIComponent(id)}`);
} catch (err) {
  container.innerHTML = `
    <div class="empty-state">
      <h2>${err.status === 404 ? 'Book not found' : 'Something went wrong'}</h2>
      <p>${escapeHtml(err.message)}</p>
      <p><a class="btn" href="/catalog.html">Browse books</a></p>
    </div>`;
  await new Promise(() => {});
}
const user = await getCurrentUser();
// how many of each copy are already in the cart, so the button can say so and stop at the stock
const inCart = new Map();
if (user) {
  const cart = await api('/cart');
  for (const item of cart.groups.flatMap((g) => g.items)) {
    inCart.set(String(item.listingId), item.quantity);
  }
}

document.title = `${book.title} · Bookmarket`;

function stockText(offer) {
  return offer.condition === 'new' ? `${offer.quantity} in stock` : 'Single copy';
}

function actionHtml(offer) {
  if (user && offer.seller._id === user._id) {
    return '<button class="btn btn--small" type="button" disabled>Your listing</button>';
  }
  if (!user) {
    return `<a class="btn btn--small btn--primary" href="${escapeHtml(loginUrl())}">Log in to buy</a>`;
  }
  return addButtonHtml(offer);
}

function addButtonHtml(offer) {
  const have = inCart.get(offer._id) || 0;
  if (have >= offer.quantity) {
    return `<a class="btn btn--small" href="/cart.html">In your cart${offer.quantity > 1 ? ` (${have})` : ''}</a>`;
  }
  const label = have ? `Add another (${have} in cart)` : 'Add to cart';
  return `<button class="btn btn--small btn--primary" type="button" data-add="${offer._id}">${label}</button>`;
}

function offerRowHtml(offer, i) {
  return `
    <tr data-offer="${offer._id}">
      <td data-label="Seller">
        <div class="offer-table__seller">
          <strong>${escapeHtml(offer.seller.name)}</strong>
          ${starsHtml(offer.seller.rating, offer.seller.ratingCount)}
        </div>
      </td>
      <td data-label="Condition">${conditionBadge(offer.condition)}</td>
      <td data-label="Price"><span class="price">${formatPrice(offer.pricePaise)}</span>${i === 0 && book.offers.length > 1 ? '<span class="offer-table__cheapest">Lowest</span>' : ''}</td>
      <td data-label="Stock" class="muted">${stockText(offer)}</td>
      <td data-label="Notes" class="offer-table__notes">${escapeHtml(offer.notes)}</td>
      <td data-label="Action">${actionHtml(offer)}</td>
    </tr>`;
}

function offersHtml() {
  if (!book.offers.length) {
    return `
      <div class="empty-state">
        <h2>No copies on sale right now</h2>
        <p>Have a copy you've finished with?</p>
        <p><a class="btn btn--primary" href="/sell.html?isbn=${book.isbn13}">Sell yours</a></p>
      </div>`;
  }
  return `
    <table class="offer-table">
      <thead>
        <tr><th scope="col">Seller</th><th scope="col">Condition</th><th scope="col">Price</th><th scope="col">Stock</th><th scope="col">Notes</th><th scope="col"><span class="visually-hidden">Action</span></th></tr>
      </thead>
      <tbody>${book.offers.map(offerRowHtml).join('')}</tbody>
    </table>`;
}

const facts = [
  ['Publisher', book.publisher && escapeHtml(book.publisher)],
  ['Published', book.publishedYear],
  ['Pages', book.pages],
  ['ISBN', book.isbn13],
  ['Genre', book.genre && `<a href="/catalog.html?genre=${encodeURIComponent(book.genre.slug)}">${escapeHtml(book.genre.name)}</a>`],
].filter(([, v]) => v);

const cheapest = book.offers[0];
container.innerHTML = `
  <article class="book-detail">
    <div>
      <h1>${escapeHtml(book.title)}</h1>
      <p class="book-detail__author">by ${escapeHtml(book.author)}</p>
      <dl class="book-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${
        cheapest
          ? `<div class="book-detail__summary">
              <span class="price price--from">${formatPrice(cheapest.pricePaise)}</span>
              <span class="muted">${book.offers.length} offer${book.offers.length === 1 ? '' : 's'} below</span>
              <a class="btn btn--small" href="/sell.html?isbn=${book.isbn13}">Sell yours</a>
            </div>`
          : ''
      }
    </div>
  </article>
  <section class="offers" aria-labelledby="offers-title">
    <h2 id="offers-title">Offers</h2>
    ${offersHtml()}
  </section>`;

container.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-add]');
  if (!button) {
    return;
  }
  const offer = book.offers.find((o) => o._id === button.dataset.add);
  const quantity = (inCart.get(offer._id) || 0) + 1;
  button.disabled = true;
  try {
    await api(`/cart/${offer._id}`, { method: 'PUT', body: { quantity } });
    inCart.set(offer._id, quantity);
    window.dispatchEvent(new Event('cart:change'));
    toast(`Added “${book.title}” to your cart`);
  } catch (err) {
    toast(err.message, { type: 'error' });
  }
  button.closest('td').innerHTML = addButtonHtml(offer);
});
