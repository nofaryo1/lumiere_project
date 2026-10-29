# LUMIERE

A little social network for people who love perfume. Find new scents, see what others actually think of them, and chat with people who share your taste.

**Live site:** [https://lumiere-j9qr.onrender.com](https://lumiere-j9qr.onrender.com)

The full requirements document is in [SRS.md](SRS.md).

## What you can do

- **Browse perfumes:** see what's trending this week, this month or of all time, then filter by scent family, brand, notes or star rating, or search by name.
- **Rate and review:** leave a star rating and a few words on anything you've tried, mark other reviews as helpful, and vote on longevity, sillage, value for money and when to wear it.
- **Add missing perfumes:** add one with a photo and its three main notes, and edit or remove it later.
- **Follow people:** follow members whose taste you like and keep up with what they're doing in the activity feed.
- **Join groups:** join discussion groups, start threads, reply, like and edit posts, and search old posts. You can also create a group of your own, and edit or delete it.
- **Chat:** private messages arrive in real time, with "typing…", "Seen", online status and an unread badge.
- **Charts:** two charts on the homepage show review trends and how active the groups are, drawn from the live database.

## Built with

| Part | Technology |
| --- | --- |
| Server | Node.js and Express (MVC: models, controllers, routes) |
| Database | MongoDB (Atlas) through Mongoose |
| Browser | React 18 for the whole site, jQuery AJAX for every call to the server |
| Charts | D3.js |
| Live chat and updates | Socket.io |
| Styling | Plain CSS3 (no framework) |
| Build | esbuild bundles all the `.jsx` code |
| Hosting | Render (web service) + MongoDB Atlas |

## Running it on your computer

You need **Node.js 20.19 or newer** and a **MongoDB** database (a free MongoDB Atlas cluster works, or MongoDB installed locally).

1. Install the packages:

   ```bash
   npm install
   ```

2. Create a file called `.env` in the project folder (copy `.env.example`) and put your database address in it:

   ```
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority
   ```

   `.env` is listed in `.gitignore`, so the password never goes to GitHub.

3. Start the site:

   ```bash
   npm start
   ```

   This builds the code (`npm run build`) and starts the server. Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Name | Required | What it does |
| --- | --- | --- |
| `MONGO_URI` | yes | The MongoDB connection string. The app always uses the database named `lumiere` inside it. |
| `PORT` | no | The port to listen on (default `3000`; Render sets it by itself). |
| `NODE_ENV` | no | Set to `production` on Render: the server then trusts Render's proxy and sends the login cookie only over HTTPS. |
| `SEED_DB` | no | Only for the seed scripts: which database to fill (default `lumiere`). |

### Database setup

There's nothing to create by hand. The first time the server connects, it adds the built-in perfume catalog (100 perfumes) and 12 discussion groups by itself, and Mongoose creates the collections and indexes.

To fill a **new, empty** database with a realistic demo community (2,000 members with reviews, likes, follows and group activity), run once, in this order:

```bash
npm run seed:community
npm run seed:groups
```

Running `seed:community` again replaces all the demo members (and everything they wrote) with new ones, so don't run it on a database you want to keep as it is. Members who signed up themselves are never touched.

## The live site

The site is deployed on Render from this repository: [https://lumiere-j9qr.onrender.com](https://lumiere-j9qr.onrender.com).

- On the free plan the site goes to sleep after about 15 minutes without visitors, so the first visit after that takes up to a minute to wake up.
- Render reads `render.yaml`: it runs `npm install && npm run build`, then `npm start`, with `NODE_ENV=production`. `MONGO_URI` is set in Render's dashboard under **Environment**.
- In MongoDB Atlas, **Network Access** must allow `0.0.0.0/0`, because Render's addresses change.
- Every push to the `main` branch deploys the new version automatically.

## How it's organized

```
server.jsx          starts Express, the database connection and the live chat
config/db.jsx       the MongoDB connection
src/
  models/           Mongoose models (User, Perfume, Review, Group, GroupPost, Message, Upload, ...)
  controllers/      what each API route does
  routes/           the API routes (/api/...) and the page routes
  middleware/       login sessions, permission and request checks
  socket/           live chat and live updates (Socket.io)
  utils/            shared helpers, photo uploads, the built-in catalog and groups
  data/             the built-in perfume catalog
seed/               demo members, reviews and group activity
client/
  pages/app.jsx     the browser entry point
  components/       React components, one folder per part of the site
  store/            the site's shared state and the actions that talk to the server
  lib/              small helpers (jQuery AJAX, formatting)
views/index.html    the page React draws into
public/             styles, fonts, catalog photos and the video
```

`npm run build` bundles the server into `dist/` and the browser code into `public/build/`. Both are created on build and aren't stored in the repo.

Photos that members upload are stored in MongoDB (the `uploads` collection) and shown at `/uploads/perfumes/<file>`, so they stay available after the server restarts or is redeployed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Builds everything and starts the server |
| `npm run build` | Builds the server (`dist/`) and the browser code (`public/build/`) |
| `npm run seed:community` | Creates the demo members, reviews, likes and follows |
| `npm run seed:groups` | Creates the demo group memberships, posts and replies |

Add `-- --remove` to a seed command to remove that demo data instead.
