# Online Book Marketplace

B.Tech CSE final year major project. A marketplace where anyone can buy and sell new and used books.

Stack: vanilla HTML, CSS and JavaScript on the frontend, Node.js with Express on the backend, MongoDB Atlas with Mongoose.

See [PLAN.md](PLAN.md) for the full design, API and timeline.

## Running locally

1. Install Node.js 24 and Docker.
2. `docker compose up -d --wait` to start the local MongoDB.
3. Copy `.env.example` to `.env` and set a session secret.
4. `npm install`
5. `npm run seed`
6. `npm run dev` and open http://localhost:3000

The seed creates `seller1@example.com` to `seller4@example.com` and `buyer@example.com`, all with the password `demo1234`. It wipes the database first, so reseed whenever the demo data needs resetting.

`server/db/seed-books.json` is already committed. Only rerun `node server/db/fetch-seed-books.js` after changing its ISBN list, and check the titles it prints, because Open Library records can be vandalized.

## Report material

`docs/screenshots/` has every page at desktop width and the main pages at 375 px, taken from a fresh seed.
`docs/diagrams/` has the architecture and data model diagrams as editable `.drawio` files with PNG exports.
`docs/slides.md` is the slide by slide draft for the final presentation.

## Changelog

- 4 Nov 2026: project plan and repository setup.
- 16 Nov 2026: rescheduled the build plan against the 30 Nov and 7 Dec deadlines.
- 16 Nov 2026: database models, seed data from Open Library, sign up and login, ISBN lookup and the shared listing validator. The ISBN lookup moved to Open Library's `/isbn/` endpoint and rejects records without an author, after a spam edition claimed the demo ISBN.
- 16 Nov 2026: sell form, my listings, catalog with search and filters, and the home page.
- 17 Nov 2026: book page, cart, checkout with mock payment, and the place order transaction that splits a cart into one order per seller.
- 17 Nov 2026: orders and order detail with cancel and restock, seller sales with status updates, earnings summary and seller ratings.
- 17 Nov 2026: profile page, polish pass (loading and empty states, 404 page, mobile layout) and a full manual walkthrough including the security spot checks.
- 17 Nov 2026: production check of a clean install, plus a Render blueprint (`render.yaml`) pinned to Node 24 in the Singapore region.
- 17 Nov 2026: report screenshots, architecture and data model diagrams, slide draft, and the book page now shows wide covers whole instead of cropping them.
- 18 Nov 2026: deployed on Render at https://bookmarket-1.onrender.com, backed by a MongoDB Atlas cluster seeded with the demo data.
