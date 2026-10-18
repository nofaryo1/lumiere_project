# LUMIERE — fragrance social network

LUMIERE is a social network for fragrance lovers: members discover perfumes, rate and review them,
follow each other, join discussion groups and chat in real time.

Built with **Node.js + Express**, **MongoDB (Mongoose)**, **jQuery**, **React**, **D3.js** and **Socket.io**,
organized as **MVC**.

---

## Requirements

- **Node.js 20.19 or newer** (Mongoose 9 needs it) and npm
- A **MongoDB** database — MongoDB Atlas (cloud) or a local MongoDB server
- Internet access only if you use MongoDB Atlas (everything else, including fonts and libraries, is served by the app)

## Setup

```bash
# 1. install the dependencies
npm install

# 2. create your environment file and put your MongoDB connection string in it
cp .env.example .env
#    then edit .env:  MONGO_URI=...

# 3. start the server
npm start
```

Open **http://localhost:3000**.

On the first start the server loads the built-in perfume catalog (100 perfumes) and the built-in
discussion groups into the `lumiere` database automatically.

### MongoDB Atlas

If you use Atlas, allow the computer's IP address under **Network Access** in the Atlas dashboard
(or allow access from anywhere, `0.0.0.0/0`, for a demo). Otherwise the server can't connect.

### Demo data (optional)

To make the site look like a real community, add demo members and group activity:

```bash
npm run seed:community   # 2,000 demo members with reviews, likes and follows (takes a few minutes)
npm run seed:groups      # members and posts in the discussion groups
```

Running them again replaces the demo data; real accounts are never touched.
`npm run seed:community -- --remove` removes the demo members and everything they created.
Demo members can't log in — sign up on the site to get your own account.

## Project structure (MVC)

```
server.js               Express app, static files, MongoDB connection, Socket.io
models/                 Model — Mongoose schemas (User, Perfume, Review, Group, GroupPost, Message, …)
controllers/            Controller — request handling for each feature (auth, users, perfumes, reviews,
                        groups, messages, stats, contact, pages)
routes/api.js           REST API routes (/api/...) -> controllers
routes/pages.js         page route (/) -> controllers/pageController.js
views/home.html         View — the page; public/js/main.js renders each screen in the browser
public/js/main.js       client app (jQuery: AJAX to /api, events, forms, filters)
public/js/react/        React components: video banner, notes canvas, top reviewers
public/js/*-chart.js    D3 charts
public/css/style.css    styles (CSS3)
public/fonts/           Plus Jakarta Sans font files (@font-face)
lib/                    helpers: sessions & passwords, live chat (Socket.io), catalog seeding, uploads
scripts/                demo data seeding
data/catalog.js         the built-in perfume catalog
```

## Where each feature is

| Feature | Where |
|---|---|
| Models with Create / Update / Delete / List / Search in the UI | **Perfume** (add, edit, delete your own, Trending list, search & filters) · **Review** (write, edit, delete your own, All reviews, filters) · **User** (sign up, edit profile, delete account, Members page, member search) · **Group** (create, edit / delete your own, Groups page, search) · **Group post** (post, edit / delete your own, group page, search) |
| Search with several parameters | **Perfumes:** brand, notes, scent family, star rating (Trending section) · **Reviews:** stars, date, reviewer or keyword (All reviews page) · **Group posts:** words or @member, date |
| jQuery + jQuery AJAX | every request to the API goes through `$.ajax` (`api()` in `public/js/main.js`); jQuery events for the filters, forms and page controls |
| React | `public/js/react/video-banner.js` (Video), `notes-canvas.js` (Canvas), `top-reviewers.js` |
| CSS3 | `text-shadow`, `transition`, multi-column (`columns` on the Privacy page), `@font-face`, `border-radius` — in `public/css/style.css` |
| Live chat (Socket.io) | `lib/realtime.js` + Messages page |
| D3 charts from the database | "Review trends" and "Group activity" on the homepage (`/api/stats/...`) |

## Notes

- Uploaded perfume photos are saved in `public/uploads/` (not in git).
- `.env` holds the database password — it is in `.gitignore` and must never be committed.
