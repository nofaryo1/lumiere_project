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

Node.js and Express on the server, MongoDB through Mongoose, jQuery in the browser, a few React components, D3 for the charts, and Socket.io for the live chat.

## Getting started

You'll need **Node.js 20.19 or newer** and a **MongoDB** database. A free MongoDB Atlas cluster works fine, and so does MongoDB running on your own machine.

```bash
npm install
cp .env.example .env
```

Open `.env` and put in your own MongoDB connection string:

```
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority
```

For a local database, `mongodb://127.0.0.1:27017` is enough. The app keeps its data in a database called `lumiere`.

If you're on Atlas, add your computer's IP address under **Network Access**, or the server won't be able to connect.

## Running it

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

The first time it starts, LUMIERE loads its built-in perfume catalog and a handful of discussion groups by itself, so there's something to look at right away.

## Demo data (optional)

An empty community is a bit quiet. These two commands fill it with demo members, reviews, likes, follows and group posts:

```bash
npm run seed:community   # about 2,000 demo members — takes a few minutes
npm run seed:groups      # activity in the discussion groups
```

You can run them again whenever you like; they replace the old demo data and never touch real accounts. To clear the demo members out, run `npm run seed:community -- --remove`.

Demo members can't log in, so sign up on the site to get an account of your own.

## Good to know

- Photos people upload go into `public/uploads/`, which isn't tracked by git.
- Your `.env` holds the database password, so keep it out of git. It's already in `.gitignore`.
