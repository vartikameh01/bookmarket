import { requireUser } from '../header.js';
import { api } from '../api.js';
import { escapeHtml, formatPrice } from '../ui.js';
import { formatDate, orderNumber, statusBadge } from '../render.js';

await requireUser();

const container = document.querySelector('#orders-list');
const checkoutId = new URLSearchParams(location.search).get('checkout');

function rowHtml(order) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const titles = order.items.map((item) => item.title).join(', ');
  const isNew = order.checkoutId === checkoutId;
  return `
    <li class="row${isNew ? ' is-highlighted' : ''}">
      <div class="row__main">
        <a class="row__title" href="/order.html?id=${order._id}">${escapeHtml(titles)}</a>
        <div class="row__meta">
          <span>Order ${orderNumber(order._id)}</span>
          <span>from ${escapeHtml(order.seller?.name ?? 'a seller')}</span>
          <span>${formatDate(order.createdAt)}</span>
          <span>${count} book${count === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div class="row__actions">
        ${statusBadge(order.status)}
        <span class="price">${formatPrice(order.totalPaise)}</span>
        <a class="btn btn--small" href="/order.html?id=${order._id}">View</a>
      </div>
    </li>`;
}

function bannerHtml(orders) {
  const placed = orders.filter((o) => o.checkoutId === checkoutId);
  if (!placed.length) {
    return '';
  }
  const total = placed.reduce((sum, o) => sum + o.totalPaise, 0);
  const sellers = placed.length === 1 ? 'Your seller has been told to pack your books.' : `Your ${placed.length} sellers have been told to pack your books, and each order ships on its own.`;
  return `
    <div class="banner" role="status">
      <h2>Thank you, your order is placed</h2>
      <p>Payment ${escapeHtml(placed[0].paymentRef)} of ${formatPrice(total)} went through. ${sellers}</p>
    </div>`;
}

const orders = await api('/orders');
container.innerHTML = `
  <div class="page-head"><h1>My orders</h1></div>
  ${bannerHtml(orders)}
  ${
    orders.length
      ? `<ul class="rows">${orders.map(rowHtml).join('')}</ul>`
      : `<div class="empty-state">
          <h2>No orders yet</h2>
          <p>When you buy a book, it shows up here so you can follow it to your door.</p>
          <p><a class="btn btn--primary" href="/catalog.html">Browse books</a></p>
        </div>`
  }`;
