import path from 'node:path';
import express from 'express';

const app = express();

app.use(express.json());
app.use(express.static(path.join(import.meta.dirname, '../public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

export default app;
