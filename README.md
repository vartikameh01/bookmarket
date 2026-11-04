# Online Book Marketplace

B.Tech CSE final year major project. A marketplace where anyone can buy and sell new and used books.

Stack: vanilla HTML, CSS and JavaScript on the frontend, Node.js with Express on the backend, MongoDB Atlas with Mongoose.

See [PLAN.md](PLAN.md) for the full design, API and timeline.

## Running locally

1. Install Node.js 22 or newer and Docker.
2. `docker compose up -d --wait` to start the local MongoDB.
3. Copy `.env.example` to `.env` and set a session secret.
4. `npm install`
5. `npm run seed`
6. `npm run dev` and open http://localhost:3000

## Changelog

- 4 Nov 2026: project plan and repository setup.
