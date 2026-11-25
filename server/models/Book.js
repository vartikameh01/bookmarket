import mongoose from 'mongoose';

const { Schema } = mongoose;

// one document per ISBN, created by the first seller who lists it and shared by every seller's listing
const bookSchema = new Schema(
  {
    isbn13: { type: String, required: true, unique: true, match: [/^97[89]\d{10}$/, 'Not an ISBN 13'] },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    // several authors are kept as one display string, like "Kernighan, Ritchie"
    author: { type: String, required: true, trim: true, maxlength: 200 },
    // only the demo books have these three, sellers aren't asked for them
    publisher: { type: String, trim: true, default: '' },
    publishedYear: { type: Number, default: null },
    pages: { type: Number, min: 1, default: null },
    // the first seller to list the book picks this, so it starts empty
    genreId: { type: Schema.Types.ObjectId, ref: 'Genre', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model('Book', bookSchema);
