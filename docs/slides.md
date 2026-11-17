# Presentation slides (7 Dec 2026)

Twelve slides following section 13 of PLAN.md.
Each slide has what goes on it, the image to use, and short speaker notes.
Fill in the bracketed parts on slide 1.
Screenshots are in `docs/screenshots/` and the diagrams in `docs/diagrams/` (open the `.drawio` files at app.diagrams.net to edit them, then File > Export as > PNG).

Aim for about 30 seconds per slide, so the slides take 6 minutes and the live demo (section 12) takes 5.

---

## 1. Title

**Bookmarket: an online marketplace for new and used books**

- Vartika Mehrotra, [roll number]
- B.Tech CSE, major project, [college name]
- Supervisor: [supervisor name]
- 7 December 2026

Image: `screenshots/01-home.png` cropped to the top half, faded behind the title.

Notes: one line on what the app is. "Anyone can sell a book they own and anyone can buy one, new or used, from several sellers in one cart."

---

## 2. Problem statement and objectives

**Problem**
- Second hand textbooks and novels change hands through WhatsApp groups and notice boards, with no way to compare prices or trust a seller.
- General marketplaces don't know what a book is, so the same title appears under ten spellings with wrong details.

**Objectives**
1. A responsive storefront and seller dashboard in plain HTML, CSS and JavaScript.
2. A REST API in Express for users, books, listings, carts and orders.
3. Only real books get listed, through browser checks, server checks and an ISBN lookup.
4. Stock and orders stay consistent through database transactions, even across several sellers.
5. Secure login with hashed passwords and session cookies.
6. Deployed, so it can be demoed from any browser.

Notes: the ISBN is the key idea. Every listing is tied to a real, verified book, so all offers for one book land on one page.

---

## 3. Features

Two columns.

**Buyer**
- Search by title, author or ISBN, filter by genre, condition and price, sort and page through results
- One page per book comparing every seller's offer, with condition badges and seller ratings
- Cart grouped by seller, checkout with a mock payment
- Orders with status tracking, cancel while placed, rate the seller after delivery
- Profile with saved address and password change

**Seller**
- Sell a book by typing its ISBN: details and cover fill in automatically
- New copies with stock, used copies as single items
- My listings: edit price, stock and notes, pause or remove
- Sales: buyer address, mark shipped, mark delivered
- Earnings: earned, pending, order count, average rating

Image: `screenshots/05-book-three-offers.png` small in a corner.

Notes: one account can both buy and sell, and "Sell a book" is always in the header.

---

## 4. Tech stack and why no frontend framework

| Layer | Choice |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript ES modules |
| Backend | Node.js 24, Express 5 |
| Database | MongoDB 8 (Docker locally, Atlas when deployed), Mongoose 9 |
| Auth | express-session with connect-mongo, bcryptjs |
| Book data | Open Library API |
| Hosting | Render (Singapore) and MongoDB Atlas (Mumbai) |

**Why no framework**
- Shows the platform itself: DOM, Fetch, ES modules, CSS Grid and Flexbox, form validation.
- No build step: the browser loads the same files we write.
- ES modules let the server import the exact validator file the browser uses.

Size: 15 pages, 26 API endpoints, about 3,600 lines of JavaScript and 2,700 lines of CSS.

Notes: no React, no Bootstrap, no jQuery. The only runtime dependencies are Express, Mongoose, the session libraries, bcrypt and dotenv.

---

## 5. System architecture

Image: `diagrams/architecture.png` full slide.

Notes:
- The browser loads static pages from Express, then every page talks to the REST API through one `api.js` fetch wrapper.
- Login is an httpOnly session cookie, and sessions live in MongoDB so a restart doesn't log anyone out.
- The server calls Open Library only when a seller types an ISBN we haven't seen. The result is saved in `books`, so each ISBN is fetched once.
- Render runs in Singapore because it's the closest region to the Atlas cluster in Mumbai, and a checkout makes several database round trips.

---

## 6. Data model

Image: `diagrams/data-model.png` full slide.

Notes, the four design choices:
- **Book vs listing.** A book is one document per ISBN, shared by everyone. A listing is one seller's offer with condition, price and stock. Comparing offers is one query on listings by `bookId`.
- **Reference vs embed.** Listings reference books because many sellers share a book. The cart, order items and shipping address are embedded because they belong to one parent and are always read with it.
- **Snapshots.** Order items copy the title, condition and price at purchase time, so a seller editing a listing later doesn't change old orders.
- **One order per seller.** Each seller ships separately, so a checkout is split into one order per seller with its own status, linked by a shared `checkoutId`.

Money is stored in whole paise (₹499 is 49900) to avoid floating point errors.

---

## 7. Listing validation layers

Three layers, shown as three stacked boxes.

1. **Browser, instant.** HTML attributes plus the shared validator on every keystroke. ISBN checksum is checked before any network call. Submit stays disabled until everything is valid.
2. **Server, final authority.** The same `validate-listing.js` file runs again on the server, because a request can skip the browser. Title and author are never accepted from the client.
3. **Open Library lookup.** The ISBN must be a real book. Unknown ISBNs can't be listed, and the details come from the lookup.

Plus a last safety net: the Mongoose schema repeats the min, max and enum rules.

Images: `screenshots/11-sell-bad-isbn.png` and `screenshots/12-sell-price-error.png` side by side, or `13-sell-filled.png` alone.

Notes: show a one line ISBN 13 checksum, e.g. weights 1 and 3 alternate and the sum must be a multiple of 10. That's why `…627` passes and `…628` fails instantly.

---

## 8. Checkout transaction across multiple sellers

A flow of four boxes inside one dashed box labelled "one MongoDB transaction":

1. For each cart item: `updateOne({ _id, status: 'active', quantity: { $gte: qty } }, { $inc: { quantity: -qty } })`
2. If any update matches nothing, that book is out of stock: abort and tell the buyer which one
3. Group the items by seller and insert one order per seller with a shared `checkoutId`
4. Empty the cart

Either every order is placed or none are.
Cancelling is also a transaction: mark the order cancelled only if it's still placed, then put the stock back.

Images: `screenshots/21-cart-two-sellers.png` then `screenshots/23-orders-after-checkout.png`.

Notes: the `$gte` filter alone stops two buyers from taking the last copy at once. The transaction is needed because one checkout touches several listings and creates several orders, and a failure halfway must not leave stock taken with no order. Prices always come from the listings collection, never from the browser.

---

## 9. Security measures

- Passwords hashed with bcrypt and never sent back by the API. Changing the password needs the current one.
- Session cookie is httpOnly, sameSite lax and secure in production. The session id is regenerated on login.
- NoSQL injection blocked: Mongoose `sanitizeFilter` plus casting every input, so `{"email": {"$ne": null}}` can't log in.
- Search input is escaped before it becomes a regex.
- Ownership checked on every write: only the seller edits a listing or ships an order, only the buyer sees, cancels or rates it.
- You can't buy your own listing.
- Secrets live only in `.env` and Render's settings, never in git.

Notes: these were all spot checked on the final build. The injection login gets 401, editing another seller's listing gets 404, your own listing in the cart gets 400, and a price sent in the checkout body is ignored.

---

## 10. Screenshots

A grid of four to six.

- `screenshots/01-home.png`
- `screenshots/02-catalog.png`
- `screenshots/13-sell-filled.png`
- `screenshots/30-sales.png`
- `screenshots/42-mobile-book.png` and `screenshots/45-mobile-orders.png` as phone frames

Notes: every page was checked at 375 px wide, and there are loading, empty and error states throughout. Then switch to the live demo.

---

## 11. Challenges faced and how they were solved

| Challenge | Solution |
|---|---|
| Open Library is a wiki, and a spam edition claimed our demo ISBN on its search endpoint | Switched to the exact `/isbn/<isbn>.json` record and treat records without a named author as not found |
| Open Library took 4 to 12 seconds per request in November | 10 second timeout, every found book cached in our own database, 503 with a friendly message when it's down |
| Transactions don't work on a plain MongoDB | Run MongoDB in Docker as a single node replica set locally, and Atlas in production |
| Mongoose `sanitizeFilter` also blocked our own query operators like `$gte` | Wrap the trusted ones with `mongoose.trusted()` |
| Mongoose skips some schema rules on `updateOne`, so a used listing could be edited above one copy | The edit route runs the shared validator with the listing's condition |
| Book covers come in different shapes | The book page frame takes the real cover's shape once it loads |

Notes: pick two to talk through. The Open Library spam story is the most memorable one.

---

## 12. Future scope and conclusion

**Future scope**
- Real payments with Razorpay test mode and seller payouts
- Seller photos of their actual copy
- Manual entry for books Open Library doesn't know, with admin approval
- Admin page, listing reports and user blocking
- Wishlist with "a cheaper copy is now listed" alerts
- Email notifications and buyer to seller chat
- Automated tests and rate limiting

**Conclusion**
- A complete buy and sell flow for real books, built without a frontend framework
- Consistent stock and orders through transactions across sellers
- Validation that the browser can't bypass, shared between both sides
- Live at [Render URL]

Notes: end on the live URL and invite questions.
