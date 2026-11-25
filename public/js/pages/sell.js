import { requireUser } from '../header.js';
import { api } from '../api.js';
import { setFieldError, showFieldErrors } from '../ui.js';
import { normalizeIsbn, toIsbn13 } from '../shared/isbn.js';
import { NOTES_MAX, validateListing } from '../shared/validate-listing.js';

await requireUser();

const form = document.querySelector('#sell-form');
const isbnInput = form.elements.isbn;
const isbnStatus = document.querySelector('#sell-isbn-status');
const genreSelect = form.elements.genreId;
const genreField = document.querySelector('#genre-field');
const quantityField = document.querySelector('#quantity-field');
const usedNote = document.querySelector('#used-note');
const notesCount = document.querySelector('#sell-notes-count');
const newBookFields = document.querySelector('#new-book-fields');
const formError = form.querySelector('.form-error');
const submit = form.querySelector('[type="submit"]');

const LOOKUP_DELAY_MS = 400;
const OTHER_FIELDS = ['title', 'author', 'genreId', 'condition', 'price', 'quantity', 'notes'];

// the book already on Bookmarket for this ISBN, or null
let book = null;
// true once we know the ISBN is valid but not on Bookmarket yet, so the seller types the title and author
let isNewBook = false;
let lookupTimer;
// bumped on every keystroke so a slow lookup for an old ISBN can't overwrite a newer one
let lookupSeq = 0;
// errors only show once a field has been left or the form submitted, so an empty form isn't covered in red
const touched = new Set();

function values() {
  return Object.fromEntries(new FormData(form));
}

function setIsbnState(kind, message = '', retry = false) {
  isbnStatus.className = kind && kind !== 'error' ? `isbn-status isbn-status--${kind}` : 'isbn-status';
  isbnStatus.textContent = kind === 'error' ? '' : message;
  setFieldError(form, 'isbn', kind === 'error' ? message : '');
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--small';
    button.textContent = 'Try again';
    button.addEventListener('click', () => isbnInput.dispatchEvent(new Event('input')));
    isbnStatus.append(button);
  }
}

// runs the shared validator on every change, shows errors for touched fields and unlocks submit only when all is well
function refresh() {
  const condition = form.elements.condition.value;
  quantityField.hidden = condition !== 'new';
  usedNote.hidden = !condition || condition === 'new';
  newBookFields.hidden = !isNewBook;
  genreField.hidden = !isNewBook && !(book && !book.genreId);
  notesCount.textContent = `${form.elements.notes.value.length} / ${NOTES_MAX}`;

  const { errors } = validateListing(values(), { needsGenre: !book?.genreId, newBook: isNewBook });
  for (const name of OTHER_FIELDS) {
    setFieldError(form, name, touched.has(name) ? errors[name] : '');
  }
  submit.disabled = !(book || isNewBook) || Object.keys(errors).length > 0;
}

// asks our own server whether this ISBN is already on Bookmarket
async function lookup(isbn13) {
  const seq = lookupSeq;
  try {
    const found = await api(`/isbn/${isbn13}`);
    if (seq !== lookupSeq) {
      return;
    }
    book = found;
    if (book.genreId) {
      genreSelect.value = book.genreId;
    }
    setIsbnState('ok', `Already on Bookmarket: ${book.title} by ${book.author}`);
  } catch (err) {
    if (seq !== lookupSeq) {
      return;
    }
    if (err.status === 404) {
      isNewBook = true;
      setIsbnState('new', "New book on Bookmarket. Type its title and author below.");
    } else {
      setIsbnState('error', err.message, true);
    }
  }
  refresh();
}

isbnInput.addEventListener('input', () => {
  const raw = normalizeIsbn(isbnInput.value);
  const isbn13 = toIsbn13(raw);
  lookupSeq++;
  clearTimeout(lookupTimer);
  book = null;
  isNewBook = false;

  if (!raw) {
    setIsbnState('');
  } else if (isbn13) {
    setIsbnState('loading', 'Checking…');
    lookupTimer = setTimeout(() => lookup(isbn13), LOOKUP_DELAY_MS);
  } else if (raw.length >= 13 || (raw.length === 10 && !/^97[89]/.test(raw))) {
    // a full length ISBN that fails the checksum is rejected straight away, without any network call
    setIsbnState('error', "This isn't a valid ISBN. Check it for a typo.");
  } else {
    // ten characters starting 978 is most likely an ISBN 13 still being typed
    setIsbnState('');
  }
  refresh();
});

isbnInput.addEventListener('blur', () => {
  const raw = normalizeIsbn(isbnInput.value);
  if (raw && !toIsbn13(raw)) {
    setIsbnState('error', "This isn't a valid ISBN. It should have 10 or 13 digits.");
  }
});

form.addEventListener('focusout', (event) => {
  if (OTHER_FIELDS.includes(event.target.name)) {
    touched.add(event.target.name);
    refresh();
  }
});
form.addEventListener('input', (event) => {
  if (event.target !== isbnInput) {
    refresh();
  }
});
form.addEventListener('change', (event) => {
  // a radio click counts as touched right away because radios don't lose focus on choice
  if (event.target.name === 'condition') {
    touched.add('condition');
  }
  refresh();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  OTHER_FIELDS.forEach((name) => touched.add(name));
  refresh();
  if (submit.disabled) {
    return;
  }

  formError.textContent = '';
  submit.disabled = true;
  submit.textContent = 'Listing…';
  try {
    const listing = await api('/listings', { method: 'POST', body: values() });
    location.href = `/seller/listings.html?created=${encodeURIComponent(listing._id)}`;
  } catch (err) {
    const unmatched = err.errors ? showFieldErrors(form, err.errors) : [err.message];
    formError.textContent = unmatched.join(' ');
    submit.textContent = 'List this book';
    submit.disabled = false;
  }
});

const genres = await api('/genres');
genreSelect.append(...genres.map((g) => new Option(g.name, g._id)));
// the book page links here with ?isbn= so a seller can list a copy of that book straight away
isbnInput.value ||= new URLSearchParams(location.search).get('isbn') || '';
// a pasted or remembered ISBN is already in the box when the page loads
if (isbnInput.value) {
  isbnInput.dispatchEvent(new Event('input'));
}
refresh();
