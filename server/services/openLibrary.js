const BASE_URL = 'https://openlibrary.org';
const HEADERS = { 'User-Agent': 'BookMarketplace/1.0 (college project)', Accept: 'application/json' };
const AUTHOR_KEY = /^\/authors\/OL\d+A$/;
const WORK_KEY = /^\/works\/OL\d+W$/;

async function getJson(path, signal) {
  const res = await fetch(BASE_URL + path, { headers: HEADERS, signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Library returned ${res.status} for ${path}`);
  return res.json();
}

async function authorName(key, signal) {
  let author = await getJson(`${key}.json`, signal);
  // merged authors leave a redirect record behind that points at the surviving one
  if (author?.type?.key === '/type/redirect' && AUTHOR_KEY.test(author.location)) {
    author = await getJson(`${author.location}.json`, signal);
  }
  return author?.name?.trim() || null;
}

// look up an ISBN 13 and return our book fields, or null when Open Library has no usable record.
// use the /isbn endpoint over /api/books because a spam edition claiming 9780131103627 hijacked /api/books in Nov 2026.
// throws on network errors and timeouts so the caller can answer 503 instead of "not found".
export async function lookupIsbn(isbn13) {
  // one deadline for the whole lookup, which can take a few requests
  const signal = AbortSignal.timeout(10000);

  const edition = await getJson(`/isbn/${isbn13}.json`, signal);
  const title = edition?.title?.trim();
  if (!title) return null;

  const firstCover = (record) => (record?.covers ?? []).find((id) => id > 0);
  let authorKeys = (edition.authors ?? []).map((a) => a.key);
  let coverId = firstCover(edition);
  const workKey = edition.works?.[0]?.key;
  // many editions only list their authors or cover on the work record
  if ((authorKeys.length === 0 || !coverId) && WORK_KEY.test(workKey)) {
    const work = await getJson(`${workKey}.json`, signal);
    if (authorKeys.length === 0) authorKeys = (work?.authors ?? []).map((a) => a.author?.key);
    coverId ??= firstCover(work);
  }
  authorKeys = authorKeys.filter((key) => AUTHOR_KEY.test(key)).slice(0, 3);

  const names = (await Promise.all(authorKeys.map((key) => authorName(key, signal)))).filter(Boolean);
  // reject records without a named author because spam and junk editions usually have none
  if (names.length === 0) return null;

  const year = Number(String(edition.publish_date ?? '').match(/\b(1[5-9]|20)\d{2}\b/)?.[0]) || null;
  const pages = Number.isInteger(edition.number_of_pages) && edition.number_of_pages > 0 ? edition.number_of_pages : null;

  return {
    isbn13,
    title,
    author: names.join(', '),
    publisher: edition.publishers?.[0]?.trim() ?? '',
    publishedYear: year,
    pages,
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '',
  };
}
