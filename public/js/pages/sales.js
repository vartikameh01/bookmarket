import { requireUser } from '../header.js';
import { api } from '../api.js';
import { escapeHtml, formatPrice, toast } from '../ui.js';
import { formatDate, orderNumber, statusBadge } from '../render.js';

await requireUser();

const TABS = [
  ['', 'All'],
  ['placed', 'To ship'],
  ['shipped', 'Shipped'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
];
const ACTIONS = { placed: ['shipped', 'Mark shipped'], shipped: ['delivered', 'Mark delivered'] };

const container = document.querySelector('#sales');
const summaryEl = document.querySelector('#summary');
const tabsEl = document.querySelector('#tabs');
const status = new URLSearchParams(location.search).get('status') || '';

function renderTabs(allOrders) {
  tabsEl.innerHTML = TABS.map(([value, label]) => {
    const count = value ? allOrders.filter((o) => o.status === value).length : allOrders.length;
    const current = value === status ? ' aria-current="page"' : '';
    return `<a href="/seller/sales.html${value ? `?status=${value}` : ''}"${current}>${label}<span class="count">${count}</span></a>`;
  }).join('');
}

function rowHtml(order) {
  const a = order.shipping;
  const titles = order.items.map((item) => `${item.title}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`).join(', ');
  const action = ACTIONS[order.status];
  // the address only matters while the seller still has to send the parcel
  const address = ['placed', 'shipped'].includes(order.status)
    ? `<p class="sale-address">Ship to ${escapeHtml(a.name)}, ${escapeHtml(a.line1)}${a.line2 ? `, ${escapeHtml(a.line2)}` : ''}, ${escapeHtml(a.city)}, ${escapeHtml(a.state)} ${escapeHtml(a.pincode)} · ${escapeHtml(a.phone)}</p>`
    : '';
  return `
    <li class="row" data-id="${order._id}">
      <div class="row__main">
        <span class="row__title">${escapeHtml(titles)}</span>
        <div class="row__meta">
          <span>Order ${orderNumber(order._id)}</span>
          <span>${escapeHtml(order.buyer?.name ?? 'A buyer')}</span>
          <span>${formatDate(order.createdAt)}</span>
          ${order.rating ? `<span class="stars"><span class="stars__icon">★</span> ${order.rating.stars}</span>` : ''}
        </div>
        ${address}
      </div>
      <div class="row__actions">
        ${statusBadge(order.status)}
        <span class="price">${formatPrice(order.totalPaise)}</span>
        ${action ? `<button class="btn btn--small btn--primary" type="button" data-next="${action[0]}">${action[1]}</button>` : ''}
      </div>
    </li>`;
}

async function render() {
  const all = await api('/sales');
  renderTabs(all);
  const orders = status ? all.filter((o) => o.status === status) : all;
  if (!orders.length) {
    const label = TABS.find(([v]) => v === status)?.[1].toLowerCase();
    container.innerHTML = `
      <div class="empty-state">
        <h2>${status ? `Nothing ${label === 'to ship' ? 'to ship' : label} right now` : 'No sales yet'}</h2>
        <p>${status ? 'Orders move through here as you ship and deliver them.' : 'When someone buys one of your books, the order shows up here with their address.'}</p>
      </div>`;
    return all;
  }
  container.innerHTML = `<ul class="rows">${orders.map(rowHtml).join('')}</ul>`;
  return all;
}

async function renderSummary() {
  const s = await api('/sales/summary');
  const rating = s.ratingCount
    ? `<span class="stars__icon">★</span> ${s.rating.toFixed(1)}<small> from ${s.ratingCount} rating${s.ratingCount === 1 ? '' : 's'}</small>`
    : '<small>No ratings yet</small>';
  summaryEl.innerHTML = `
    <dl class="stat-cards">
      <div class="stat-card stat-card--earned"><dt>Earned</dt><dd>${formatPrice(s.earnedPaise)}</dd><small>From delivered orders</small></div>
      <div class="stat-card stat-card--pending"><dt>Pending</dt><dd>${formatPrice(s.pendingPaise)}</dd><small>Placed or on the way</small></div>
      <div class="stat-card"><dt>Orders</dt><dd>${s.orderCount}</dd><small>${s.toShip} to ship${s.cancelledCount ? `, ${s.cancelledCount} cancelled` : ''}</small></div>
      <div class="stat-card"><dt>Rating</dt><dd>${rating}</dd></div>
    </dl>`;
}

container.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-next]');
  if (!button) {
    return;
  }
  const id = button.closest('[data-id]').dataset.id;
  button.disabled = true;
  try {
    const order = await api(`/sales/${id}`, { method: 'PATCH', body: { status: button.dataset.next } });
    toast(`Order ${orderNumber(order._id)} marked ${order.status}`);
  } catch (err) {
    toast(err.message, { type: 'error' });
  }
  await Promise.all([render(), renderSummary()]);
});

await Promise.all([render(), renderSummary()]);
