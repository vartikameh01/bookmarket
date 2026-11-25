import { Router } from 'express';
import mongoose from 'mongoose';
import Book from '../models/Book.js';
import Genre from '../models/Genre.js';
import Listing from '../models/Listing.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { toIsbn13 } from '../../public/js/shared/isbn.js';
import { validateListing } from '../../public/js/shared/validate-listing.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  // find the book first: a new ISBN needs a title, author and genre, a known one only a genre if it has none yet
  const isbn13 = toIsbn13(req.body.isbn);
  let book = isbn13 ? await Book.findOne({ isbn13 }) : null;

  const { value, errors } = validateListing(req.body, { needsGenre: !book?.genreId, newBook: !book });
  if (value.genreId && !(await Genre.exists({ _id: value.genreId }))) {
    errors.genreId = 'Pick a genre from the list';
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  if (!book) {
    // the first seller of an ISBN creates the book from what they typed
    try {
      book = await Book.create({ isbn13, title: value.title, author: value.author, genreId: value.genreId });
    } catch (err) {
      // two sellers listing the same new ISBN at once both reach create, and the unique index lets only one win
      if (err.code !== 11000) {
        throw err;
      }
      book = await Book.findOne({ isbn13 });
    }
  } else if (value.genreId) {
    // the filter keeps the first seller's choice if two sellers pick a genre at the same moment
    await Book.updateOne({ _id: book._id, genreId: null }, { $set: { genreId: value.genreId } });
  }

  const listing = await Listing.create({
    bookId: book._id,
    sellerId: req.userId,
    condition: value.condition,
    pricePaise: value.pricePaise,
    quantity: value.quantity,
    notes: value.notes,
  });
  res.status(201).json(listing);
});

// wrap in trusted because sanitizeFilter would otherwise turn our own $ne into a literal value
const NOT_REMOVED = () => mongoose.trusted({ $ne: 'removed' });

// removed listings are gone for the seller too, but stay in the database so old orders still point at them
function findOwnListing(req) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return null;
  }
  return Listing.findOne({ _id: req.params.id, sellerId: req.userId, status: NOT_REMOVED() });
}

const BOOK_FIELDS = 'title author isbn13';

router.get('/mine', async (req, res) => {
  const listings = await Listing.find({ sellerId: req.userId, status: NOT_REMOVED() })
    .sort({ createdAt: -1 })
    .populate('bookId', BOOK_FIELDS)
    .lean();
  res.json(listings.map(({ bookId, ...listing }) => ({ ...listing, book: bookId })));
});

router.get('/:id', async (req, res) => {
  const listing = await findOwnListing(req)?.populate('bookId', BOOK_FIELDS).lean();
  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }
  const { bookId, ...rest } = listing;
  res.json({ ...rest, book: bookId });
});

router.patch('/:id', async (req, res) => {
  // someone else's listing gets the same 404 as a missing one, so ids can't be probed
  const listing = await findOwnListing(req);
  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  // pass the saved condition so a used listing can't be edited above one copy, which the schema skips on updates
  const { value, errors } = validateListing(req.body, { existing: { condition: listing.condition } });
  if (req.body.status !== undefined && !['active', 'paused'].includes(req.body.status)) {
    errors.status = 'Status must be active or paused';
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  listing.set(value);
  if (req.body.status !== undefined) {
    listing.status = req.body.status;
  }
  // save only writes the changed paths, so a checkout lowering the stock meanwhile isn't overwritten unless quantity was edited
  await listing.save();
  res.json(listing);
});

// soft delete because orders keep pointing at the listing
router.delete('/:id', async (req, res) => {
  const listing = await findOwnListing(req);
  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }
  listing.status = 'removed';
  await listing.save();
  res.status(204).end();
});

export default router;
