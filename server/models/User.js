import mongoose from 'mongoose';

const { Schema } = mongoose;

// shared with Order, which copies the address in at checkout
export const addressSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, match: [/^\d{10}$/, 'Phone must be 10 digits'] },
    line1: { type: String, required: true, trim: true, maxlength: 120 },
    line2: { type: String, trim: true, maxlength: 120, default: '' },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: String, required: true, trim: true, maxlength: 60 },
    pincode: { type: String, required: true, trim: true, match: [/^\d{6}$/, 'Pincode must be 6 digits'] },
  },
  { _id: false },
);

const cartItemSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    quantity: { type: Number, required: true, min: 1, max: 100 },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    // login has to ask for it with .select('+passwordHash') because it is left out of queries by default
    passwordHash: { type: String, required: true, select: false },
    address: { type: addressSchema, default: null },
    cart: { type: [cartItemSchema], default: [] },
    // store the sum and count instead of an average so a new rating is a single $inc
    ratingSum: { type: Number, default: 0, min: 0 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      // drop the hash even from a freshly created user, which select: false does not cover
      transform(doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export default mongoose.model('User', userSchema);
