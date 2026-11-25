import { requireUser } from '../header.js';
import { api } from '../api.js';
import { escapeHtml, formatPrice, toast } from '../ui.js';
import { conditionBadge, thumbHtml } from '../render.js';

await requireUser();

const container = document.querySelector('#cart');
const noticesEl = document.querySelector('#notices');

function itemHtml(item) {
  const quantity =
    item.stock > 1
      ? `<label class="qty"><span class="visually-hidden">Quantity of ${escapeHtml(item.title)}</span>
           <input type="number" inputmode="numeric" min="1" max="${item.stock}" step="1" value="${item.quantity}" data-qty="${item.listingId}">
           <span class="muted">of ${item.stock}</span></label>`
      : '<span class="muted">Single copy</span>';
  return `
    <li class="row">
      ${thumbHtml(item)}
      <div class="row__main">
        <a class="row__title" href="/book.html?id=${item.bookId}">${escapeHtml(item.title)}</a>
        <div class="row__meta">${conditionBadge(item.condition)} <span>${formatPrice(item.pricePaise)} each</span></div>
      </div>
      <div class="row__actions">
        ${quantity}
        <span class="price line-total">${formatPrice(item.lineTotalPaise)}</span>
        <button class="btn btn--small btn--ghost" type="button" data-remove="${item.listingId}">Remove</button>
      </div>
    </li>`;
}

function groupHtml(group) {
  return `
    <section class="seller-group" aria-label="Sold by ${escapeHtml(group.seller.name)}">
      <div class="seller-group__head">
        <h2>Sold by ${escapeHtml(group.seller.name)}</h2>
        <span class="seller-group__subtotal">Subtotal <span class="price">${formatPrice(group.subtotalPaise)}</span></span>
      </div>
      <ul class="rows">${group.items.map(itemHtml).join('')}</ul>
    </section>`;
}

async function render() {
  const cart = await api('/cart');
  noticesEl.innerHTML = cart.notices.map((n) => `<li>${escapeHtml(n)}</li>`).join('');
  if (cart.notices.length) {
    // the server already removed or capped those items, so the header badge needs the new count
    window.dispatchEvent(new Event('cart:change'));
  }

  if (!cart.groups.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Your cart is empty</h2>
        <p>Find a book you like and compare offers from different sellers.</p>
        <p><a class="btn btn--primary" href="/catalog.html">Browse books</a></p>
      </div>`;
    return;
  }

  const sellers = cart.groups.length;
  container.innerHTML = `
    <div class="cart">
      <div>${cart.groups.map(groupHtml).join('')}</div>
      <aside class="order-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Order summary</h2>
        <div class="summary-line"><span>Items</span><span>${cart.count}</span></div>
        <div class="summary-line"><span>Delivery</span><span>Free</span></div>
        <div class="summary-line summary-line--total"><span>Total</span><span class="price">${formatPrice(cart.totalPaise)}</span></div>
        <a class="btn btn--primary" href="/checkout.html">Checkout</a>
        ${sellers > 1 ? `<p class="field__hint">Your books come from ${sellers} sellers, so you'll get ${sellers} orders that each ship on their own.</p>` : ''}
      </aside>
    </div>`;
}

async function setQuantity(listingId, quantity) {
  try {
    await api(`/cart/${listingId}`, { method: 'PUT', body: { quantity } });
    window.dispatchEvent(new Event('cart:change'));
  } catch (err) {
    toast(err.message, { type: 'error' });
  }
  await render();
}

container.addEventListener('change', (event) => {
  const input = event.target.closest('[data-qty]');
  if (input) {
    const quantity = Number(input.value);
    // an emptied or zero box removes nothing by accident, the Remove button is the way out
    setQuantity(input.dataset.qty, Number.isInteger(quantity) && quantity >= 1 ? quantity : 1);
  }
});

container.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove]');
  if (button) {
    button.disabled = true;
    setQuantity(button.dataset.remove, 0);
  }
});

await render();
