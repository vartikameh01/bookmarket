// one off script that turns the isbn list below into seed-books.json, so seeding never needs the internet.
// run with: node server/db/fetch-seed-books.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { lookupIsbn } from '../services/openLibrary.js';

// open library is wiki edited, so isbns whose record was missing, vandalized or credited translators as authors were taken out of this list
const CANDIDATES = {
  programming: [
    '9780131103627', // the c programming language, used in the demo
    '9780262033848', '9780132350884', '9780201633610', '9781593279509',
    '9780596517748', '9781449355739', '9780596007126', '9780134685991',
    '9780262510875', '9781449373320', '9780132126953', '9781118063330', '9780073523323',
    '9780321573513', '9780984782857', '9780201485677',
  ],
  fiction: [
    '9780061120084', '9780451524935', '9780743273565', '9780141439518',
    '9780547928227', '9780062315007', '9780439708180', '9780307474278', '9780385490818',
    '9780060850524', '9781594631931',
  ],
  'indian-writing': [
    '9780060977498', '9781416562603', '9780099578512', '9780060786526', '9780618485222',
    '9780395927205', '9788129104595', '9788129115300', '9788129118806', '9789380658742',
    '9780143039655', '9780312428594', '9780143062226', '9780140449181',
  ],
  'exam-prep': [
    '9788121924986', '9780671741907', '9788177091878',
  ],
  'self-help': [
    '9780735211292', '9780743269513', '9780671027032', '9781585424337',
    '9781455586691',
  ],
  'science-history': [
    '9780553380163', '9780062316097', '9780393317558', '9780345539434',
    '9780199291151', '9780465026562',
  ],
  business: [
    '9780374533557', '9780804139298', '9780307887894',
    '9780066620992',
  ],
  biography: [
    '9788173711466', '9781451648539', '9781524763138', '9780807014271',
    '9780553296983', '9780807059098', '9780316548182',
  ],
};

const OUT_FILE = path.join(import.meta.dirname, 'seed-books.json');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const books = [];
const dropped = [];

for (const [genre, isbns] of Object.entries(CANDIDATES)) {
  for (const isbn13 of isbns) {
    let book;
    try {
      book = await lookupIsbn(isbn13);
    } catch (err) {
      // retry once because open library times out now and then under load
      await sleep(2000);
      book = await lookupIsbn(isbn13).catch(() => undefined);
    }

    if (book === undefined) dropped.push(`${isbn13} lookup failed`);
    else if (book === null) dropped.push(`${isbn13} not on Open Library`);
    // skip books without covers because every card and book page shows one
    else if (!book.coverUrl) dropped.push(`${isbn13} no cover (${book.title})`);
    else {
      books.push({ ...book, genre });
      console.log(`ok   ${isbn13} ${book.title} by ${book.author}`);
    }

    // stay well under open library's request rate limit
    await sleep(300);
  }
}

for (const line of dropped) console.log(`drop ${line}`);
await fs.writeFile(OUT_FILE, JSON.stringify(books, null, 2) + '\n');
console.log(`\nwrote ${books.length} books to ${path.relative(process.cwd(), OUT_FILE)}, dropped ${dropped.length}`);
