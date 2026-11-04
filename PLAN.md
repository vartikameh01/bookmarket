# Online Book Marketplace: Project Plan

B.Tech CSE Final Year Major Project (application based)
Stack: vanilla HTML + CSS + JavaScript frontend, Node.js + Express backend, MongoDB (Atlas) with Mongoose
Plan date: 4 Nov 2026 · Target: everything built, deployed and rehearsed by **15 Nov 2026**

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
| Database | MongoDB Atlas free tier (M0) with Mongoose. Atlas runs as a replica set, which multi document transactions need. |
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
| Database | MongoDB Atlas (free M0 cluster) | Hosted, so the data survives redeploys; free; supports transactions |
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
4. Otherwise call `https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data` with a 5 second timeout.
5. Found: save title, author, publisher, year, page count and cover URL (`https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg`) into `books` and return it. The form shows the details read only, with the cover.
6. Not found: return 404 "We couldn't find this ISBN on Open Library, so it can't be listed."
7. Open Library timed out or errored: return 503 "Book lookup is unavailable, please try again in a minute."

### Validation checklist to show in the demo
- `978-0-13-110362-7` (valid, The C Programming Language) auto fills
- `978-0-13-110362-8` (one digit wrong) is rejected instantly by the checksum
- A valid checksum ISBN that Open Library does not know is rejected with the "not found" message
- Price `5` shows a field error; choosing a used condition hides quantity
- Submitting with browser checks bypassed (send the request from the DevTools console) still gets rejected by the server

---

## 6. Folder structure

```
ecommerce/
├── package.json            # "type": "module"
├── .env.example            # PORT, SESSION_SECRET, MONGODB_URI
├── server/
│   ├── app.js              # express app, middleware, routes mounted
│   ├── server.js           # connects to mongodb, then starts the app
│   ├── db/
│   │   ├── connect.js      # mongoose.connect(process.env.MONGODB_URI)
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

## 11. Timeline (4 to 15 Nov 2026)

Twelve days. Each block ends with something that works end to end.

### 4 to 5 Nov: setup and data
- [ ] `npm init`, install Express, mongoose, express-session, connect-mongo, bcryptjs, dotenv, nodemon
- [ ] Free MongoDB Atlas M0 cluster, database user, allow your IP (and `0.0.0.0/0` later for the host), URI in `.env`
- [ ] Git repo on GitHub, `.gitignore`, `.env.example`, README
- [ ] Mongoose models and `seed.js`: genres, ~60 real books (ISBNs confirmed on Open Library), 4 demo sellers, ~100 listings, 1 demo buyer, a few delivered and rated orders so ratings show from the start
- [ ] Express serves `public/`; `/api/genres` and `/api/books` return data
- [ ] Base CSS and shared `header.js`

### 6 to 7 Nov: accounts and selling
- [ ] Register / login / logout with sessions and bcrypt
- [ ] `isbn.js` checksum + ISBN 10 to 13 conversion
- [ ] `validate-listing.js` shared validator
- [ ] `/api/isbn/:isbn` with Open Library lookup, caching, 404 and 503 handling
- [ ] Sell form with live validation and auto fill
- [ ] My listings page (view, edit, pause, remove)

### 8 to 9 Nov: browsing
- [ ] Home page sections from the API
- [ ] Catalog with search, filters, sort, pagination and URL state
- [ ] Book page with offers table and seller ratings

### 10 to 11 Nov: cart, checkout and orders
- [ ] Server cart, grouped by seller, header badge
- [ ] Checkout page with address form and mock payment
- [ ] `POST /orders` transaction: stock checks, one order per seller
- [ ] My orders and order detail pages, cancel with restock

### 12 Nov: seller side and ratings
- [ ] Seller sales page: mark shipped / delivered
- [ ] Earnings summary
- [ ] Buyer rating form on delivered orders, average shown on offers

### 13 Nov: profile and polish
- [ ] Profile page: name, saved address (prefills checkout), change password
- [ ] Loading states, empty states, error toasts, 404 page, mobile check
- [ ] Walk through the validation checklist (section 5) and the demo script (section 12) by hand and fix what breaks

### 14 Nov: deploy
- [ ] Deploy to Render/Railway, set env vars, allow the host in Atlas network access
- [ ] Run the seed against the production database
- [ ] Test the live URL on a phone, run the full demo script on it

### 15 Nov: presentation material
- [ ] Slides (10 to 12) and a 5 minute demo script; rehearse twice
- [ ] Record a backup demo video in case the internet fails
- [ ] Screenshots and diagrams for the report

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
| A real Indian edition isn't on Open Library | Expected and accepted for this scope; manual entry is listed as future scope |
| College or venue Wi-Fi blocks MongoDB's port 27017 | Test from campus early; keep a phone hotspot ready; as a last resort run a local `mongod` started as a single node replica set (`mongod --replSet rs0` then `rs.initiate()`) so transactions still work |
| Transactions fail on a plain local MongoDB | Always develop against Atlas, or the single node replica set above; a standalone `mongod` does not support transactions |
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
