import { requireUser } from '../header.js';
import { api } from '../api.js';
import { clearFieldError, clearFieldErrors, escapeHtml, showFieldErrors, toast } from '../ui.js';
import { INDIAN_STATES, validateAddress } from '../shared/validate-address.js';

await requireUser();

const ticket = document.querySelector('#ticket');
const detailsForm = document.querySelector('#details-form');
const passwordForm = document.querySelector('#password-form');
const ADDRESS_FIELDS = ['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode'];

const monthYear = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });

function initials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase();
}

function renderTicket(profile) {
  const { stats } = profile;
  const rating = stats.ratingCount
    ? `<span class="stars__icon" aria-hidden="true">★</span> ${stats.rating.toFixed(1)} <small>(${stats.ratingCount})</small>`
    : '<small>Not rated yet</small>';
  ticket.innerHTML = `
    <div class="ticket__band"><span>Bookmarket</span><span>Reader's ticket</span></div>
    <div class="ticket__body">
      <span class="ticket__initials" aria-hidden="true">${escapeHtml(initials(profile.name))}</span>
      <h2 class="ticket__name">${escapeHtml(profile.name)}</h2>
      <p class="ticket__email">${escapeHtml(profile.email)}</p>
      <p class="ticket__stamp">Member since <strong>${monthYear.format(new Date(profile.memberSince))}</strong></p>
    </div>
    <dl class="ticket__stats">
      <div><dt>Orders placed</dt><dd><a href="/orders.html">${stats.ordersPlaced}</a></dd></div>
      <div><dt>Books on sale</dt><dd><a href="/seller/listings.html">${stats.activeListings}</a></dd></div>
      <div><dt>As a seller</dt><dd>${rating}</dd></div>
    </dl>
    <p class="ticket__no">No. ${escapeHtml(String(profile._id).slice(-6).toUpperCase())}</p>`;
}

function fillDetails(profile) {
  detailsForm.elements.name.value = profile.name;
  document.querySelector('#prof-email').value = profile.email;
  for (const field of ADDRESS_FIELDS) {
    detailsForm.elements[`address.${field}`].value = profile.address?.[field] ?? '';
  }
}

function flashSaved(el, text) {
  el.textContent = text;
  el.classList.remove('is-shown');
  // restart the stamp animation when the same form is saved twice in a row
  void el.offsetWidth;
  el.classList.add('is-shown');
}

detailsForm.elements['address.state'].append(...INDIAN_STATES.map((s) => new Option(s, s)));

let profile;
try {
  profile = await api('/profile');
} catch (err) {
  ticket.innerHTML = `<p class="form-error">${escapeHtml(err.message)}</p>`;
  await new Promise(() => {});
}
renderTicket(profile);
fillDetails(profile);

for (const form of [detailsForm, passwordForm]) {
  form.addEventListener('input', (event) => {
    clearFieldError(event.target);
    form.querySelector('.saved-note').classList.remove('is-shown');
  });
}

detailsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(detailsForm);
  const formError = detailsForm.querySelector('.form-error');
  formError.textContent = '';

  const name = detailsForm.elements.name.value.trim();
  const address = Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, detailsForm.elements[`address.${f}`].value]));
  const errors = {};
  if (!name) {
    errors.name = 'Enter your name';
  }
  // same rule as the server, an address left completely empty is cleared instead of checked
  if (Object.values(address).some((v) => v.trim())) {
    for (const [field, message] of Object.entries(validateAddress(address).errors)) {
      errors[`address.${field}`] = message;
    }
  }
  if (Object.keys(errors).length) {
    showFieldErrors(detailsForm, errors);
    return;
  }

  const button = detailsForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const user = await api('/profile', { method: 'PATCH', body: { name, address } });
    profile = { ...profile, name: user.name, address: user.address };
    fillDetails(profile);
    renderTicket(profile);
    // the header was drawn from /auth/me before the change
    const menuName = document.querySelector('.account-menu summary');
    if (menuName) {
      menuName.textContent = user.name;
    }
    flashSaved(document.querySelector('#details-saved'), user.address ? 'Saved' : 'Saved, address cleared');
  } catch (err) {
    const unmatched = err.errors ? showFieldErrors(detailsForm, err.errors) : [err.message];
    formError.textContent = unmatched.join(' ');
  } finally {
    button.disabled = false;
  }
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors(passwordForm);
  const formError = passwordForm.querySelector('.form-error');
  formError.textContent = '';

  const { currentPassword, newPassword, confirmPassword } = Object.fromEntries(new FormData(passwordForm));
  const errors = {};
  if (!currentPassword) {
    errors.currentPassword = 'Enter your current password';
  }
  if (newPassword.length < 8) {
    errors.newPassword = 'Password must be at least 8 characters';
  } else if (newPassword === currentPassword) {
    errors.newPassword = 'Pick a password different from your current one';
  }
  if (!errors.newPassword && confirmPassword !== newPassword) {
    errors.confirmPassword = 'This doesn’t match the new password';
  }
  if (Object.keys(errors).length) {
    showFieldErrors(passwordForm, errors);
    return;
  }

  const button = passwordForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await api('/profile/password', { method: 'POST', body: { currentPassword, newPassword } });
    passwordForm.reset();
    flashSaved(document.querySelector('#password-saved'), 'Changed');
    toast('Password changed. Use the new one next time you log in.');
  } catch (err) {
    const unmatched = err.errors ? showFieldErrors(passwordForm, err.errors) : [err.message];
    formError.textContent = unmatched.join(' ');
  } finally {
    button.disabled = false;
  }
});
