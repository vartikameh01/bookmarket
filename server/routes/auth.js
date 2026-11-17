import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { cartCount } from './cart.js';

const router = Router();

export const BCRYPT_COST = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// compared against when the email is unknown, so a wrong email takes as long as a wrong password and doesn't reveal which accounts exist
const DUMMY_HASH = bcrypt.hashSync('not a real password', BCRYPT_COST);

// the one user shape every auth route returns, so the header can rely on it
export function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    address: user.address,
    cartCount: cartCount(user.cart),
  };
}

// register and the profile password change share this so both enforce the same rule
export function passwordError(password) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  // bcrypt only uses the first 72 bytes, so longer passwords would silently match on a prefix
  if (new TextEncoder().encode(password).length > 72) {
    return 'Password must be 72 characters or fewer';
  }
  return null;
}

// a fresh session id on login stops an attacker from planting a known id before the user signs in
export function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }
      req.session.userId = userId.toString();
      resolve();
    });
  });
}

router.post('/register', async (req, res) => {
  // an object like { "$ne": 1 } would otherwise be saved as the text "[object Object]"
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');

  const errors = {};
  if (!name) {
    errors.name = 'Enter your name';
  } else if (name.length > 80) {
    errors.name = 'Name must be 80 characters or fewer';
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    errors.email = 'Enter a valid email address';
  }
  if (passwordError(password)) {
    errors.password = passwordError(password);
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  let user;
  try {
    user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, BCRYPT_COST) });
  } catch (err) {
    // catch the unique email index here because errorHandler would turn it into a 500
    if (err.code === 11000) {
      return res.status(409).json({ errors: { email: 'An account with this email already exists' } });
    }
    throw err;
  }

  await startSession(req, user._id);
  res.status(201).json(publicUser(user));
});

router.post('/login', async (req, res) => {
  // String() turns an injected object like { "$ne": null } into a harmless string
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');

  const user = await User.findOne({ email }).select('+passwordHash');
  const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  await startSession(req, user._id);
  res.json(publicUser(user));
});

router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('sid');
    res.status(204).end();
  });
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json(null);
  }
  const user = await User.findById(req.session.userId);
  res.json(user ? publicUser(user) : null);
});

export default router;
