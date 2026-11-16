import mongoose from 'mongoose';

// strip $ operators from query filters so a login body like { "email": { "$ne": null } } can't match every user
mongoose.set('sanitizeFilter', true);

export async function connectDb(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env first.');
  }
  await mongoose.connect(uri);
  console.log('connected to MongoDB');
}

// the session store waits on this so it shares mongoose's connection instead of opening a second one
export const clientPromise = new Promise((resolve) => {
  mongoose.connection.once('connected', () => resolve(mongoose.connection.getClient()));
});
