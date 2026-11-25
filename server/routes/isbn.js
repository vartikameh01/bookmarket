import { Router } from 'express';
import Book from '../models/Book.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { toIsbn13 } from '../../public/js/shared/isbn.js';

const router = Router();

// the sell form asks here whether an ISBN is already on Bookmarket, so it can fill in the title and author
router.get('/:isbn', requireAuth, async (req, res) => {
  const isbn13 = toIsbn13(req.params.isbn);
  if (!isbn13) {
    return res.status(400).json({ error: "This isn't a valid ISBN. Check it for a typo." });
  }

  const book = await Book.findOne({ isbn13 });
  if (!book) {
    // not an error for the seller, it just means they are the first to list this book
    return res.status(404).json({ error: 'This book is not on Bookmarket yet' });
  }
  res.json(book);
});

export default router;
