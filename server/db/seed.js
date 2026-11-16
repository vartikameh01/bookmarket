// wipes the database in MONGODB_URI and fills it with demo data.
// run with: npm run seed
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDb } from './connect.js';
import User from '../models/User.js';
import Genre from '../models/Genre.js';
import Book from '../models/Book.js';
import Listing from '../models/Listing.js';
import Order from '../models/Order.js';

const GENRES = [
  { name: 'Programming', slug: 'programming' },
  { name: 'Fiction', slug: 'fiction' },
  { name: 'Indian Writing', slug: 'indian-writing' },
  { name: 'Exam Prep', slug: 'exam-prep' },
  { name: 'Self Help', slug: 'self-help' },
  { name: 'Science & History', slug: 'science-history' },
  { name: 'Business', slug: 'business' },
  { name: 'Biography', slug: 'biography' },
];

const PASSWORD = 'demo1234';
const DEMO_ISBN = '9780131103627';

// seller1 is seller A and seller2 is seller B in the demo script
const SELLERS = [
  { name: 'Aarav Sharma', email: 'seller1@example.com' },
  { name: 'Priya Nair', email: 'seller2@example.com' },
  { name: 'Rohan Gupta', email: 'seller3@example.com' },
  { name: 'Meera Iyer', email: 'seller4@example.com' },
];
const BUYER = {
  name: 'Kavya Singh',
  email: 'buyer@example.com',
  address: {
    name: 'Kavya Singh',
    phone: '9876543210',
    line1: '14, Green Park Extension',
    line2: 'Near Metro Gate 2',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110016',
  },
};

// books that always get three offers so the offer comparison table has something to show
const FEATURED = ['9780262033848', '9780735211292', '9788173711466', '9780062315007', '9788129104595'];

const USED_NOTES = [
  'Some pencil highlighting in the first few chapters.',
  'Previous owner\'s name on the first page.',
  'Cover slightly worn at the corners, pages clean.',
  'Spine has light creases, otherwise like new.',
  '',
  '',
];
const RATINGS = [
  { stars: 5, comment: 'Book arrived well packed and exactly as described.' },
  { stars: 4, comment: 'Good condition, shipping took a couple of extra days.' },
  { stars: 5, comment: '' },
];

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

// fixed seed so every reseed produces the same listings and prices
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(42);
const randInt = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (items) => items[Math.floor(random() * items.length)];
function weighted(options) {
  let r = random() * options.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of options) {
    r -= weight;
    if (r < 0) return value;
  }
  return options.at(-1)[0];
}
function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const newId = () => new mongoose.Types.ObjectId();

const PRICE_FACTOR = { new: 1, like_new: 0.75, good: 0.6, fair: 0.45 };
const TEXTBOOK_GENRES = new Set(['programming', 'exam-prep']);

function buildListings(books, sellers) {
  const listings = [];
  for (const book of books) {
    const mrp = TEXTBOOK_GENRES.has(book.genre)
      ? pick([449, 499, 599, 699, 799, 899, 999, 1199])
      : pick([199, 249, 299, 349, 399, 449, 499, 599]);
    const offerCount = FEATURED.includes(book.isbn13) ? 3 : weighted([[1, 55], [2, 35], [3, 10]]);
    // keep seller A off the demo book so selling it live adds a fresh offer
    const eligible = book.isbn13 === DEMO_ISBN ? sellers.slice(1) : sellers;

    for (const seller of shuffled(eligible).slice(0, offerCount)) {
      const condition = weighted([['new', 30], ['like_new', 25], ['good', 30], ['fair', 15]]);
      const jitter = 0.9 + random() * 0.2;
      const rupees = Math.max(50, Math.round((mrp * PRICE_FACTOR[condition] * jitter) / 10) * 10);
      const createdAt = new Date(now - random() * 30 * DAY);
      listings.push({
        _id: newId(),
        bookId: book._id,
        sellerId: seller._id,
        condition,
        pricePaise: rupees * 100,
        quantity: condition === 'new' ? randInt(1, 10) : 1,
        notes: condition === 'new' ? '' : pick(USED_NOTES),
        status: 'active',
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  return listings;
}

// past delivered and rated orders from the buyer, one each to the first three sellers so seller4 shows "no ratings yet"
function buildOrders(listings, books, sellers, buyer) {
  const bookById = new Map(books.map((b) => [String(b._id), b]));
  const orders = [];

  sellers.slice(0, 3).forEach((seller, i) => {
    const placedAt = new Date(now - (20 - i * 5) * DAY);
    const candidates = listings.filter((l) => l.sellerId === seller._id && l.quantity > 0 && l.createdAt < placedAt);
    const chosen = shuffled(candidates).slice(0, i === 1 ? 2 : 1);
    if (chosen.length === 0) throw new Error(`seller ${seller.email} has no listing old enough for a past order`);

    const items = chosen.map((listing) => {
      listing.quantity -= 1;
      return {
        listingId: listing._id,
        titleSnapshot: bookById.get(String(listing.bookId)).title,
        conditionSnapshot: listing.condition,
        pricePaiseSnapshot: listing.pricePaise,
        quantity: 1,
      };
    });
    const deliveredAt = new Date(placedAt.getTime() + 4 * DAY);

    orders.push({
      checkoutId: newId(),
      buyerId: buyer._id,
      sellerId: seller._id,
      items,
      totalPaise: items.reduce((sum, item) => sum + item.pricePaiseSnapshot * item.quantity, 0),
      paymentRef: `MOCK-${Math.floor(random() * 36 ** 6).toString(36).toUpperCase().padStart(6, '0')}`,
      shipping: buyer.address,
      status: 'delivered',
      rating: { ...RATINGS[i], createdAt: new Date(deliveredAt.getTime() + DAY) },
      createdAt: placedAt,
      updatedAt: deliveredAt,
    });
    seller.ratingSum += RATINGS[i].stars;
    seller.ratingCount += 1;
  });
  return orders;
}

const seedBooks = JSON.parse(await fs.readFile(path.join(import.meta.dirname, 'seed-books.json'), 'utf8'));

await connectDb();
const { host, name: dbName } = mongoose.connection;
console.log(`seeding ${dbName} on ${host}`);

const models = [User, Genre, Book, Listing, Order];
for (const model of models) await model.deleteMany({});
// clear logins too because their user ids are about to stop existing
await mongoose.connection.db.collection('sessions').deleteMany({});
for (const model of models) await model.syncIndexes();

const genres = GENRES.map((g) => ({ _id: newId(), ...g }));
const genreIdBySlug = new Map(genres.map((g) => [g.slug, g._id]));

const books = seedBooks.map(({ genre, ...book }) => {
  if (!genreIdBySlug.has(genre)) throw new Error(`seed book ${book.isbn13} has unknown genre ${genre}`);
  return { _id: newId(), ...book, genre, genreId: genreIdBySlug.get(genre), createdAt: new Date(now - 31 * DAY) };
});

const passwordHash = await bcrypt.hash(PASSWORD, 10);
const sellers = SELLERS.map((s) => ({ _id: newId(), ...s, passwordHash, ratingSum: 0, ratingCount: 0 }));
const buyer = { _id: newId(), ...BUYER, passwordHash };

const listings = buildListings(books, sellers);
const orders = buildOrders(listings, books, sellers, buyer);

await Genre.insertMany(genres);
await Book.insertMany(books.map(({ genre, ...book }) => book));
await User.insertMany([...sellers, buyer]);
await Listing.insertMany(listings);
await Order.insertMany(orders);

for (const model of models) {
  console.log(`${model.collection.name.padEnd(9)} ${await model.countDocuments()}`);
}
console.log(`\nall accounts use password ${PASSWORD}: ${[...sellers, buyer].map((u) => u.email).join(', ')}`);
console.log(`demo isbn ${DEMO_ISBN} (The C Programming Language) is cached and seller1 has no offer on it`);

await mongoose.disconnect();
