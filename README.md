# LUMIERE

A little social network for people who love perfume. Find new scents, see what others actually think of them, and chat with people who share your taste.

## What you can do

- **Browse perfumes:** see what's trending this week, then filter by brand, notes, scent family or star rating.
- **Rate and review:** leave a star rating and a few words on anything you've tried, and vote on longevity, sillage and when to wear it.
- **Add missing perfumes:** add one with a photo and its three main notes, and edit or remove it later.
- **Follow people:** follow members whose taste you like and keep up with what they're doing.
- **Join groups:** join discussion groups, start threads, reply, and search old posts. You can also create a group of your own.
- **Chat:** messages arrive in real time, with an unread badge so you don't miss anything.
- **Charts:** two on the homepage show review trends and how active the groups are.

## Built with

Node.js and Express on the server, MongoDB through Mongoose, React for the whole site in the browser (with jQuery AJAX for every call to the server), D3 for the charts, and Socket.io for the live chat. All the code is written as `.jsx` and bundled with esbuild.

## How it's organized

```
server.jsx          starts Express, the database and the live chat
config/db.jsx       the MongoDB connection
src/
  models/           Mongoose models (User, Perfume, Review, Group, GroupPost, Message, ...)
  controllers/      what each API route does
  routes/           the API routes and the page route
  middleware/       login sessions and request checks
  socket/           live chat and live updates
  utils/            shared helpers, photo uploads, the built-in catalog and groups
  data/             the built-in perfume catalog
seed/               demo members, reviews and group activity
client/
  pages/app.jsx     the browser entry point
  components/       React components, one folder per part of the site
  store/            the site's shared state and the actions that talk to the server
  lib/              small helpers (jQuery AJAX, formatting)
views/index.html    the page React draws into
public/             styles, fonts, images and the video
```

`npm run build` bundles the server into `dist/` and the browser code into `public/build/`; both are created on build and aren't stored in the repo.


## Running it

```bash
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

The first time it starts, LUMIERE loads its built-in perfume catalog and a handful of discussion groups by itself, so there's something to look at right away.


## Live demo (Render)

The repo includes a `render.yaml`, so it can be deployed on [Render](https://render.com) as a free web service:

1. In MongoDB Atlas, under **Network Access**, allow access from anywhere (`0.0.0.0/0`), since Render's addresses change.
2. On Render: **New → Blueprint**, pick this GitHub repo, and paste your `MONGO_URI` when asked.
3. Render installs, builds and starts the app, and gives you a public `https://….onrender.com` link.

On the free plan the site goes to sleep after about 15 minutes without visitors, so the first visit after that takes a little while to wake up.
