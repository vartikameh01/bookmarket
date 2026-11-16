import mongoose from 'mongoose';

export function apiNotFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// express 5 forwards rejected promises from async routes here, so routes don't need try/catch
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // same { errors: { field: message } } shape the listing validator returns, so forms handle both alike
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = {};
    for (const [field, fieldError] of Object.entries(err.errors)) {
      errors[field] = fieldError.message;
    }
    return res.status(400).json({ errors });
  }

  // treat a malformed id as a missing document because there is nothing to find under it
  if (err instanceof mongoose.Error.CastError) {
    return res.status(404).json({ error: 'Not found' });
  }

  // keep the 4xx status that body parser errors like broken json already carry
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.expose ? err.message : 'Bad request' });
  }

  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
}
