import { getCurrentUser } from './header.js';
import { api, nextPath } from './api.js';
import { clearFieldError, clearFieldErrors, showFieldErrors } from './ui.js';

// same loose check the server uses, the real test is whether the address can log in
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// login and register differ only in their fields and checks, so both pages hand their form to this
export function setupAuthForm(form, { endpoint, validate, busyLabel }) {
  const submit = form.querySelector('[type="submit"]');
  const formError = form.querySelector('.form-error');

  getCurrentUser().then((user) => {
    if (user) {
      location.replace(nextPath());
    }
  });

  // carry next over when switching between login and register
  const switchLink = document.querySelector('.auth-card__switch a');
  switchLink.search = location.search;

  form.addEventListener('input', (event) => clearFieldError(event.target));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    formError.textContent = '';

    const values = Object.fromEntries(new FormData(form));
    const errors = validate(values);
    if (Object.keys(errors).length) {
      showFieldErrors(form, errors);
      return;
    }

    const label = submit.textContent;
    submit.disabled = true;
    submit.textContent = busyLabel;
    try {
      // turn off the 401 redirect because a wrong password is a 401 here
      await api(endpoint, { method: 'POST', body: values, redirectOn401: false });
      location.href = nextPath();
    } catch (err) {
      const unmatched = err.errors ? showFieldErrors(form, err.errors) : [err.message];
      formError.textContent = unmatched.join(' ');
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}
