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

// a radio group's error belongs to its fieldset, every other field's to the input itself
function fieldTarget(form, nameOrEl) {
  let el = typeof nameOrEl === 'string' ? form.elements[nameOrEl] : nameOrEl;
  if (el instanceof RadioNodeList) {
    el = el[0];
  }
  if (el?.type === 'radio') {
    el = el.closest('fieldset');
  }
  return el?.id ? el : null;
}

// each field's error goes in the element with id "<field id>-error", which the field lists in aria-describedby so screen readers read it with the field
export function setFieldError(form, nameOrEl, message) {
  const target = fieldTarget(form, nameOrEl);
  const errorEl = target && form.querySelector(`#${target.id}-error`);
  if (!errorEl) {
    return false;
  }
  errorEl.textContent = message || '';
  if (message) {
    target.setAttribute('aria-invalid', 'true');
  } else {
    target.removeAttribute('aria-invalid');
  }
  return true;
}

export function showFieldErrors(form, errors) {
  const unmatched = [];
  let first;
  for (const [name, message] of Object.entries(errors)) {
    if (setFieldError(form, name, message)) {
      first ??= fieldTarget(form, name);
    } else {
      unmatched.push(message);
    }
  }
  // a fieldset can't take focus, so focus its first radio instead
  (first?.matches('fieldset') ? first.querySelector('input') : first)?.focus();
  // hand back errors with no matching field so the page can show them in its form level message
  return unmatched;
}

export function clearFieldError(el) {
  if (el.form) {
    setFieldError(el.form, el, '');
  }
}

export function clearFieldErrors(form) {
  for (const el of form.querySelectorAll('[aria-invalid]')) {
    setFieldError(form, el, '');
  }
}
