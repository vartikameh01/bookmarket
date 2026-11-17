import { requireUser } from '../header.js';
import { api } from '../api.js';
import { escapeHtml, formatPrice, setFieldError, showFieldErrors } from '../ui.js';
import { INDIAN_STATES, validateAddress } from '../shared/validate-address.js';

const user = await requireUser();

const form = document.querySelector('#checkout-form');
const formError = form.querySelector('.form-error');
const summary = document.querySelector('#summary');
const noticesEl = document.querySelector('#notices');
const pay = document.querySelector('#pay');

const ADDRESS_FIELDS = ['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode'];
const CARD_FIELDS = ['cardNumber', 'cardExpiry', 'cardCvv'];
const touched = new Set();
let cart;

form.elements.state.append(...INDIAN_STATES.map((s) => new Option(s, s)));
if (user.address) {
  for (const field of ADDRESS_FIELDS) {
    form.elements[field].value = user.address[field] ?? '';
  }
} else {
  form.elements.saveAddress.checked = true;
  form.elements.name.value = user.name;
}

// card checks run only here because the card is never sent anywhere, this is a mock payment
function validateCard(values) {
  const errors = {};
  if (!/^\d{16}$/.test(values.cardNumber.replace(/\s/g, ''))) {
    errors.cardNumber = 'Enter the 16 digit card number';
  }
  const expiry = values.cardExpiry.match(/^(\d{2})\/(\d{2})$/);
  const month = Number(expiry?.[1]);
  if (!expiry || month < 1 || month > 12) {
    errors.cardExpiry = 'Enter the expiry as MM/YY';
  } else {
    const now = new Date();
    const year = 2000 + Number(expiry[2]);
    if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      errors.cardExpiry = 'This card has expired';
    }
  }
  if (!/^\d{3}$/.test(values.cardCvv)) {
    errors.cardCvv = 'Enter the 3 digit CVV';
  }
  return errors;
}

function check() {
  const values = Object.fromEntries(new FormData(form));
  const address = validateAddress(values);
  const errors = { ...address.errors, ...validateCard(values) };
  for (const name of [...ADDRESS_FIELDS, ...CARD_FIELDS]) {
    setFieldError(form, name, touched.has(name) ? errors[name] : '');
  }
  pay.disabled = !cart?.groups.length || Object.keys(errors).length > 0;
  return { errors, shipping: address.value, saveAddress: form.elements.saveAddress.checked };
}

function renderSummary() {
  noticesEl.innerHTML = cart.notices.map((n) => `<li>${escapeHtml(n)}</li>`).join('');
  summary.innerHTML = `
    <ul class="summary-items">
      ${cart.groups
        .map(
          (g) => `
        <li>
          <h3>From ${escapeHtml(g.seller.name)}</h3>
          ${g.items
            .map((i) => `<div class="summary-line"><span>${escapeHtml(i.title)} × ${i.quantity}</span><span>${formatPrice(i.lineTotalPaise)}</span></div>`)
            .join('')}
        </li>`,
        )
        .join('')}
    </ul>
    <div class="summary-line"><span>Delivery</span><span>Free</span></div>
    <div class="summary-line summary-line--total"><span>Total</span><span class="price">${formatPrice(cart.totalPaise)}</span></div>`;
  pay.textContent = `Pay ${formatPrice(cart.totalPaise)}`;
}

async function loadCart() {
  cart = await api('/cart');
  if (!cart.groups.length) {
    location.replace('/cart.html');
    await new Promise(() => {});
  }
  renderSummary();
  check();
}

// group card digits in fours and add the slash in the expiry, the way they're printed on the card
form.elements.cardNumber.addEventListener('input', (event) => {
  const digits = event.target.value.replace(/\D/g, '').slice(0, 16);
  event.target.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
});
form.elements.cardExpiry.addEventListener('input', (event) => {
  const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
  event.target.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
});

form.addEventListener('input', check);
form.addEventListener('change', check);
form.addEventListener('focusout', (event) => {
  if (event.target.name) {
    touched.add(event.target.name);
    check();
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  [...ADDRESS_FIELDS, ...CARD_FIELDS].forEach((name) => touched.add(name));
  const { errors, shipping, saveAddress } = check();
  if (Object.keys(errors).length) {
    showFieldErrors(form, errors);
    return;
  }

  formError.textContent = '';
  pay.disabled = true;
  pay.textContent = 'Placing your order…';
  try {
    // only the address goes to the server, prices and items are read from the cart there
    const result = await api('/orders', { method: 'POST', body: { shipping, saveAddress } });
    window.dispatchEvent(new Event('cart:change'));
    location.href = `/orders.html?checkout=${encodeURIComponent(result.checkoutId)}`;
  } catch (err) {
    const unmatched = err.errors ? showFieldErrors(form, err.errors) : [err.message];
    formError.textContent = unmatched.join(' ');
    formError.scrollIntoView({ block: 'center' });
    window.dispatchEvent(new Event('cart:change'));
    await loadCart();
  }
});

await loadCart();
