import mongoose from 'mongoose';
import { addressSchema } from './User.js';
import { CONDITIONS } from './Listing.js';

const { Schema } = mongoose;

// snapshot the title, condition and price so later edits to the listing don't rewrite old orders
const orderItemSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    titleSnapshot: { type: String, required: true },
    conditionSnapshot: { type: String, required: true, enum: CONDITIONS },
    pricePaiseSnapshot: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const ratingSchema = new Schema(
  {
    stars: {
      type: Number,
      required: true,
      min: [1, 'Rating must be 1 to 5 stars'],
      max: [5, 'Rating must be 1 to 5 stars'],
      validate: { validator: Number.isInteger, message: 'Rating must be 1 to 5 stars' },
    },
    comment: { type: String, trim: true, maxlength: [300, 'Comment can be at most 300 characters'], default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// one order per seller per checkout, and checkoutId ties together the orders from one payment
const orderSchema = new Schema(
  {
    checkoutId: { type: Schema.Types.ObjectId, required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      validate: { validator: (items) => items.length > 0, message: 'An order needs at least one item' },
    },
    totalPaise: { type: Number, required: true, min: 0 },
    paymentRef: { type: String, required: true },
    shipping: { type: addressSchema, required: true },
    status: { type: String, enum: ['placed', 'shipped', 'delivered', 'cancelled'], default: 'placed' },
    rating: { type: ratingSchema, default: null },
  },
  { timestamps: true },
);

orderSchema.index({ buyerId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);
