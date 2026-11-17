import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Order from '../models/Order.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { BCRYPT_COST, passwordError, publicUser, startSession } from './auth.js';
import { validateAddress } from '../../public/js/shared/validate-address.js';

const router = Router();
router.use(requireAuth);

const ADDRESS_FIELDS = ['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode'];

// the profile page header shows these next to the user's details
router.get('/', async (req, res) => {
  const user = await User.findById(req.userId);
  const [ordersPlaced, activeListings] = await Promise.all([
    Order.countDocuments({ buyerId: req.userId }),
    Listing.countDocuments({ sellerId: req.userId, status: 'active', quantity: mongoose.trusted({ $gt: 0 }) }),
  ]);
  res.json({
    ...publicUser(user),
    memberSince: user.createdAt,
    stats: {
      ordersPlaced,
      activeListings,
      rating: user.ratingCount ? Math.round((user.ratingSum / user.ratingCount) * 10) / 10 : null,
      ratingCount: user.ratingCount,
    },
  });
});

router.patch('/', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
  const errors = {};
  if (!name) {
    errors.name = 'Enter your name';
  } else if (name.length > 80) {
    errors.name = 'Name must be 80 characters or fewer';
  }

  // a form with every address field blank clears the saved address instead of failing validation
  const input = req.body.address ?? {};
  const blank = ADDRESS_FIELDS.every((field) => !String(input[field] ?? '').trim());
  let address = null;
  if (!blank) {
    const checked = validateAddress(input);
    // prefix the keys so the address name never collides with the account name field
    for (const [field, message] of Object.entries(checked.errors)) {
      errors[`address.${field}`] = message;
    }
    address = checked.value;
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  const user = await User.findByIdAndUpdate(req.userId, { $set: { name, address } }, { returnDocument: 'after', runValidators: true });
  res.json(publicUser(user));
});

router.post('/password', async (req, res) => {
  const currentPassword = String(req.body.currentPassword ?? '');
  const newPassword = String(req.body.newPassword ?? '');

  const errors = {};
  if (!currentPassword) {
    errors.currentPassword = 'Enter your current password';
  }
  const weak = passwordError(newPassword);
  if (weak) {
    errors.newPassword = weak;
  } else if (newPassword === currentPassword) {
    errors.newPassword = 'Pick a password different from your current one';
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  const user = await User.findById(req.userId).select('+passwordHash');
  // answer 400 and not 401, because the browser treats 401 as logged out and would send the user to the login page
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(400).json({ errors: { currentPassword: 'That is not your current password' } });
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await user.save();
  // a new session id means a session cookie copied before the change stops working
  await startSession(req, user._id);
  res.status(204).end();
});

export default router;
