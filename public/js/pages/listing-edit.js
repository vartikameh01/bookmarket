import { requireUser } from '../header.js';
import { api } from '../api.js';
import { escapeHtml, formatPrice, setFieldError, showFieldErrors } from '../ui.js';
import { conditionBadge } from '../render.js';
import { NOTES_MAX, validateListing } from '../shared/validate-listing.js';

await requireUser();

const container = document.querySelector('#edit');
const id = new URLSearchParams(location.search).get('id') || '';

let listing;
try {
  listing = await api(`/listings/${encodeURIComponent(id)}`);
} catch (err) {
  container.innerHTML = `
    <div class="empty-state">
      <h2>Listing not found</h2>
      <p>${escapeHtml(err.message)}. It may have been removed.</p>
      <p><a class="btn" href="/seller/listings.html">Back to my listings</a></p>
    </div>`;
  // stop here without an uncaught error, because the message above is the whole page
  await new Promise(() => {});
}

const isNew = listing.condition === 'new';
const soldOut = listing.quantity === 0;
container.innerHTML = `
  <div class="book-summary">
    <div class="row__main">
      <p class="row__title">${escapeHtml(listing.book.title)}</p>
      <p class="row__meta">${escapeHtml(listing.book.author)} · ${conditionBadge(listing.condition)}</p>
    </div>
  </div>
  <form id="edit-form" class="form sell-form" novalidate style="margin-top: var(--space-5)">
    <p class="form-error" role="alert"></p>
    <div class="field-row">
      <div class="field">
        <label for="edit-price">Price</label>
        <div class="input-prefix">
          <span aria-hidden="true">₹</span>
          <input id="edit-price" name="price" type="number" inputmode="numeric" min="10" max="10000" step="1" required value="${listing.pricePaise / 100}" aria-describedby="edit-price-error">
        </div>
        <p class="field__error" id="edit-price-error"></p>
      </div>
      ${
        isNew
          ? `<div class="field">
              <label for="edit-quantity">Copies in stock</label>
              <input id="edit-quantity" name="quantity" type="number" inputmode="numeric" min="1" max="100" step="1" required value="${listing.quantity}" aria-describedby="edit-quantity-hint edit-quantity-error">
              <p class="field__hint" id="edit-quantity-hint">${soldOut ? 'Sold out. Enter a new stock count to put it back on sale.' : 'Up to 100.'}</p>
              <p class="field__error" id="edit-quantity-error"></p>
            </div>`
          : ''
      }
    </div>
    ${
      isNew
        ? ''
        : `<p class="field__hint">${soldOut ? 'This copy has sold, so it stays off sale.' : 'A used listing is always a single copy.'}</p>`
    }
    <div class="field">
      <label for="edit-notes">Notes <span class="muted">(optional)</span></label>
      <textarea id="edit-notes" name="notes" maxlength="${NOTES_MAX}" aria-describedby="edit-notes-error">${escapeHtml(listing.notes)}</textarea>
      <p class="field__error" id="edit-notes-error"></p>
    </div>
    <div class="row__actions">
      <button class="btn btn--primary" type="submit">Save changes</button>
      <a class="btn btn--ghost" href="/seller/listings.html">Cancel</a>
      <span class="muted">Currently ${formatPrice(listing.pricePaise)}</span>
    </div>
  </form>`;

const form = document.querySelector('#edit-form');
const formError = form.querySelector('.form-error');
const submit = form.querySelector('[type="submit"]');

const original = Object.fromEntries(new FormData(form));

// send only what the seller changed, so saving a new price on a sold out listing doesn't quietly restock it
function changes() {
  const current = Object.fromEntries(new FormData(form));
  return Object.fromEntries(Object.entries(current).filter(([key, v]) => v !== original[key]));
}

function check() {
  const { value, errors } = validateListing(changes(), { existing: { condition: listing.condition } });
  for (const name of ['price', 'quantity', 'notes']) {
    setFieldError(form, name, errors[name]);
  }
  return { value, errors };
}

form.addEventListener('input', check);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';
  const { errors } = check();
  if (Object.keys(errors).length) {
    showFieldErrors(form, errors);
    return;
  }
  const body = changes();
  if (!Object.keys(body).length) {
    location.href = '/seller/listings.html';
    return;
  }
  submit.disabled = true;
  try {
    await api(`/listings/${listing._id}`, { method: 'PATCH', body });
    location.href = `/seller/listings.html?updated=${listing._id}`;
  } catch (err) {
    const unmatched = err.errors ? showFieldErrors(form, err.errors) : [err.message];
    formError.textContent = unmatched.join(' ');
    submit.disabled = false;
  }
});
