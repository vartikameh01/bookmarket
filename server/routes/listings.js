import { Router } from 'express';
import Book from '../models/Book.js';
import Genre from '../models/Genre.js';
import Listing from '../models/Listing.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { toIsbn13 } from '../../public/js/shared/isbn.js';
import { validateListing } from '../../public/js/shared/validate-listing.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  // find the book first because the genre is only asked for when the book doesn't have one yet
  const isbn13 = toIsbn13(req.body.isbn);
  const book = isbn13 ? await Book.findOne({ isbn13 }) : null;

  const { value, errors } = validateListing(req.body, { needsGenre: !book?.genreId });
  if (isbn13 && !book) {
    // the lookup route is the only way a book gets into the collection
    errors.isbn = 'Look this ISBN up first so we can check it on Open Library';
  }
  if (value.genreId && !(await Genre.exists({ _id: value.genreId }))) {
    errors.genreId = 'Pick a genre from the list';
  }
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  if (value.genreId) {
    // the filter keeps the first seller's choice if two sellers list a new book at the same moment
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

export default router;
