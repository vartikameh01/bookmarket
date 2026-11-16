// shared by the browser and the server, so keep this free of DOM and node only APIs

// also strip unicode dashes because ISBNs copied from web pages often use them instead of plain hyphens
export function normalizeIsbn(input) {
  return String(input ?? '')
    .replace(/[\s\u2010-\u2015-]/g, '')
    .toUpperCase();
}

// weights run 10 down to 1 and the total must divide by 11, with X standing for 10 in the last place
export function isValidIsbn10(input) {
  const isbn = normalizeIsbn(input);
  if (!/^\d{9}[\dX]$/.test(isbn)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = isbn[i] === 'X' ? 10 : Number(isbn[i]);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

function isbn13CheckDigit(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

// require the 978 or 979 book prefix, otherwise any 13 digit product barcode with a good check digit would pass
export function isValidIsbn13(input) {
  const isbn = normalizeIsbn(input);
  return /^97[89]\d{10}$/.test(isbn) && isbn13CheckDigit(isbn.slice(0, 12)) === isbn[12];
}

// returns the ISBN 13 form of any valid ISBN, or null, because books are stored and looked up by ISBN 13 only
export function toIsbn13(input) {
  const isbn = normalizeIsbn(input);
  if (isValidIsbn13(isbn)) {
    return isbn;
  }
  if (!isValidIsbn10(isbn)) {
    return null;
  }
  // every ISBN 10 maps to 978 plus its first nine digits, with the check digit worked out again
  const first12 = `978${isbn.slice(0, 9)}`;
  return first12 + isbn13CheckDigit(first12);
}
