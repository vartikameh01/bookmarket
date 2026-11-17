import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Order from '../models/Order.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateAddress } from '../../public/js/shared/validate-address.js';

const router = Router();
router.use(requireAuth);

// thrown inside a transaction to abort it and answer the buyer with a specific status
class CheckoutError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// a readable fake payment reference like MOCK-8F3K2A, without 0, O, 1 or I so it can be read out loud
function mockPaymentRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `MOCK-${[...randomBytes(6)].map((byte) => alphabet[byte % alphabet.length]).join('')}`;
}

/**
 * Checkout in one transaction: take the stock, write one order per seller and empty the cart.
 * If any book ran out, everything rolls back, so there is never stock taken without an order.
 */
router.post('/', async (req, res) => {
  const { value: shipping, errors } = validateAddress(req.body.shipping);
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }
  const saveAddress = req.body.saveAddress === true;
  const checkoutId = new mongoose.Types.ObjectId();
  const paymentRef = mockPaymentRef();

  let orders;
  const session = await mongoose.startSession();
  try {
    // withTransaction reruns this callback on a write conflict, so it rereads everything instead of using values from outside
    await session.withTransaction(async () => {
      const user = await User.findById(req.userId).session(session);
      if (!user.cart.length) {
        throw new CheckoutError(400, 'Your cart is empty');
      }

      const ids = user.cart.map((item) => item.listingId);
      const listings = await Listing.find({ _id: mongoose.trusted({ $in: ids }) })
        .populate('bookId', 'title')
        .session(session);
      const byId = new Map(listings.map((l) => [String(l._id), l]));

      const itemsBySeller = new Map();
      for (const item of user.cart) {
        const listing = byId.get(String(item.listingId));
        const title = listing?.bookId?.title ?? 'A book in your cart';
        if (!listing || String(listing.sellerId) === req.userId) {
          throw new CheckoutError(409, `Sorry, “${title}” is no longer available. Nothing was charged.`);
        }

        // the $gte filter means two buyers racing for the last copy can't both take it
        const taken = await Listing.updateOne(
          { _id: listing._id, status: 'active', quantity: mongoose.trusted({ $gte: item.quantity }) },
          { $inc: { quantity: -item.quantity } },
          { session },
        );
        if (taken.modifiedCount !== 1) {
          const left = listing.status === 'active' ? listing.quantity : 0;
          const why = left > 0 ? `only ${left} left` : 'just sold out';
          throw new CheckoutError(409, `Sorry, “${title}” ${why}. Nothing was charged, and your cart has been updated.`);
        }

        const sellerId = String(listing.sellerId);
        if (!itemsBySeller.has(sellerId)) {
          itemsBySeller.set(sellerId, []);
        }
        // copy title, condition and price so later edits to the listing don't change this order
        itemsBySeller.get(sellerId).push({
          listingId: listing._id,
          titleSnapshot: title,
          conditionSnapshot: listing.condition,
          pricePaiseSnapshot: listing.pricePaise,
          quantity: item.quantity,
        });
      }

      orders = await Order.insertMany(
        [...itemsBySeller].map(([sellerId, items]) => ({
          checkoutId,
          buyerId: req.userId,
          sellerId,
          items,
          totalPaise: items.reduce((sum, i) => sum + i.pricePaiseSnapshot * i.quantity, 0),
          paymentRef,
          shipping,
        })),
        { session },
      );

      user.cart = [];
      if (saveAddress) {
        user.address = shipping;
      }
      await user.save({ session });
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  } finally {
    await session.endSession();
  }

  res.status(201).json({ checkoutId, orderIds: orders.map((o) => o._id), paymentRef });
});

export default router;
