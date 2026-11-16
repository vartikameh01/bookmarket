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
