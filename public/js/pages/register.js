import '../header.js';
import { EMAIL_PATTERN, setupAuthForm } from '../auth-form.js';

setupAuthForm(document.querySelector('#register-form'), {
  endpoint: '/auth/register',
  busyLabel: 'Creating account…',
  validate({ name, email, password }) {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Enter your name';
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = 'Enter a valid email address';
    }
    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    return errors;
  },
});
