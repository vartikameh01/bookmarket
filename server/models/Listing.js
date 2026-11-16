import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CONDITIONS = ['new', 'like_new', 'good', 'fair'];

// last safety net under the shared validator, so code that skips the route still cannot save a bad listing
const listingSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    condition: { type: String, required: true, enum: { values: CONDITIONS, message: 'Pick a valid condition' } },
    pricePaise: {
      type: Number,
      required: true,
      min: [1000, 'Price must be between ₹10 and ₹10,000'],
      max: [1000000, 'Price must be between ₹10 and ₹10,000'],
      validate: { validator: (v) => Number.isInteger(v / 100), message: 'Price must be in whole rupees' },
    },
    // allow 0 because stock runs out through checkout, which hides the listing but keeps it for old orders
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
      max: [100, 'Quantity must be between 1 and 100'],
      validate: [
        { validator: Number.isInteger, message: 'Quantity must be a whole number' },
        {
          // skip update validators because there this is the query and the condition is unknown, and the route validator covers those
          validator(v) {
            if (!(this instanceof mongoose.Document)) return true;
            return this.condition === 'new' || v <= 1;
          },
          message: 'A used listing is always a single copy',
        },
      ],
    },
    notes: { type: String, trim: true, maxlength: [500, 'Notes can be at most 500 characters'], default: '' },
    status: { type: String, enum: ['active', 'paused', 'removed'], default: 'active' },
  },
  { timestamps: true },
);

// the book page and catalog read active offers for a book cheapest first
listingSchema.index({ bookId: 1, status: 1, pricePaise: 1 });
listingSchema.index({ sellerId: 1 });

export default mongoose.model('Listing', listingSchema);
