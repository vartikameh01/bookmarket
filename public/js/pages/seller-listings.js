import { requireUser } from '../header.js';
import { api } from '../api.js';
import { escapeHtml, formatPrice, toast } from '../ui.js';
import { badge, conditionBadge, thumbHtml } from '../render.js';

await requireUser();

const container = document.querySelector('#listings');
const params = new URLSearchParams(location.search);
const highlightId = params.get('created') || params.get('updated');

function stockLabel(listing) {
  if (listing.quantity === 0) {
    return badge('soldout', 'Sold out');
  }
  return listing.condition === 'new' ? `${listing.quantity} in stock` : 'Single copy';
}

function rowHtml(listing, i) {
  const { book } = listing;
  const paused = listing.status === 'paused';
  const classes = ['row', paused || listing.quantity === 0 ? 'is-muted' : '', listing._id === highlightId ? 'is-highlighted' : ''];
  return `
    <li class="${classes.join(' ')}" style="--i: ${i}" data-id="${listing._id}">
      ${thumbHtml(book)}
      <div class="row__main">
        <a class="row__title" href="/book.html?id=${book._id}">${escapeHtml(book.title)}</a>
        <div class="row__meta">
          ${conditionBadge(listing.condition)}
          <span class="price">${formatPrice(listing.pricePaise)}</span>
          <span>${stockLabel(listing)}</span>
          ${paused ? badge('paused', 'Paused') : badge('active', 'Active')}
        </div>
        ${listing.notes ? `<p class="row__meta">${escapeHtml(listing.notes)}</p>` : ''}
      </div>
      <div class="row__actions">
        <a class="btn btn--small" href="/seller/listing-edit.html?id=${listing._id}">Edit</a>
        <button class="btn btn--small" type="button" data-action="${paused ? 'resume' : 'pause'}">${paused ? 'Resume' : 'Pause'}</button>
        <button class="btn btn--small btn--danger" type="button" data-action="remove">Remove</button>
      </div>
    </li>`;
}

async function render() {
  const listings = await api('/listings/mine');
  if (!listings.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Nothing listed yet</h2>
        <p>Got books on your shelf you're done with? List one in under a minute.</p>
        <p><a class="btn btn--primary" href="/sell.html">Sell a book</a></p>
      </div>`;
    return;
  }
  container.innerHTML = `<ul class="rows">${listings.map(rowHtml).join('')}</ul>`;
}

container.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }
  const id = button.closest('[data-id]').dataset.id;
  const title = button.closest('.row').querySelector('.row__title').textContent;
  const action = button.dataset.action;

  if (action === 'remove' && !confirm(`Remove "${title}" from sale? Buyers won't see it any more.`)) {
    return;
  }
  button.disabled = true;
  try {
    if (action === 'remove') {
      await api(`/listings/${id}`, { method: 'DELETE' });
      toast(`Removed "${title}"`);
    } else {
      await api(`/listings/${id}`, { method: 'PATCH', body: { status: action === 'pause' ? 'paused' : 'active' } });
      toast(action === 'pause' ? `Paused "${title}". Buyers won't see it until you resume.` : `"${title}" is back on sale`);
    }
    await render();
  } catch (err) {
    toast(err.message, { type: 'error' });
    button.disabled = false;
  }
});

await render();
if (params.has('created')) {
  toast('Your listing is live');
} else if (params.has('updated')) {
  toast('Listing updated');
}
document.querySelector('.row.is-highlighted')?.scrollIntoView({ block: 'center' });
