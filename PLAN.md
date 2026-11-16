# Online Book Marketplace: Project Plan

B.Tech CSE Final Year Major Project (application based)
Stack: vanilla HTML + CSS + JavaScript frontend, Node.js + Express backend, MongoDB with Mongoose (local Docker for development, Atlas when deployed)
Plan date: 4 Nov 2026, rescheduled 16 Nov 2026 · Target: at least 20% coded by **30 Nov 2026** (college milestone), everything built, deployed and rehearsed by **6 Dec 2026**, final presentation on **7 Dec 2026**

---

## 1. Decisions made

| Question | Decision |
|---|---|
| Who can sell? | Any registered user can both buy and sell from one account. "Sell a book" is just a button in the header. |
| What is listed? | New and used books. Each listing has a condition and a price. New books have a quantity (1 to 100); a used listing is always exactly one copy. Many sellers can list the same book (same ISBN) at different prices. |
| Listing validation | Field checks plus ISBN 10/13 checksum and an Open Library lookup. The ISBN must be found on Open Library (or already be in our database); unknown ISBNs are rejected. Title, author and cover always come from the lookup, never typed by the seller. |
| Login | Browsing works logged out. Adding to cart, checkout, selling and all "my" pages need login. There is no guest cart. |
| Multi seller checkout | One checkout creates **one order per seller**, all inside one MongoDB transaction. Each order has a single status. |
| Order lifecycle | Placed → Shipped → Delivered, set by the seller. The buyer can cancel an order while it is still Placed, which restocks the listings. |
| Photos | No photo upload. Books show the Open Library cover. |
| Search | One search box over title, author and ISBN using an escaped regex. No live suggestion dropdown. |
| Payment | Mock payment form. No real money moves; sellers see sales and earnings on their dashboard. |
| Database | Development uses a local MongoDB 8 in Docker, run as a single node replica set. The deployed app uses MongoDB Atlas free tier (M0), set up on deploy day. Both are replica sets, which multi document transactions need. |
| Extras in scope | Seller rating (buyer rates an order after delivery) and a profile page (name, saved address, change password). |
| Not in scope | Admin page, wishlist, dark mode, photo upload, rate limiting, automated tests. |

---

## 2. Project summary (for synopsis / slides)

A web marketplace where people buy and sell new and used books. A seller enters an ISBN, the system checks it is a real ISBN, looks the book up on Open Library and fills in the details automatically; the seller then adds condition, price and quantity. Buyers browse and search books, compare offers from different sellers on one book page, add them to a cart and check out. Each seller sees the orders for their own books, marks them shipped and delivered, tracks earnings, and gets rated by buyers.

The frontend uses no frameworks (no React, no Bootstrap, no jQuery), to show understanding of the core web platform: DOM, Fetch API, ES modules, CSS Grid/Flexbox and form validation. The backend is a REST API built with Express.

### Objectives
1. Build a responsive storefront and seller dashboard using only HTML, CSS and JavaScript.
2. Design a REST API with Express for users, books, listings, carts and orders.
3. Ensure listings are valid using layered validation: browser checks, server checks and an external ISBN lookup.
4. Keep stock and orders consistent with database transactions, even when one checkout contains books from several sellers.
5. Implement secure authentication with hashed passwords and session cookies.
6. Deploy the application so it can be demoed from any browser.

### Points to highlight in the presentation
- **One validator, two places.** The listing validation rules live in one ES module that is imported by both the browser (instant feedback) and the server (final authority).
- **ISBN checksum + Open Library verification.** Bad ISBNs are rejected before any network call; real ones fill the form, and books Open Library does not know cannot be listed, so the catalog only contains real books.
- **Multi seller checkout.** One checkout with books from three sellers becomes three orders in a single transaction; either all are placed or none are.
- **Offer comparison.** One book page lists every seller's offer, sorted by price, with condition badges and seller ratings.

---

## 3. Tech stack and why

| Layer | Choice | Reason |
|---|---|---|
| Frontend | HTML5, CSS3, vanilla JS (ES modules) | College requirement; no build step needed |
| Backend | Node.js 22+ and Express 5, `"type": "module"` | Requirement; ES modules let the server share the validator file with the browser |
| Database | MongoDB 8 in Docker locally, MongoDB Atlas (free M0) when deployed | Local needs no account or internet; Atlas is hosted so data survives redeploys; both support transactions |
| ODM | Mongoose | Schemas with built in validators (required, min/max, enum), which become a second line of listing validation |
| Sessions store | `connect-mongo` | Keeps login sessions in MongoDB so users stay logged in across server restarts |
| Auth | `express-session` + `bcryptjs` | httpOnly session cookie is simpler and safer than a JWT in localStorage |
| ISBN lookup | Open Library API through Node's built in `fetch` | Free, no API key |
| Dev | `nodemon`, `dotenv` | Auto restart, config via `.env` |
| Deploy | Render or Railway (free tier) | Push to GitHub, auto deploy, gives a public URL |

---

## 4. Features

**Everyone**
- Register, login, logout
- Header with search, cart count (when logged in), "Sell a book" button, account menu
- Profile page: edit name, saved shipping address (prefills checkout), change password

**Buying**
- Home page: recently listed, browse by genre, cheapest used copies
- Catalog page: search, filter by genre, condition, price range; sort by price / newest; pagination
- Book page: cover, details, and a table of all offers (seller name, seller rating, condition, price, stock, "Add to cart")
- Cart (login required): change quantity, remove, totals grouped by seller
- Checkout: shipping address, order summary, mock payment
- My orders: list and detail, one order per seller with its status (Placed, Shipped, Delivered, Cancelled)
- Cancel an order while it is still "Placed"
- Rate the seller (1 to 5 stars, optional comment) once an order is Delivered

**Selling**
- "Sell a book" form: ISBN entry → checksum check → Open Library lookup → auto filled title/author/cover → seller picks genre and condition, enters price, quantity (new only) and optional notes
- My listings: edit price/quantity/notes, pause or remove a listing
- Sales: orders to ship, with buyer's shipping address, "Mark shipped" and "Mark delivered" buttons
- Earnings summary: total earned, pending, number of orders, average rating

### Future scope (mention in slides)
- Razorpay test mode payment and seller payouts
- Seller photos of their actual copy (Cloudinary)
- Manual entry for books Open Library does not know, with admin approval
- Admin page: remove listings, block users, report listing button
- Wishlist with "a cheaper copy is now listed" notice
- Duplicate listing and price outlier detection
- Email notifications (Nodemailer), buyer and seller chat
- Automated test suite and rate limiting

---

## 5. Listing validation in detail

Validation runs in three layers. The first two use the same file, `public/js/shared/validate-listing.js`.

### Layer 1: browser (instant feedback)
- HTML attributes: `required`, `min`, `max`, `maxlength`
- The shared validator runs on every input change and shows the error under the field
- The submit button stays disabled until the form is valid and the ISBN lookup has succeeded

### Layer 2: server (final authority)
The server runs the same validator again because a request can skip the browser entirely.

| Field | Rule |
|---|---|
| ISBN | Strip spaces and hyphens. Must be 10 characters (last may be `X`) or 13 digits. Must pass the ISBN 10 or ISBN 13 checksum. Stored as ISBN 13 (ISBN 10 is converted). Must match a book in our `books` collection, which only gets books found on Open Library. |
| Genre | Must be an existing genre id |
| Condition | One of `new`, `like_new`, `good`, `fair` |
| Price | Whole rupees, 10 to 10,000. Stored in paise. |
| Quantity | New: integer 1 to 100. Used (any other condition): forced to 1, the field is hidden in the form. |
| Notes | Optional, max 500 characters, escaped on display |
| Seller | Must be logged in |

Title and author are not accepted from the client at all; they come from the `books` document.

Errors come back as `{ "errors": { "price": "Price must be between ₹10 and ₹10,000" } }` so the form can show each message next to its field.

The Mongoose `Listing` schema repeats the core rules (`required`, `min`, `max`, `enum` for condition) as a last safety net, so even code that skips the route validator cannot save a bad listing. The error handler converts a Mongoose `ValidationError` into the same `{ errors: {...} }` shape.

### Layer 3: ISBN lookup
1. `GET /api/isbn/:isbn` on our server (the browser never calls Open Library directly, which avoids CORS issues and lets us cache).
2. Server checks the checksum first; an invalid ISBN returns 400 without any network call.
3. If the book is already in our `books` collection, return it immediately.
4. Otherwise look the edition up at `https://openlibrary.org/isbn/<isbn>.json`, then fetch its author names (and the work record when the edition lacks authors or a cover), all within one 10 second timeout (raised from 5 seconds on 16 Nov, when Open Library took 4 to 12 seconds per request). A record with no title or no named author counts as not found.
5. Found: save title, author, publisher, year, page count and cover URL (`https://covers.openlibrary.org/b/id/<coverId>-L.jpg`) into `books` and return it. The form shows the details read only, with the cover.
6. Not found: return 404 "We couldn't find this ISBN on Open Library, so it can't be listed."
7. Open Library timed out or errored: return 503 "Book lookup is unavailable, please try again in a minute."

### Validation checklist to show in the demo
- `978-0-13-110362-7` (valid, The C Programming Language) auto fills
- `978-0-13-110362-8` (one digit wrong) is rejected instantly by the checksum
- `9789999999991` (valid checksum, unknown to Open Library) is rejected with the "not found" message. Recheck it before the demo, because anyone can add records to Open Library.
- Price `5` shows a field error; choosing a used condition hides quantity
- Submitting with browser checks bypassed (send the request from the DevTools console) still gets rejected by the server

---

## 6. Folder structure

```
ecommerce/
├── package.json            # "type": "module"
├── .env.example            # PORT, SESSION_SECRET, MONGODB_URI
├── docker-compose.yml      # local mongodb 8 as a single node replica set
├── server/
│   ├── app.js              # express app, middleware, routes mounted
│   ├── server.js           # connects to mongodb, then starts the app
│   ├── db/
│   │   ├── connect.js      # mongoose.connect(process.env.MONGODB_URI)
│   │   ├── fetch-seed-books.js  # one off: isbn list to seed-books.json via open library
│   │   ├── seed-books.json
│   │   └── seed.js         # genres, ~60 real books, 4 demo sellers, ~100 listings, demo buyer, a few delivered + rated orders
│   ├── models/
│   │   ├── User.js
│   │   ├── Genre.js
│   │   ├── Book.js
│   │   ├── Listing.js
│   │   └── Order.js
│   ├── routes/
│   │   ├── auth.js         # register, login, logout, me
│   │   ├── profile.js      # name, address, password
│   │   ├── books.js        # browse, search, book page with offers
│   │   ├── isbn.js         # checksum + open library lookup
│   │   ├── listings.js     # seller create/edit/remove
│   │   ├── cart.js
│   │   ├── orders.js       # buyer side: checkout, list, cancel, rate
│   │   └── sales.js        # seller side: orders to ship, earnings
│   ├── middleware/
│   │   ├── requireAuth.js
│   │   └── errorHandler.js
│   └── services/
│       └── openLibrary.js
└── public/                 # served statically by express
    ├── index.html
    ├── 404.html
    ├── catalog.html
    ├── book.html           # book.html?id=<bookId>
    ├── cart.html
    ├── checkout.html
    ├── orders.html
    ├── order.html
    ├── login.html
    ├── register.html
    ├── profile.html
    ├── sell.html           # new listing form
    ├── seller/
    │   ├── listings.html
    │   ├── listing-edit.html
    │   └── sales.html
    ├── css/
    │   ├── base.css        # reset, variables, typography
    │   ├── layout.css      # header, footer, grid
    │   └── components.css  # buttons, cards, forms, badges, toasts, stars
    └── js/
        ├── shared/
        │   ├── validate-listing.js   # imported by browser AND server
        │   └── isbn.js               # checksum + isbn10 to isbn13
        ├── api.js          # fetch wrapper: JSON, errors, credentials, 401 redirect
        ├── header.js       # injects shared header/footer, cart badge, user menu
        ├── ui.js           # toast, loading spinner, escapeHtml, formatPrice
        └── pages/          # one module per page: catalog.js, book.js, sell.js, ...
```

Each HTML page loads `<script type="module" src="/js/pages/<page>.js">`. The shared header and footer are injected by `header.js` so they are written only once.

---

## 7. Database design (MongoDB collections)

Money is stored as integer paise (₹499 is stored as `49900`) to avoid floating point rounding errors.

The key idea is the split between a **book** (the work, one document per ISBN, shared by everyone) and a **listing** (one seller's offer of that book with condition, price and stock). Listings reference books with an `ObjectId` and are joined with Mongoose `populate()` or an aggregation `$lookup`.

```js
users {
  _id, name, email (unique index), passwordHash, createdAt,
  address: { name, phone, line1, line2, city, state, pincode } | null,   // saved from profile, prefills checkout
  cart: [ { listingId, quantity } ],         // embedded, a cart is small and only read with its user
  ratingSum: 0, ratingCount: 0               // as a seller; average = sum / count
}

genres {
  _id, name (unique), slug (unique)
}

books {                                      // one per ISBN, only books found on Open Library
  _id, isbn13 (unique index), title, author, publisher, publishedYear, pages,
  coverUrl, genreId, createdAt
}

listings {                                   // a seller's offer
  _id, bookId, sellerId,
  condition: 'new' | 'like_new' | 'good' | 'fair',
  pricePaise, quantity, notes,
  status: 'active' | 'paused' | 'removed',
  createdAt, updatedAt
}
// indexes: { bookId, status, pricePaise }, { sellerId }

orders {                                     // one per seller per checkout
  _id, checkoutId, buyerId, sellerId,
  items: [
    { listingId, titleSnapshot, conditionSnapshot, pricePaiseSnapshot, quantity }
  ],
  totalPaise, paymentRef,
  shipping: { name, phone, line1, line2, city, state, pincode },   // copied, not linked
  status: 'placed' | 'shipped' | 'delivered' | 'cancelled',
  rating: { stars, comment, createdAt } | null,
  createdAt, updatedAt
}
// indexes: { buyerId, createdAt }, { sellerId, createdAt }

sessions                                     // managed by connect-mongo
```

The genre is picked by the seller the first time a book is listed (Open Library subjects are too messy to map) and stored on the book.

Key design points to explain in the viva:
- **Reference vs embed.** Listings reference books because many sellers share a book and listings change often (stock). Order items and the shipping address are embedded because they belong only to that order and are always read together with it. The cart is embedded in the user for the same reason.
- **Book vs listing** avoids storing the same title and author 20 times and makes the "compare offers" page a single query on `listings` by `bookId`.
- **One order per seller.** Each seller ships separately, so splitting at checkout gives every order exactly one seller and one status. The seller's sales page is a simple `find({ sellerId: me })`, and status changes are a plain `updateOne({ _id, sellerId: me, status: 'placed' }, { $set: { status: 'shipped' } })`. The shared `checkoutId` lets the confirmation page show all orders from one checkout.
- **Snapshots.** Order items copy title, condition and price at purchase time so later edits by the seller do not change old orders.
- **Checkout is one MongoDB transaction** (`session.withTransaction()`): for each cart item run `updateOne({ _id, status: 'active', quantity: { $gte: qty } }, { $inc: { quantity: -qty } })`; if any update matches nothing that item is out of stock, so abort. Otherwise group the cart by seller, insert one order per seller, and clear the cart. Any failure rolls everything back and the buyer is told which item ran out.
- **Why a transaction is needed.** The `$gte` filter alone makes each single stock decrement safe from two buyers racing, but a checkout touches several listings and creates several orders, and without a transaction a failure halfway would leave some stock decremented with no order.
- **Cancel** is also a transaction: set the order to `cancelled` only if it is still `placed`, then `$inc` each listing's quantity back.
- **Ratings.** A buyer can rate a delivered order once (`updateOne({ _id, buyerId: me, status: 'delivered', rating: null }, ...)`), and the seller's `ratingSum` and `ratingCount` are incremented so the offers table never needs an aggregation to show the average.
- A listing that reaches quantity 0 is hidden from browse but kept, so old orders still link to it.
- Seller earnings come from an aggregation on `orders`: `$match` on `sellerId`, `$group` by status and sum `totalPaise`.

---

## 8. REST API

Base path `/api`. All responses are JSON. Errors are `{ "error": "message" }` or `{ "errors": { field: message } }` with a proper HTTP status.

### Auth and profile
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /auth/register | none | Create account |
| POST | /auth/login | none | Start session |
| POST | /auth/logout | user | End session |
| GET | /auth/me | none | Current user (with cart count) or `null` |
| PATCH | /profile | user | Update name and saved address |
| POST | /profile/password | user | Change password (needs current password) |

### Browsing
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /books?q=&genre=&condition=&min=&max=&sort=&page= | none | Books that have at least one active listing, with lowest price and offer count |
| GET | /books/:id | none | Book details + all active offers sorted by price, with seller name and rating |
| GET | /genres | none | All genres |

### Selling
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /isbn/:isbn | user | Validate checksum, look up and return book details (400 / 404 / 503 on failure) |
| POST | /listings | user | Create listing (JSON) |
| GET | /listings/mine | user | My listings |
| PATCH | /listings/:id | owner | Edit price, quantity, notes, status |
| DELETE | /listings/:id | owner | Remove (soft delete: status = removed) |
| GET | /sales | user | Orders where I am the seller |
| PATCH | /sales/:orderId | seller of order | Mark shipped / delivered |
| GET | /sales/summary | user | Earnings, counts, average rating |

### Buying
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /cart | user | Cart grouped by seller, with totals |
| PUT | /cart/:listingId | user | Set quantity (0 removes). Rejects own listings and quantities above stock. |
| POST | /orders | user | Check out the cart: one transaction, one order per seller. Returns `checkoutId` and order ids. |
| GET | /orders | user | My orders |
| GET | /orders/:id | buyer | Order detail |
| POST | /orders/:id/cancel | buyer | Cancel while "placed", restock the listings |
| POST | /orders/:id/rating | buyer | Rate the seller once the order is delivered |

---

## 9. Frontend approach (vanilla)

- **Multi page app.** Each page is its own HTML file; simpler to explain and debug than a hand written single page router.
- **`api.js` fetch wrapper.** Every call goes through one function that sets JSON headers, sends cookies, parses errors and redirects to `/login.html?next=...` on 401.
- **Rendering.** Build DOM with `<template>` elements or `document.createElement`. Any user text (notes, names, review comments) goes through `escapeHtml` or `textContent` to prevent XSS.
- **State.** The cart lives only on the server. After any cart change the page fires a custom `cart:change` event so the header badge updates.
- **URL as state.** Catalog search, filters and page number live in the query string (`URLSearchParams`) so results can be bookmarked and the back button works.
- **Sell form UX.** ISBN field validates on input; when the checksum passes, a debounced lookup fills the book details and shows the cover. Clear loading, "not found" and "lookup unavailable" states. Choosing a used condition hides the quantity field.
- **CSS.** Custom properties for colours and spacing, Grid for book cards, Flexbox for header and forms, mobile first media queries, condition badges in different colours, star ratings.
- **Accessibility.** Semantic tags, `alt` on covers, labels on every input, errors linked with `aria-describedby`, visible focus states.

---

## 10. Security checklist

- Passwords hashed with bcrypt (cost 10+), never returned by the API. Changing the password needs the current one.
- Session cookie: `httpOnly`, `sameSite: 'lax'`, `secure` in production. Regenerate the session id on login.
- Prevent NoSQL injection: enable `mongoose.set('sanitizeFilter', true)` and cast every query value to the expected type (for example `String(req.body.email)`), so a body like `{ "email": { "$ne": null } }` cannot bypass login.
- Escape user input before using it in the search regex to avoid regex injection and slow queries.
- Validate `:id` params with `mongoose.isValidObjectId()` and return 404 instead of a cast error.
- `MONGODB_URI` with its password only lives in `.env` and the host's environment settings.
- Prices and totals are always computed on the server from the listings collection, never trusted from the browser.
- Ownership checks on every write: only the seller edits a listing or changes an order's shipping status; only the buyer sees, cancels or rates their order.
- A seller cannot add their own listing to their cart.
- `SESSION_SECRET` in `.env`, and `.env` in `.gitignore`.

---

## 11. Step by step build plan (4 Nov to 7 Dec 2026)

Do the steps in order. Each one ends with a **Check**. Don't move on until it passes, then commit (`git commit -m "Step 7: register and login"`) so there is always a working version to go back to.

Steps 1 to 5 were done on 4 Nov and work paused until 16 Nov, so the dates below were redone on 16 Nov against the college deadlines: 20% of the coding by 30 Nov and the final presentation on 7 Dec. The 30 Nov milestone lands after step 27, so the supervisor sees the full buying flow working, well past 20%. If a block runs over, take the time from the 1 Dec buffer day first, then cut ratings and profile (see section 14).

### 4 Nov and 16 to 17 Nov: setup and data

1. [x] **Git repository.** `.gitignore`, `.env.example`, README, this plan, first commit.
2. [ ] **GitHub remote.** Deferred to step 34, since nothing needs it before deploying.
3. [x] **Local MongoDB.** `docker-compose.yml` runs MongoDB 8 as a single node replica set (`rs0`) with a named volume, and initiates the set on first start. `docker compose up -d --wait` starts it, `docker compose down` stops it (data is kept). Copy `.env.example` to `.env`; its default `MONGODB_URI` points at this container. Put a long random string in `SESSION_SECRET`. Atlas is deferred to step 34.
   **Check:** `docker compose exec mongo mongosh --eval 'rs.status().members[0].stateStr'` prints `PRIMARY`.
4. [x] **npm project.** `npm init -y`, add `"type": "module"`, then `npm install express mongoose express-session connect-mongo bcryptjs dotenv` and `npm install -D nodemon`. Scripts: `"dev": "nodemon server/server.js"`, `"start": "node server/server.js"`, `"seed": "node server/db/seed.js"`.
   **Check:** `npm install` finishes with no errors and `node_modules` is not shown by `git status`.
5. [x] **Server skeleton.** `server/db/connect.js` (calls `mongoose.set('sanitizeFilter', true)` then `mongoose.connect`), `server/app.js` (`express.json()`, `express.static('public')`, `GET /api/health` returns `{ ok: true }`), `server/server.js` (loads dotenv, connects, then listens on `PORT`).
   **Check:** `npm run dev` logs "connected to MongoDB" and http://localhost:3000/api/health shows `{"ok":true}`.
6. [x] **Error handling.** `middleware/errorHandler.js` turns a Mongoose `ValidationError` into `400 { errors: { field: message } }`, a `CastError` into 404, and anything else into `500 { error }` (log the stack). Add a JSON 404 for unknown `/api` routes.
   **Check:** http://localhost:3000/api/nope returns JSON with status 404.
7. [x] **Models.** `User`, `Genre`, `Book`, `Listing`, `Order` exactly as in section 7, including the indexes and the `min`/`max`/`enum` rules on `Listing`.
   **Check:** the server still starts, and the indexes appear (`db.listings.getIndexes()` in mongosh) after the seed in step 8.
8. [x] **Seed data.** Write a one off script `server/db/fetch-seed-books.js` that takes a list of ~60 ISBNs (mix of programming, fiction, Indian authors, exam prep), calls Open Library for each, and writes `server/db/seed-books.json` with title, author, publisher, year, pages and cover URL. Drop any ISBN Open Library doesn't know. Then `seed.js` wipes all collections and inserts ~8 genres, the books, 4 sellers and 1 buyer (all with password `demo1234`), ~100 listings (random seller, condition and price; used ones quantity 1), and 3 delivered orders with ratings (updating each seller's `ratingSum` and `ratingCount`).
   **Check:** `npm run seed` prints the count of each collection and the data is visible in mongosh or MongoDB Compass (`mongodb://localhost:27017/?directConnection=true`). Note down two seeded ISBNs to use in the demo.
9. [x] **First API routes.** `GET /api/genres`, and a first version of `GET /api/books` that returns books with at least one active listing, their lowest price and offer count (aggregate `listings` grouped by `bookId`, then `$lookup` the book).
   **Check:** both URLs show sensible JSON in the browser.
10. [x] **Frontend base.** `css/base.css` (reset, colour and spacing variables, fonts), `layout.css` (header, footer, page width), `components.css` (buttons, cards, forms, badges, toasts). `js/ui.js` (`escapeHtml`, `formatPrice`, `toast`), `js/api.js` (fetch wrapper from section 9), `js/header.js` (injects header and footer). `index.html` with an empty main area.
    **Check:** the home page shows the header and footer with no errors in the console.

### 18 to 21 Nov: accounts and selling

11. [x] **Auth API.** Sessions with `connect-mongo`, cookie `httpOnly`, `sameSite: 'lax'`, `secure` when `NODE_ENV=production`, and `app.set('trust proxy', 1)` for Render. Register (name, email, password of at least 8 characters, bcrypt cost 10, 409 for an existing email), login (cast inputs with `String()`, compare hash, `req.session.regenerate`, store `userId`), logout, `me`. `middleware/requireAuth.js` returns 401 without a session.
    **Check:** register, refresh, still logged in. Restart the server, still logged in. Wrong password gives 401.
12. [x] **Login and register pages.** Forms with field errors, redirect to `?next=` after success. The header shows the user's name, "Sell a book" and Logout when logged in, and Login / Register when not.
    **Check:** the whole flow works in the browser, including logout.
13. [x] **ISBN helpers.** `public/js/shared/isbn.js`: `normalizeIsbn`, `isValidIsbn10`, `isValidIsbn13`, `toIsbn13`.
    **Check:** in `node`, `9780131103627` is valid, `9780131103628` is invalid, and `toIsbn13('0131103628')` returns `9780131103627`.
14. [x] **Shared validator.** `public/js/shared/validate-listing.js` exports `validateListing(input)` returning `{ value, errors }` with the rules from section 5.
    **Check:** in `node`, price `5` returns a price error, and condition `good` with quantity `4` returns quantity `1`.
15. [x] **ISBN lookup.** `services/openLibrary.js` already exists from step 8 (one 10 second timeout for the whole lookup, returns `null` when the book is missing, throws on network errors). Add `routes/isbn.js` (400 bad checksum, cached book from `books`, 404 not found, 503 lookup failed).
    **Check:** while logged in, open `/api/isbn/9780131103627`, `/api/isbn/9780131103628` and a valid but unknown ISBN in the browser and see 200, 400 and 404.
16. [ ] **Create listing API.** `POST /api/listings`: requireAuth, run the shared validator, find the book by `isbn13` (it must exist, because the lookup step saved it), set the book's genre if it has none, save the listing.
    **Check:** from the DevTools console, a `fetch` with price 5 gets 400 with a price error, and a valid body gets 201.
17. [ ] **Sell form.** `sell.html` and `pages/sell.js`: ISBN field with live checksum, debounced lookup, read only title, author and cover, genre select, condition, price, quantity (hidden for used), notes. Errors under each field linked with `aria-describedby`; submit disabled until valid.
    **Check:** every item in the validation checklist in section 5 behaves as described.
18. [ ] **My listings.** `GET /listings/mine`, `PATCH /listings/:id`, `DELETE /listings/:id` (soft delete), all checking the owner. `seller/listings.html` with pause and remove buttons, and `seller/listing-edit.html`.
    **Check:** editing, pausing and removing all survive a refresh, and patching another seller's listing id returns 404.

### 22 to 24 Nov: browsing

19. [ ] **Full catalog API.** `GET /api/books` supports `q` (escaped regex on title and author, or exact `isbn13` when `q` looks like an ISBN), `genre`, `condition`, `min` and `max` in rupees, `sort` (`price_asc`, `price_desc`, `newest`) and `page` (12 per page), returning `{ items, total, page, pages }`. Only listings that are active with quantity above 0 count.
    **Check:** each filter and sort changes the JSON as expected when typed into the URL.
20. [ ] **Catalog page.** `catalog.html` with a filter sidebar, a grid of book cards (cover, title, author, "from ₹X", "N offers") and pagination. Filters read from and write to the query string. The header search box submits to `catalog.html?q=`.
    **Check:** apply filters, go to page 2, press Back, and the previous filters and page come back.
21. [ ] **Home page.** Recently listed, cheapest used copies, and genre chips, all using `/api/books` with different parameters.
    **Check:** each section links to the matching catalog view.
22. [ ] **Book page.** `GET /api/books/:id` returns the book and its active offers sorted by price, with seller name and average rating. `book.html` shows the cover, details and an offers table with condition badges, ratings like ★ 4.5 (12), stock and "Add to cart" (disabled on your own listings, sends you to login when logged out).
    **Check:** a seeded book with 3 sellers shows 3 rows in price order.

### 25 to 28 Nov: cart, checkout and orders

23. [ ] **Cart API.** `GET /api/cart` loads the listings, drops ones that are no longer active or in stock, groups by seller and adds totals. `PUT /api/cart/:listingId` sets quantity (0 removes, rejects your own listings, caps at stock). `/auth/me` includes the cart count; pages fire `cart:change` after changes so the header badge updates.
    **Check:** add from the book page and the badge goes up without a reload.
24. [ ] **Cart page.** `cart.html` grouped by seller, quantity inputs, remove buttons, subtotals, grand total and a Checkout button.
    **Check:** changing quantities updates totals, and the empty cart shows a friendly message.
25. [ ] **Checkout page.** `checkout.html`: address form prefilled from the saved address, a "save this address" checkbox, order summary, and a mock card form (16 digits, MM/YY, 3 digit CVV, checked in the browser only).
    **Check:** invalid card details or a missing pincode block the Pay button.
26. [ ] **Place order.** `POST /api/orders` runs the transaction from section 7: decrement stock, one order per seller with a shared `checkoutId`, `paymentRef` like `MOCK-8F3K2A`, empty the cart. Out of stock returns 409 with the book's title. Then redirect to `orders.html?checkout=<id>`, which highlights the new orders.
    **Check:** log in as two buyers in two browsers, both with the last copy in the cart, and pay in both. One succeeds, the other gets the 409 message, and stock in the database is 0, not negative.
27. [ ] **Orders pages.** `orders.html` (newest first, seller, status badge, total) and `order.html` (items, shipping address, status, Cancel button while Placed). `POST /orders/:id/cancel` is a transaction that sets `cancelled` and restocks.
    **Check:** cancel an order and the listing's quantity goes back up.

### 29 to 30 Nov: seller side and ratings

**30 Nov milestone:** the college's 20% deadline. Show the supervisor the buying and selling flow running locally and note their feedback in the weekly progress log.

28. [ ] **Sales.** `GET /api/sales` (filter by status), `PATCH /api/sales/:orderId` allowing only Placed → Shipped → Delivered. `seller/sales.html` with status tabs, buyer address and the action button.
    **Check:** marking another seller's order returns 404, and jumping from Placed straight to Delivered returns 400.
29. [ ] **Earnings summary.** `GET /api/sales/summary` aggregation (earned from delivered, pending from placed and shipped, order count, average rating) shown as cards at the top of the sales page.
    **Check:** the numbers match the orders listed below them.
30. [ ] **Ratings.** `POST /api/orders/:id/rating` takes 1 to 5 stars and a comment of up to 300 characters, only for the buyer's own delivered and unrated order, and `$inc`s the seller's `ratingSum` and `ratingCount`. Star form on `order.html`.
    **Check:** the new rating changes the seller's average on the book page, and rating the same order again returns 409.

### 1 Dec: buffer

Catch up on anything that slipped and act on the supervisor's feedback from the 30 Nov review. If nothing slipped, start the profile and polish steps early.

### 2 to 3 Dec: profile and polish

31. [ ] **Profile.** `profile.html`, `PATCH /api/profile` (name, address), `POST /api/profile/password` (needs the current password).
    **Check:** a wrong current password is rejected, and the new password works after logging out.
32. [ ] **Polish pass.** Loading spinners, empty states (cart, orders, listings, sales, no search results), error toasts, `404.html`, visible focus outlines, `alt` text, and every page at 375 px wide in DevTools device mode.
    **Check:** nothing overflows sideways on the phone sized view.
33. [ ] **Full manual walkthrough.** Run the validation checklist (section 5), the demo script (section 12) and these security spot checks: login with `{"email":{"$ne":null},"password":"x"}` is rejected, editing someone else's listing gives 404, adding your own listing to the cart is rejected, and a price sent in the checkout body is ignored.
    **Check:** everything passes; fix and recheck anything that doesn't.

### 4 Dec: deploy

34. [ ] **GitHub and Render.** Create an empty repo on the vartikameh01 account (no README), `git remote add origin git@github.com:vartikameh01/<repo>.git`, `git push -u origin main`. Create a free MongoDB Atlas M0 cluster (Mumbai region) with a database user, add `0.0.0.0/0` under Network Access, and copy its connection string with `bookmarket` as the database name. Then on Render, New Web Service from that repo, build `npm install`, start `npm start`, Node 22, environment variables `MONGODB_URI` (the Atlas one), `SESSION_SECRET`, `NODE_ENV=production`.
    **Check:** the live URL loads, and login survives a refresh (this proves the secure cookie and `trust proxy` are right).
35. [ ] **Live test.** Seed Atlas with `MONGODB_URI='<atlas uri>' npm run seed`, then go through the whole demo script on a phone using the live URL.
    **Check:** the demo works start to finish on the phone.

### 5 to 6 Dec: presentation material

The final presentation is on 7 Dec.

36. [ ] **Report material.** Screenshots of every page, the architecture diagram and the data model diagram (draw.io).
37. [ ] **Slides.** 12 slides following section 13.
38. [ ] **Rehearse.** Run the demo twice with a timer, then record a backup video with QuickTime screen recording.
39. [ ] **Wrap up.** Update the README changelog, reseed Atlas one last time, and tag the release with `git tag v1.0 && git push --tags`.
    **Check:** everything in section 4 works on the live URL.

---

## 12. Demo script (about 5 minutes)

1. Open the live URL. Home page, browse a genre, search for a book.
2. Open a book that has offers from 3 sellers; point out condition badges, seller ratings and price sorting.
3. Log in as **Seller A**. Click "Sell a book", type a wrong ISBN and show the instant rejection. Type a correct one and show the auto fill and cover. Pick a used condition and show quantity disappear. Try price ₹5 and show the error. Publish the listing.
4. Log in as **Buyer**. Find the new listing, add it plus a book from **Seller B** to the cart. Show the cart grouped by seller.
5. Check out with the mock payment. Show the confirmation with two orders, both "Placed".
6. Log in as **Seller A**, open Sales, mark the order shipped, then delivered. Show the listing's stock went down in My listings.
7. Back as the buyer, show one order Delivered and the other still Placed. Rate Seller A, then cancel the Seller B order and show its stock come back.
8. Quick code tour: the shared validator, the checkout transaction, the `api.js` wrapper.

---

## 13. Presentation slide outline

1. Title, name, roll number, supervisor
2. Problem statement and objectives
3. Features (buyer side and seller side)
4. Tech stack and why no frontend framework
5. System architecture (browser ↔ Express REST API ↔ MongoDB Atlas, plus Open Library)
6. Data model: collections, references vs embedded documents, book vs listing split, one order per seller
7. Listing validation layers
8. Checkout transaction across multiple sellers
9. Security measures
10. Screenshots
11. Challenges faced and how they were solved
12. Future scope and conclusion

---

## 14. Risks and how to handle them

| Risk | Plan |
|---|---|
| Falling behind schedule | Ratings and profile page are cut first; everything else is the core flow |
| Open Library is slow or down during the demo | Unknown ISBNs can't be listed while it's down, so the demo uses an ISBN already cached in `books`; the lookup then answers instantly from our database. Keep a second cached ISBN as backup. |
| Open Library data is wrong or vandalized | It is a wiki. In Nov 2026 a spam edition claimed the demo ISBN `9780131103627` and hijacked the `/api/books` endpoint, which is why the lookup uses `/isbn/<isbn>.json` and rejects records with no named author. The seed list was checked by hand, and seeded books are served from our database, so later edits on Open Library don't affect them. Open the demo ISBNs on the live site the day before. |
| A real Indian edition isn't on Open Library | Expected and accepted for this scope; manual entry is listed as future scope |
| College or venue Wi-Fi blocks MongoDB's port 27017 | The deployed app talks to Atlas from Render's servers, so venue Wi-Fi doesn't matter for it. If running on the laptop, use the local Docker database, which needs no internet for data. |
| Transactions fail on a plain MongoDB | Only ever use the Docker replica set or Atlas; a standalone `mongod` does not support transactions |
| Local and deployed data drift apart | Both are filled by the same `npm run seed`, so reseed whichever one is being demoed |
| Free host sleeps when idle (Render takes ~50 s to wake) | Open the live URL a couple of minutes before presenting |
| Internet or hosting down on presentation day | Run locally on the laptop and keep the recorded video as backup |
| Supervisor asks for changes | Weekly meetings catch this early; keep a changelog in the README |

---

## 15. Documents to keep for the final report

- Synopsis (already submitted)
- Data model diagram and architecture diagram
- API tables (section 8) and validation rules (section 5)
- Screenshots of each page
- Weekly progress log: date, what was done, supervisor feedback, action items
