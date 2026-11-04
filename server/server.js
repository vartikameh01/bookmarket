import 'dotenv/config';
import app from './app.js';
import { connectDb } from './db/connect.js';

const port = process.env.PORT || 3000;

await connectDb();
app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
