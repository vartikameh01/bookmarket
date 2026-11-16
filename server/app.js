import path from 'node:path';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { clientPromise } from './db/connect.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import genresRouter from './routes/genres.js';
import booksRouter from './routes/books.js';
import isbnRouter from './routes/isbn.js';
import listingsRouter from './routes/listings.js';

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set. Copy .env.example to .env first.');
}

const SESSION_DAYS = 14;
const app = express();

// render puts a proxy in front of the app, so trust its https header or secure cookies never get set
app.set('trust proxy', 1);

// static files come before the session so loading css and images doesn't touch the sessions collection
app.use(express.static(path.join(import.meta.dirname, '../public')));
app.use(express.json());
app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    // only store a session once someone logs in, so anonymous visitors don't fill the collection
    saveUninitialized: false,
    store: MongoStore.create({
      clientPromise,
      ttl: SESSION_DAYS * 24 * 60 * 60,
      touchAfter: 24 * 60 * 60,
    }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    },
  }),
);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});
app.use('/api/auth', authRouter);
app.use('/api/genres', genresRouter);
app.use('/api/books', booksRouter);
app.use('/api/isbn', isbnRouter);
app.use('/api/listings', listingsRouter);

app.use('/api', apiNotFound);
app.use(errorHandler);

export default app;
