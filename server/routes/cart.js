import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

const MAX_QUANTITY = 100;

export function cartCount(cart) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

// a listing can sell out, be paused or be removed while it sits in someone's cart, so the cart is cleaned on every read
export async function loadCart(userId) {
  const user = await User.findById(userId).lean();
  const ids = user.cart.map((item) => item.listingId);
  const listings = await Listing.find({ _id: mongoose.trusted({ $in: ids }) })
    .populate('bookId', 'title author coverUrl')
    .populate('sellerId', 'name')
    .lean();
  const byId = new Map(listings.map((l) => [String(l._id), l]));

  const lines = [];
  const notices = [];
  for (const item of user.cart) {
    const listing = byId.get(String(item.listingId));
    const title = listing?.bookId?.title ?? 'A book';
    const buyable = listing && listing.status === 'active' && listing.quantity > 0 && listing.sellerId && String(listing.sellerId._id) !== String(userId);
    if (!buyable) {
      notices.push(`“${title}” is no longer available, so it was taken out of your cart.`);
      continue;
    }
    let quantity = item.quantity;
    if (quantity > listing.quantity) {
      quantity = listing.quantity;
      notices.push(`Only ${listing.quantity} of “${title}” left, so your cart now has ${quantity}.`);
    }
    lines.push({ listing, quantity });
  }

  if (notices.length) {
    await User.updateOne({ _id: userId }, { $set: { cart: lines.map((l) => ({ listingId: l.listing._id, quantity: l.quantity })) } });
  }
  return { lines, notices };
}

// one group per seller because checkout makes one order per seller
function groupBySeller(lines) {
  const groups = new Map();
  for (const { listing, quantity } of lines) {
    const sellerId = String(listing.sellerId._id);
    if (!groups.has(sellerId)) {
      groups.set(sellerId, { seller: { _id: sellerId, name: listing.sellerId.name }, items: [], subtotalPaise: 0 });
    }
    const group = groups.get(sellerId);
    const lineTotalPaise = listing.pricePaise * quantity;
    group.items.push({
      listingId: listing._id,
      bookId: listing.bookId._id,
      title: listing.bookId.title,
      author: listing.bookId.author,
      coverUrl: listing.bookId.coverUrl,
      condition: listing.condition,
      pricePaise: listing.pricePaise,
      quantity,
      stock: listing.quantity,
      lineTotalPaise,
    });
    group.subtotalPaise += lineTotalPaise;
  }
  return [...groups.values()];
}

router.get('/', async (req, res) => {
  const { lines, notices } = await loadCart(req.userId);
  const groups = groupBySeller(lines);
  res.json({
    groups,
    totalPaise: groups.reduce((sum, g) => sum + g.subtotalPaise, 0),
    count: lines.reduce((sum, l) => sum + l.quantity, 0),
    notices,
  });
});

// sets the quantity rather than adding, so repeating the same request can't double an order
router.put('/:listingId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.listingId)) {
    return res.status(404).json({ error: 'This copy is no longer available' });
  }
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) {
    return res.status(400).json({ error: 'Quantity must be a whole number from 0 to 100' });
  }

  const user = await User.findById(req.userId).lean();
  let cart = user.cart.filter((item) => String(item.listingId) !== req.params.listingId);

  if (quantity > 0) {
    const listing = await Listing.findById(req.params.listingId).populate('bookId', 'title').lean();
    if (!listing || listing.status !== 'active' || listing.quantity === 0) {
      return res.status(404).json({ error: 'This copy is no longer available' });
    }
    if (String(listing.sellerId) === req.userId) {
      return res.status(400).json({ error: "You can't buy your own listing" });
    }
    if (quantity > listing.quantity) {
      const copies = listing.quantity === 1 ? 'Only 1 copy' : `Only ${listing.quantity} copies`;
      return res.status(400).json({ error: `${copies} of “${listing.bookId.title}” left` });
    }
    // keep the item where it was so the cart order doesn't jump around when a quantity changes
    const index = user.cart.findIndex((item) => String(item.listingId) === req.params.listingId);
    const entry = { listingId: listing._id, quantity };
    cart = index === -1 ? [...cart, entry] : user.cart.map((item, i) => (i === index ? entry : item));
  }

  await User.updateOne({ _id: req.userId }, { $set: { cart } });
  res.json({ quantity, cartCount: cartCount(cart) });
});

export default router;
