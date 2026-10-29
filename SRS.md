# LUMIERE — Software Requirements Specification (SRS)

Final project, Web Applications Development course.
Live site: [https://lumiere-j9qr.onrender.com](https://lumiere-j9qr.onrender.com)

---

## Contents

1. [Introduction](#1-introduction)
2. [Overall description](#2-overall-description)
3. [System architecture](#3-system-architecture)
4. [Course requirements and where they are met](#4-course-requirements-and-where-they-are-met)
5. [Functional requirements](#5-functional-requirements)
6. [Database design](#6-database-design)
7. [Server: modules and functions](#7-server-modules-and-functions)
8. [API reference](#8-api-reference)
9. [Real-time features (Socket.io)](#9-real-time-features-socketio)
10. [Client: React application](#10-client-react-application)
11. [Charts (D3.js)](#11-charts-d3js)
12. [Validation and error handling](#12-validation-and-error-handling)
13. [Security](#13-security)
14. [Non-functional requirements](#14-non-functional-requirements)
15. [Build, deployment and configuration](#15-build-deployment-and-configuration)
16. [Known limitations](#16-known-limitations)
17. [Walk-through examples for the defense](#17-walk-through-examples-for-the-defense)

---

## 1. Introduction

### 1.1 Purpose

This document describes LUMIERE: what it does, how it is built, and how every major part of the code works and connects to the rest. It describes the system as it is actually implemented in this repository.

### 1.2 Scope

LUMIERE is a social network about perfumes. Visitors can browse and search a catalog of perfumes and read reviews. Members (registered users) can also:

- rate and review perfumes, like them, and vote on their performance;
- add perfumes that are missing, with a photo;
- follow other members and see their activity;
- join, create and manage discussion groups, write posts and replies;
- chat privately in real time.

The homepage also shows two live charts built from the database.

### 1.3 Definitions

| Term | Meaning |
| --- | --- |
| Visitor / guest | Someone using the site without logging in |
| Member | A registered, logged-in user |
| Slug | The short id in a URL, made from the name, e.g. `dior-sauvage` |
| Catalog perfume | One of the 100 built-in perfumes (`source: "catalog"`) |
| Community perfume | A perfume a member added (`source: "community"`) |
| Scent family | One of 8 categories: woody, floral, fresh, amber, citrus, musk, spicy, gourmand |
| Notes | The main ingredients a perfume smells of, e.g. "Bergamot, Pepper, Ambroxan" |
| Longevity / sillage | How long a perfume lasts / how far it projects |
| SPA | Single-page application: one HTML page, React draws every "page" in the browser |
| Hash route | The part of the URL after `#`, e.g. `#perfume/dior-sauvage`, used to choose the page |

### 1.4 Technologies

| Layer | Technology | Used for |
| --- | --- | --- |
| Server runtime | Node.js (20.19+) | Running the server |
| Web framework | Express 5 | HTTP server, routing, static files |
| Database | MongoDB (Atlas) | Storing all data |
| ODM | Mongoose 9 | Schemas, validation, queries, aggregation |
| Front end | React 18 | The whole user interface |
| AJAX | jQuery 3.7 (`$.ajax`) | Every request from the browser to the server |
| Charts | D3.js 7 | The two statistics charts |
| Real time | Socket.io 4.8 | Chat, typing, read receipts, presence, live updates |
| Passwords | bcryptjs | Hashing passwords |
| Config | dotenv | Reading `MONGO_URI` from `.env` |
| Build | esbuild | Bundling all `.jsx` code (server and browser) |
| Styling | CSS3 | Layout, design, the required CSS3 features |
| Hosting | Render + MongoDB Atlas | The live site |

---

## 2. Overall description

### 2.1 Users and what they can do

| Role | Can do |
| --- | --- |
| Visitor | Browse and search perfumes, open perfume pages, read reviews, see profiles, groups, posts, members and the charts, use the Help form |
| Member | Everything a visitor can, plus: like, review, vote, add perfumes, follow, join/leave groups, post/reply/like in groups, create groups, chat, edit their profile, delete their account |
| Owner of a perfume | The member who added it: edit its details, notes and photo, delete it |
| Creator of a group | The member who created it: edit the group and delete it |
| Author | The member who wrote a review or post: edit and delete it |

Members-only parts of the menu (Discover, Community, Reviews, Messages) show a lock for visitors. Clicking them opens the sign-up window instead.

### 2.2 Operating environment

- Any modern browser (tested in Chrome and Safari/WebKit), desktop and phone widths.
- The server runs anywhere Node.js runs; the live site runs on Render.
- The database is MongoDB Atlas (database name `lumiere`).

### 2.3 Data in the system

The live database currently holds about 2,006 members, 103 perfumes, 12,547 reviews, 26,000 likes, 33,900 follows, 12 groups and 12,817 group posts and replies. Most of it was created by the seed scripts (section 7.8) so the site looks like a real, active community.

---

## 3. System architecture

### 3.1 The big picture

```
 Browser                                   Server (Node.js + Express)                 MongoDB Atlas
┌────────────────────────────┐   jQuery   ┌──────────────────────────────────┐       ┌───────────────┐
│ React app (public/build)   │── AJAX ──▶ │ routes/api.jsx  (/api/...)       │       │ users         │
│  components  ← store ──────┼──────────▶ │   middleware/auth.jsx            │       │ perfumes      │
│  (views)       (state +    │  JSON      │   controllers/*.jsx  ───────────▶│ Mongoose ▶ reviews  ...   │
│                 actions)   │◀────────── │   models/*.jsx                   │       │ (14 collections)│
│                            │            │                                  │       └───────────────┘
│  Socket.io client ◀────────┼─ WebSocket ┤ socket/realtime.jsx (Socket.io)  │
└────────────────────────────┘            └──────────────────────────────────┘
```

1. The server sends one HTML page (`views/index.html`) with the React bundle.
2. React draws the page. Which "page" it shows depends on the hash in the URL.
3. Whenever the page needs data, it calls the server's JSON API with **jQuery AJAX** (`client/lib/api.jsx`).
4. The server's controllers read and write MongoDB through Mongoose models and answer with JSON.
5. A Socket.io connection (for logged-in members) carries chat messages and live updates in both directions.

### 3.2 MVC on the server

The server follows Model–View–Controller with a clear separation:

| MVC part | Where | What it contains |
| --- | --- | --- |
| **Model** | `src/models/` | 14 Mongoose schemas: the shape of the data and its rules |
| **Controller** | `src/controllers/` | The logic for each request: check input, check permission, read/write models, build the JSON answer |
| **View** | `views/index.html` + `client/` (React) | What the user sees. The server sends the page; React components render the data the controllers return |
| Routes | `src/routes/` | Connect each URL + HTTP method to a controller function |
| Middleware | `src/middleware/` | Code that runs before controllers: who is logged in, must-be-logged-in, same-origin check, rate limits |

### 3.3 Folder structure

```
server.jsx              entry point: Express app, static files, routes, DB connection, Socket.io
config/db.jsx           connects Mongoose to MongoDB (database "lumiere")
src/
  paths.jsx             finds the project folder (public/, views/, uploads/)
  models/               14 Mongoose models
  controllers/          auth, user, perfume, review, group, message, stats, contact, page
  routes/api.jsx        all /api routes
  routes/pages.jsx      "/" (the page) and /uploads/perfumes/:file (member photos)
  middleware/auth.jsx   sessions, passwords, requireUser, sameOrigin, rateLimit
  socket/realtime.jsx   Socket.io server: events, rooms, presence
  socket/chat.jsx       chat logic shared by the API and Socket.io
  utils/helpers.jsx     shared helpers (JSON shapes, stats, input trimming)
  utils/uploads.jsx     photo upload checks, saving and serving
  utils/perfumeKey.jsx  slugs and duplicate detection keys
  utils/catalog.jsx     loads the built-in catalog into the DB
  utils/groups.jsx      the 12 built-in groups
  utils/startup.jsx     runs once the DB is connected (catalog, groups, indexes, photos)
  data/catalog.jsx      the 100 built-in perfumes
seed/                   seed.jsx (entry), community.jsx, groups.jsx: demo data
client/
  pages/app.jsx         browser entry point: mounts <App/>
  components/           React components by feature (see section 10)
  store/                shared state and actions (see section 10)
  lib/                  api (jQuery AJAX), createStore, events, format, mount
views/index.html        the HTML page
public/                 css/style.css, fonts, images/perfumes, videos/video.mp4, uploads/
render.yaml             Render deployment settings
```

All source code is written as `.jsx`. esbuild turns it into `dist/server.js` (server) and `public/build/app.js` (browser).

### 3.4 Request life cycle (example: liking a perfume)

1. The member clicks ♥ on a perfume card (`components/common/PerfumeCard.jsx`).
2. The click calls `toggleLike(p)` in `client/store/session.jsx`. The button turns "pressed" at once.
3. `toggleLike` calls `api("/perfumes/dior-sauvage/like", { method: "PUT" })`, which sends a jQuery AJAX request.
4. Express runs `sameOrigin` → `loadUser` (reads the session cookie) → `requireUser` → `perfumeController.like`.
5. The controller checks the perfume exists, saves a `Like` document (upsert: never twice), and returns the new counts from `statsFor()`.
6. The store saves the new counts and the like, the components re-render, and a toast says "Added to your liked perfumes".

---

## 4. Course requirements and where they are met

Numbers refer to the instructor's requirements document.

| # | Requirement | Status | How / where |
| --- | --- | --- | --- |
| 15 | Node.js + Express server | Done | `server.jsx`, `src/routes`, `src/controllers` |
| 16 | Data stored in MongoDB | Done | Mongoose models in `src/models`, MongoDB Atlas |
| 17 | MVC with clear separation | Done | Models / controllers / views (section 3.2) |
| 18 | At least 3 models | Done | 14 models (section 6) |
| 19 | Create, Update, Delete, List, Search for each model, from the UI | Done | Table in 4.1 |
| 20 | At least 2 searches with 3+ user-chosen parameters | Done | 3 such searches, section 4.2 |
| 21 | (Optional) Group managers and permissions | Partly | Group creators manage their group (edit/delete); authors manage only their own content; private data stays private. No private groups or join approvals |
| 22 | (Optional) Own posts + feed | Partly | Profiles list a member's reviews, likes, added perfumes and groups; the "Following" activity feed shows what followed members do, including group posts. No dedicated feed of posts from my groups |
| 23 | (Optional) Enough data to look real | Done | Seed scripts: 2,000 members, 12,000+ reviews, 12,000+ group posts (section 7.8) |
| 24 | Edge cases, errors and validation on client and server; no crashes | Done | Section 12 |
| 25 | jQuery in the views, including AJAX to our server | Done | All server calls use `$.ajax` (`client/lib/api.jsx`); query strings use `$.param`; page-wide events (click-outside, Escape key, window resize, tab visibility, URL hash change) use `$(document).on` / `$(window).on` |
| 26 | React with Video and Canvas | Done | Whole UI is React. Video: `components/video/VideoBanner.jsx`. Canvas: `components/notes/NotesCanvas.jsx` |
| 27 | CSS3: text-shadow, transition, multiple columns, @font-face, border-radius | Done | `public/css/style.css`: `@font-face` (lines 1–15, Plus Jakarta Sans), `text-shadow` (video banner title), `transition` (buttons, cards, menus, ~20 rules), `columns: 2` with `column-rule` and `break-inside` (`.info-columns`, Privacy page), `border-radius` (~90 rules) |
| 28 | Chat between users with Socket.io | Done | Section 9 |
| 29 | 2+ D3 charts with live data from the DB | Done | Section 11 |
| 7 | Public git, no secrets | Done | `.env` is git-ignored; `.env.example` shows the format only |

### 4.1 CRUD + search per model (requirement 19)

| Model | Create | Update | Delete | List | Search |
| --- | --- | --- | --- | --- | --- |
| **User** | Sign up | Edit profile (name, bio) | Delete account (needs password) | Members page, followers/following lists | Members search (name or @username), `@name` in the header search |
| **Perfume** | Add a perfume (with photo) | Edit details, notes, photo (owner) | Delete (owner) | Trending carousel, profile tabs, "You might also like" | Search box + filters: family, brand, notes, rating |
| **Review** | Write a review | Edit own review | Delete own review | Perfume page, All reviews page, profile | All reviews: sort, scope, rating, date, keyword/reviewer |
| **Group** | Create a group | Edit (creator) | Delete (creator) | Groups page, home teaser, profile tab | Name/topic text + scent family + all/my groups |
| **GroupPost** | Post or reply | Edit own post/reply | Delete own post/reply | Group discussions, replies | Words or @member + date range + sort |
| Message | Send | — | (removed with the account) | Conversations and threads | Member search to start a chat |
| Like / Follow / GroupMember | Like, follow, join | — | Unlike, unfollow, leave | Liked tab, followers/following, group members | — |

### 4.2 Multi-parameter searches (requirement 20)

1. **Perfume search** (home page, "Trending perfumes"): free text (name, brand, note or family words) + scent family + brand + notes (several, comma-separated, with suggestions) + exact star rating, combined with the period (week, month, all time). Runs in the browser over the full perfume list (`client/store/trending.jsx`).
2. **Review search** (`#all-reviews`): sort (most helpful / newest) + scope (everyone / people I follow) + star rating + date (week, month, year) + reviewer or keyword, optionally for one perfume. Runs on the server: `GET /api/reviews?...` (`reviewController.list`).
3. **Group post search** (inside a group): words or @member + date (week, month, year) + sort (newest / top). Runs on the server: `GET /api/groups/:slug/posts?...` (`groupController.posts`).

---

## 5. Functional requirements

Each requirement has an id (FR-x), what the system does, and where it is implemented.

### 5.1 Accounts and sessions

| Id | Requirement | Implementation |
| --- | --- | --- |
| FR-1 | A visitor can sign up with name, username (3–20: letters, numbers, `_`, `.`), email and password (8+). They are logged in right away. | `AuthModal.jsx` → `POST /api/auth/signup` → `authController.signup` |
| FR-2 | A member can log in with email **or** username and password. | `POST /api/auth/login` → `authController.login` |
| FR-3 | A member can log out from the account menu, the mobile menu or their profile. | `POST /api/auth/logout` |
| FR-4 | The login lasts 30 days on that browser (cookie), and the header is drawn as logged-in on the next visit before the server answers. | `middleware/auth.jsx`, `store/session.jsx` (`rememberAccount`) |
| FR-5 | A member can edit their display name and bio. | `ProfilePage.jsx` → `PATCH /api/users/me` |
| FR-6 | A member can delete their account after typing their password. Their reviews, likes, votes, follows, memberships, posts, replies and chats are deleted; perfumes and groups they created stay. | `DELETE /api/users/me` → `userController.deleteMe` |

### 5.2 Perfumes

| Id | Requirement | Implementation |
| --- | --- | --- |
| FR-7 | Show trending perfumes ranked by activity (reviews + likes) this week, this month or of all time, in a scrollable carousel with arrows, a position counter (“1–5 of 103”) and keyboard arrows. When a perfume had at least 5 likes/reviews last week and has more this week, a ↑% badge shows the increase. | `home/Trending.jsx`, `store/catalog.jsx` (`rankedPerfumes`) |
| FR-8 | Filter by scent family (with counts), brand, notes (with suggestions) and exact star rating; "Clear filters". | `Trending.jsx`, `NotesFilter.jsx`, `store/trending.jsx` |
| FR-9 | Search by text from the header or hero search box, with live suggestions of perfumes and members; `@name` searches members only; Enter on `@name` opens the profile. Popular tags start a search. | `search/SearchBox.jsx` |
| FR-10 | A perfume page shows photo, brand, name, who added it, rating summary, families, notes, likes, reviews, weekly activity, community verdict (pros/cons), notes canvas, rating breakdown, performance meters, when to wear, and similar perfumes. | `perfume/PerfumePage.jsx` |
| FR-11 | A member can like/unlike a perfume; liked perfumes appear on their profile. | `PUT/DELETE /api/perfumes/:slug/like` |
| FR-12 | A member can vote longevity, sillage and value (1–5, click again to remove), pick seasons/times to wear, and agree with pros/cons. | `perfume/Opinions.jsx` → `PUT /performance`, `/wear`, `/agree` |
| FR-13 | A member can add a perfume: brand, name, families, exactly 3 notes, photo (required; any size, resized in the browser to max 1600 px JPEG). Duplicates are detected while typing and on save ("Sauvage EDP" = "Sauvage"). | `perfume/PerfumeForm.jsx` → `POST /api/perfumes` |
| FR-14 | The member who added a perfume can edit its details and photo, edit its notes from the perfume page, and delete it (with a confirm step). | `PATCH /api/perfumes/:slug`, `PUT /image`, `PUT /notes`, `DELETE` |
| FR-15 | Changes to perfumes (added, edited, deleted, notes) appear for everyone online without reloading. | Socket.io `perfume:*` events (section 9) |

### 5.3 Reviews

| Id | Requirement | Implementation |
| --- | --- | --- |
| FR-16 | A member can rate (1–5 stars) and review a perfume (10–1000 characters), edit and delete their own reviews. A member may write more than one review of the same perfume. | `perfume/Composer.jsx`, `reviewController` |
| FR-17 | Members can mark other members' reviews as "Helpful" (not their own). | `PUT/DELETE /api/reviews/:id/like` |
| FR-18 | The homepage shows the 3 most helpful reviews; "See all reviews" opens a full, searchable, paged list (10 at a time, "Load more"). | `home/Community.jsx`, `reviews/AllReviewsPage.jsx` |

### 5.4 Members and following

| Id | Requirement | Implementation |
| --- | --- | --- |
| FR-19 | Every member has a profile with stats and tabs: Liked, Reviews, Added, Groups, Followers, Following. | `profile/ProfilePage.jsx`, `GET /api/users/:username` |
| FR-20 | Members can follow/unfollow each other. | `PUT/DELETE /api/users/:username/follow` |
| FR-21 | The activity feed shows recent reviews, likes, follows, added perfumes, group joins and posts, for everyone or only people I follow. | `Community.jsx`, `GET /api/activity` |
| FR-22 | "Top reviewers" lists this month's most active reviewers with a follow button; it refreshes every minute and after new reviews. | `components/reviewers/` |
| FR-23 | A members directory lists and searches all members, 30 at a time. | `members/MembersPage.jsx`, `GET /api/members/all` |

### 5.5 Groups

| Id | Requirement | Implementation |
| --- | --- | --- |
| FR-24 | List all groups (sorted by posts this week, then members), "My groups", search by name/topic and family. | `groups/GroupsPage.jsx` |
| FR-25 | Join and leave groups. Only members of a group can post or reply in it. | `PUT/DELETE /api/groups/:slug/membership` |
| FR-26 | A group page shows info, members count, posts, discussions with sort/search/date filter, most discussed perfumes, and newest members. | `groups/GroupPage.jsx` |
| FR-27 | Write a post (2–2000 characters), optionally tagging a perfume; reply to posts; like others' posts; edit/delete own posts and replies. | `groups/PostItem.jsx`, `groupController` |
| FR-28 | Create a group (name 3+, description 10+, optional family); duplicate names are refused. The creator joins automatically and is the only one who can edit or delete it. | `groups/GroupForm.jsx` |

### 5.6 Chat

| Id | Requirement | Implementation |
| --- | --- | --- |
| FR-29 | Members can message each other privately, in real time, from `#messages` or a profile's "Message" button. | `chat/MessengerPage.jsx`, `socket/realtime.jsx` |
| FR-30 | The chat shows online status, "typing…", "Sending… / Sent / Seen / Not sent", day separators, older messages on demand, and an unread count in the menu and the tab title. | `chat/Thread.jsx`, `store/chat.jsx` |
| FR-31 | A pop-up appears for a new message when the member is elsewhere on the site (max 3, disappear after 7 seconds). | `layout/ChatPopups.jsx` |

### 5.7 Other

| Id | Requirement | Implementation |
| --- | --- | --- |
| FR-32 | Two live charts on the homepage (section 11). | `components/stats/` |
| FR-33 | About, Privacy (two-column text) and Help pages; the Help page has a contact form that is saved to the database. | `info/InfoPages.jsx`, `POST /api/contact` |
| FR-34 | A short muted video plays at the top of the homepage while it is on screen. | `video/VideoBanner.jsx` |
| FR-35 | Every page has its own URL (hash route), works with the browser's Back button, and Escape returns home. | `store/router.jsx` |

---

## 6. Database design

MongoDB database: `lumiere`. Each Mongoose model below is one collection. All models with `{ timestamps: true }` get `createdAt` and `updatedAt` automatically.

### 6.1 Relationships

```
User ─┬─< Review >── Perfume (by slug)
      ├─< Like >──── Perfume (by slug)
      ├─< PerformanceVote >── Perfume (by slug)
      ├─< Follow (follower) ; Follow (following) >─ User
      ├─< GroupMember >── Group
      ├─< GroupPost >──── Group        (GroupPost.parent → GroupPost for replies)
      ├─< Session
      └─< Message >── Conversation (2 participants: User, User)
Perfume.addedBy → User ; Group.createdBy → User ; Upload ← Perfume.image (by path)
```

Perfumes are referenced by their **slug** (a string such as `dior-sauvage`) rather than by ObjectId. Slugs never change, even when a perfume is renamed, so links and reviews keep working.

### 6.2 Collections

**User** (`users`)

| Field | Type | Notes |
| --- | --- | --- |
| username | String | unique, lowercase, 3–20 chars |
| email | String | unique, lowercase; never sent to other users |
| displayName | String | required |
| passwordHash | String | bcrypt hash (cost 12); the password itself is never stored |
| bio | String | up to 160 chars |
| seeded | Boolean | true for demo members made by the seed script |

Method `toPublic()` returns only `username, displayName, bio, joinedAt` — the only user data the API ever sends.

**Perfume** (`perfumes`)

| Field | Type | Notes |
| --- | --- | --- |
| slug | String | unique id in URLs |
| brand, name | String | |
| key, nameKey | String | indexed, normalized keys for duplicate detection |
| tags | [String] | scent families |
| notes | [String] | main notes |
| image | String | `/images/perfumes/<slug>.jpg` (catalog) or `/uploads/perfumes/<file>` (member photo) |
| source | `catalog` \| `community` | |
| addedBy, notesAddedBy | ObjectId → User | who added it / its notes |

**Review** (`reviews`): `user` → User, `perfume` (slug), `rating` 1–5, `text`, `likedBy` [User], `likesCount`. Indexes on perfume, (user, perfume), createdAt, (likesCount, createdAt).

**Like** (`likes`): `user` → User, `perfume` (slug). Unique (user, perfume): you can like a perfume once.

**PerformanceVote** (`performancevotes`): one document per (user, perfume): `longevity`, `sillage`, `value` (1–5 or null), `wear` [Spring…Night], `agree` ["pros:…" / "cons:…", max 30].

**Follow** (`follows`): `follower` → User, `following` → User. Unique pair.

**Group** (`groups`): `slug` (unique), `name`, `nameKey` (unique, normalized name), `description`, `family`, `source` (`builtin` / `member`), `createdBy` → User.

**GroupMember** (`groupmembers`): `group` → Group, `user` → User. Unique pair.

**GroupPost** (`groupposts`): `group` → Group, `user` → User, `parent` → GroupPost (null for a post, set for a reply), `text`, `perfume` (slug, optional), `likedBy`, `likesCount`, `repliesCount`, `editedAt`.

**Conversation** (`conversations`): `participants` [2 Users], `key` (unique: the two user ids sorted and joined, so each pair has exactly one conversation), `lastMessage { text, sender, at }`.

**Message** (`messages`): `conversation`, `sender`, `recipient`, `text`, `readAt` (null until read).

**Session** (`sessions`): `tokenHash` (SHA-256 of the cookie token), `user`, `expiresAt`. A TTL index deletes expired sessions automatically.

**ContactRequest** (`contactrequests`): `name`, `email`, `message`, `user` (if logged in), `handled`.

**Upload** (`uploads`): `path` (unique, e.g. `/uploads/perfumes/x.jpg`), `contentType`, `data` (the image bytes). Holds the photos members upload (section 7.6).

### 6.3 Derived numbers (not stored)

Counts such as a perfume's number of reviews, rating average, likes, weekly activity, a group's members and posts, or a member's followers are **calculated** with MongoDB aggregation when requested, so they are always correct and never get out of sync.

---

## 7. Server: modules and functions

### 7.1 `server.jsx` (entry point)

1. Loads `.env` (dotenv).
2. Creates the Express app. In production it trusts Render's proxy (`trust proxy`), so the visitor's real IP is used for rate limits.
3. Serves static files from `public/` (CSS, fonts, images, video, the React bundle).
4. Mounts the API at `/api` (`src/routes/api.jsx`).
5. Loads `src/utils/startup.jsx` and connects to MongoDB (`config/db.jsx`).
6. Mounts the page routes (`/`, `/uploads/perfumes/:file`).
7. Creates the HTTP server and attaches Socket.io (`attachRealtime`), then listens on `PORT` (default 3000).

### 7.2 `config/db.jsx` and `src/paths.jsx`

- `connectDB()` connects Mongoose to `MONGO_URI` with `dbName: "lumiere"` and logs the result. If the connection fails, the error is logged and the server keeps running (API calls then return errors instead of crashing).
- `paths.jsx` finds the project root (the folder with `package.json`), because the running code lives in `dist/`. It exports `PUBLIC`, `VIEWS` and `UPLOADS`.

### 7.3 `src/utils/startup.jsx`

Runs once the database is connected:

1. `Review.syncIndexes()` — makes sure the review indexes exist.
2. `seedCatalog()` — inserts/updates the 100 built-in perfumes from `src/data/catalog.jsx` (upsert, so it is safe to run on every start; member perfumes are never touched).
3. `seedGroups()` — inserts/updates the 12 built-in groups.
4. `syncUploads()` — copies any member photo that exists on this server's disk but not yet in the database into the `uploads` collection.

### 7.4 Middleware (`src/middleware/auth.jsx`)

| Function | What it does |
| --- | --- |
| `hashPassword`, `checkPassword` | bcrypt hash (cost 12) and compare |
| `startSession(res, user)` | Makes a random 32-byte token, stores its SHA-256 hash in `Session` (30 days), sets the `lumiere_session` cookie (HttpOnly, SameSite=Lax, Secure in production) |
| `endSession` | Deletes the session and clears the cookie |
| `userFromCookieHeader` | Finds the logged-in user from a cookie header (used by the API and by Socket.io) |
| `loadUser` | Runs on every API request and sets `req.user` (or null) |
| `requireUser` | Answers 401 "Please log in first." if nobody is logged in |
| `sameOrigin` | Blocks changing requests (POST/PUT/PATCH/DELETE) coming from another website (CSRF protection) |
| `rateLimit({ max, windowMs })` | Limits requests per IP: sign-up/login 20 per 15 minutes, contact form 5 per 15 minutes |

### 7.5 Controllers

**`authController`** — `signup` (validates fields, refuses taken username/email with 409, creates the user, starts a session), `login` (always runs bcrypt, even for unknown users, so response time doesn't reveal which accounts exist), `logout`, `me` (current user + their likes, reviews and who they follow).

**`userController`**
- `profile` — a member's public profile, likes, reviews, added perfumes, follower counts, groups.
- `updateMe`, `deleteMe` — edit profile; delete account and everything personal (see FR-6).
- `follow`, `unfollow`, `followers`, `following`.
- `search` — quick member search, ranked (exact match, then starts-with, then word starts-with).
- `directory` — the paged Members list with search.
- `top` — top reviewers (all time or this month) using one aggregation with `$lookup` for user names and follower counts.
- `activity` — merges the latest reviews, likes, follows, added perfumes, joins and posts into one time-sorted feed; `scope=following` limits it to people I follow.

**`perfumeController`**
- `list` — all perfumes plus stats per perfume (reviews, rating sum, likes, this week, last week, this month), from two aggregations.
- `check` — "is this perfume already here?" (`findDuplicate`: same normalized brand+name, or same name with a matching/empty brand).
- `create` — the photo is the request body, the details are in the `X-Perfume` header (JSON). Validates fields and photo, refuses duplicates (409 with a link to the existing one), makes a unique slug, saves the photo, creates the perfume, tells everyone (`perfume:added`).
- `update`, `updateImage`, `updateNotes`, `remove` — owner only (`ownPerfume` → 403 otherwise). Deleting also removes its reviews, likes, votes and photo, and untags posts.
- `performance`, `votePerformance`, `voteWear`, `voteAgree` — the voting data: counts per level, voters, and my own votes.
- `like`, `unlike` — return fresh stats.

**`reviewController`** — `forPerfume` (top 60 reviews by helpfulness + all of mine + star breakdown), `create`, `update`, `remove` (author only), `list` (the searchable All reviews list), `markHelpful` / `unmarkHelpful` (atomic: a member can count once; not on their own review).

**`groupController`** — `list`, `check`, `create`, `show` (stats, am I a member, newest members, most discussed perfumes), `update` / `remove` (creator only), `join`, `leave`, `members`, `posts` (searchable, paged), `replies`, `createPost` (members only; replies only to top-level posts; tagged perfume must exist), `updatePost` / `deletePost` (author only; deleting a post deletes its replies), `likePost` / `unlikePost`.

**`messageController`** — `conversations` (my chats + total unread), `open` (find or create the chat with a member, optionally with the latest 30 messages), `messages` (paged by `before` date), `unread`.

**`statsController`** — `reviewTrends` and `groupPosts` for the charts (section 11). Results are cached for 60 seconds.

**`contactController`** — saves the Help form.

**`pageController`** — sends `views/index.html`.

### 7.6 Photo uploads (`src/utils/uploads.jsx`)

- `imageBody` — accepts the raw image body (JPEG, PNG or WebP only, max 5 MB).
- `isImage(req)` — checks both the declared type **and** the file's first bytes (its "magic number"), so a renamed non-image is refused.
- `saveImage(slug, req)` — stores the photo in the `uploads` collection under a new unique name `<slug>-<time>.<ext>` and returns its address `/uploads/perfumes/<file>`.
- `serveUpload` — answers `GET /uploads/perfumes/:file` from the database, with a one-year browser cache (each name is used only once, so it never needs re-checking).
- `removeUpload` — deletes a replaced or deleted perfume's photo.
- `syncUploads` — see 7.3.

Why the database and not only the disk: the hosting service (Render, free plan) starts every restart and redeploy from a clean copy of the code, so files written to its disk disappear. Keeping photos in MongoDB means every server shows the same photos and they survive restarts.

### 7.7 Helpers

- `utils/helpers.jsx`: `text(value, max)` (only strings, trimmed, cut to a maximum length — used for every text input), `perfumeJSON`, `reviewJSON`, `authorJSON`, `meJSON` (the shapes sent to the browser), `statsFor(slug)`, `escapeRegex` (so a search for `a.b` doesn't act as a regular expression), `limitParam` (keeps page sizes in a safe range), `followingIds`, `requirePerfume`, `reviewsChanged` (tells everyone online that reviews changed).
- `utils/perfumeKey.jsx`: `slugify` ("Dior Sauvage" → `dior-sauvage`), `normalize` (lowercase, no accents/punctuation, ignores words like "EDP", "Eau de Parfum", "ml"), `nameKey`, `perfumeKey` — used for duplicate detection.

### 7.8 Seed scripts (`seed/`)

`npm run seed:community` (`seed/community.jsx`) creates 2,000 demo members (`seeded: true`) with realistic names and bios, spread-out join dates, reviews (written from templates that match each perfume's notes), helpful votes, likes and follows. Popular perfumes get more activity. A fixed random seed makes the result repeatable. `npm run seed:groups` (`seed/groups.jsx`) adds group memberships, posts and replies that match each group's topic. Both can be undone with `-- --remove`, which removes only demo members and what they created.

---

## 8. API reference

All API addresses start with `/api`, take and return JSON, and answer errors as `{ "error": "message", "fields": { ... } }` with a matching HTTP status (400 invalid input, 401 not logged in, 403 not allowed, 404 not found, 409 duplicate/taken, 413 too large, 429 too many requests, 500 unexpected).

🔒 = must be logged in.

**Accounts**

| Method & path | Purpose |
| --- | --- |
| POST `/auth/signup` | Create account and log in |
| POST `/auth/login` | Log in |
| POST `/auth/logout` | Log out |
| GET `/auth/me` | Who am I (+ my likes, reviews, follows) |
| GET `/users/:username` | Public profile |
| PATCH `/users/me` 🔒 | Edit my name and bio |
| DELETE `/users/me` 🔒 | Delete my account (body: password) |
| PUT / DELETE `/users/:username/follow` 🔒 | Follow / unfollow |
| GET `/users/:username/followers`, `/following` | Follow lists |
| GET `/members?search=&limit=` | Quick member search |
| GET `/members/all?search=&limit=&offset=` | Members directory |
| GET `/members/top?period=month&limit=` | Top reviewers |
| GET `/activity?scope=all\|following&limit=` | Activity feed |

**Perfumes**

| Method & path | Purpose |
| --- | --- |
| GET `/perfumes` | All perfumes + stats |
| GET `/perfumes/check?brand=&name=&except=` | Duplicate check |
| POST `/perfumes` 🔒 | Add (photo as body, details in `X-Perfume` header) |
| PATCH `/perfumes/:slug` 🔒 | Edit details (owner) |
| PUT `/perfumes/:slug/image` 🔒 | Replace photo (owner) |
| PUT `/perfumes/:slug/notes` 🔒 | Edit notes (owner) |
| DELETE `/perfumes/:slug` 🔒 | Delete (owner) |
| PUT / DELETE `/perfumes/:slug/like` 🔒 | Like / unlike |
| GET `/perfumes/:slug/performance` | Votes summary (+ mine) |
| PUT `/perfumes/:slug/performance` 🔒 | Vote longevity/sillage/value |
| PUT `/perfumes/:slug/wear` 🔒 | Pick/unpick a season or time |
| PUT `/perfumes/:slug/agree` 🔒 | Agree/un-agree with a pro or con |

**Reviews**

| Method & path | Purpose |
| --- | --- |
| GET `/perfumes/:slug/reviews` | A perfume's reviews + star breakdown |
| POST `/perfumes/:slug/reviews` 🔒 | Write a review |
| PUT `/reviews/:id` 🔒 | Edit my review |
| DELETE `/reviews/:id` 🔒 | Delete my review |
| GET `/reviews?sort=&scope=&rating=&since=&q=&perfume=&limit=&offset=` | Search all reviews |
| PUT / DELETE `/reviews/:id/like` 🔒 | Mark / unmark helpful |

**Groups**

| Method & path | Purpose |
| --- | --- |
| GET `/groups` | All groups (+ am I a member) |
| GET `/groups/check?name=&except=` | Is the name taken |
| POST `/groups` 🔒 | Create |
| GET `/groups/:slug` | Group details |
| PATCH / DELETE `/groups/:slug` 🔒 | Edit / delete (creator) |
| PUT / DELETE `/groups/:slug/membership` 🔒 | Join / leave |
| GET `/groups/:slug/members` | Member list (available; the UI shows the newest members from `/groups/:slug`) |
| GET `/groups/:slug/posts?sort=&q=&since=&limit=&offset=` | Search posts |
| GET `/groups/:slug/posts/:id/replies` | Replies |
| POST `/groups/:slug/posts` 🔒 | Post or reply (`parent`) |
| PATCH / DELETE `/group-posts/:id` 🔒 | Edit / delete my post |
| PUT / DELETE `/group-posts/:id/like` 🔒 | Like / unlike a post |

**Chat, stats, contact**

| Method & path | Purpose |
| --- | --- |
| GET `/conversations` 🔒 | My chats + unread total |
| POST `/conversations` 🔒 | Open a chat with a member |
| GET `/conversations/:id/messages?before=` 🔒 | Messages (paged) |
| GET `/messages/unread` 🔒 | Unread count (available; the UI gets it from `/conversations` and Socket.io) |
| GET `/stats/review-trends` | Data for the Review trends chart |
| GET `/stats/group-posts` | Data for the Group activity chart |
| POST `/contact` | Help form |

**Pages and files (outside `/api`)**: `GET /` (the page), `GET /uploads/perfumes/:file` (member photos), and static files from `public/` (`/css`, `/fonts`, `/images`, `/videos`, `/build`).

---

## 9. Real-time features (Socket.io)

File: `src/socket/realtime.jsx` (server) and `client/store/chat.jsx` (browser). Chat logic shared with the API is in `src/socket/chat.jsx`.

### 9.1 Connecting

- Only logged-in members connect. The browser sends its session cookie, and the server identifies the user with `userFromCookieHeader`; otherwise the connection is refused ("unauthorized").
- Connections from other websites are refused (`allowRequest` compares the Origin with the host).
- Each member joins a private room `user:<id>`, so messages can be sent to all of that member's open tabs.
- The server counts open connections per member to know who is **online**.

### 9.2 Events

| Direction | Event | Payload / purpose |
| --- | --- | --- |
| browser → server | `message:send` | `{ conversationId, text, clientId }`; the server saves the message and answers through an acknowledgement `{ ok, message }` or `{ error }`. Limited to 20 messages per 10 seconds |
| browser → server | `typing` | `{ conversationId }` (sent at most every 2 seconds while typing) |
| browser → server | `conversation:read` | Marks my messages in that chat as read |
| browser → server | `presence:query` | List of usernames → answers which are online |
| server → browser | `message:new` | New message + updated conversation (+ total unread for the recipient; + `clientId` for the sender so the "Sending…" bubble is replaced) |
| server → browser | `typing` | The other member is typing (shown for 3.5 s) |
| server → browser | `conversation:read` | The other member read my messages → "Seen" |
| server → browser | `unread:changed` | My new unread total |
| server → browser | `presence` | A member came online / went offline |
| server → everyone | `perfume:added`, `perfume:changed`, `perfume:deleted`, `perfume:notes` | Keep every open page's perfume list up to date |
| server → everyone | `reviews:changed` | Reviews changed → Top reviewers refreshes |

### 9.3 Sending a message, step by step

1. The member types and presses Enter (`chat/Thread.jsx`).
2. `sendChat()` adds a temporary "Sending…" bubble right away and emits `message:send`.
3. The server checks the text (1–2000 characters) and that the member belongs to the conversation, saves a `Message`, updates the conversation's `lastMessage`.
4. The server emits `message:new` to the recipient (with their unread count) and to the sender's other tabs, and acknowledges the sender. The temporary bubble is replaced by the saved message ("Sent").
5. If the recipient has the chat open, their browser emits `conversation:read`; the sender receives `conversation:read` and shows "Seen". Otherwise the recipient sees a pop-up and the unread badge.
6. If the connection drops, a "Reconnecting to live chat…" note appears; after reconnecting, the chat list and open thread reload so nothing is missed.

---

## 10. Client: React application

### 10.1 How the browser app works

- `views/index.html` contains only `<div id="root">`, the CSS, the Socket.io client script and the bundle `/build/app.js`.
- `client/pages/app.jsx` mounts the `<App/>` component (`lib/mount.jsx`, rendered synchronously so the first paint is complete).
- **State** lives in small shared stores (`client/lib/createStore.jsx`): a plain object plus a version number. A component that calls `app.use()` re-renders whenever the store changes (React's `useSyncExternalStore`). There are two stores: `app` (everything) and `chat` (the messenger, so chat updates don't redraw the whole site).
- **Actions** (functions in `client/store/*.jsx`) call the server with `api()`, update the store, and show toasts. Components only display data and call actions.
- **Routing**: `store/router.jsx` reads `location.hash` on load and on every `hashchange` (`route()`), decides which view to show, and loads its data. The home page stays in the page (hidden) while another view is open, so going back restores the scroll position.

### 10.2 `client/lib`

| File | What it does |
| --- | --- |
| `api.jsx` | `api(path, { method, body, file, headers })` — the only way the app talks to the server. Uses `jQuery.ajax`, sends JSON or a raw file, parses the answer, and turns errors into `Error` objects with `status` and `data` (field errors). `query()` builds query strings with `$.param` |
| `createStore.jsx` | The tiny state container described above |
| `events.jsx` | `on` / `emit` for page-wide notices (`auth`, `follow`, `reviews-changed`) |
| `format.jsx` | `formatCount` (1.2k), `timeAgo` (5m ago), `fmtTime`, `dayLabel` (Today/Yesterday), `initialsOf`, `hash` |
| `mount.jsx` | Renders the app into `#root` |

### 10.3 `client/store` (state and actions)

| File | Main functions |
| --- | --- |
| `app.jsx` | The main store (perfumes, session, filters, groups, current view, open forms, toast…) and `byId(slug)` |
| `session.jsx` | `setSession`, `submitAuth`, `logout`, `deleteAccount`, `saveProfile`, `toggleLike`, `toggleFollow`, `onAuthChange` (reloads what depends on who is logged in) |
| `catalog.jsx` | The 8 `families`, `buildPerfume` (adds stats, score, trend %, and the drawn-bottle look), `ratingFor`, `rankedPerfumes`, `matchesQuery`, `ownsPerfume`, `loadCatalog`, `syncNewPerfumes`, `updatePerfume`, `removePerfume`, `applyNotes` |
| `trending.jsx` | Filters and search: `setTrending`, `setFamily`, `runSearch`, `clearFilters`, `matchesPerfumeFilters`, `filterOptions` (brands and notes taken from the data) |
| `perfumePage.jsx` | Perfume page logic: `baseDetails` (see 10.6), `similarPerfumes`, `loadPerformance`, `loadRealReviews`, `votePerformance`, `toggleOpinion`, `saveReview`, `deleteReview`, `submitNotes`, `createPerfume`, `saveEditedPerfume`, `deletePerfume`, `checkPerfumeExists` |
| `community.jsx` | `loadPopularReviews`, `loadActivity`, `setActivityScope`, `refreshCommunity`, `toggleHelpful`, `patchReview` (updates a review everywhere it is shown) |
| `reviews.jsx` | All reviews page: `loadAllReviews`, `setReviewFilters`, `setReviewQuery` (waits 300 ms after typing) |
| `members.jsx` | Members page: `loadMembers`, `setMembersQuery` |
| `profile.jsx` | `setProfileTab` (loads followers/following when opened), `setProfileMode` |
| `groups.jsx` | `loadGroups`, `loadGroup`, `loadGroupPosts`, `toggleMembership`, `submitPost`, `submitReply`, `saveEditedPost`, `deletePost`, `togglePostLike`, `toggleReplies`, `createGroup`, `saveEditedGroup`, `deleteGroup`, `checkGroupName` |
| `chat.jsx` | The messenger store and Socket.io client: `startMessenger` (connect when logged in), `showMessenger`, `loadMessages`, `sendChat`, `sendTyping`, `markActiveRead`, `prefetchThread`, `setUnread`, pop-ups |
| `router.jsx` | `route`, `showHome`, `openPerfume`, `goBack`, `currentPerfume`, `runAfterRender` (scroll/focus after drawing) |
| `ui.jsx` | `toast`, `openAuth` / `closeAuth` (sign-up/login window), `setTitle` (adds the unread count to the tab title), `share` (copies a link) |

### 10.4 Components (`client/components`)

| Folder | Components | Role |
| --- | --- | --- |
| (root) | `App.jsx` | Page shell: header, home, the current view, footer, auth window, chat pop-ups, toast. Starts the app (`start()`: loads `/auth/me` and `/perfumes` together), handles Escape and tab visibility |
| `layout/` | `Header`, `Footer`, `AuthModal`, `ChatPopups`, `FieldError` | Header with search, menu (locked items for visitors), account menu, mobile menu and unread badge; sign-up/login window with field errors |
| `search/` | `SearchBox` | Header and hero search with perfume and member suggestions and keyboard navigation |
| `home/` | `HomePage`, `Hero`, `Trending`, `NotesFilter`, `Community`, `GroupsTeaser` | Homepage sections; `HomePage` also remembers section heights so a refresh doesn't jump |
| `video/` | `VideoBanner`, `VideoCaption`, `useAutoplayWhileVisible`, `shouldAutoplay` | **React video**: muted looping `<video>` that plays only while visible (IntersectionObserver), not when the user prefers reduced motion or data saving, and hides itself if the file fails |
| `notes/` | `NotesCanvas`, `NotesBlock`, `drawNotes`, `fitLabel`, `hoverSpring`, `palette` | **React canvas**: draws the notes as colored circles (see 10.5) |
| `perfume/` | `PerfumePage`, `Opinions` (bars, meters, wear, verdict), `Composer`, `ReviewItem`, `NotesPanel`, `PerfumeForm` | Perfume page and the add/edit form |
| `reviews/` | `ReviewCard`, `ActivityItem`, `AllReviewsPage` | Review cards, the activity feed rows, the All reviews page |
| `reviewers/` | `TopReviewers`, `ReviewerList`, `ReviewerRow`, `FollowButton`, `PanelHeader`, `useTopReviewers` | This month's top reviewers |
| `profile/` | `ProfilePage` | Profile, its tabs, edit form and delete-account box |
| `members/` | `MembersPage` | Members directory |
| `groups/` | `GroupsPage`, `GroupPage`, `GroupCard` (+ `GroupIcon`, `JoinButton`), `PostItem`, `GroupForm` | Groups |
| `chat/` | `MessengerPage`, `ConversationList`, `Thread`, `MemberSearch` | Messenger |
| `stats/` | `TrendsChart`, `GroupChart`, `chartKit` | **D3 charts** (section 11) |
| `info/` | `AboutPage`, `HelpPage`, `PrivacyPage` | Info pages and the contact form |
| `common/` | `PerfumeCard`, `PerfumeMedia` (+ `BottleThumb`), `RatingRow`, `Stars`, `Avatar`, `MemberLink`, `MemberRow`, `FollowButton`, `HelpfulButton`, `OwnerButtons`, `JoinPrompt`, `BackButton`, `Icon`, `Toast` | Shared building blocks |

### 10.5 The notes canvas (React + Canvas)

`NotesCanvas` renders a `<canvas>` and, in a React effect, draws one circle per note with `drawNotes` (2D canvas API):

- the canvas is sized for the screen's pixel density so it stays sharp;
- up to 4 notes in one row, more in two rows;
- `fitLabel` shrinks or splits a note name into two lines so it fits inside its circle;
- the circles grow in when first shown (380 ms), and the hovered circle springs up a little (`hoverSpring`);
- a `ResizeObserver` redraws it when its size changes;
- it has an accessible text label ("3 notes: Bergamot, Pepper, Ambroxan").

It is used on every perfume page, and as a live preview while typing notes in the add/edit forms.

### 10.6 Perfume page numbers: real and estimated

- Ratings, reviews, likes, the rating breakdown, and all members' votes come from the database.
- So that a perfume with few votes doesn't look empty, the page also starts from **estimated base numbers** for the pros/cons list, the performance meters and "when to wear". `baseDetails()` computes them in the browser, the same way every time, from the perfume's scent families and its review count. Members' real votes are added on top of the base numbers.

### 10.7 Perfume photos in the browser

`PerfumeMedia` shows the photo (`loading="lazy"`), and always draws a simple bottle (`BottleThumb`, SVG, colored by scent family) behind it. If a photo fails to load, the bottle is shown instead, so a card never shows a broken-image icon.

---

## 11. Charts (D3.js)

Both charts are React components in `client/components/stats/`. React draws the summary boxes, legend and data table; D3 draws the chart itself (`<svg>`) inside a React effect, and redraws it when the panel's width changes. Both charts show a crosshair and tooltip on hover, can be explored with the keyboard (← → keys, Escape), and include a "Show data table" option.

### 11.1 Review trends (`TrendsChart.jsx`)

- **Data:** `GET /api/stats/review-trends` (`statsController.reviewTrends`). An aggregation groups all reviews by perfume and by week (`$dateTrunc`), then builds **running totals** for the last 52 weeks, the total per week, and the **leader** (most-reviewed perfume) of each week. The 5 most-reviewed perfumes (including past leaders) are returned.
- **Drawing:** a time scale (`scaleUtc`) for weeks, a linear scale for the totals, one smooth line per perfume (`d3.line` + `curveMonotoneX`), a "Leader" strip of colored cells under the chart, and a label at the end of the current leader's line.
- **Summary boxes:** total reviews (and new in the last 4 weeks), most reviewed right now, how many times the lead changed this year.

### 11.2 Group activity (`GroupChart.jsx`)

- **Data:** `GET /api/stats/group-posts` (`statsController.groupPosts`). An aggregation counts top-level posts per group per month for the last 12 months.
- **Drawing:** one line per group for the 5 busiest groups; the current month is dashed and marked "so far", because it isn't over yet.
- **Summary boxes:** posts this year, busiest group this month, busiest month.

Both endpoints cache their answer for 60 seconds, so the charts always reflect the database without recalculating on every visit.

---

## 12. Validation and error handling

### 12.1 In the browser (before sending)

| Form | Checks |
| --- | --- |
| Sign up | Server field errors are shown under each field |
| Review | A star rating is chosen; text has 10+ characters; character counter (max 1000) |
| Add/edit perfume | Brand and name filled; exactly 3 notes; photo required when adding, must be a readable image; resized to max 1600 px and 5 MB; duplicate warning while typing disables the button |
| Notes edit | Exactly 3 notes |
| Group | Name 3+ characters (taken names warned while typing), description 10+ |
| Post / reply / edit | At least 2 characters; a tagged perfume must be picked from the list |
| Profile | Name required |
| Delete account | Password required |
| Help | Name required, valid email |

### 12.2 On the server (always, even if the browser checks were skipped)

- Every text input goes through `text(value, max)`: only strings, trimmed and length-limited.
- Every field is re-validated with the same rules as above, plus username format, email format, password length, rating 1–5, levels 1–5, allowed families and seasons, notes count.
- Ids are checked with `mongoose.isValidObjectId` before queries, so bad ids answer 404 instead of crashing.
- Unique indexes and upserts prevent double likes, double follows, double memberships and two chats for the same pair.
- JSON bodies are limited to 20 KB, images to 5 MB; bad JSON answers 400, too-large uploads 413.
- A final error handler answers any unexpected error with 500 "Something went wrong" and logs it; the server keeps running.

### 12.3 Showing errors

Errors appear next to the field that caused them, in a message line in the form, or as a short toast. If the server can't be reached at all, the message says so ("Can't connect to the LUMIERE server…"). Pages that don't exist show "This perfume/group doesn't exist (anymore)" or "We couldn't find @name".

---

## 13. Security

| Topic | How it is handled |
| --- | --- |
| Passwords | bcrypt (cost 12); never stored or sent in plain text |
| Sessions | Random 256-bit token in an HttpOnly, SameSite=Lax cookie (Secure on HTTPS); only its SHA-256 hash is stored; expires after 30 days |
| Login timing | bcrypt runs even for unknown accounts |
| CSRF | SameSite cookie + `sameOrigin` check on every changing request; Socket.io accepts only same-site connections |
| Permissions | Every change checks ownership on the server: only the author edits/deletes a review or post, only the adder changes a perfume, only the creator changes a group, only members post in a group, only participants read a chat |
| Private data | Emails and password hashes are never sent to the browser; profiles expose only name, username, bio and join date |
| Abuse | Rate limits on login/sign-up and the contact form; chat limited to 20 messages per 10 s |
| Injection | Search text is escaped before being used in a regular expression; inputs are typed and trimmed |
| Uploads | Only JPEG/PNG/WebP, checked by file signature, max 5 MB |
| Secrets | `MONGO_URI` is read from `.env` / Render settings; `.env` is git-ignored |

---

## 14. Non-functional requirements

| Id | Requirement | How it is met |
| --- | --- | --- |
| NFR-1 Usability | Clear, consistent design; every action gives feedback (toasts, pressed buttons, loading text) | Shared components and styles |
| NFR-2 Responsiveness | Works from phone (390 px) to desktop | CSS grid/flex layouts and media queries; mobile menu |
| NFR-3 Performance | Pages switch without reloading; lists are paged; counts come from indexed aggregations; chart data cached 60 s; photos lazy-loaded; member photos cached by the browser | SPA, indexes on every searched field |
| NFR-4 Real time | Chat and live updates arrive within a moment | Socket.io |
| NFR-5 Reliability | Bad input never crashes the server; the app shows a message when something fails; uploaded photos survive restarts | Section 12, uploads in MongoDB |
| NFR-6 Accessibility | Labels on buttons and inputs, keyboard navigation (carousel, suggestions, charts, Escape), visible focus, alt text, reduced-motion support | ARIA attributes in components |
| NFR-7 Maintainability | MVC on the server, feature folders on the client, one place for server calls (`api.jsx`) | Section 3 |
| NFR-8 Portability | Runs anywhere with Node.js 20.19+ and a MongoDB URI | `package.json` engines, `.env` |
| NFR-9 Security | Section 13 | |

---

## 15. Build, deployment and configuration

### 15.1 Scripts (`package.json`)

| Script | Command |
| --- | --- |
| `build:server` | esbuild bundles `server.jsx` and `seed/seed.jsx` into `dist/` (Node, CommonJS; npm packages stay external) |
| `build:client` | esbuild bundles `client/pages/app.jsx` into `public/build/app.js` (ES module, minified, with a source map) |
| `build` | both |
| `start` | runs `build` first (`prestart`), then `node dist/server.js` |
| `seed:community`, `seed:groups` | build the server, then run `dist/seed/seed.js community` / `groups` |

### 15.2 Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `MONGO_URI` | yes | MongoDB connection string |
| `PORT` | no | Port (default 3000) |
| `NODE_ENV` | no | `production`: trust the proxy, Secure cookies |
| `SEED_DB` | no | Database for the seed scripts (default `lumiere`) |

### 15.3 Deployment (Render)

`render.yaml` defines a free Node web service: build `npm install && npm run build`, start `npm start`, health check `/api/perfumes/check`, `NODE_ENV=production`, and `MONGO_URI` entered in Render's dashboard. Pushing to `main` redeploys. MongoDB Atlas must allow connections from anywhere (`0.0.0.0/0`). The live site is [https://lumiere-j9qr.onrender.com](https://lumiere-j9qr.onrender.com).

---

## 16. Known limitations

- On Render's free plan the site sleeps after ~15 minutes without visitors; the first visit afterwards takes up to a minute.
- Groups are all public: there are no private groups or join approvals (optional requirement 21).
- There is no dedicated feed of posts from my groups (optional requirement 22); the activity feed covers followed members.
- Chat messages can't be edited or deleted one by one (they are removed with the account).
- "214 people online now" in the welcome box is fixed text; the avatars next to it are real top reviewers.
- The estimated base numbers on perfume pages (section 10.6) are not stored votes.
- The contact form saves requests to the database; there is no admin page to read them.

---

## 17. Walk-through examples for the defense

**"Where is MVC?"** — Open `src/models/Review.jsx` (model), `src/controllers/reviewController.jsx` (controller), `src/routes/api.jsx` (the route `POST /perfumes/:slug/reviews` → `reviews.create`), and `client/components/perfume/Composer.jsx` (the view that sends it).

**"Show jQuery AJAX."** — `client/lib/api.jsx`: every request uses `$.ajax`. Example caller: `toggleLike` in `client/store/session.jsx`.

**"Show a search with 3+ parameters."** — `#all-reviews` in the browser; `reviewController.list` builds the MongoDB filter from `rating`, `since`, `q` and `scope`.

**"Show React Video and Canvas."** — `components/video/VideoBanner.jsx` and `components/notes/NotesCanvas.jsx` + `drawNotes.jsx`.

**"Show Socket.io."** — `src/socket/realtime.jsx` (`message:send` handler) and `client/store/chat.jsx` (`connectSocket`, `sendChat`).

**"Show D3 with data from the DB."** — `statsController.reviewTrends` (aggregation) → `components/stats/TrendsChart.jsx` (`drawTrends`).

**"How do you stop users editing others' content?"** — `ownPerfume` in `perfumeController`, `myReview` in `reviewController`, `ownGroup` and the `post.user.equals(req.user._id)` checks in `groupController`.

**"What happens when I upload a perfume photo?"** — `PerfumeForm.jsx` resizes it on a canvas → `createPerfume` sends it as the request body → `imageBody` + `isImage` check it → `saveImage` stores it in the `uploads` collection → the perfume's `image` is `/uploads/perfumes/<file>` → `serveUpload` sends it to any browser.
