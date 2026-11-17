import { Router } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { orderView, WITH_BOOKS } from './orders.js';

const router = Router();
router.use(requireAuth);

const STATUSES = ['placed', 'shipped', 'delivered', 'cancelled'];
// the only moves a seller can make, one step at a time
const NEXT = { placed: 'shipped', shipped: 'delivered' };

router.get('/', async (req, res) => {
  const filter = { sellerId: req.userId };
  if (STATUSES.includes(req.query.status)) {
    filter.status = req.query.status;
  }
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .populate('buyerId', 'name')
    .populate(WITH_BOOKS)
    .lean();
  res.json(orders.map(orderView));
});

router.get('/summary', async (req, res) => {
  // aggregation pipelines skip sanitizeFilter, and the id has to be cast by hand because $match doesn't cast
  const byStatus = await Order.aggregate([
    { $match: { sellerId: new mongoose.Types.ObjectId(String(req.userId)) } },
    { $group: { _id: '$status', totalPaise: { $sum: '$totalPaise' }, count: { $sum: 1 } } },
  ]);
  const of = (status) => byStatus.find((s) => s._id === status) ?? { totalPaise: 0, count: 0 };
  const seller = await User.findById(req.userId, 'ratingSum ratingCount').lean();

  res.json({
    // money only counts as earned once the buyer has the book
    earnedPaise: of('delivered').totalPaise,
    pendingPaise: of('placed').totalPaise + of('shipped').totalPaise,
    toShip: of('placed').count,
    orderCount: of('placed').count + of('shipped').count + of('delivered').count,
    cancelledCount: of('cancelled').count,
    rating: seller.ratingCount ? Math.round((seller.ratingSum / seller.ratingCount) * 10) / 10 : null,
    ratingCount: seller.ratingCount,
  });
});

router.patch('/:orderId', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orderId)) {
    return res.status(404).json({ error: 'Order not found' });
  }
  // another seller's order gets the same 404 as a missing one
  const order = await Order.findOne({ _id: req.params.orderId, sellerId: req.userId });
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const wanted = String(req.body.status ?? '');
  if (NEXT[order.status] !== wanted) {
    const allowed = NEXT[order.status] ? `It can only be marked ${NEXT[order.status]} next.` : 'It is already final.';
    return res.status(400).json({ error: `This order is ${order.status}, so it can't be marked ${wanted || 'that'}. ${allowed}` });
  }

  // the status filter catches a buyer cancelling between our read and this write
  const result = await Order.updateOne({ _id: order._id, sellerId: req.userId, status: order.status }, { $set: { status: wanted } });
  if (result.modifiedCount !== 1) {
    return res.status(409).json({ error: 'This order changed while you were looking at it, maybe the buyer cancelled. Refresh to see it.' });
  }

  const updated = await Order.findById(order._id).populate('buyerId', 'name').populate(WITH_BOOKS).lean();
  res.json(orderView(updated));
});

export default router;
