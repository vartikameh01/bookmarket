import { Router } from 'express';
import mongoose from 'mongoose';
import Listing from '../models/Listing.js';
import Book from '../models/Book.js';
import Genre from '../models/Genre.js';
import { toIsbn13 } from '../../public/js/shared/isbn.js';
import { CONDITIONS } from '../../public/js/shared/validate-listing.js';

const router = Router();

const PAGE_SIZE = 12;
const MAX_LIMIT = 24;
const USED = CONDITIONS.filter((c) => c !== 'new');
// _id last so books with the same price or date keep a stable order across pages
const SORTS = {
  newest: { lastListedAt: -1, _id: 1 },
  price_asc: { minPricePaise: 1, _id: 1 },
  price_desc: { minPricePaise: -1, _id: 1 },
};

// escape the search text so characters like ( or * are matched literally, which also stops slow pathological patterns
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function rupeesToPaise(value) {
  const n = Number(String(value ?? '').trim());
  return String(value ?? '').trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

// book level filters (search and genre) become a list of book ids, everything else filters the listings themselves
async function matchingBookIds(q, genreSlug) {
  const filter = {};
  if (q) {
    const isbn13 = toIsbn13(q);
    if (isbn13) {
      filter.isbn13 = isbn13;
    } else {
      const words = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: words }, { author: words }];
      // a partly typed ISBN also matches books whose ISBN starts with those digits
      const digits = q.replace(/[\s-]/g, '');
      if (/^\d{3,12}$/.test(digits)) {
        filter.$or.push({ isbn13: new RegExp(`^${digits}`) });
      }
    }
  }
  if (genreSlug) {
    const genre = await Genre.findOne({ slug: genreSlug });
    if (!genre) {
      return [];
    }
    filter.genreId = genre._id;
  }
  return Object.keys(filter).length ? Book.find(filter).distinct('_id') : null;
}

// start from listings because a book appears only while someone is selling it
router.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  const genre = String(req.query.genre ?? '').trim();
  const sort = Object.hasOwn(SORTS, req.query.sort) ? req.query.sort : 'newest';
  const limit = Math.min(toPositiveInt(req.query.limit, PAGE_SIZE), MAX_LIMIT);
  const page = toPositiveInt(req.query.page, 1);

  // only buyable listings decide which books show up and their prices
  const match = { status: 'active', quantity: { $gt: 0 } };

  const conditions = String(req.query.condition ?? '')
    .split(',')
    .flatMap((c) => (c === 'used' ? USED : [c]))
    .filter((c) => CONDITIONS.includes(c));
  if (conditions.length) {
    match.condition = { $in: [...new Set(conditions)] };
  }

  const minPaise = rupeesToPaise(req.query.min);
  const maxPaise = rupeesToPaise(req.query.max);
  if (minPaise !== null || maxPaise !== null) {
    match.pricePaise = {};
    if (minPaise !== null) match.pricePaise.$gte = minPaise;
    if (maxPaise !== null) match.pricePaise.$lte = maxPaise;
  }

  const bookIds = await matchingBookIds(q, genre);
  if (bookIds) {
    match.bookId = { $in: bookIds };
  }

  const [result] = await Listing.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$bookId',
        minPricePaise: { $min: '$pricePaise' },
        offerCount: { $sum: 1 },
        lastListedAt: { $max: '$createdAt' },
      },
    },
    { $sort: SORTS[sort] },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $lookup: { from: Book.collection.name, localField: '_id', foreignField: '_id', as: 'book' } },
          { $unwind: '$book' },
          {
            $project: {
              _id: 1,
              isbn13: '$book.isbn13',
              title: '$book.title',
              author: '$book.author',
              coverUrl: '$book.coverUrl',
              genreId: '$book.genreId',
              minPricePaise: 1,
              offerCount: 1,
              lastListedAt: 1,
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const total = result.total[0]?.count ?? 0;
  res.json({ items: result.items, total, page, pages: Math.ceil(total / limit) });
});

// average to one decimal for display, null when nobody has rated the seller yet
function sellerSummary(seller) {
  const rating = seller.ratingCount ? Math.round((seller.ratingSum / seller.ratingCount) * 10) / 10 : null;
  return { _id: seller._id, name: seller.name, rating, ratingCount: seller.ratingCount };
}

// a book with nothing on sale still loads, because old orders link to it
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Book not found' });
  }
  const book = await Book.findById(req.params.id).populate('genreId', 'name slug').lean();
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const listings = await Listing.find({ bookId: book._id, status: 'active', quantity: mongoose.trusted({ $gt: 0 }) })
    .sort({ pricePaise: 1, createdAt: 1 })
    .populate('sellerId', 'name ratingSum ratingCount')
    .lean();

  const { genreId, ...rest } = book;
  res.json({
    ...rest,
    genre: genreId,
    offers: listings.map((l) => ({
      _id: l._id,
      condition: l.condition,
      pricePaise: l.pricePaise,
      quantity: l.quantity,
      notes: l.notes,
      createdAt: l.createdAt,
      seller: sellerSummary(l.sellerId),
    })),
  });
});

export default router;
