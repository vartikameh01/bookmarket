import { Router } from 'express';
import Genre from '../models/Genre.js';

const router = Router();

router.get('/', async (req, res) => {
  const genres = await Genre.find().sort({ name: 1 }).lean();
  res.json(genres);
});

export default router;
