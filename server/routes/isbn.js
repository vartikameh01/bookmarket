import { Router } from 'express';
import Book from '../models/Book.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { lookupIsbn } from '../services/openLibrary.js';
import { toIsbn13 } from '../../public/js/shared/isbn.js';

const router = Router();

router.get('/:isbn', requireAuth, async (req, res) => {
  // reject a bad checksum before any network call
  const isbn13 = toIsbn13(req.params.isbn);
  if (!isbn13) {
    return res.status(400).json({ error: "This isn't a valid ISBN. Check it for a typo." });
  }

  // books already in our collection skip open library, which also makes repeat lookups instant
  const known = await Book.findOne({ isbn13 });
  if (known) {
    return res.json(known);
  }

  let found;
  try {
    found = await lookupIsbn(isbn13);
  } catch (err) {
    console.error(`open library lookup failed for ${isbn13}: ${err.message}`);
    return res.status(503).json({ error: 'Book lookup is unavailable, please try again in a minute.' });
  }
  if (!found) {
    return res.status(404).json({ error: "We couldn't find this ISBN on Open Library, so it can't be listed." });
  }

  try {
    res.json(await Book.create(found));
  } catch (err) {
    // two sellers looking up the same new ISBN at once both reach create, and the unique index lets only one win
    if (err.code === 11000) {
      return res.json(await Book.findOne({ isbn13 }));
    }
    throw err;
  }
});

export default router;
