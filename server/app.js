import path from 'node:path';
import express from 'express';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import genresRouter from './routes/genres.js';
import booksRouter from './routes/books.js';

const app = express();

app.use(express.json());
app.use(express.static(path.join(import.meta.dirname, '../public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});
app.use('/api/genres', genresRouter);
app.use('/api/books', booksRouter);

app.use('/api', apiNotFound);
app.use(errorHandler);

export default app;
