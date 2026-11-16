import mongoose from 'mongoose';

const { Schema } = mongoose;

// one document per ISBN, filled only from Open Library lookups and shared by every seller's listing
const bookSchema = new Schema(
  {
    isbn13: { type: String, required: true, unique: true, match: [/^97[89]\d{10}$/, 'Not an ISBN 13'] },
    title: { type: String, required: true, trim: true },
    // open library can list several authors, so they are joined into one display string
    author: { type: String, required: true, trim: true },
    publisher: { type: String, trim: true, default: '' },
    publishedYear: { type: Number, default: null },
    pages: { type: Number, min: 1, default: null },
    coverUrl: { type: String, default: '' },
    // the first seller to list the book picks this, so it starts empty
    genreId: { type: Schema.Types.ObjectId, ref: 'Genre', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model('Book', bookSchema);
