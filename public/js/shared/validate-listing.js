// imported by the sell form for instant feedback and by the server as the final check, so the rules live only here
import { toIsbn13 } from './isbn.js';

export const CONDITIONS = ['new', 'like_new', 'good', 'fair'];
export const CONDITION_LABELS = { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair' };
export const PRICE_MIN = 10;
export const PRICE_MAX = 10000;
export const QUANTITY_MAX = 100;
export const NOTES_MAX = 500;
export const TITLE_MAX = 200;
export const AUTHOR_MAX = 200;

const OBJECT_ID = /^[a-f\d]{24}$/i;

function isBlank(value) {
  return String(value ?? '').trim() === '';
}

// accepts form strings and json numbers alike, and gives NaN for anything that isn't a plain whole number
function toWholeNumber(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : NaN;
  }
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) ? Number(text) : NaN;
}

/**
 * Returns { value, errors }. value holds only clean fields ready to save, with the price in paise.
 * Pass existing: { condition } when editing, which skips isbn, genre and condition and only checks the fields sent.
 * Pass needsGenre: false when the book already has a genre, because only the first seller picks it.
 * Pass newBook: true when the ISBN isn't on Bookmarket yet, so the seller has to type the title and author.
 */
export function validateListing(input = {}, { existing = null, needsGenre = true, newBook = false } = {}) {
  const value = {};
  const errors = {};
  const editing = Boolean(existing);
  const has = (key) => !editing || input[key] !== undefined;

  if (!editing) {
    const isbn13 = toIsbn13(input.isbn);
    if (isBlank(input.isbn)) {
      errors.isbn = 'Enter the ISBN from the back cover';
    } else if (!isbn13) {
      errors.isbn = "This isn't a valid ISBN. Check it for a typo.";
    } else {
      value.isbn13 = isbn13;
    }

    if (newBook) {
      // squash repeated spaces so "The  C   Language" is saved neatly
      const title = String(input.title ?? '').trim().replace(/\s+/g, ' ');
      const author = String(input.author ?? '').trim().replace(/\s+/g, ' ');
      if (!title) {
        errors.title = 'Enter the book title';
      } else if (title.length > TITLE_MAX) {
        errors.title = `Title can be at most ${TITLE_MAX} characters`;
      } else {
        value.title = title;
      }
      if (!author) {
        errors.author = 'Enter the author';
      } else if (author.length > AUTHOR_MAX) {
        errors.author = `Author can be at most ${AUTHOR_MAX} characters`;
      } else {
        value.author = author;
      }
    }

    if (needsGenre) {
      if (OBJECT_ID.test(String(input.genreId ?? ''))) {
        value.genreId = String(input.genreId);
      } else {
        errors.genreId = 'Pick a genre';
      }
    }

    if (CONDITIONS.includes(input.condition)) {
      value.condition = input.condition;
    } else {
      errors.condition = 'Pick the condition of your copy';
    }
  }

  if (has('price')) {
    const price = toWholeNumber(input.price);
    if (isBlank(input.price)) {
      errors.price = 'Enter a price';
    } else if (Number.isNaN(price)) {
      errors.price = 'Price must be in whole rupees';
    } else if (price < PRICE_MIN || price > PRICE_MAX) {
      errors.price = 'Price must be between ₹10 and ₹10,000';
    } else {
      value.pricePaise = price * 100;
    }
  }

  const condition = editing ? existing.condition : value.condition;
  if (condition === 'new') {
    if (has('quantity')) {
      const quantity = toWholeNumber(input.quantity);
      if (isBlank(input.quantity)) {
        errors.quantity = 'Enter how many copies you have';
      } else if (Number.isNaN(quantity) || quantity < 1 || quantity > QUANTITY_MAX) {
        errors.quantity = 'Quantity must be a whole number from 1 to 100';
      } else {
        value.quantity = quantity;
      }
    }
  } else if (condition && !editing) {
    // a used copy is one of a kind, so whatever quantity was sent becomes 1
    value.quantity = 1;
  }
  // editing a used listing leaves quantity out entirely, so a copy that already sold can't be put back on sale

  if (has('notes')) {
    const notes = String(input.notes ?? '').trim();
    if (notes.length > NOTES_MAX) {
      errors.notes = `Notes can be at most ${NOTES_MAX} characters`;
    } else {
      value.notes = notes;
    }
  }

  return { value, errors };
}
