const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// run every piece of user text through this before putting it in innerHTML, so notes or names can't inject markup
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

const wholeRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const withPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

// money is stored as integer paise, so 49900 shows as ₹499 and 49950 as ₹499.50
export function formatPrice(paise) {
  const rupees = paise / 100;
  return paise % 100 === 0 ? wholeRupees.format(rupees) : withPaise.format(rupees);
}

let toastRegion;

export function toast(message, { type = 'success', timeout = 4000 } = {}) {
  if (!toastRegion) {
    toastRegion = document.createElement('div');
    toastRegion.className = 'toast-region';
    toastRegion.setAttribute('aria-live', 'polite');
    document.body.append(toastRegion);
  }

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  toastRegion.append(el);

  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, timeout);
}

// each input's error goes in the element with id "<input id>-error", which the input lists in aria-describedby so screen readers read it with the field
export function showFieldErrors(form, errors) {
  const unmatched = [];
  let firstInvalid;
  for (const [name, message] of Object.entries(errors)) {
    const input = form.elements[name];
    const errorEl = input?.id && form.querySelector(`#${input.id}-error`);
    if (!errorEl) {
      unmatched.push(message);
      continue;
    }
    errorEl.textContent = message;
    input.setAttribute('aria-invalid', 'true');
    firstInvalid ??= input;
  }
  firstInvalid?.focus();
  // hand back errors with no matching field so the page can show them in its form level message
  return unmatched;
}

export function clearFieldError(input) {
  input.removeAttribute('aria-invalid');
  const errorEl = input.id && input.form?.querySelector(`#${input.id}-error`);
  if (errorEl) {
    errorEl.textContent = '';
  }
}

export function clearFieldErrors(form) {
  for (const input of form.querySelectorAll('[aria-invalid]')) {
    clearFieldError(input);
  }
}
