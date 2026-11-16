import { Router } from 'express';
import Listing from '../models/Listing.js';
import Book from '../models/Book.js';

const router = Router();

// only these listings can be bought, so they alone decide which books show up and their prices
const BUYABLE = { status: 'active', quantity: { $gt: 0 } };

// start from listings because a book appears only while someone is selling it
router.get('/', async (req, res) => {
  const items = await Listing.aggregate([
    { $match: BUYABLE },
    {
      $group: {
        _id: '$bookId',
        minPricePaise: { $min: '$pricePaise' },
        offerCount: { $sum: 1 },
        lastListedAt: { $max: '$createdAt' },
      },
    },
    { $lookup: { from: Book.collection.name, localField: '_id', foreignField: '_id', as: 'book' } },
    { $unwind: '$book' },
    { $sort: { lastListedAt: -1, _id: 1 } },
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
  ]);
  res.json({ items });
});

export default router;
