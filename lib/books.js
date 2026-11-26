// Reading log helpers: ISBN validation, star-point defaults, and book lookup.
// Pure functions plus two public-API lookups (Open Library, Google Books).
// No credentials are needed or sent.

// ---------- Points per book (the one place to tune them) ----------
// First matching row wins; a book with unknown page count gets the default.
const BOOK_POINTS = {
  default: 5,                     // under 100 pages, or page count unknown
  tiers: [
    { minPages: 250, points: 15 },
    { minPages: 100, points: 10 },
  ],
};

function pointsForPages(pages) {
  const n = Number(pages);
  if (!Number.isFinite(n) || n <= 0) return BOOK_POINTS.default;
  const tier = BOOK_POINTS.tiers.find(t => n >= t.minPages);
  return tier ? tier.points : BOOK_POINTS.default;
}

// ---------- ISBN ----------

function isbn13CheckDigit(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

function isValidIsbn13(s) {
  return /^97[89]\d{10}$/.test(s) && isbn13CheckDigit(s.slice(0, 12)) === s[12];
}

function isValidIsbn10(s) {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : Number(s[i])) * (10 - i);
  return sum % 11 === 0;
}

function isbn10to13(s10) {
  const base = '978' + s10.slice(0, 9);
  return base + isbn13CheckDigit(base);
}

// Accepts anything a person might type or a scanner might read ("0-06-440055-7",
// "9780064400558", "isbn 0064400557"). Returns the 13-digit ISBN, or null when
// the input is not a valid ISBN-13 (978/979 prefix + check digit) or ISBN-10.
// Non-book barcodes (e.g. a cereal box EAN-13) return null.
function normalizeIsbn(input) {
  const s = String(input ?? '').toUpperCase().replace(/[\s-]/g, '').replace(/^ISBN(?:1[03])?:?/, '');
  if (s.length === 13) return isValidIsbn13(s) ? s : null;
  if (s.length === 10) return isValidIsbn10(s) ? isbn10to13(s) : null;
  return null;
}

// ---------- Lookup (Open Library, then Google Books) ----------

const UA = 'FamilyPlanner/1.0 (book lookup)';
const TIMEOUT_MS = 4500;

// Returns { status, json } (json null on 404) or throws on network error /
// timeout. Open Library drops connections now and then, so a failure that
// happens quickly is retried once; a slow one (timeout) is not, to stay well
// inside a serverless function's time limit.
async function getJson(url, retried) {
  const started = Date.now();
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });
    if (r.status === 404) return { status: 404, json: null };
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return { status: r.status, json: await r.json() };
  } catch (e) {
    if (!retried && Date.now() - started < 2500) return getJson(url, true);
    throw e;
  }
}

const olCover = (isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;

async function openLibraryAuthorNames(keys) {
  const names = await Promise.all(keys.slice(0, 3).map(async (key) => {
    if (!/^\/authors\/OL\d+A$/.test(key)) return null;
    try {
      const { json } = await getJson(`https://openlibrary.org${key}.json`);
      return json && json.name ? String(json.name) : null;
    } catch { return null; }
  }));
  return names.filter(Boolean);
}

async function lookupOpenLibrary(isbn) {
  const { json: ed } = await getJson(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!ed || !ed.title) return null;
  let keys = (ed.authors || []).map(a => a && a.key).filter(Boolean);
  if (!keys.length && ed.works && ed.works[0] && /^\/works\/OL\d+W$/.test(ed.works[0].key || '')) {
    try {
      const { json: work } = await getJson(`https://openlibrary.org${ed.works[0].key}.json`);
      keys = ((work && work.authors) || []).map(a => a && a.author && a.author.key).filter(Boolean);
    } catch { /* author stays blank */ }
  }
  const author = (await openLibraryAuthorNames(keys)).join(', ');
  let pages = Number(ed.number_of_pages);
  if (!(pages > 0)) pages = parseInt(String(ed.pagination || ''), 10);
  return {
    isbn,
    title: String(ed.title).slice(0, 300),
    author: author || null,
    // default=false makes a missing cover a 404 (not a 1x1 gif) so the UI can show its text fallback
    cover_url: olCover(isbn),
    pages: pages > 0 ? Math.round(pages) : null,
  };
}

async function lookupGoogleBooks(isbn) {
  const { json } = await getJson(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`);
  const v = json && json.items && json.items[0] && json.items[0].volumeInfo;
  if (!v || !v.title) return null;
  const thumb = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail);
  return {
    isbn,
    title: String(v.title).slice(0, 300),
    author: Array.isArray(v.authors) && v.authors.length ? v.authors.slice(0, 3).join(', ') : null,
    cover_url: thumb ? String(thumb).replace(/^http:\/\//i, 'https://') : null,
    pages: Number(v.pageCount) > 0 ? Math.round(Number(v.pageCount)) : null,
  };
}

// Tries Open Library, then Google Books. Resolves to
//   { book, source }                 when one of them knows the ISBN
//   { book: null, source: null, failed } when neither does; failed is true if
//                                     every source errored (network/timeout)
//                                     rather than answering "not found".
async function lookupBookOnline(isbn) {
  let errors = 0;
  for (const [source, fn] of [['openlibrary', lookupOpenLibrary], ['google', lookupGoogleBooks]]) {
    try {
      const book = await fn(isbn);
      if (book) return { book, source };
    } catch { errors++; }
  }
  return { book: null, source: null, failed: errors === 2 };
}

module.exports = {
  BOOK_POINTS, pointsForPages, normalizeIsbn, isValidIsbn13, isValidIsbn10, isbn10to13,
  lookupBookOnline, lookupOpenLibrary, lookupGoogleBooks,
};
