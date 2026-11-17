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
class OrderError extends Error {
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
        throw new OrderError(400, 'Your cart is empty');
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
          throw new OrderError(409, `Sorry, “${title}” is no longer available. Nothing was charged.`);
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
          throw new OrderError(409, `Sorry, “${title}” ${why}. Nothing was charged, and your cart has been updated.`);
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
    if (err instanceof OrderError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  } finally {
    await session.endSession();
  }

  res.status(201).json({ checkoutId, orderIds: orders.map((o) => o._id), paymentRef });
});

// covers come from the listing's book, so an order still shows them even after the listing is removed
export const WITH_BOOKS = {
  path: 'items.listingId',
  select: 'bookId',
  populate: { path: 'bookId', select: 'coverUrl' },
};

// the shape both the buyer and seller pages read, with snapshot names shortened
export function orderView(order) {
  const person = (user) => (user?._id ? { _id: user._id, name: user.name } : null);
  return {
    _id: order._id,
    checkoutId: String(order.checkoutId),
    status: order.status,
    totalPaise: order.totalPaise,
    paymentRef: order.paymentRef,
    shipping: order.shipping,
    rating: order.rating ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    seller: person(order.sellerId),
    buyer: person(order.buyerId),
    items: order.items.map((item) => {
      const book = item.listingId?.bookId;
      return {
        title: item.titleSnapshot,
        condition: item.conditionSnapshot,
        pricePaise: item.pricePaiseSnapshot,
        quantity: item.quantity,
        book: book?._id ? { _id: book._id, coverUrl: book.coverUrl } : null,
      };
    }),
  };
}

function findOwnOrder(req) {
  return Order.findOne({ _id: req.params.id, buyerId: req.userId }).populate('sellerId', 'name').populate(WITH_BOOKS).lean();
}

router.get('/', async (req, res) => {
  const orders = await Order.find({ buyerId: req.userId })
    .sort({ createdAt: -1 })
    .populate('sellerId', 'name')
    .populate(WITH_BOOKS)
    .lean();
  res.json(orders.map(orderView));
});

router.get('/:id', async (req, res) => {
  // another buyer's order gets the same 404 as a missing one
  const order = mongoose.isValidObjectId(req.params.id) ? await findOwnOrder(req) : null;
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(orderView(order));
});

/**
 * Cancel and restock in one transaction so the copies can't be lost or counted twice.
 * The status filter on the update stops a cancel racing the seller marking it shipped.
 */
router.post('/:id/cancel', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Order not found' });
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: req.params.id, buyerId: req.userId }).session(session);
      if (!order) {
        throw new OrderError(404, 'Order not found');
      }
      const result = await Order.updateOne(
        { _id: order._id, buyerId: req.userId, status: 'placed' },
        { $set: { status: 'cancelled' } },
        { session },
      );
      if (result.modifiedCount !== 1) {
        throw new OrderError(409, `This order is already ${order.status}, so it can't be cancelled.`);
      }
      for (const item of order.items) {
        await Listing.updateOne({ _id: item.listingId }, { $inc: { quantity: item.quantity } }, { session });
      }
    });
  } catch (err) {
    if (err instanceof OrderError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  } finally {
    await session.endSession();
  }

  res.json(orderView(await findOwnOrder(req)));
});

const COMMENT_MAX = 300;

router.post('/:id/rating', async (req, res) => {
  const stars = Number(req.body.stars);
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  const errors = {};
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    errors.stars = 'Pick 1 to 5 stars';
  }
  if (comment.length > COMMENT_MAX) {
    errors.comment = `Comment can be at most ${COMMENT_MAX} characters`;
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: req.params.id, buyerId: req.userId }).session(session);
      if (!order) {
        throw new OrderError(404, 'Order not found');
      }
      if (order.rating) {
        throw new OrderError(409, 'You have already rated this order.');
      }
      if (order.status !== 'delivered') {
        throw new OrderError(400, 'You can rate the seller once the order is delivered.');
      }
      // rating: null in the filter means a double click can't add the stars to the seller twice
      const result = await Order.updateOne(
        { _id: order._id, buyerId: req.userId, status: 'delivered', rating: null },
        { $set: { rating: { stars, comment, createdAt: new Date() } } },
        { session },
      );
      if (result.modifiedCount !== 1) {
        throw new OrderError(409, 'You have already rated this order.');
      }
      await User.updateOne({ _id: order.sellerId }, { $inc: { ratingSum: stars, ratingCount: 1 } }, { session });
    });
  } catch (err) {
    if (err instanceof OrderError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  } finally {
    await session.endSession();
  }

  res.status(201).json(orderView(await findOwnOrder(req)));
});

export default router;
