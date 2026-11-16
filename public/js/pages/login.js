import '../header.js';
import { EMAIL_PATTERN, setupAuthForm } from '../auth-form.js';

setupAuthForm(document.querySelector('#login-form'), {
  endpoint: '/auth/login',
  busyLabel: 'Logging in…',
  validate({ email, password }) {
    const errors = {};
    if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = 'Enter the email you registered with';
    }
    if (!password) {
      errors.password = 'Enter your password';
    }
    return errors;
  },
});
