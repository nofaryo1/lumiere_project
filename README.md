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


## Running it

```bash
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
