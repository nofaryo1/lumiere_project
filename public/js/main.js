/* =========================================================
   LUMIERE — Homepage scripts
   Perfumes, members, reviews, likes and follows come from the
   Express API (/api) backed by MongoDB.
   ========================================================= */

(function () {
  "use strict";

  /* =======================================================
     Data
     ======================================================= */

  // Scent families used by the trending filters
  const families = [
    { key: "woody", name: "Woody" },
    { key: "floral", name: "Floral" },
    { key: "fresh", name: "Fresh" },
    { key: "amber", name: "Amber" },
    { key: "citrus", name: "Citrus" },
    { key: "musk", name: "Musk" },
    { key: "spicy", name: "Spicy" },
    { key: "gourmand", name: "Gourmand" },
  ];

  // Small stable hash (avatar colors, bottle illustrations)
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  const LIQUID = { woody: "#b98a57", floral: "#e7b9b4", fresh: "#cfe0dc", amber: "#d9a85e",
                   citrus: "#f0d98a", musk: "#e6ebe8", spicy: "#c98a5e", gourmand: "#8a5a3b" };

  // Filled from the API (/api/perfumes) when the page loads
  let perfumes = [];

  // Turns an API record + its activity stats into what the page uses
  function buildPerfume(rec, stat = {}) {
    const id = rec.slug;
    const h = hash(id);
    const tags = rec.tags || [];
    const s = { reviews: 0, ratingSum: 0, likes: 0, week: 0, prevWeek: 0, month: 0, ...stat };
    return {
      id,
      name: rec.name,
      brand: rec.brand,
      tags,
      notes: rec.notes || [],
      image: rec.image || "",
      source: rec.source,
      addedBy: rec.addedBy || null,
      notesAddedBy: rec.notesAddedBy || null,
      // activity = reviews + likes in that period (drives the Trending tabs)
      score: { week: s.week, month: s.month, all: s.reviews + s.likes },
      change: s.prevWeek >= 5 ? Math.round(((s.week - s.prevWeek) / s.prevWeek) * 100) : 0,
      real: { reviews: s.reviews, ratingSum: s.ratingSum, likes: s.likes },
      // fallback illustration if there's no photo
      look: { shape: ["rect", "tall", "round"][h % 3], liquid: LIQUID[tags[0]] || "#e3e6e4", cap: "#2b2f2d" },
    };
  }

  /* =======================================================
     Helpers
     ======================================================= */
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const byId = (id) => perfumes.find((p) => p.id === id);

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[ch]);
  }

  function formatCount(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  function timeAgo(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const AVATAR_TONES = [
    ["#e6efe9", "#3f6b56"], ["#e4ecf3", "#3d6283"], ["#efe9f3", "#6a4f83"],
    ["#f3ece4", "#83613d"], ["#e9eef0", "#4b5f66"],
  ];
  // `who` is an author object { initials, tone }
  function avatar(who, size = "") {
    const [bg, fg] = AVATAR_TONES[who.tone % AVATAR_TONES.length];
    return `<span class="avatar ${size}" style="--avatar-bg:${bg};--avatar-fg:${fg}" aria-hidden="true">${escapeHTML(who.initials)}</span>`;
  }

  const initialsOf = (name) => String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";

  // A member as shown next to reviews, activity, lists
  function authorFromUser(u) {
    return { name: u.displayName, username: u.username, level: "Member", initials: initialsOf(u.displayName), tone: hash(u.username) % 5 };
  }

  const profileLink = (u, text = u.displayName) =>
    `<a class="member-link" href="#profile/${encodeURIComponent(u.username)}">${escapeHTML(text)}</a>`;

  const ICON = {
    star: '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 1.8l2.4 5.2 5.7.6-4.3 3.9 1.2 5.6L10 14.2l-5 2.9 1.2-5.6L1.9 7.6l5.7-.6z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z"/></svg>',
    thumb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/></svg>',
    comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12"><path d="M7 14l5-5 5 5"/></svg>',
  };

  /* ---------- Bottle thumbnail (fallback product image) ---------- */
  const SHAPES = {
    rect:  { body: '<rect x="13" y="30" width="34" height="42" rx="5"/>', cap: '<rect x="22" y="13" width="16" height="13" rx="2"/>', neck: [26, 25, 8, 6], liquid: 40 },
    tall:  { body: '<rect x="18" y="24" width="24" height="48" rx="4"/>', cap: '<rect x="24" y="7" width="12" height="14" rx="2"/>', neck: [27, 20, 6, 5], liquid: 34 },
    round: { body: '<circle cx="30" cy="51" r="21"/>', cap: '<rect x="23" y="14" width="14" height="13" rx="3"/>', neck: [26, 26, 8, 6], liquid: 42 },
  };
  let thumbId = 0;

  function bottleThumb({ shape, liquid, cap }, className = "") {
    const s = SHAPES[shape] || SHAPES.rect;
    const id = `t${++thumbId}`;
    const [nx, ny, nw, nh] = s.neck;
    return `
      <svg class="${className}" viewBox="0 0 60 80" aria-hidden="true">
        <defs><clipPath id="${id}">${s.body}</clipPath></defs>
        <ellipse cx="30" cy="74" rx="20" ry="2.5" fill="#000" opacity="0.08"/>
        <g clip-path="url(#${id})">
          <rect width="60" height="80" fill="#fff" opacity="0.85"/>
          <rect y="${s.liquid}" width="60" height="40" fill="${liquid}" opacity="0.9"/>
          <rect x="16" y="0" width="3" height="80" fill="#fff" opacity="0.7"/>
        </g>
        <g fill="none" stroke="#1c2220" stroke-opacity="0.18" stroke-width="0.8">${s.body}</g>
        <rect x="22" y="${s.liquid + 6}" width="16" height="10" rx="1" fill="#fff" opacity="0.9"/>
        <rect x="${nx}" y="${ny}" width="${nw}" height="${nh}" fill="#c9cecb"/>
        <g fill="${cap}">${s.cap}</g>
        <g fill="#fff" opacity="0.18">${s.cap}</g>
      </svg>`;
  }

  /* ---------- Perfume image (shared by every perfume visual) ----------
     Always renders the same `.perfume-media` frame; sizing, padding and
     centering are handled entirely in CSS. Without a photo, or if the
     photo fails to load, the illustrated bottle is shown instead. */
  function perfumeMedia(p, size = "") {
    const classes = ["perfume-media", size && `perfume-media--${size}`, p.image && "has-photo"]
      .filter(Boolean).join(" ");
    const zoom = p.imageZoom ? ` style="--media-zoom:${Number(p.imageZoom)}"` : "";
    const photo = p.image
      ? `<img class="perfume-media__img" src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async"${zoom}>`
      : "";
    return `<span class="${classes}">${photo}${bottleThumb(p.look, "perfume-media__img perfume-media__fallback")}</span>`;
  }

  function stars(rating) {
    const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
    const row = ICON.star.repeat(5);
    return `<span class="stars" aria-hidden="true"><span class="stars__base">${row}</span><span class="stars__fill" style="width:${pct}%">${row}</span></span>`;
  }

  function toast(message) {
    const $toast = jQuery("#toast").text(message).prop("hidden", false);
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { $toast.prop("hidden", true); }, 2400);
  }

  /* =======================================================
     Renderers
     ======================================================= */
  function ratingFor(p) {
    const count = p.real.reviews;
    return { avg: count ? p.real.ratingSum / count : 0, count, reviews: count };
  }

  function ratingRow(p) {
    const r = ratingFor(p);
    if (!r.count) return `<div class="rating rating--empty">No ratings yet</div>`;
    return `
          <div class="rating" aria-label="Rated ${r.avg.toFixed(1)} out of 5 from ${r.count} ratings">
            <span class="rating__score">${r.avg.toFixed(1)}</span>
            ${stars(r.avg)}
            <span>(${formatCount(r.count)})</span>
          </div>`;
  }

  function perfumeCard(p, { rank, owner = false } = {}) {
    const badge = rank ? `<span class="rank">#${rank}</span>` : "";
    const trend = p.change > 0 ? `<span class="trend">${ICON.up}${p.change}%</span>` : "";
    return `
      <article class="perfume-card" data-perfume="${p.id}">
        <div class="perfume-card__media">
          ${badge}${trend}
          ${perfumeMedia(p)}
        </div>
        <div class="perfume-card__body">
          <p class="perfume-card__brand">${escapeHTML(p.brand) || "&nbsp;"}</p>
          <h3 class="perfume-card__name"><a href="#perfume/${p.id}">${escapeHTML(p.name)}</a></h3>
          ${ratingRow(p)}
          <div class="perfume-card__notes">${p.notes.map((n) => `<span class="chip">${escapeHTML(n)}</span>`).join("")}</div>
          <div class="perfume-card__actions">
            <button class="action-btn" data-action="love" data-id="${p.id}" aria-pressed="${isLiked(p.id)}" aria-label="Like ${escapeHTML(p.name)}">
              ${ICON.heart}<span data-like-count="${p.id}">${formatCount(p.real.likes)}</span>
            </button>
            <button class="action-btn" data-action="review" aria-label="Reviews of ${escapeHTML(p.name)}">
              ${ICON.comment}<span>${formatCount(p.real.reviews)}</span>
            </button>
          </div>
          ${owner && ownsPerfume(p) ? `<div class="perfume-card__owner">${ownerButtons(p, "social-btn")}</div>` : ""}
        </div>
      </article>`;
  }

  /* ---------- Your own perfumes: Edit / Delete (only the member who added it sees these) ---------- */
  const ownsPerfume = (p) => !!session.user && p.source === "community" && p.addedBy === session.user.username;
  let confirmingDelete = null;   // slug waiting for "Yes, delete"

  function ownerButtons(p, cls) {
    if (confirmingDelete === p.id) {
      return `
        <span class="owner-confirm">Delete this perfume?</span>
        <button class="${cls}" data-cancel-delete>Cancel</button>
        <button class="${cls} is-danger" data-confirm-delete="${p.id}">Yes, delete</button>`;
    }
    return `
      <a class="${cls}" href="#edit-perfume/${encodeURIComponent(p.id)}">Edit</a>
      <button class="${cls}" data-delete-perfume="${p.id}">Delete</button>`;
  }

  // "Helpful" button on a review (members can't vote on their own)
  function helpfulButton(r) {
    const mine = session.user && r.user && r.user.username === session.user.username;
    return `
      <button class="social-btn" data-helpful="${r.id}" aria-pressed="${!!r.likedByMe}" ${mine ? "disabled" : ""}
              aria-label="Mark review as helpful" title="${mine ? "Your review" : "Helpful"}">
        ${ICON.thumb}<span>${r.likes || 0}</span> <span class="social-btn__label">Helpful</span>
      </button>`;
  }

  function followButton(username, extra = "") {
    if (session.user && session.user.username === username) return "";
    const on = isFollowing(username);
    return `<button class="btn btn--ghost btn--sm btn--follow ${extra}" data-follow="${escapeHTML(username)}" aria-pressed="${on}">${on ? "Following" : "Follow"}</button>`;
  }

  // Review card used on the homepage and the "All reviews" page
  function reviewCard(r) {
    const p = byId(r.perfume);
    if (!p || !r.user) return "";
    const author = authorFromUser(r.user);
    return `
      <article class="review">
        <header class="review__head">
          <a href="#profile/${encodeURIComponent(r.user.username)}" aria-hidden="true" tabindex="-1">${avatar(author)}</a>
          <div>
            <p class="review__user">${profileLink(r.user)}</p>
            <p class="review__meta">@${escapeHTML(r.user.username)} · ${timeAgo(r.createdAt)}</p>
          </div>
          ${followButton(r.user.username, "review__follow")}
        </header>

        <a href="#perfume/${p.id}" class="review__perfume">
          ${perfumeMedia(p, "sm")}
          <div>
            <p class="review__perfume-name">${escapeHTML(p.name)}</p>
            <p class="review__perfume-brand">${escapeHTML(p.brand)}</p>
          </div>
          <div class="review__score" aria-label="Rated ${r.rating} out of 5">
            <span class="rating__score">${r.rating.toFixed(1)}</span>
            ${stars(r.rating)}
          </div>
        </a>

        <p class="review__text">${escapeHTML(r.text)}</p>

        <footer class="review__actions">
          ${helpfulButton(r)}
          <button class="social-btn" data-action="share" data-share="#perfume/${p.id}" aria-label="Share review">
            ${ICON.share}<span>Share</span>
          </button>
        </footer>
      </article>`;
  }

  function activityText(a) {
    const p = a.perfume && byId(a.perfume);
    const perfumeLink = p ? `<a class="activity__perfume" href="#perfume/${p.id}">${escapeHTML(`${p.brand ? p.brand + " " : ""}${p.name}`)}</a>` : "a perfume";
    switch (a.type) {
      case "review": return `rated ${perfumeLink} <span class="activity__stars">★ ${a.rating}</span>`;
      case "like": return `liked ${perfumeLink}`;
      case "follow": return `started following ${profileLink(a.target)}`;
      case "added": return `added ${perfumeLink} to LUMIERE`;
      case "joined": return `joined <a class="activity__perfume" href="#group/${encodeURIComponent(a.group.slug)}">${escapeHTML(a.group.name)}</a>`;
      case "posted": return `posted in <a class="activity__perfume" href="#group/${encodeURIComponent(a.group.slug)}">${escapeHTML(a.group.name)}</a>`;
      default: return "";
    }
  }

  function activityItem(a) {
    return `
      <li class="activity__item">
        <a href="#profile/${encodeURIComponent(a.user.username)}" aria-hidden="true" tabindex="-1">${avatar(authorFromUser(a.user), "avatar--sm")}</a>
        <p>${profileLink(a.user)} ${activityText(a)}<span class="activity__time">${timeAgo(a.at)}</span></p>
      </li>`;
  }

  /* =======================================================
     Trending: period tabs + family filter + search query
     ======================================================= */
  const state = { period: "week", family: "all", query: "", brand: "", notes: "", rating: 0 };   // rating: exact stars (1–5)

  const PERIOD_LABEL = {
    week: "Most liked and reviewed this week",
    month: "Most liked and reviewed this month",
    all: "Most liked and reviewed of all time",
  };

  function matchesQuery(p, q) {
    const hay = [p.name, p.brand, ...p.notes, ...p.tags].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
  }

  function rankedPerfumes(period = "week") {
    return [...perfumes].sort((a, b) => b.score[period] - a.score[period] || b.real.reviews - a.real.reviews);
  }

  function renderFilterBar() {
    const all = { key: "all", name: "All" };
    const used = families.filter((f) => state.family === f.key || perfumes.some((p) => p.tags.includes(f.key)));
    $("#filterBar").innerHTML = [all, ...used].map((f) => {
      const count = f.key === "all" ? perfumes.length : perfumes.filter((p) => p.tags.includes(f.key)).length;
      return `<button class="tag" data-family="${f.key}" aria-pressed="${state.family === f.key}">${f.name}<span class="tag__count">${count}</span></button>`;
    }).join("");
    renderPerfumeFilters();
  }

  /* ---------- Brand / notes / rating filters (combine with the family chips and the search) ---------- */
  const brandKey = (brand) => String(brand || "").trim().replace(/\s+/g, " ").toLowerCase();
  const filterNoteTerms = () => state.notes.toLowerCase().split(",").map((t) => t.trim()).filter(Boolean);
  const hasPerfumeFilters = () => !!(state.brand || filterNoteTerms().length || state.rating);
  // a perfume's rating in whole stars (average rounded to the nearest star; 0 = not rated yet)
  const starsOf = (p) => { const r = ratingFor(p); return r.count ? Math.min(5, Math.max(1, Math.round(r.avg))) : 0; };

  let noteNames = [];   // every note on LUMIERE right now (for the Notes suggestions)

  function renderPerfumeFilters() {
    const $brand = jQuery("#filterBrand");
    if (!$brand.length) return;
    const brands = new Map();
    perfumes.forEach((p) => { const k = brandKey(p.brand); if (k && !brands.has(k)) brands.set(k, p.brand.trim().replace(/\s+/g, " ")); });
    if (state.brand && !brands.has(state.brand)) state.brand = "";
    $brand.empty().append(
      jQuery("<option>", { value: "", text: "All brands" }),
      [...brands].sort((a, b) => a[1].localeCompare(b[1]))
        .map(([k, name]) => jQuery("<option>", { value: k, text: name, selected: k === state.brand })),
    );
    const notes = new Map();
    perfumes.forEach((p) => p.notes.forEach((n) => { if (!notes.has(n.toLowerCase())) notes.set(n.toLowerCase(), n); }));
    noteNames = [...notes.values()].sort((a, b) => a.localeCompare(b));
    // exact star ratings
    jQuery("#filterRating").empty().append(
      jQuery("<option>", { value: "", text: "Any rating" }),
      [5, 4, 3, 2, 1].map((n) => jQuery("<option>", { value: n, text: `${n}★`, selected: state.rating === n })),
    );
    jQuery("#clearPerfumeFilters").prop("hidden", !hasPerfumeFilters() && state.family === "all");
  }

  function matchesPerfumeFilters(p) {
    if (state.brand && brandKey(p.brand) !== state.brand) return false;
    const terms = filterNoteTerms();
    if (terms.length && !terms.every((t) => p.notes.some((n) => n.toLowerCase().includes(t)))) return false;
    if (state.rating && starsOf(p) !== state.rating) return false;
    return true;
  }

  function renderTrending() {
    const title = $("#trending .section-title");
    const sub = $("#trending .section-sub");

    let list = rankedPerfumes(state.period);
    const ranks = new Map(list.map((p, i) => [p.id, i + 1]));

    if (state.family !== "all") list = list.filter((p) => p.tags.includes(state.family));
    list = list.filter(matchesPerfumeFilters);

    if (state.query) {
      list = list.filter((p) => matchesQuery(p, state.query));
      title.textContent = "Search results";
      sub.innerHTML = `${list.length} result${list.length === 1 ? "" : "s"} for “${escapeHTML(state.query)}” · <button class="link link--btn" id="clearSearch">Clear search</button>`;
    } else if (hasPerfumeFilters()) {
      title.textContent = "Trending perfumes";
      sub.textContent = `${list.length} perfume${list.length === 1 ? " matches" : "s match"} your filters`;
    } else {
      title.textContent = "Trending perfumes";
      sub.textContent = PERIOD_LABEL[state.period];
    }

    const track = $("#trendingGrid");
    track.innerHTML = list
      .map((p) => perfumeCard(p, { rank: state.query ? null : ranks.get(p.id) })).join("");
    track.scrollTo({ left: 0, behavior: "instant" });
    $("#trendingEmpty").hidden = list.length > 0;
    updateCarousel();
  }

  // Add perfumes this page doesn't know yet (added by another member after it loaded).
  // Signed-in members get them live; this covers guests and lists that mention a new perfume.
  let perfumeSync = null;
  function syncNewPerfumes() {
    if (perfumeSync) return perfumeSync;
    perfumeSync = api("/perfumes")
      .then((res) => {
        const fresh = res.perfumes.filter((rec) => !byId(rec.slug));
        fresh.forEach((rec) => perfumes.push(buildPerfume(rec, res.stats[rec.slug])));
        if (fresh.length) { renderFilterBar(); renderTrendingKeepScroll(); }
      })
      .catch(() => { /* try again next time */ })
      .finally(() => { perfumeSync = null; });
    return perfumeSync;
  }

  function renderTrendingKeepScroll() {
    const left = $("#trendingGrid").scrollLeft;
    renderTrending();
    $("#trendingGrid").scrollTo({ left, behavior: "instant" });
    updateCarousel();
  }

  /* ---------- Carousel controls (arrows + "1–5 of 100") ---------- */
  function carouselMetrics() {
    const track = $("#trendingGrid");
    const first = track.firstElementChild;
    if (!first) return { track, step: 1, perView: 0, total: 0 };
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = first.getBoundingClientRect().width + gap;
    return {
      track,
      step,
      perView: Math.max(1, Math.floor((track.clientWidth + gap) / step)),
      total: track.children.length,
    };
  }

  function updateCarousel() {
    const { track, step, perView, total } = carouselMetrics();
    const start = total ? Math.round(track.scrollLeft / step) + 1 : 0;
    const end = Math.min(total, start + perView - 1);
    $("#trendStatus").textContent = total ? `${start}–${end} of ${total}` : "";
    $("#trendPrev").disabled = track.scrollLeft <= 2;
    $("#trendNext").disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
  }

  function scrollCarousel(direction) {
    const { track, step, perView } = carouselMetrics();
    track.scrollBy({ left: direction * step * perView, behavior: "smooth" });
  }

  function setFamily(key) {
    state.family = key;
    renderFilterBar();
    renderTrending();
  }

  function runSearch(query) {
    state.query = query.trim();
    state.family = "all";
    renderFilterBar();
    renderTrending();
    $$("[data-search] input").forEach((i) => { i.value = state.query; });
    closeAllSuggestions();
    if (state.query) {
      if (location.hash && location.hash !== "#trending") location.hash = "";
      $("#trending").scrollIntoView({ behavior: "smooth" });
    }
  }

  function initTrending() {
    renderFilterBar();
    renderTrending();

    // carousel (jQuery)
    const $track = jQuery("#trendingGrid");
    $track.on("scroll", updateCarousel);
    jQuery(window).on("resize", updateCarousel);
    jQuery("#trendPrev").on("click", () => scrollCarousel(-1));
    jQuery("#trendNext").on("click", () => scrollCarousel(1));
    $track.on("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); scrollCarousel(1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); scrollCarousel(-1); }
    });

    // This week / This month / All time
    jQuery("#trendTabs").on("click", "[data-period]", function () {
      jQuery("#trendTabs [role=tab]").attr("aria-selected", "false");
      jQuery(this).attr("aria-selected", "true");
      state.period = jQuery(this).attr("data-period");
      renderTrending();
    });

    // scent family chips
    jQuery("#filterBar").on("click", "[data-family]", function () { setFamily(jQuery(this).attr("data-family")); });

    // brand / notes / rating
    const $clear = jQuery("#clearPerfumeFilters");
    const refine = () => { renderTrending(); $clear.prop("hidden", !hasPerfumeFilters() && state.family === "all"); };
    jQuery("#filterBrand").on("change", function () { state.brand = jQuery(this).val(); refine(); });
    jQuery("#filterRating").on("change", function () { state.rating = Number(jQuery(this).val()) || 0; refine(); });
    initNotesSuggest(refine);
    $clear.on("click", () => {
      Object.assign(state, { brand: "", notes: "", rating: 0, family: "all" });
      jQuery("#filterBrand, #filterNotes, #filterRating").val("");
      renderFilterBar();
      renderTrending();
    });

    jQuery("#trending").on("click", "#clearSearch", () => runSearch(""));

    // guests have no live connection: pick up newly added perfumes when they come back to the tab
    jQuery(document).on("visibilitychange", () => {
      if (document.visibilityState === "visible" && !session.user && perfumes.length) syncNewPerfumes();
    });
  }

  /* ---------- Notes filter: suggestions in a list right under the field (jQuery) ---------- */
  function initNotesSuggest(onChange) {
    const $input = jQuery("#filterNotes");
    const $box = jQuery("#notesSuggest");
    let active = -1;
    let timer = 0;

    const terms = () => $input.val().split(",");
    const close = () => {
      active = -1;
      $box.prop("hidden", true).empty();
      $input.attr("aria-expanded", "false").removeAttr("aria-activedescendant");
    };
    const highlight = (index) => {
      const $items = $box.children("[data-note]");
      if (!$items.length) return;
      active = (index + $items.length) % $items.length;
      $items.removeClass("is-active").attr("aria-selected", "false");
      const $item = $items.eq(active).addClass("is-active").attr("aria-selected", "true");
      $input.attr("aria-activedescendant", $item.attr("id"));
      $item[0].scrollIntoView({ block: "nearest" });
    };
    const open = () => {
      const parts = terms();
      const term = parts[parts.length - 1].trim().toLowerCase();
      const chosen = new Set(parts.slice(0, -1).map((t) => t.trim().toLowerCase()));
      const matches = noteNames
        .filter((n) => !chosen.has(n.toLowerCase()) && (!term || n.toLowerCase().includes(term)))
        .sort((a, b) => Number(b.toLowerCase().startsWith(term)) - Number(a.toLowerCase().startsWith(term)))
        .slice(0, 8);
      if (!matches.length) { close(); return; }
      active = -1;
      $box.empty().append(matches.map((n, i) => jQuery("<button>", {
        type: "button", class: "suggest-item", role: "option", id: `noteOption${i}`, "data-note": n, "aria-selected": "false",
      }).append(jQuery("<span>", { class: "suggest-item__name", text: n }))));
      $box.prop("hidden", false);
      $input.attr("aria-expanded", "true");
    };
    const apply = () => { state.notes = $input.val(); onChange(); };
    const choose = (note) => {
      const parts = terms();
      parts[parts.length - 1] = note;
      $input.val(parts.map((t) => t.trim()).filter(Boolean).join(", "));
      close();
      apply();
    };

    $input.on("focus", open);
    $input.on("input", () => {
      open();
      clearTimeout(timer);
      timer = setTimeout(apply, 150);
    });
    $input.on("keydown", (e) => {
      if ($box.prop("hidden")) { if (e.key === "ArrowDown") { open(); highlight(0); e.preventDefault(); } return; }
      if (e.key === "ArrowDown") { e.preventDefault(); highlight(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); highlight(active - 1); }
      else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose($box.children("[data-note]").eq(active).attr("data-note")); }
      else if (e.key === "Escape") { close(); }
    });
    $input.on("blur", () => setTimeout(close, 120));
    // mousedown (not click) so the field doesn't lose focus first
    $box.on("mousedown", "[data-note]", function (e) { e.preventDefault(); choose(jQuery(this).attr("data-note")); });
  }

  /* =======================================================
     Search with suggestions (header + hero): perfumes + members
     ======================================================= */
  function closeAllSuggestions() {
    $$(".search-suggest").forEach((s) => { s.hidden = true; s.innerHTML = ""; });
  }

  function initSearch() {
    $$("[data-search]").forEach((form) => {
      const input = $("input", form);
      const box = $(".search-suggest", form);
      let active = -1;
      let memberTimer = 0;
      let memberReq = 0;
      let members = [];
      let membersLoading = false;

      const render = () => {
        const q = input.value.trim();
        if (!q) { box.hidden = true; return; }
        const membersOnly = q.startsWith("@");
        const hits = membersOnly ? [] : perfumes.filter((p) => matchesQuery(p, q)).slice(0, 5);
        const perfumeRows = hits.map((p) => {
          const r = ratingFor(p);
          const meta = [p.brand, p.notes.slice(0, 2).join(", ")].filter(Boolean).join(" · ");
          return `
            <button type="button" class="suggest-item" data-id="${p.id}">
              ${perfumeMedia(p, "xs")}
              <span><span class="suggest-item__name">${escapeHTML(p.name)}</span><br><span class="suggest-item__meta">${escapeHTML(meta)}</span></span>
              <span class="suggest-item__rating">${r.count ? `★ ${r.avg.toFixed(1)}` : ""}</span>
            </button>`;
        }).join("");
        const memberRows = members.map((u) => `
            <button type="button" class="suggest-item" data-user="${escapeHTML(u.username)}">
              ${avatar(authorFromUser(u))}
              <span><span class="suggest-item__name">${escapeHTML(u.displayName)}</span><br><span class="suggest-item__meta">@${escapeHTML(u.username)}</span></span>
            </button>`).join("");
        box.innerHTML = (perfumeRows ? `<p class="suggest-group">Perfumes</p>${perfumeRows}` : "")
          + (memberRows ? `<p class="suggest-group">Members</p>${memberRows}` : "")
          || (membersLoading ? `<p class="suggest-empty">Searching members…</p>` : `<p class="suggest-empty">Nothing found for “${escapeHTML(q)}”</p>`);
        box.hidden = false;
        active = -1;
      };

      const update = () => {
        clearTimeout(memberTimer);
        const q = input.value.trim();
        const name = q.replace(/^@/, "");
        membersLoading = !!name;
        render();
        if (!name) { members = []; return; }
        // members: all accounts in MongoDB (new and demo), closest matches first
        memberTimer = setTimeout(async () => {
          const id = ++memberReq;
          try {
            const res = await api(`/members?search=${encodeURIComponent(name)}&limit=${q.startsWith("@") ? 6 : 4}`);
            if (id === memberReq && input.value.trim() === q) { members = res.users; membersLoading = false; render(); }
          } catch (err) {
            if (id === memberReq) { membersLoading = false; render(); }   // perfumes still work without member results
          }
        }, 150);
      };

      const choose = (item) => {
        closeAllSuggestions();
        input.blur();
        if (item.dataset.user) location.hash = `profile/${encodeURIComponent(item.dataset.user)}`;
        else openPerfume(item.dataset.id);
      };

      input.addEventListener("input", () => { members = []; update(); });
      input.addEventListener("focus", update);

      input.addEventListener("keydown", (e) => {
        const items = $$(".suggest-item", box);
        if (e.key === "Escape") { box.hidden = true; return; }
        if (!items.length || !["ArrowDown", "ArrowUp"].includes(e.key)) return;
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach((it, i) => it.classList.toggle("is-active", i === active));
      });

      box.addEventListener("click", (e) => {
        const item = e.target.closest(".suggest-item");
        if (item) choose(item);
      });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const chosen = $(".suggest-item.is-active", box);
        const q = input.value.trim();
        if (chosen) return choose(chosen);
        if (q.startsWith("@") && q.length > 1) {
          // "@username" + Enter -> open the best matching member
          const res = await api(`/members?search=${encodeURIComponent(q.slice(1))}&limit=1`).catch(() => ({ users: [] }));
          if (res.users[0]) { closeAllSuggestions(); input.blur(); location.hash = `profile/${encodeURIComponent(res.users[0].username)}`; }
          else toast(`No members match “${q}”`);
          return;
        }
        runSearch(input.value);
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("[data-search]")) closeAllSuggestions();
    });

    $$(".hero__popular [data-query]").forEach((btn) =>
      btn.addEventListener("click", () => runSearch(btn.dataset.query)));
  }

  /* =======================================================
     Social: likes, follows, helpful votes, share
     ======================================================= */
  function initSocial() {
    document.addEventListener("click", (e) => {
      const follow = e.target.closest("[data-follow]");
      if (follow) { toggleFollow(follow.dataset.follow); return; }

      const helpful = e.target.closest("[data-helpful]");
      if (helpful) { toggleHelpful(helpful); return; }

      const join = e.target.closest("[data-join]");
      if (join) { toggleMembership(join.dataset.join); return; }

      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      switch (btn.dataset.action) {
        case "love": {
          const p = byId(btn.dataset.id);
          if (p) toggleLike(p);
          break;
        }
        case "share": {
          const url = btn.dataset.share ? `${location.origin}${location.pathname}${btn.dataset.share}` : location.href;
          if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
          toast("Link copied");
          break;
        }
        case "review": {
          const card = btn.closest("[data-perfume]");
          if (card) openPerfume(card.dataset.perfume, "reviews");
          break;
        }
        case "comment":
          if (!session.user) openAuth("login", "Log in to join the conversation.");
          else toast("Replies are coming soon");
          break;
      }
    });
  }

  /* =======================================================
     Homepage community: popular reviews, activity, top reviewers
     ======================================================= */
  let activityScope = "all";
  let popularReviews = [];

  async function loadPopularReviews() {
    const list = $("#reviewList");
    try {
      const res = await api("/reviews?sort=popular&limit=3");
      popularReviews = res.reviews;
      list.innerHTML = popularReviews.map(reviewCard).join("") || '<p class="pv__empty">No reviews yet.</p>';
    } catch (err) {
      list.innerHTML = `<p class="pv__empty">${escapeHTML(err.message)}</p>`;
    }
  }

  // Avatars in the welcome box. (The "Top reviewers" panel itself is a
  // React component: public/js/react/top-reviewers.js)
  async function loadTopReviewers() {
    try {
      const res = await api("/members/top?limit=5");
      $("#onlineAvatars").innerHTML = res.users.map((u) => avatar(authorFromUser(u))).join("");
    } catch (err) { /* stays empty */ }
  }

  function renderActivityTabs() {
    const tabs = $("#activityTabs");
    tabs.hidden = !session.user;
    $$("[data-scope]", tabs).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.scope === activityScope)));
    $("#activityTitle").textContent = activityScope === "following" ? "People you follow" : "Community activity";
  }

  async function loadActivity() {
    const feed = $("#activityFeed");
    renderActivityTabs();
    feed.classList.add("is-loading");
    try {
      const res = await api(`/activity?scope=${activityScope}&limit=8`);
      if (activityScope === "following" && !res.followingCount) {
        feed.innerHTML = `<li class="activity__empty">You're not following anyone yet. Tap <strong>Follow</strong> on a reviewer to see their activity here.</li>`;
      } else {
        feed.innerHTML = res.items.map(activityItem).join("") || '<li class="activity__empty">No activity yet.</li>';
      }
    } catch (err) {
      feed.innerHTML = `<li class="activity__empty">${escapeHTML(err.message)}</li>`;
    }
    feed.classList.remove("is-loading");
  }

  function initCommunity() {
    $("#activityTabs").addEventListener("click", (e) => {
      const tab = e.target.closest("[data-scope]");
      if (!tab || tab.dataset.scope === activityScope) return;
      activityScope = tab.dataset.scope;
      loadActivity();
    });
  }

  // Signed in -> show people you follow by default (if you follow anyone)
  function refreshCommunity() {
    activityScope = session.user && session.following.size ? "following" : "all";
    loadActivity();
    loadPopularReviews();
    loadTopReviewers();
  }

  /* ---------- Mobile navigation ---------- */
  function initNav() {
    const toggle = $("#navToggle");
    const nav = $("#nav");
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  /* =======================================================
     Perfume page data: default pros & cons and performance/season
     votes are generated per perfume (scaled to its real review count);
     reviews, ratings and likes are real.
     ======================================================= */
  const PRO_POOL = {
    general: ["Gets lots of compliments", "Smells expensive", "Unique — not generic",
              "Smooth, beautiful dry down", "Beautiful bottle", "Easy to wear", "Great for layering"],
    fresh:    ["Perfect for hot weather", "Clean and office-safe"],
    citrus:   ["Bright, energizing opening", "Uplifting and cheerful"],
    woody:    ["Warm and grounding", "Sophisticated and calm"],
    floral:   ["Elegant and romantic", "Natural-smelling flowers"],
    amber:    ["Rich and warm in cold weather", "Cozy, enveloping trail"],
    gourmand: ["Cozy, edible sweetness", "Very comforting"],
    musk:     ["Soft skin-scent, very intimate", "Smells clean and fresh out of the shower"],
    spicy:    ["Warm, interesting spice", "Stands out in a crowd"],
  };
  const CON_POOL = {
    general: ["Pricey for the bottle size", "Sprayer could be better", "Very popular — you'll smell it on others",
              "Opening is a bit harsh", "Can feel slightly synthetic", "Hard to find in stores"],
    fresh:    ["Can feel generic"],
    citrus:   ["Opening disappears quickly"],
    woody:    ["Can read a bit serious"],
    floral:   ["Can turn powdery"],
    amber:    ["Too heavy for summer"],
    gourmand: ["Can be cloying in the heat"],
    musk:     ["Some people barely smell musk"],
    spicy:    ["Not for everyone"],
  };

  const LEVELS = {
    longevity: ["Very weak", "Weak", "Moderate", "Long lasting", "Eternal"],
    sillage:   ["Intimate", "Soft", "Moderate", "Strong", "Enormous"],
    value:     ["Overpriced", "Pricey", "Fair", "Good value", "Great value"],
  };

  // Season / time-of-day leaning per scent family
  const WEAR = {
    fresh:    { Spring: 3, Summer: 5, Fall: 1, Winter: 0, Day: 5, Night: 1 },
    citrus:   { Spring: 4, Summer: 5, Fall: 1, Winter: 0, Day: 5, Night: 1 },
    woody:    { Spring: 1, Summer: 1, Fall: 4, Winter: 3, Day: 2, Night: 4 },
    floral:   { Spring: 5, Summer: 3, Fall: 2, Winter: 1, Day: 4, Night: 2 },
    amber:    { Spring: 0, Summer: 0, Fall: 4, Winter: 5, Day: 1, Night: 5 },
    gourmand: { Spring: 1, Summer: 0, Fall: 4, Winter: 5, Day: 2, Night: 4 },
    musk:     { Spring: 3, Summer: 3, Fall: 3, Winter: 2, Day: 4, Night: 2 },
    spicy:    { Spring: 1, Summer: 0, Fall: 5, Winter: 4, Day: 2, Night: 4 },
  };
  // Keeps the page consistent with the featured homepage reviews
  const KNOWN_PERFORMANCE = {
    "dior-sauvage":             { longevity: 4, sillage: 4 },
    "lattafa-yara":             { longevity: 4, sillage: 4 },
    "dolce-gabbana-light-blue": { longevity: 2, sillage: 2 },
  };
  const BASE_LONGEVITY = { fresh: 2, citrus: 2, floral: 3, musk: 3, woody: 4, spicy: 4, amber: 4, gourmand: 4 };


  const SEASONS = ["Spring", "Summer", "Fall", "Winter"];
  const TIMES = ["Day", "Night"];
  const STAR_LABELS = ["Didn't like it", "Not for me", "It's OK", "Like it", "Love it"];

  /* Performance, when-to-wear and agree votes are saved to each member's
     account on the server (see loadPerformance). They used to live in this
     browser's localStorage, shared by everyone using it — remove that. */
  try { localStorage.removeItem("lumiere:my-activity"); } catch (err) { /* storage unavailable */ }

  // Deterministic pick of n items from a list, seeded by the perfume
  function pick(list, n, seed) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = hash(seed + i) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
  }

  // Spread `votes` over levels 1–5, centred on `level`
  function spread(level, votes) {
    const w = [1, 2, 3, 4, 5].map((l) => Math.exp(-((l - level) ** 2) / 0.8));
    const total = w.reduce((a, b) => a + b, 0);
    return w.map((x) => Math.round((x / total) * votes));
  }

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  // 0 = no votes yet
  function levelOf(counts) {
    const total = sum(counts);
    if (!total) return 0;
    const mean = counts.reduce((s, c, i) => s + c * (i + 1), 0) / total;
    return Math.max(1, Math.min(5, Math.round(mean)));
  }

  /* ---------- Generated community data (catalog perfumes only) ---------- */
  const baseCache = {};

  function baseDetails(p) {
    if (baseCache[p.id]) return baseCache[p.id];
    const h = hash(p.id);
    const fam = p.tags;
    const reviewCount = p.real.reviews;

    // Performance (1–5); perfumes nobody reviewed yet start with no votes
    const famLong = fam.length ? Math.round(fam.reduce((s, t) => s + BASE_LONGEVITY[t], 0) / fam.length) : 3;
    const known = KNOWN_PERFORMANCE[p.id] || {};
    const longevity = known.longevity || Math.max(1, Math.min(5, famLong + ((h >> 3) % 3) - 1));
    const sillage = known.sillage || Math.max(1, Math.min(5, longevity + ((h >> 5) % 3) - 1));
    const value = 2 + ((h >> 7) % 4);
    const votes = Math.round(reviewCount * 0.6);

    // Default pros & cons (consistent with performance when there are votes)
    const pros = [], cons = [];
    if (votes) {
      if (longevity >= 4) pros.push("Long-lasting — still there the next morning");
      if (longevity <= 2) cons.push("Fades after a few hours");
      if (sillage >= 4) cons.push("Too loud for small offices");
      if (sillage <= 2) pros.push("Close to the skin — never overwhelming");
      if (value >= 4) pros.push("Great value for the quality");
    }
    const famPros = fam.flatMap((t) => PRO_POOL[t] || []);
    const famCons = fam.flatMap((t) => CON_POOL[t] || []);
    pros.push(...pick(famPros, 2, p.id + "fp"), ...pick(PRO_POOL.general, 2, p.id + "gp"));
    cons.push(...pick(famCons, 1, p.id + "fc"), ...pick(CON_POOL.general, 2, p.id + "gc"));

    const toItems = (list, max, k) => [...new Set(list)].slice(0, max).map((text, i) => ({
      text,
      votes: votes ? Math.max(1, Math.round(reviewCount * (0.7 - i * 0.12)) - (hash(text + p.id) % 7) * k) : 0,
    })).sort((a, b) => b.votes - a.votes);

    // When to wear: family leaning -> vote counts
    const lean = { Spring: 2, Summer: 2, Fall: 2, Winter: 2, Day: 3, Night: 3 };
    fam.forEach((t) => Object.keys(lean).forEach((k) => { lean[k] += WEAR[t][k]; }));
    const toVotes = (keys) => {
      const total = sum(keys.map((k) => lean[k]));
      return Object.fromEntries(keys.map((k) => [k, Math.round((lean[k] / total) * votes)]));
    };

    const details = {
      pros: toItems(pros, 5, 1),
      cons: toItems(cons, 4, 2),
      perf: { longevity: spread(longevity, votes), sillage: spread(sillage, votes), value: spread(value, votes) },
      wear: { ...toVotes(SEASONS), ...toVotes(TIMES) },
    };
    baseCache[p.id] = details;
    return details;
  }

  function similarPerfumes(p, n = 5) {
    return perfumes
      .filter((o) => o.id !== p.id)
      .map((o) => ({ o, shared: o.tags.filter((t) => p.tags.includes(t)).length }))
      .sort((a, b) => b.shared - a.shared || b.o.score.month - a.o.score.month)
      .slice(0, n)
      .map((x) => x.o);
  }

  // Performance votes from members + the signed-in member's own vote (cached on the perfume)
  const noPerfVote = () => ({ longevity: null, sillage: null, value: null });
  async function loadPerformance(p) {
    try {
      p.perf = await api(`/perfumes/${encodeURIComponent(p.id)}/performance`);
    } catch (err) {
      p.perf = {
        counts: { longevity: [0, 0, 0, 0, 0], sillage: [0, 0, 0, 0, 0], value: [0, 0, 0, 0, 0] }, voters: 0, mine: noPerfVote(),
        wear: { counts: {}, mine: [] }, agree: { counts: {}, mine: [] },
      };
    }
  }

  // Member reviews + star breakdown for a perfume (cached on the perfume)
  async function loadRealReviews(p) {
    try {
      const data = await api(`/perfumes/${encodeURIComponent(p.id)}/reviews`);
      p.realReviews = data.reviews;
      p.breakdown = data.breakdown;
    } catch (err) {
      p.realReviews = [];
      p.breakdown = [0, 0, 0, 0, 0];
    }
  }

  /* ---------- Page pieces ---------- */
  function bars(entries) {
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return entries.map(([label, v, display, isMine]) => `
      <div class="hbar${isMine ? " hbar--mine" : ""}">
        <span class="hbar__label">${label}</span>
        <span class="hbar__track"><span class="hbar__fill" style="width:${(v / max) * 100}%"></span></span>
        <span class="hbar__value">${display ?? v}</span>
      </div>`).join("");
  }

  function voteChips(attr, options, isOn, label) {
    return `
      <div class="vote-row" role="group" aria-label="${label}">
        <span class="vote-row__label">Your vote</span>
        ${options.map(([value, text]) => `<button class="vote-chip" ${attr}="${value}" aria-pressed="${isOn(value)}">${text}</button>`).join("")}
      </div>`;
  }

  // `p.perf` = real votes from the API (includes the signed-in member's own vote)
  function perfMeter(key, label, base, p) {
    const names = LEVELS[key];
    const real = p.perf ? p.perf.counts[key] : [0, 0, 0, 0, 0];
    const my = p.perf && session.user ? p.perf.mine[key] : null;
    const level = levelOf(base.perf[key].map((c, i) => c + real[i]));
    const result = level ? names[level - 1] : "No votes yet";
    return `
      <div class="meter">
        <div class="meter__top"><span>${label}</span><strong>${result}</strong></div>
        <div class="meter__bar" role="img" aria-label="${label}: ${result}">
          ${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= level ? "is-on" : ""}"></span>`).join("")}
        </div>
        ${voteChips("data-perf", names.map((n, i) => [`${key}:${i + 1}`, n]), (v) => v === `${key}:${my}`, `Your ${label.toLowerCase()} vote`)}
      </div>`;
  }

  const myWear = (p) => (p.perf && session.user ? p.perf.wear.mine : []);
  const myAgree = (p) => (p.perf && session.user ? p.perf.agree.mine : []);

  function wearBlock(keys, base, p) {
    const real = p.perf ? p.perf.wear.counts : {};
    const mine = myWear(p);
    const counts = keys.map((k) => base.wear[k] + (real[k] || 0));
    const total = sum(counts) || 1;
    return `
      <div class="pv__bars">${bars(keys.map((k, i) => [k, counts[i], `${Math.round((counts[i] / total) * 100)}%`, mine.includes(k)]))}</div>
      ${voteChips("data-wear", keys.map((k) => [k, k]), (k) => mine.includes(k), "Your picks")}`;
  }

  function verdictList(kind, items, p) {
    const real = p.perf ? p.perf.agree.counts : {};
    const mine = myAgree(p);
    const icon = kind === "pros"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    return items.map((it) => {
      const key = `${kind}:${it.text}`;
      const agreed = mine.includes(key);
      return `
        <li class="verdict__item">
          <span class="verdict__icon">${icon}</span>
          <span class="verdict__text">${escapeHTML(it.text)}</span>
          <button class="verdict__vote" data-agree="${escapeHTML(key)}" aria-pressed="${agreed}" aria-label="Agree: ${escapeHTML(it.text)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/></svg>
            <span>${it.votes + (real[key] || 0)}</span>
          </button>
        </li>`;
    }).join("");
  }

  function reviewItem(r, { mine = false } = {}) {
    const a = authorFromUser(r.user);
    return `
      <article class="pv-review${mine ? " pv-review--mine" : ""}">
        <header class="review__head">
          <a href="#profile/${encodeURIComponent(r.user.username)}" aria-hidden="true" tabindex="-1">${avatar(a)}</a>
          <div>
            <p class="review__user">${profileLink(r.user)}${mine ? ' <span class="review__level">Your review</span>' : ""}</p>
            <p class="review__meta">@${escapeHTML(r.user.username)} · ${timeAgo(r.updatedAt || r.createdAt)}</p>
          </div>
          <span class="pv-review__score">${stars(r.rating)}<strong>${r.rating.toFixed(1)}</strong></span>
        </header>
        <p class="review__text">${escapeHTML(r.text)}</p>
        <footer class="review__actions">
          ${mine
            ? `<span class="social-btn social-btn--static">${ICON.thumb}<span>${r.likes || 0}</span> <span class="social-btn__label">found it helpful</span></span>
               <button class="social-btn" data-edit-review="${r.id}">Edit</button><button class="social-btn" data-delete-review="${r.id}">Delete</button>`
            : helpfulButton(r)}
        </footer>
      </article>`;
  }

  function composer(p, draft, again = false) {
    const rating = draft ? draft.rating : 0;
    return `
      <form class="composer" id="reviewForm" data-rating="${rating}" novalidate>
        <p class="composer__title">${draft ? "Edit your review" : again ? `Write another review of ${escapeHTML(p.name)}` : `Rate & review ${escapeHTML(p.name)}`}</p>
        <div class="composer__rating">
          <div class="star-input" role="radiogroup" aria-label="Your rating">
            ${[5, 4, 3, 2, 1].map((n) => `
              <button type="button" class="star-input__star${n <= rating ? " is-on" : ""}" data-star="${n}" role="radio"
                      aria-checked="${n === rating}" aria-label="${n} star${n > 1 ? "s" : ""}">${ICON.star}</button>`).join("")}
          </div>
          <span class="composer__label" id="starLabel">${rating ? STAR_LABELS[rating - 1] : "Tap a star to rate"}</span>
        </div>
        <textarea name="text" rows="4" maxlength="1000" aria-label="Your review"
          placeholder="What does it smell like? How long does it last? When do you wear it?">${draft ? escapeHTML(draft.text) : ""}</textarea>
        <div class="composer__foot">
          <span class="composer__error" id="composerError" role="alert"></span>
          <span class="composer__count" id="charCount">${draft ? draft.text.length : 0} / 1000</span>
          ${draft ? '<button type="button" class="btn btn--ghost btn--sm" data-cancel-edit>Cancel</button>' : ""}
          <button type="submit" class="btn btn--primary btn--sm">${draft ? "Save changes" : "Post review"}</button>
        </div>
      </form>`;
  }

  function joinPrompt(text) {
    return `
      <div class="join-prompt">
        <p>${text}</p>
        <div class="join-prompt__actions">
          <button class="btn btn--primary btn--sm" data-auth="signup">Join the community</button>
          <button class="btn btn--ghost btn--sm" data-auth="login">Log in</button>
        </div>
      </div>`;
  }

  /* ---------- Notes canvas ----------
     One labeled circle per note, drawn by the React component in
     public/js/react/notes-canvas.js. Here we only leave a placeholder
     with the notes; paintNotesCanvases() lets React render into it. */
  const MAX_NOTES = 8;   // same limit as the API

  // "Bergamot, vanilla ,, Musk" -> ["Bergamot", "vanilla", "Musk"]
  const parseNotes = (value) => [...new Set(String(value || "").split(",").map((n) => n.trim()).filter(Boolean))].slice(0, MAX_NOTES);

  function notesCanvasHTML(notes, emptyText = "No notes added yet.") {
    if (!notes.length) return `<p class="pv__hint notes-canvas__empty">${emptyText}</p>`;
    return `<div class="notes-canvas-root" data-notes="${escapeHTML(JSON.stringify(notes))}"></div>`;
  }

  // Render (React) every notes canvas placeholder inside `scope`
  function paintNotesCanvases(scope = document) {
    if (window.LumiereNotesCanvas) window.LumiereNotesCanvas.mountAll(scope);
  }

  /* ---------- Notes panel: only the member who added the perfume can edit its notes ---------- */
  const NOTES_REQUIRED = 3;   // member-added perfumes have exactly 3 notes (same rule as the API)
  let editingNotes = null;    // slug whose notes are being edited
  let notesDraft = "";        // what's typed in the edit form (kept if the page re-renders)

  const canEditNotes = (p) => !!session.user && p.source === "community" && p.addedBy === session.user.username;

  function notesCountError(notes) {
    if (notes.length === NOTES_REQUIRED) return "";
    return `Please enter exactly ${NOTES_REQUIRED} notes${notes.length ? ` (you have ${notes.length})` : ""}.`;
  }

  function notesPanelBody(p) {
    if (editingNotes === p.id && canEditNotes(p)) {
      return `
        <form class="notes-first" id="notesForm" data-slug="${escapeHTML(p.id)}" novalidate>
          <p class="notes-first__title">Edit notes</p>
          <p class="pv__hint">Exactly ${NOTES_REQUIRED} notes, separated with commas.</p>
          <input name="notes" maxlength="300" value="${escapeHTML(notesDraft)}" placeholder="e.g. Bergamot, Vanilla, Musk" autocomplete="off" aria-label="Notes" />
          <div class="notes-first__preview" id="notesFormPreview">${notesCanvasHTML(parseNotes(notesDraft))}</div>
          <div class="notes-first__foot">
            <span class="composer__error" id="notesError" role="alert"></span>
            <button type="button" class="btn btn--ghost btn--sm" data-cancel-notes>Cancel</button>
            <button type="submit" class="btn btn--primary btn--sm">Save notes</button>
          </div>
        </form>`;
    }
    const credit = p.notes.length && p.notesAddedBy
      ? `<p class="pv__hint notes-credit">Notes added by ${profileLink({ username: p.notesAddedBy, displayName: "@" + p.notesAddedBy })}</p>` : "";
    const edit = canEditNotes(p)
      ? `<p class="pv__hint notes-credit"><button class="link link--btn" data-edit-notes>${p.notes.length ? "Edit notes" : "Add notes"}</button></p>` : "";
    return `${notesCanvasHTML(p.notes)}${credit}${edit}`;
  }

  // Show notes on a perfume everywhere it appears (page, cards)
  function applyNotes(p, notes, addedBy) {
    p.notes = notes;
    p.notesAddedBy = addedBy || null;
    renderPerfumeFilters();
    if (filterNoteTerms().length) renderTrendingKeepScroll();
    $$(`.perfume-card[data-perfume="${p.id}"] .perfume-card__notes`).forEach((el) => {
      el.innerHTML = notes.map((n) => `<span class="chip">${escapeHTML(n)}</span>`).join("");
    });
    const open = currentPerfume();
    if (open && open.id === p.id) refreshPage();
  }

  async function submitNotes(form) {
    const p = byId(form.dataset.slug);
    const notes = parseNotes(form.notes.value);
    const error = $("#notesError");
    if (!p) return;
    const invalid = notesCountError(notes);
    if (invalid) { error.textContent = invalid; form.notes.focus(); return; }
    $("button[type=submit]", form).disabled = true;
    try {
      const res = await api(`/perfumes/${encodeURIComponent(p.id)}/notes`, { method: "PUT", body: { notes } });
      editingNotes = null;
      applyNotes(p, res.notes, res.notesAddedBy);
      toast(`The notes of ${p.name} were updated`);
    } catch (err) {
      error.textContent = err.message;
      $("button[type=submit]", form).disabled = false;
    }
  }

  // Live preview in "Add a perfume" while the notes are typed
  function updateNotesPreview(input, boxId = "notesPreview") {
    const box = document.getElementById(boxId);
    if (!box) return;
    const notes = parseNotes(input.value);
    box.innerHTML = notesCanvasHTML(notes, "Type notes above to preview them here.");
    paintNotesCanvases(box);
  }

  const BACK_BUTTON = `
    <button class="pv__back" data-back>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg> Back
    </button>`;

  /* =======================================================
     Perfume page  (#perfume/<slug>)
     ======================================================= */
  let editingReview = null;   // id of your review being edited (null = writing a new one)

  function renderPerfumePage(p) {
    const base = baseDetails(p);
    const r = ratingFor(p);
    const me = session.user;
    const real = p.realReviews || [];
    const myReviews = me ? real.filter((rv) => rv.user.username === me.username) : [];
    const myReview = myReviews[0] || null;   // your latest review
    const editing = editingReview ? myReviews.find((rv) => String(rv.id) === String(editingReview)) : null;
    const others = real.filter((rv) => !myReviews.includes(rv));
    const rankWeek = rankedPerfumes("week").findIndex((o) => o.id === p.id) + 1;
    const familyChips = p.tags.map((t) => `<span class="tag tag--static">${families.find((f) => f.key === t).name}</span>`).join("");
    const breakdown = p.breakdown || [0, 0, 0, 0, 0];
    const perfVotes = sum(base.perf.longevity) + (p.perf ? p.perf.voters : 0);

    let writeArea = "";
    if (!me) writeArea = joinPrompt(`Tried ${escapeHTML(p.name)}? Join the community to rate it and share your review.`);
    else writeArea = composer(p, editing, myReviews.length > 0);   // always available: write another review, or edit one

    const reviewList = [
      ...myReviews.filter((rv) => rv !== editing).map((rv) => reviewItem(rv, { mine: true })),
      ...others.map((rv) => reviewItem(rv)),
    ].join("");
    const moreNote = r.reviews > real.length && p.realReviews
      ? `<p class="pv__hint pv__hint--after">Showing the ${real.length} most helpful of ${r.reviews.toLocaleString("en-US")} reviews · <a class="link" href="#all-reviews/${encodeURIComponent(p.id)}">See all reviews</a></p>` : "";
    const loading = !p.realReviews ? '<p class="pv__hint">Loading member reviews…</p>' : "";

    return `
      <div class="container pv">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          <span>Perfumes${p.brand ? ` / ${escapeHTML(p.brand)}` : ""} / <strong>${escapeHTML(p.name)}</strong></span>
        </nav>

        <section class="pv__hero">
          <div class="pv__media">
            ${perfumeMedia(p, "lg")}
            <span class="rank">${p.score.all ? `#${rankWeek} this week` : "New"}</span>
          </div>

          <div class="pv__info">
            ${p.brand ? `<p class="pv__brand">${escapeHTML(p.brand)}</p>` : ""}
            <h1 class="pv__name">${escapeHTML(p.name)}</h1>
            ${p.addedBy ? `<p class="pv__added">Added by <a href="#profile/${encodeURIComponent(p.addedBy)}">@${escapeHTML(p.addedBy)}</a></p>` : ""}

            <div class="pv__rating">
              <span class="pv__score">${r.count ? r.avg.toFixed(1) : "–"}</span>
              <div>
                ${stars(r.avg)}
                <p>${r.count ? `${r.count.toLocaleString("en-US")} ratings · ${r.reviews.toLocaleString("en-US")} reviews` : "No ratings yet — be the first"}</p>
              </div>
            </div>

            ${familyChips ? `<div class="pv__row"><span class="pv__label">Scent family</span><div class="pv__chips">${familyChips}</div></div>` : ""}
            ${p.notes.length ? `<div class="pv__row"><span class="pv__label">Main notes</span><div class="pv__chips">${p.notes.map((n) => `<span class="chip">${escapeHTML(n)}</span>`).join("")}</div></div>` : ""}

            <dl class="pv__stats">
              <div><dt data-like-count="${p.id}">${formatCount(p.real.likes)}</dt><dd>Likes</dd></div>
              <div><dt>${formatCount(r.reviews)}</dt><dd>Reviews</dd></div>
              <div><dt>${formatCount(p.score.week)}</dt><dd>Activity this week</dd></div>
            </dl>

            <div class="pv__actions">
              <button class="btn btn--primary" data-write-review>Write a review</button>
              <button class="action-btn" data-action="love" data-id="${p.id}" aria-pressed="${isLiked(p.id)}" aria-label="Like ${escapeHTML(p.name)}">${ICON.heart}<span>${isLiked(p.id) ? "Liked" : "Like"}</span></button>
              <button class="action-btn action-btn--icon" data-action="share" aria-label="Share">${ICON.share}</button>
              ${ownsPerfume(p) ? ownerButtons(p, "action-btn") : ""}
            </div>
          </div>
        </section>

        <div class="pv__grid">
          <div class="pv__main">
            <section class="panel verdict">
              <div class="panel__head">
                <h2 class="panel__title">Community verdict</h2>
                <span class="section-sub">Vote for the points you agree with</span>
              </div>
              <div class="verdict__cols">
                <div class="verdict__col verdict__col--pros">
                  <h3>Pros</h3>
                  <ul>${verdictList("pros", base.pros, p)}</ul>
                </div>
                <div class="verdict__col verdict__col--cons">
                  <h3>Cons</h3>
                  <ul>${verdictList("cons", base.cons, p)}</ul>
                </div>
              </div>
            </section>

            <section class="panel" id="pvReviews">
              <div class="panel__head">
                <h2 class="panel__title">Reviews <span class="section-sub">(${r.reviews.toLocaleString("en-US")})</span></h2>
              </div>
              ${writeArea}
              ${loading}
              <div class="pv__reviews">
                ${reviewList || (p.realReviews ? '<p class="pv__empty">No reviews yet — be the first to share your opinion.</p>' : "")}
              </div>
              ${moreNote}
            </section>
          </div>

          <aside class="pv__side">
            <section class="panel notes-panel">
              <h2 class="panel__title">Notes at a glance</h2>
              ${notesPanelBody(p)}
            </section>

            <section class="panel">
              <h2 class="panel__title">Rating breakdown</h2>
              <div class="pv__bars">${bars([5, 4, 3, 2, 1].map((s) => [`${s}★`, breakdown[s - 1], formatCount(breakdown[s - 1]), myReview && myReview.rating === s]))}</div>
              ${myReview ? `<p class="pv__hint pv__hint--after">Your ${myReviews.length > 1 ? "latest " : ""}rating: <strong>${myReview.rating}★</strong> — ${STAR_LABELS[myReview.rating - 1]}</p>` : ""}
            </section>

            <section class="panel">
              <h2 class="panel__title">Performance</h2>
              <p class="pv__hint">${perfVotes ? `Based on ${perfVotes.toLocaleString("en-US")} votes · add yours below` : "No votes yet — add yours below"}</p>
              ${perfMeter("longevity", "Longevity", base, p)}
              ${perfMeter("sillage", "Sillage", base, p)}
              ${perfMeter("value", "Value for money", base, p)}
            </section>

            <section class="panel">
              <h2 class="panel__title">When to wear</h2>
              <p class="pv__hint">Pick every season and time that fits</p>
              ${wearBlock(SEASONS, base, p)}
              <div class="pv__split">${wearBlock(TIMES, base, p)}</div>
            </section>
          </aside>
        </div>

        <section class="pv__similar">
          <div class="section-head">
            <div>
              <h2 class="section-title">You might also like</h2>
              <p class="section-sub">${p.tags.length ? "Perfumes with a similar scent profile" : "Popular with the community"}</p>
            </div>
          </div>
          <div class="perfume-grid">${similarPerfumes(p).map((o) => perfumeCard(o)).join("")}</div>
        </section>
      </div>`;
  }

  /* =======================================================
     Profile page  (#profile/<username>)
     ======================================================= */
  let profileData = null;
  let profileTab = "liked";
  let editingProfile = false;
  let deletingAccount = false;   // the "Delete your account?" box is open
  let profileList = null;   // { kind: "followers"|"following", users, total } for the open tab

  function profileReview(rv) {
    const p = byId(rv.perfume);
    if (!p) return "";
    return `
      <article class="profile-review">
        <a href="#perfume/${p.id}" class="profile-review__perfume">
          ${perfumeMedia(p, "sm")}
          <span>
            <span class="profile-review__name">${escapeHTML(p.name)}</span>
            <span class="profile-review__brand">${escapeHTML(p.brand)}</span>
          </span>
        </a>
        <div class="profile-review__body">
          <div class="profile-review__meta">${stars(rv.rating)}<strong>${rv.rating}.0</strong><span>· ${timeAgo(rv.updatedAt || rv.createdAt)}</span></div>
          <p>${escapeHTML(rv.text)}</p>
          <div class="profile-review__actions">${helpfulButton(rv)}</div>
        </div>
      </article>`;
  }

  function memberRow(u) {
    return `
      <li class="member-row">
        <a href="#profile/${encodeURIComponent(u.username)}" aria-hidden="true" tabindex="-1">${avatar(authorFromUser(u))}</a>
        <div class="member-row__info">
          <p class="member-row__name">${profileLink(u)}</p>
          <p class="member-row__meta">@${escapeHTML(u.username)}${u.bio ? ` · ${escapeHTML(u.bio)}` : ""}</p>
        </div>
        ${followButton(u.username)}
      </li>`;
  }

  async function loadProfileList(kind) {
    const username = profileData.user.username;
    profileList = null;
    try {
      const res = await api(`/users/${encodeURIComponent(username)}/${kind}?limit=60`);
      if (profileData && profileData.user.username === username && profileTab === kind) {
        profileList = { kind, ...res };
        refreshPage();
      }
    } catch (err) {
      toast(err.message);
    }
  }

  function renderProfilePage() {
    const { user, likes, reviews: userReviews, added } = profileData;
    const isMe = session.user && session.user.username === user.username;
    const liked = likes.map(byId).filter(Boolean);
    const addedPerfumes = added.map(byId).filter(Boolean);
    const joined = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const who = isMe ? "You haven't" : `${escapeHTML(user.displayName)} hasn't`;

    const tabs = [
      ["liked", "Liked", liked.length],
      ["reviews", "Reviews", userReviews.length],
      ["added", "Added", addedPerfumes.length],
      ["groups", "Groups", (profileData.groups || []).length],
      ["followers", "Followers", profileData.followers],
      ["following", "Following", profileData.following],
    ];

    let content = "";
    if (profileTab === "liked") {
      content = liked.length
        ? `<div class="perfume-grid">${liked.map((p) => perfumeCard(p)).join("")}</div>`
        : `<p class="pv__empty">${who} liked any perfumes yet.${isMe ? " Tap the ♥ on a perfume to save it here." : ""}</p>`;
    } else if (profileTab === "reviews") {
      content = userReviews.length
        ? `<div class="profile-reviews">${userReviews.map(profileReview).join("")}</div>`
        : `<p class="pv__empty">${who} written any reviews yet.${isMe ? " Open a perfume and tap “Write a review”." : ""}</p>`;
    } else if (profileTab === "groups") {
      const joined = profileData.groups || [];
      const full = joined.map((g) => (groups.list || []).find((x) => x.slug === g.slug) || { ...g, description: "", members: 0, postsThisWeek: 0 });
      content = full.length
        ? `<div class="group-grid">${full.map(groupCard).join("")}</div>`
        : `<p class="pv__empty">${isMe ? "You haven't" : `${escapeHTML(user.displayName)} hasn't`} joined any groups yet.${isMe ? ' <a class="link" href="#groups">Browse groups</a>' : ""}</p>`;
    } else if (profileTab === "added") {
      content = addedPerfumes.length
        ? `<div class="perfume-grid">${addedPerfumes.map((p) => perfumeCard(p, { owner: isMe })).join("")}</div>`
        : `<p class="pv__empty">${who} added any perfumes yet.${isMe ? ' <a class="link" href="#add-perfume">Add a perfume</a>' : ""}</p>`;
    } else {
      const label = profileTab === "followers" ? "followers" : "people they follow";
      if (!profileList || profileList.kind !== profileTab) content = '<p class="pv__empty">Loading…</p>';
      else if (!profileList.users.length) {
        content = `<p class="pv__empty">${profileTab === "followers"
          ? `${isMe ? "You don't" : `${escapeHTML(user.displayName)} doesn't`} have any followers yet.`
          : `${isMe ? "You aren't" : `${escapeHTML(user.displayName)} isn't`} following anyone yet.`}</p>`;
      } else {
        content = `
          <ul class="member-list">${profileList.users.map(memberRow).join("")}</ul>
          ${profileList.total > profileList.users.length ? `<p class="pv__hint">Showing the ${profileList.users.length} most recent of ${profileList.total.toLocaleString("en-US")} ${label}.</p>` : ""}`;
      }
    }

    const editForm = `
      <form class="profile-edit" id="profileForm" novalidate>
        <label class="field">
          <span class="field__label">Name</span>
          <input name="displayName" maxlength="40" value="${escapeHTML(user.displayName)}" required />
          <span class="field__error" data-error-for="displayName"></span>
        </label>
        <label class="field">
          <span class="field__label">Bio <span class="field__optional">(optional)</span></span>
          <textarea name="bio" rows="2" maxlength="160" placeholder="What do you love to wear?">${escapeHTML(user.bio)}</textarea>
        </label>
        <div class="profile-edit__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-cancel-profile>Cancel</button>
          <button type="submit" class="btn btn--primary btn--sm">Save</button>
        </div>
      </form>`;

    const deleteBox = deletingAccount ? `
      <div class="account-delete" role="group" aria-label="Delete your account">
        <div>
          <strong>Delete your account?</strong>
          <p>This permanently removes your profile, reviews, likes, follows, group posts and messages. Perfumes and groups you created stay on LUMIERE.</p>
        </div>
        <label class="field">
          <span class="field__label">Enter your password to confirm</span>
          <input type="password" id="deleteAccountPassword" autocomplete="current-password" />
          <span class="field__error" id="deleteAccountError"></span>
        </label>
        <div class="profile-edit__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-cancel-delete-account>Cancel</button>
          <button type="button" class="btn btn--danger btn--sm" data-confirm-delete-account>Delete my account</button>
        </div>
      </div>`
      : '<p class="profile-edit__danger"><button type="button" class="link link--btn is-danger" data-delete-account>Delete account</button></p>';

    const stat = (key, n, label) =>
      `<button class="profile-stat" data-profile-tab="${key}"><strong>${formatCount(n)}</strong><span>${label}</span></button>`;

    return `
      <div class="container pv">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          <span>Members / <strong>@${escapeHTML(user.username)}</strong></span>
        </nav>

        <section class="profile-head">
          ${avatar(authorFromUser(user), "avatar--xl")}
          <div class="profile-head__info">
            ${isMe && editingProfile ? editForm + deleteBox : `
              <h1 class="profile-head__name">${escapeHTML(user.displayName)}</h1>
              <p class="profile-head__meta">@${escapeHTML(user.username)} · Joined ${joined}</p>
              ${user.bio ? `<p class="profile-head__bio">${escapeHTML(user.bio)}</p>` : ""}`}
            <div class="profile-head__stats">
              ${stat("followers", profileData.followers, "Followers")}
              ${stat("following", profileData.following, "Following")}
              ${stat("reviews", userReviews.length, "Reviews")}
              ${stat("liked", liked.length, "Liked")}
            </div>
          </div>
          <div class="profile-head__actions">
            ${isMe
              ? (editingProfile ? "" : `
                <button class="btn btn--ghost btn--sm" data-edit-profile>Edit profile</button>
                <a class="btn btn--primary btn--sm" href="#add-perfume">Add a perfume</a>
                <button class="btn btn--ghost btn--sm" data-logout>Log out</button>`)
              : `${followButton(user.username, "btn--follow-lg")}
                 ${session.user
                   ? `<a class="btn btn--ghost btn--follow-lg" href="#messages/${encodeURIComponent(user.username)}">Message</a>`
                   : `<button class="btn btn--ghost btn--follow-lg" data-auth="signup" data-reason="Join the community to message other members.">Message</button>`}`}
          </div>
        </section>

        <div class="segmented profile-tabs" role="tablist" aria-label="Profile sections">
          ${tabs.map(([key, label, n]) => `<button role="tab" aria-selected="${profileTab === key}" data-profile-tab="${key}">${label} <span class="tab-count">${formatCount(n)}</span></button>`).join("")}
        </div>

        <div class="profile-content">${content}</div>
      </div>`;
  }

  /* =======================================================
     All reviews  (#all-reviews)
     ======================================================= */
  const allReviews = { sort: "popular", scope: "all", rating: "", since: "", q: "", perfume: "", items: [], total: 0, hasMore: false, loading: false };   // perfume: slug, or "" for all

  function renderAllReviewsPage() {
    const a = allReviews;
    const only = a.perfume ? byId(a.perfume) || { id: a.perfume, name: "this perfume" } : null;
    const seg = (attr, value, label, current) =>
      `<button role="tab" aria-selected="${current === value}" ${attr}="${value}">${label}</button>`;
    let body;
    if (a.loading && !a.items.length) body = '<p class="pv__empty">Loading reviews…</p>';
    else if (!a.items.length) {
      body = a.scope === "following"
        ? '<p class="pv__empty">No reviews from people you follow yet. Follow reviewers you like to see their reviews here.</p>'
        : '<p class="pv__empty">No reviews match this filter.</p>';
    } else body = `<div class="review-list">${a.items.map(reviewCard).join("")}</div>`;

    return `
      <div class="container pv all-reviews">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          ${only
            ? `<span>Perfumes / <a href="#perfume/${encodeURIComponent(only.id)}">${escapeHTML(only.name)}</a> / <strong>Reviews</strong></span>`
            : "<span>Community / <strong>All reviews</strong></span>"}
        </nav>

        <div class="section-head">
          <div>
            <h1 class="section-title">${only ? `Reviews of ${escapeHTML(only.name)}` : "All reviews"}</h1>
            <p class="section-sub">${a.loading && !a.items.length ? "&nbsp;" : `${a.total.toLocaleString("en-US")} review${a.total === 1 ? "" : "s"}`}</p>
          </div>
        </div>

        <div class="all-reviews__controls">
          <div class="segmented" role="tablist" aria-label="Sort reviews">
            ${seg("data-reviews-sort", "popular", "Most helpful", a.sort)}
            ${seg("data-reviews-sort", "newest", "Newest", a.sort)}
          </div>
          ${session.user ? `
          <div class="segmented" role="tablist" aria-label="Whose reviews">
            ${seg("data-reviews-scope", "all", "Everyone", a.scope)}
            ${seg("data-reviews-scope", "following", "People I follow", a.scope)}
          </div>` : ""}
          <div class="all-reviews__ratings" role="group" aria-label="Filter by rating">
            ${["", "5", "4", "3", "2", "1"].map((r) => `<button class="tag" data-reviews-rating="${r}" aria-pressed="${a.rating === r}">${r ? `${r}★` : "All ratings"}</button>`).join("")}
          </div>
        </div>

        <div class="filter-fields" role="group" aria-label="Search reviews">
          <label class="filter-field">
            <span>Date</span>
            <select id="reviewsSince">
              ${[["", "Any time"], ["week", "Past week"], ["month", "Past month"], ["year", "Past year"]]
                .map(([v, label]) => `<option value="${v}"${a.since === v ? " selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
          <label class="filter-field filter-field--wide">
            <span>Reviewer or keyword</span>
            <input id="reviewsQuery" type="search" value="${escapeHTML(a.q)}" placeholder="e.g. @alice or long lasting" autocomplete="off" />
          </label>
          ${a.rating || a.since || a.q.trim() ? '<button type="button" class="link link--btn filter-fields__clear" data-clear-review-filters>Clear filters</button>' : ""}
        </div>

        <div class="${a.loading && a.items.length ? "is-loading" : ""}">${body}</div>

        ${a.hasMore ? `<div class="all-reviews__more"><button class="btn btn--ghost" data-load-more ${a.loading ? "disabled" : ""}>${a.loading ? "Loading…" : "Load more reviews"}</button></div>` : ""}
      </div>`;
  }

  let allReviewsRequest = 0;

  // Changing a filter keeps the current list on screen (dimmed) until the new one arrives
  // re-render without losing your place in the "Reviewer or keyword" box
  function refreshReviewsPage() {
    const input = document.activeElement && document.activeElement.id === "reviewsQuery" ? document.activeElement : null;
    const caret = input ? [input.selectionStart, input.selectionEnd] : null;
    refreshPage();
    const again = input && $("#reviewsQuery");
    if (again) { again.focus(); again.setSelectionRange(caret[0], caret[1]); }
  }

  async function loadAllReviews(reset) {
    const a = allReviews;
    const id = ++allReviewsRequest;
    a.loading = true;
    refreshReviewsPage();
    try {
      const q = new URLSearchParams({ sort: a.sort, scope: a.scope, limit: "10", offset: String(reset ? 0 : a.items.length) });
      if (a.rating) q.set("rating", a.rating);
      if (a.perfume) q.set("perfume", a.perfume);
      if (a.since) q.set("since", a.since);
      if (a.q.trim()) q.set("q", a.q.trim());
      const res = await api(`/reviews?${q}`);
      if (res.reviews.some((r) => !byId(r.perfume))) await syncNewPerfumes();   // a review of a perfume added after this page loaded
      if (renderCurrent !== renderAllReviewsPage || id !== allReviewsRequest) return;
      a.items = reset ? res.reviews : [...a.items, ...res.reviews];
      a.total = res.total;
      a.hasMore = res.hasMore;
    } catch (err) {
      toast(err.message);
    }
    a.loading = false;
    refreshReviewsPage();
  }

  /* =======================================================
     Add a perfume  (#add-perfume)
     ======================================================= */
  const MAX_PHOTO = 5 * 1024 * 1024;   // server limit
  const PHOTO_MAX_SIDE = 1600;          // photos are resized to this before upload
  let addPhoto = null;                  // ready-to-upload JPEG
  let photoWork = null;                 // promise while a photo is being prepared

  // "Add a perfume", or (with `edit`) "Edit perfume" for a perfume you added
  function renderAddPage(edit = null) {
    const v = (value) => (edit ? ` value="${escapeHTML(value || "")}"` : "");
    return `
      <div class="container pv">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          <span>Perfumes / ${edit ? `${escapeHTML(edit.name)} / <strong>Edit</strong>` : "<strong>Add a perfume</strong>"}</span>
        </nav>

        <div class="add">
          <section class="panel add__form-panel">
            <h1 class="add__title">${edit ? "Edit perfume" : "Add a perfume"}</h1>
            <p class="section-sub">${edit ? `Update the details of ${escapeHTML(edit.name)}.` : "Can't find a perfume on LUMIERE? Add it so the community can rate and review it."}</p>

            <form id="addForm" class="add__form" novalidate${edit ? ` data-editing="${escapeHTML(edit.id)}"` : ""}>
              <div class="add__row">
                <label class="field">
                  <span class="field__label">Brand</span>
                  <input name="brand" maxlength="60" placeholder="e.g. Creed" autocomplete="off" required${v(edit && edit.brand)} />
                  <span class="field__error" data-error-for="brand"></span>
                </label>
                <label class="field">
                  <span class="field__label">Perfume name</span>
                  <input name="name" maxlength="80" placeholder="e.g. Aventus" autocomplete="off" required${v(edit && edit.name)} />
                  <span class="field__error" data-error-for="name"></span>
                </label>
              </div>

              <div class="notice" id="dupNotice" role="status" hidden></div>

              <fieldset class="field">
                <legend class="field__label">Scent family <span class="field__optional">(pick all that fit)</span></legend>
                <div class="check-chips">
                  ${families.map((f) => `<label class="check-chip"><input type="checkbox" name="tags" value="${f.key}"${edit && edit.tags.includes(f.key) ? " checked" : ""} /><span>${f.name}</span></label>`).join("")}
                </div>
              </fieldset>

              <label class="field">
                <span class="field__label">Main notes <span class="field__optional">(exactly ${NOTES_REQUIRED}, separate with commas)</span></span>
                <input name="notes" maxlength="300" placeholder="e.g. Bergamot, Vanilla, Musk" autocomplete="off" required${v(edit && edit.notes.join(", "))} />
                <span class="field__error" data-error-for="notes"></span>
              </label>
              <div class="notes-preview" id="notesPreview" aria-live="polite">
                ${notesCanvasHTML(edit ? edit.notes : [], "Type notes above to preview them here.")}
              </div>

              <div class="field">
                <span class="field__label">Photo <span class="field__optional">${edit ? "(choose a new one to replace it · any size, we'll resize it)" : "(required · any size, we'll resize it)"}</span></span>
                <div class="add__photo">
                  <div class="add__preview" id="photoPreview">
                    ${perfumeMedia(edit || { name: "", image: "", look: { shape: "rect", liquid: "#e3e6e4", cap: "#2b2f2d" } }, "sm")}
                  </div>
                  <label class="btn btn--ghost btn--sm add__file">
                    <input type="file" id="photoInput" accept="image/*" />
                    Choose a photo
                  </label>
                  <button type="button" class="link link--btn" id="photoRemove" hidden>Remove</button>
                </div>
                <span class="field__error" data-error-for="photo"></span>
              </div>

              <div class="add__foot">
                <span class="composer__error" id="addError" role="alert"></span>
                <button type="submit" class="btn btn--primary" id="addSubmit">${edit ? "Save changes" : "Add perfume"}</button>
              </div>
            </form>
          </section>

          <aside class="panel add__tips">
            <h2 class="panel__title">Before you add</h2>
            <ul>
              <li>Search first — we'll also warn you if the perfume is already here.</li>
              <li>Use the official name, e.g. <em>Aventus</em> by <em>Creed</em>.</li>
              <li>A clear photo of the bottle on a plain background works best.</li>
              <li>After adding, be the first to rate and review it!</li>
            </ul>
          </aside>
        </div>
      </div>`;
  }

  function showDuplicate(existing) {
    const box = $("#dupNotice");
    const submit = $("#addSubmit");
    if (!box) return;
    if (!existing) {
      box.hidden = true;
      box.innerHTML = "";
      submit.disabled = false;
      return;
    }
    const label = `${existing.brand ? existing.brand + " " : ""}${existing.name}`;
    box.innerHTML = `
      <div>
        <strong>Good news — ${escapeHTML(label)} is already on LUMIERE.</strong>
        <p>No need to add it again. You can like it, rate it and write your review on its page.</p>
      </div>
      <a class="btn btn--primary btn--sm" href="#perfume/${encodeURIComponent(existing.slug)}">View ${escapeHTML(label)} →</a>`;
    box.hidden = false;
    submit.disabled = true;
  }

  let dupTimer = 0;
  let dupRequest = 0;
  function checkDuplicateSoon(form) {
    clearTimeout(dupTimer);
    dupTimer = setTimeout(async () => {
      const brand = form.brand.value.trim();
      const name = form.name.value.trim();
      if (!name) return showDuplicate(null);
      const id = ++dupRequest;
      try {
        const except = form.dataset.editing ? `&except=${encodeURIComponent(form.dataset.editing)}` : "";
        const res = await api(`/perfumes/check?brand=${encodeURIComponent(brand)}&name=${encodeURIComponent(name)}${except}`);
        if (id === dupRequest) showDuplicate(res.exists ? res.perfume : null);
      } catch (err) { /* the server check on submit still protects us */ }
    }, 350);
  }

  function setFieldErrors(form, fields = {}) {
    $$("[data-error-for]", form).forEach((el) => { el.textContent = fields[el.dataset.errorFor] || ""; });
    $$("input, textarea", form).forEach((el) => el.toggleAttribute("aria-invalid", !!fields[el.name]));
  }

  async function submitAddForm(form) {
    const submit = $("#addSubmit");
    const error = $("#addError");
    const body = {
      brand: form.brand.value.trim(),
      name: form.name.value.trim(),
      tags: $$("input[name=tags]:checked", form).map((c) => c.value),
      notes: form.notes.value,
    };
    const fields = {};
    if (!body.brand) fields.brand = "Please enter the brand.";
    if (!body.name) fields.name = "Please enter the perfume's name.";
    const notesError = notesCountError(parseNotes(body.notes));
    if (notesError) fields.notes = notesError;
    if (photoWork) await photoWork;   // wait until a chosen photo is ready
    const photoError = $('[data-error-for="photo"]').textContent;
    const editing = form.dataset.editing ? byId(form.dataset.editing) : null;
    if (photoError) fields.photo = photoError;
    else if (!addPhoto && !editing) fields.photo = "Please add a photo of the perfume.";
    setFieldErrors(form, fields);
    error.textContent = "";
    if (Object.keys(fields).length) return;
    if (editing) return saveEditedPerfume(form, editing, body);

    submit.disabled = true;
    submit.textContent = "Adding…";
    try {
      // the photo is the request body; the details travel in a header
      const { perfume } = await api("/perfumes", {
        method: "POST",
        file: addPhoto,
        headers: { "X-Perfume": encodeURIComponent(JSON.stringify(body)) },
      });
      // the live "perfume:added" event may have added it already
      const p = byId(perfume.slug) || buildPerfume(perfume);
      if (!perfumes.includes(p)) perfumes.push(p);
      if (profileData && session.user && profileData.user.username === session.user.username) profileData.added.unshift(p.id);
      renderFilterBar();
      renderTrending();
      addPhoto = null;
      location.hash = `perfume/${p.id}`;
      toast(`Thanks! ${p.name} was added to LUMIERE`);
    } catch (err) {
      if (err.status === 409 && err.data.existing) {
        showDuplicate(err.data.existing);
        toast("This perfume is already on LUMIERE — here's the link");
      } else {
        setFieldErrors(form, err.data && err.data.fields);
        error.textContent = err.message;
      }
      submit.textContent = "Add perfume";
      submit.disabled = !!(err.status === 409);
    }
  }

  async function saveEditedPerfume(form, p, body) {
    const submit = $("#addSubmit");
    const error = $("#addError");
    submit.disabled = true;
    submit.textContent = "Saving…";
    try {
      let { perfume } = await api(`/perfumes/${encodeURIComponent(p.id)}`, { method: "PATCH", body });
      if (addPhoto) {
        try {
          const res = await api(`/perfumes/${encodeURIComponent(p.id)}/image`, { method: "PUT", file: addPhoto });
          perfume = { ...perfume, image: res.image };
        } catch (err) {
          toast(`Changes saved, but the photo failed: ${err.message}`);
        }
      }
      addPhoto = null;
      updatePerfume(perfume);
      location.hash = `perfume/${encodeURIComponent(p.id)}`;
      toast(`${perfume.name} was updated`);
    } catch (err) {
      if (err.status === 409 && err.data.existing) {
        showDuplicate(err.data.existing);
      } else {
        setFieldErrors(form, err.data && err.data.fields);
        error.textContent = err.message;
      }
      submit.textContent = "Save changes";
      submit.disabled = !!(err.status === 409);
    }
  }

  // A perfume's details changed (by you, or live from the owner)
  function updatePerfume(json) {
    const p = byId(json.slug);
    if (!p) return;
    Object.assign(p, { brand: json.brand, name: json.name, tags: json.tags || [], notes: json.notes || [], image: json.image || "" });
    renderFilterBar();
    renderTrending();
    if (renderCurrent && currentPerfume() === p) refreshPage();
    else if (renderCurrent === renderProfilePage) refreshPage();
  }

  async function deletePerfume(id) {
    const p = byId(id);
    if (!p) return;
    // checked before the request: the live "perfume:deleted" event can remove it from the list first
    const onItsPage = currentPerfume() === p;
    try {
      await api(`/perfumes/${encodeURIComponent(id)}`, { method: "DELETE" });
      confirmingDelete = null;
      removePerfume(id);
      toast(`${p.name} was deleted`);
      if (onItsPage) {
        profileTab = "added";
        location.hash = `profile/${encodeURIComponent(session.user.username)}`;
      }
    } catch (err) {
      toast(err.message);
    }
  }

  // A perfume is gone (deleted by you, or live by its owner)
  function removePerfume(id) {
    if (!byId(id)) return;
    perfumes = perfumes.filter((x) => x.id !== id);
    if (profileData) profileData.added = profileData.added.filter((x) => x !== id);
    renderFilterBar();
    renderTrending();
    refreshCommunity();
    if (renderCurrent === renderProfilePage) refreshPage();
    else if (location.hash === `#perfume/${encodeURIComponent(id)}` || location.hash === `#perfume/${id}`) route();
  }

  // Resize any photo (e.g. a big phone photo) to a web-friendly JPEG
  async function preparePhoto(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";                         // transparent PNGs get a white background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("encode failed");
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  }

  function showPhoto(file) {
    const form = $("#addForm");
    const editing = form && form.dataset.editing && byId(form.dataset.editing);
    $("#photoPreview").innerHTML = perfumeMedia({
      name: "Preview", image: file ? URL.createObjectURL(file) : (editing ? editing.image : ""),
      look: editing ? editing.look : { shape: "rect", liquid: "#e3e6e4", cap: "#2b2f2d" },
    }, "sm");
    $("#photoRemove").hidden = !file;
    if (!file) $("#photoInput").value = "";
  }

  function choosePhoto(file) {
    const errorEl = $('[data-error-for="photo"]');
    errorEl.textContent = "";
    addPhoto = null;
    if (!file) { photoWork = null; showPhoto(null); return; }

    photoWork = preparePhoto(file)
      .then((ready) => {
        if (ready.size > MAX_PHOTO) throw new Error("too big");
        addPhoto = ready;
        showPhoto(ready);
      })
      .catch(() => {
        errorEl.textContent = "We couldn't read that photo. Please choose a JPG, PNG or WebP image.";
        showPhoto(null);
      })
      .finally(() => { photoWork = null; });
  }

  /* =======================================================
     Info pages: About (#about) · Help center (#help) · Privacy (#privacy)
     ======================================================= */
  const SUPPORT_EMAIL = "support@lumiere.com";

  function infoPage(crumb, body) {
    return `
      <div class="container pv info-page">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          <span>LUMIERE / <strong>${crumb}</strong></span>
        </nav>
        <article class="panel info-card">${body}</article>
      </div>`;
  }

  function renderAboutPage() {
    return infoPage("About", `
      <p class="info-card__eyebrow">About LUMIERE</p>
      <h1 class="info-card__title">Fragrance discovery, made personal</h1>
      <p class="info-card__lead">LUMIERE is a fragrance community for discovering new scents, sharing honest opinions and learning from other fragrance lovers. Our goal is to make finding your next favorite perfume feel simple, personal and social.</p>
      <ul class="info-points">
        <li><strong>Discover</strong><span>Explore perfumes by brand, notes and scent family, and see what's trending right now.</span></li>
        <li><strong>Review honestly</strong><span>Rate what you've tried and read real opinions — longevity, sillage, when to wear it.</span></li>
        <li><strong>Connect</strong><span>Follow other members, join discussion groups and chat with people who share your taste.</span></li>
      </ul>
      <div class="info-card__actions">
        <a class="btn btn--primary" href="#trending">Explore perfumes</a>
        ${session.user ? '<a class="btn btn--ghost" href="#groups">Browse groups</a>' : '<button class="btn btn--ghost" data-auth="signup">Join the community</button>'}
      </div>`);
  }

  function renderHelpPage() {
    const me = session.user;
    return infoPage("Help center", `
      <p class="info-card__eyebrow">Help center</p>
      <h1 class="info-card__title">How can we help?</h1>
      <p class="info-card__lead">Have a question or need a hand? Email us at <a class="link" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>, or leave your name and email below and we'll get back to you.</p>
      <form class="info-form" id="contactForm" novalidate>
        <div class="info-form__row">
          <label class="field">
            <span class="field__label">Name</span>
            <input name="name" maxlength="80" autocomplete="name" value="${me ? escapeHTML(me.displayName) : ""}" required />
            <span class="field__error" data-error-for="name"></span>
          </label>
          <label class="field">
            <span class="field__label">Email</span>
            <input name="email" type="email" maxlength="120" autocomplete="email" required />
            <span class="field__error" data-error-for="email"></span>
          </label>
        </div>
        <label class="field">
          <span class="field__label">Message <span class="field__optional">(optional)</span></span>
          <textarea name="message" rows="3" maxlength="1000" placeholder="Tell us a little about what you need"></textarea>
        </label>
        <div class="info-form__foot">
          <span class="composer__error" id="contactError" role="alert"></span>
          <button type="submit" class="btn btn--primary">Send</button>
        </div>
      </form>
      <p class="info-form__done" id="contactDone" role="status" hidden>Thanks! We've got your details and will get back to you soon.</p>`);
  }

  function renderPrivacyPage() {
    return infoPage("Privacy", `
      <p class="info-card__eyebrow">Privacy &amp; terms</p>
      <h1 class="info-card__title">Using LUMIERE</h1>
      <p class="info-card__lead">By using LUMIERE, you agree to these simple rules. We keep them short on purpose.</p>
      <div class="info-columns">
      <section class="info-section">
        <h2>Be respectful</h2>
        <p>Use the platform kindly and honestly. Don't harass other members, post spam or misuse any features.</p>
      </section>
      <section class="info-section">
        <h2>Your account information</h2>
        <p>We store your account details — like your name, username and email — only to make the site work: signing in, your profile, likes, reviews and messages. We don't sell your information.</p>
      </section>
      <section class="info-section">
        <h2>What other members can see</h2>
        <p>Reviews, ratings, group posts, replies and your public profile are visible to other members. Private messages are only visible to you and the person you're chatting with.</p>
      </section>
      </div>
      <p class="info-card__note">Questions? Contact us at <a class="link" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> or visit the <a class="link" href="#help">Help center</a>.</p>`);
  }

  async function submitContact(form) {
    const $form = jQuery(form);
    const value = (name) => String($form.find(`[name=${name}]`).val() || "").trim();
    const body = { name: value("name"), email: value("email"), message: value("message") };
    const fields = {};
    if (!body.name) fields.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) fields.email = "Please enter a valid email.";
    setFieldErrors(form, fields);
    const $error = jQuery("#contactError").text("");
    if (Object.keys(fields).length) return;
    const $button = $form.find("button[type=submit]").prop("disabled", true);
    try {
      await api("/contact", { method: "POST", body });
      $form.prop("hidden", true);
      jQuery("#contactDone").prop("hidden", false);
    } catch (err) {
      setFieldErrors(form, err.data && err.data.fields);
      $error.text(err.message);
      $button.prop("disabled", false);
    }
  }

  /* =======================================================
     Accounts: session, sign up / log in window, account menu
     ======================================================= */
  const session = { user: null, likes: new Set(), following: new Set() };
  const isLiked = (id) => session.likes.has(id);
  const isFollowing = (username) => session.following.has(username);

  function setSession(data) {
    session.user = data && data.user ? data.user : null;
    session.likes = new Set((data && data.likes) || []);
    session.following = new Set((data && data.following) || []);
  }

  // Every request to our Express API goes through jQuery AJAX ($.ajax).
  // Resolves with the JSON body; rejects with an Error carrying { status, data } (status 0 = server unreachable).
  const parseJSON = (text) => { try { return JSON.parse(text); } catch (err) { return {}; } };

  function api(path, { method = "GET", body, file, headers = {} } = {}) {
    const settings = { url: `/api${path}`, method, headers: { ...headers }, dataType: "text" };
    if (file) {
      Object.assign(settings, { data: file, processData: false, contentType: file.type });   // raw photo upload
    } else if (body !== undefined) {
      Object.assign(settings, { data: JSON.stringify(body), contentType: "application/json" });
    }
    return new Promise((resolve, reject) => {
      jQuery.ajax(settings)
        .done((text) => resolve(parseJSON(text)))
        .fail((xhr) => {
          if (!xhr.status) {
            reject(Object.assign(new Error("Can't connect to the LUMIERE server. Make sure it's running (npm start) and try again."), { status: 0, data: {} }));
            return;
          }
          const data = parseJSON(xhr.responseText);
          reject(Object.assign(new Error(data.error || "Something went wrong."), { status: xhr.status, data }));
        });
    });
  }

  const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  function renderAccountArea() {
    const me = session.user;
    const desktop = $("#headerAccount");
    const mobile = $("#navAuthMobile");

    if (!me) {
      desktop.innerHTML = `
        <button class="btn btn--ghost btn--sm header__login" data-auth="login">Log in</button>
        <button class="btn btn--primary btn--sm header__signup" data-auth="signup">Sign up</button>`;
      mobile.innerHTML = `
        <button class="btn btn--ghost" data-auth="login">Log in</button>
        <button class="btn btn--primary" data-auth="signup">Sign up</button>`;
      try { localStorage.removeItem("lumiere:account"); } catch (err) { /* storage unavailable */ }
      return;
    }
    const profileHref = `#profile/${encodeURIComponent(me.username)}`;
    desktop.innerHTML = `
      <div class="account">
        <button class="account__btn" id="accountBtn" aria-expanded="false" aria-haspopup="menu" aria-controls="accountMenu">
          ${avatar(authorFromUser(me), "avatar--sm")}
          <span class="account__name">${escapeHTML(me.displayName.split(" ")[0])}</span>
          ${CHEVRON}
        </button>
        <div class="account__menu" id="accountMenu" role="menu" hidden>
          <p class="account__who"><strong>${escapeHTML(me.displayName)}</strong><span>@${escapeHTML(me.username)}</span></p>
          <a role="menuitem" href="${profileHref}">My profile</a>
          <a role="menuitem" href="#add-perfume">Add a perfume</a>
          <button role="menuitem" data-logout>Log out</button>
        </div>
      </div>`;
    mobile.innerHTML = `
      <a class="btn btn--ghost" href="${profileHref}">My profile</a>
      <a class="btn btn--primary" href="#add-perfume">Add a perfume</a>
      <button class="btn btn--ghost nav__logout" data-logout>Log out</button>`;
    // remembered so the next page load paints this header straight away (see the script in home.html)
    try { localStorage.setItem("lumiere:account", desktop.innerHTML); } catch (err) { /* storage unavailable */ }
  }

  // Signed out: welcome + join. Signed in: no box (members are found with the main search).
  function renderSnapshot() {
    const me = session.user;
    const box = $("#snapshot");
    // the login state is known now -> show the right thing (the box is hidden on page load to avoid a flash)
    box.classList.remove("is-pending");
    box.removeAttribute("aria-busy");
    box.hidden = !!me;
    $(".hero").classList.toggle("hero--solo", !!me);
    if (!me) {
      $("#snapshotWelcome").innerHTML = `<p class="snapshot__title">Welcome to LUMIERE 👋</p>
         <p>Want to chat with other fragrance lovers and share your opinion in reviews? Join the community — it only takes a minute.</p>`;
      $("#snapshotCta").innerHTML = `<button class="btn btn--primary btn--block" data-auth="signup">Join the community — it’s free</button>`;
    }
  }

  // Signed-out visitors only get "Home"; the other sections are for members
  function applyAuthState() {
    const signedIn = !!session.user;
    document.documentElement.classList.toggle("is-member", signedIn);
    $$("[data-members-only]").forEach((link) => {
      link.classList.toggle("is-locked", !signedIn);
      link.toggleAttribute("aria-disabled", !signedIn);
      link.title = signedIn ? "" : "Join the community to unlock";
    });
    renderAccountArea();
    renderSnapshot();
  }

  // Re-render everything that depends on who is signed in
  function onAuthChange() {
    applyAuthState();
    perfumes.forEach((x) => { delete x.perf; });   // performance votes are per member
    const viewing = currentPerfume();
    if (viewing) loadPerformance(viewing).then(() => { if (currentPerfume() === viewing) refreshPage(); });
    document.dispatchEvent(new CustomEvent("lumiere:auth"));
    allReviews.scope = "all";
    if (perfumes.length) { renderTrending(); refreshCommunity(); }
    loadGroups();
    startMessenger();
    if (renderCurrent === renderGroupPage && groupView) {
      groupView.group = null;
      loadGroup(groupView.slug);
    }
    if (location.hash === "#add-perfume" && !session.user) location.hash = "";
    else if (renderCurrent) refreshPage();
    else if (!$("#perfumeView").hidden) route();
  }

  /* ---------- Sign up / log in window ---------- */
  let lastFocus = null;

  function field(name, label, type, autocomplete, hint = "") {
    return `
      <label class="field">
        <span class="field__label">${label}</span>
        <input name="${name}" type="${type}" autocomplete="${autocomplete}" required ${type === "password" ? 'minlength="8"' : ""} />
        <span class="field__error" data-error-for="${name}"></span>
        ${hint ? `<span class="field__hint">${hint}</span>` : ""}
      </label>`;
  }

  function openAuth(mode = "signup", reason = "") {
    const modal = $("#authModal");
    const signup = mode === "signup";
    if (modal.hidden) lastFocus = document.activeElement;
    modal.innerHTML = `
      <div class="modal__backdrop" data-close-modal></div>
      <div class="modal__card" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <button class="modal__close" data-close-modal aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <span class="logo"><span class="logo__mark" aria-hidden="true"></span>LUMIERE</span>
        <h2 class="modal__title" id="authTitle">${signup ? "Join the community" : "Welcome back"}</h2>
        <p class="modal__reason">${escapeHTML(reason || (signup
          ? "Create a free account to write reviews, like perfumes, chat with other fragrance lovers and add new perfumes."
          : "Log in to your LUMIERE account."))}</p>

        <form id="authForm" data-mode="${mode}" novalidate>
          ${signup
            ? field("displayName", "Your name", "text", "name") +
              field("username", "Username", "text", "username", "3–20 characters: letters, numbers, _ or .") +
              field("email", "Email", "email", "email") +
              field("password", "Password", "password", "new-password", "At least 8 characters.")
            : field("login", "Email or username", "text", "username") +
              field("password", "Password", "password", "current-password")}
          <p class="form-error" id="authError" role="alert"></p>
          <button class="btn btn--primary btn--block" type="submit">${signup ? "Create account" : "Log in"}</button>
        </form>

        <p class="modal__switch">
          ${signup
            ? 'Already a member? <button class="link link--btn" data-auth="login">Log in</button>'
            : 'New to LUMIERE? <button class="link link--btn" data-auth="signup">Create an account</button>'}
        </p>
      </div>`;
    modal.hidden = false;
    document.documentElement.classList.add("modal-open");
    $("input", modal).focus();
  }

  function closeAuth() {
    const modal = $("#authModal");
    if (modal.hidden) return;
    modal.hidden = true;
    modal.innerHTML = "";
    document.documentElement.classList.remove("modal-open");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  async function submitAuth(form) {
    const signup = form.dataset.mode === "signup";
    const button = $("button[type=submit]", form);
    const values = Object.fromEntries(new FormData(form));
    setFieldErrors(form, {});
    $("#authError").textContent = "";
    button.disabled = true;
    try {
      const data = await api(signup ? "/auth/signup" : "/auth/login", { method: "POST", body: values });
      setSession(data);
      closeAuth();
      onAuthChange();
      toast(signup ? `Welcome to LUMIERE, ${data.user.displayName}!` : `Welcome back, ${data.user.displayName}!`);
    } catch (err) {
      setFieldErrors(form, err.data && err.data.fields);
      $("#authError").textContent = err.message;
      button.disabled = false;
    }
  }

  /* ---------- Page controls handled with jQuery event delegation on the page view ----------
     All reviews (sort, whose, stars, date, reviewer/keyword, load more, clear),
     Members (search, load more), profile editing / delete account, Help center form */
  function initPageControls() {
    const $view = jQuery("#perfumeView");

    // All reviews
    $view.on("click", "[data-reviews-sort]", function () { allReviews.sort = jQuery(this).attr("data-reviews-sort"); loadAllReviews(true); });
    $view.on("click", "[data-reviews-scope]", function () { allReviews.scope = jQuery(this).attr("data-reviews-scope"); loadAllReviews(true); });
    $view.on("click", "[data-reviews-rating]", function () { allReviews.rating = jQuery(this).attr("data-reviews-rating"); loadAllReviews(true); });
    $view.on("click", "[data-load-more]", () => loadAllReviews(false));
    $view.on("click", "[data-clear-review-filters]", () => { Object.assign(allReviews, { rating: "", since: "", q: "" }); loadAllReviews(true); });
    $view.on("change", "#reviewsSince", function () { allReviews.since = jQuery(this).val(); loadAllReviews(true); });
    let reviewsQueryTimer = 0;
    $view.on("input", "#reviewsQuery", function () {
      allReviews.q = String(jQuery(this).val() || "");   // saved right away, so another filter can't undo it
      clearTimeout(reviewsQueryTimer);
      reviewsQueryTimer = setTimeout(() => loadAllReviews(true), 300);
    });

    // Members
    $view.on("click", "[data-members-more]", () => loadMembers(false));
    let membersQueryTimer = 0;
    $view.on("input", "#membersQuery", function () {
      membersDir.q = String(jQuery(this).val() || "");
      clearTimeout(membersQueryTimer);
      membersQueryTimer = setTimeout(() => loadMembers(true), 300);
    });

    // Profile: edit, delete account
    $view.on("click", "[data-edit-profile]", () => { editingProfile = true; refreshPage(); jQuery("#profileForm input").first().trigger("focus"); });
    $view.on("click", "[data-cancel-profile]", () => { editingProfile = false; deletingAccount = false; refreshPage(); });
    $view.on("click", "[data-delete-account]", () => { deletingAccount = true; refreshPage(); jQuery("#deleteAccountPassword").trigger("focus"); });
    $view.on("click", "[data-cancel-delete-account]", () => { deletingAccount = false; refreshPage(); });
    $view.on("click", "[data-confirm-delete-account]", function () { deleteAccount(this); });

    // Help center
    $view.on("submit", "#contactForm", function (e) { e.preventDefault(); submitContact(this); });

    // Groups page: search by name / topic and scent family
    let groupsQueryTimer = 0;
    $view.on("input", "#groupsQuery", function () {
      groups.q = String(jQuery(this).val() || "");
      clearTimeout(groupsQueryTimer);
      groupsQueryTimer = setTimeout(refreshKeepingFocus, 150);
    });
    $view.on("change", "#groupsFamily", function () { groups.family = jQuery(this).val(); refreshKeepingFocus(); });

    // Group page: the creator edits / deletes the group
    $view.on("click", "[data-delete-group]", () => { groupView.confirmDelete = true; refreshPage(); });
    $view.on("click", "[data-cancel-group-delete]", () => { groupView.confirmDelete = false; refreshPage(); });
    $view.on("click", "[data-confirm-group-delete]", function () { deleteGroup(this); });

    // Group page: search posts (words or @member, date)
    let postsQueryTimer = 0;
    $view.on("input", "#postsQuery", function () {
      groupView.q = String(jQuery(this).val() || "");
      clearTimeout(postsQueryTimer);
      postsQueryTimer = setTimeout(() => loadGroupPosts(true), 300);
    });
    $view.on("change", "#postsSince", function () { groupView.since = jQuery(this).val(); loadGroupPosts(true); });

    // Group page: edit your own post or reply
    $view.on("click", "[data-post-edit]", function () {
      groupView.editing = String(jQuery(this).attr("data-post-edit"));
      refreshPage();
      const $text = jQuery(`[data-post-edit-form="${groupView.editing}"] textarea`);
      $text.trigger("focus");
      if ($text.length) $text[0].setSelectionRange($text.val().length, $text.val().length);
    });
    $view.on("click", "[data-cancel-post-edit]", () => { groupView.editing = null; refreshPage(); });
    $view.on("submit", "[data-post-edit-form]", function (e) { e.preventDefault(); saveEditedPost(this); });
  }

  // Re-render the open page without losing your place in one of its search boxes
  const SEARCH_BOX_IDS = ["reviewsQuery", "membersQuery", "groupsQuery", "postsQuery"];
  function refreshKeepingFocus() {
    const active = document.activeElement;
    const input = active && SEARCH_BOX_IDS.includes(active.id) ? active : null;
    const caret = input ? [input.selectionStart, input.selectionEnd] : null;
    refreshPage();
    const again = input && document.getElementById(input.id);
    if (again) { again.focus(); again.setSelectionRange(caret[0], caret[1]); }
  }

  async function deleteAccount(button) {
    const password = jQuery("#deleteAccountPassword").val();
    const error = jQuery("#deleteAccountError")[0];
    if (!password) { error.textContent = "Please enter your password."; return; }
    button.disabled = true;
    try {
      await api("/users/me", { method: "DELETE", body: { password } });
      deletingAccount = false;
      editingProfile = false;
      setSession(null);
      onAuthChange();
      location.hash = "";
      toast("Your account was deleted");
    } catch (err) {
      error.textContent = err.message;
      button.disabled = false;
    }
  }

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch (err) { /* cookie may already be gone */ }
    setSession(null);
    onAuthChange();
    toast("You've been logged out");
  }

  async function toggleLike(p) {
    if (!session.user) {
      openAuth("signup", "Join the community to like perfumes and keep them on your profile.");
      return;
    }
    const liked = !isLiked(p.id);
    const setUI = (on) => $$(`[data-action="love"][data-id="${p.id}"]`).forEach((b) => b.setAttribute("aria-pressed", String(on)));
    setUI(liked);
    try {
      const res = await api(`/perfumes/${encodeURIComponent(p.id)}/like`, { method: liked ? "PUT" : "DELETE" });
      p.real = { ...p.real, ...res.stats };
      if (liked) session.likes.add(p.id); else session.likes.delete(p.id);
      $$(`[data-like-count="${p.id}"]`).forEach((el) => { el.textContent = formatCount(p.real.likes); });
      $$(`.pv__actions [data-action="love"][data-id="${p.id}"] span`).forEach((el) => { el.textContent = liked ? "Liked" : "Like"; });
      toast(liked ? "Added to your liked perfumes" : "Removed from your liked perfumes");
    } catch (err) {
      setUI(!liked);
      toast(err.message);
    }
  }

  function setFollowUI(username, on) {
    $$(`[data-follow="${CSS.escape(username)}"]`).forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      b.textContent = on ? "Following" : "Follow";
    });
  }

  async function toggleFollow(username) {
    if (!session.user) {
      openAuth("signup", "Join the community to follow other fragrance lovers and see what they're wearing.");
      return;
    }
    const on = !isFollowing(username);
    setFollowUI(username, on);
    try {
      const res = await api(`/users/${encodeURIComponent(username)}/follow`, { method: on ? "PUT" : "DELETE" });
      if (on) session.following.add(username); else session.following.delete(username);
      $$(`[data-followers-of="${CSS.escape(username)}"]`).forEach((el) => { el.textContent = formatCount(res.followers); });
      if (profileData && profileData.user.username === username) {
        profileData.followers = res.followers;
        profileData.isFollowing = on;
        if (renderCurrent === renderProfilePage) refreshPage();
      }
      toast(on ? `You're now following @${username}` : `You unfollowed @${username}`);
      document.dispatchEvent(new CustomEvent("lumiere:follow", { detail: { username, following: on, followers: res.followers } }));
      // the home feed switches to "people you follow" once you follow someone
      if (on && session.following.size === 1) activityScope = "following";
      if (activityScope === "following") loadActivity();
      return { following: on, followers: res.followers };
    } catch (err) {
      setFollowUI(username, !on);
      toast(err.message);
      return null;
    }
  }

  // Update a review everywhere it's cached after a helpful vote
  function patchReview(id, changes) {
    const lists = [popularReviews, allReviews.items, profileData ? profileData.reviews : [], ...perfumes.map((p) => p.realReviews || [])];
    lists.forEach((list) => list.forEach((r) => { if (String(r.id) === String(id)) Object.assign(r, changes); }));
  }

  async function toggleHelpful(btn) {
    if (!session.user) {
      openAuth("login", "Log in to mark reviews as helpful.");
      return;
    }
    if (btn.disabled) return;
    const id = btn.dataset.helpful;
    const on = btn.getAttribute("aria-pressed") !== "true";
    try {
      const res = await api(`/reviews/${encodeURIComponent(id)}/like`, { method: on ? "PUT" : "DELETE" });
      patchReview(id, { likes: res.likes, likedByMe: on });
      $$(`[data-helpful="${CSS.escape(id)}"]`).forEach((b) => {
        b.setAttribute("aria-pressed", String(on));
        $("span", b).textContent = res.likes;
      });
    } catch (err) {
      toast(err.message);
    }
  }


  function initAccounts() {
    document.addEventListener("click", (e) => {
      const locked = e.target.closest("[data-members-only].is-locked");
      if (locked) {
        e.preventDefault();
        const name = locked.textContent.trim().replace(/\d+$/, "").trim();
        openAuth("signup", `Join the community to use ${name}.`);
        return;
      }
      if (e.target.closest("[data-soon]")) {
        e.preventDefault();
        toast("Messages are coming soon");
        return;
      }
      const authBtn = e.target.closest("[data-auth]");
      if (authBtn) {
        e.preventDefault();
        openAuth(authBtn.dataset.auth, authBtn.dataset.reason || "");
        return;
      }
      if (e.target.closest("[data-close-modal]")) { closeAuth(); return; }
      if (e.target.closest("[data-logout]")) { logout(); return; }

      // Account dropdown: toggle on the button, close on any other click
      const menu = $("#accountMenu");
      if (!menu) return;
      const accountBtn = e.target.closest("#accountBtn");
      if (accountBtn) {
        menu.hidden = !menu.hidden;
        accountBtn.setAttribute("aria-expanded", String(!menu.hidden));
      } else if (!menu.hidden && (!e.target.closest("#accountMenu") || e.target.closest("a, button"))) {
        menu.hidden = true;
        $("#accountBtn").setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("submit", (e) => {
      if (e.target.id === "authForm") { e.preventDefault(); submitAuth(e.target); }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!$("#authModal").hidden) { closeAuth(); e.stopImmediatePropagation(); return; }
      const menu = $("#accountMenu");
      if (menu && !menu.hidden) { menu.hidden = true; $("#accountBtn").focus(); }
    }, true);
  }

  /* =======================================================
     Router: #perfume/<slug> · #profile/<username> · #add-perfume
     ======================================================= */
  let returnScroll = 0;
  let homeSeen = false;      // true once the homepage was shown in this visit
  let pendingSection = null; // e.g. jump straight to the reviews
  let renderCurrent = null;  // re-renders the open page in place
  let routeToken = 0;

  const currentPerfume = () => {
    const m = location.hash.match(/^#perfume\/(.+)$/);
    return m && byId(decodeURIComponent(m[1]));
  };

  function openPerfume(id, section = null) {
    pendingSection = section;
    if (location.hash === `#perfume/${id}`) route();
    else location.hash = `perfume/${id}`;
  }

  function showView(html, title) {
    const view = $("#perfumeView");
    if (view.hidden) returnScroll = window.scrollY;
    view.innerHTML = html;
    view.hidden = false;
    $("main").hidden = true;
    document.documentElement.classList.remove("is-opening-view");
    setTitle(`${title} — LUMIERE`);
    window.scrollTo({ top: 0, behavior: "instant" });
    paintNotesCanvases(view);
  }

  function showHome() {
    homeSeen = true;
    renderCurrent = null;
    document.documentElement.classList.remove("is-opening-view");
    const view = $("#perfumeView");
    if (view.hidden) return;
    view.hidden = true;
    view.innerHTML = "";
    $("main").hidden = false;
    setTitle("LUMIERE — Fragrance discovery & community");
    const target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
    else window.scrollTo({ top: returnScroll, behavior: "instant" });
  }

  function showPerfume(p, token) {
    editingReview = null;
    editingNotes = null;
    confirmingDelete = null;
    renderCurrent = () => renderPerfumePage(p);
    showView(renderCurrent(), `${p.brand ? p.brand + " " : ""}${p.name}`);
    if (pendingSection === "reviews") $("#pvReviews").scrollIntoView({ behavior: "instant" });
    pendingSection = null;
    if (!p.realReviews) loadRealReviews(p).then(() => { if (token === routeToken) refreshPage(); });
    if (!p.perf) loadPerformance(p).then(() => { if (token === routeToken) refreshPage(); });
  }

  async function showProfile(username, token) {
    if (!profileData || profileData.user.username !== username.toLowerCase()) {
      profileTab = "liked";
      editingProfile = false;
      profileList = null;
    }
    renderCurrent = null;
    showView(`<div class="container pv"><p class="pv__empty">Loading profile…</p></div>`, `@${username}`);
    try {
      const data = await api(`/users/${encodeURIComponent(username)}`);
      if (token !== routeToken) return;
      profileData = data;
      renderCurrent = renderProfilePage;
      refreshPage();
      setTitle(`${data.user.displayName} (@${data.user.username}) — LUMIERE`);
    } catch (err) {
      if (token !== routeToken) return;
      $("#perfumeView").innerHTML = `
        <div class="container pv">
          <nav class="pv__crumbs">${BACK_BUTTON}</nav>
          <p class="pv__empty">${err.status === 404 ? `We couldn't find @${escapeHTML(username)}.` : escapeHTML(err.message)}</p>
        </div>`;
    }
  }

  function showGroups() {
    renderCurrent = renderGroupsPage;
    showView(renderGroupsPage(), "Groups");
    loadGroups();
  }

  function showGroup(slug) {
    groupView = { slug, group: null, posts: [], total: 0, hasMore: false, sort: "new", loading: false, replies: {}, q: "", since: "", editing: null, confirmDelete: false };
    renderCurrent = renderGroupPage;
    showView(renderGroupPage(), "Group");
    loadGroup(slug);
  }

  function showCreateGroup() {
    if (!session.user) {
      history.replaceState(null, "", location.pathname + location.search);
      showHome();
      openAuth("signup", "Create a free account to start your own group.");
      return;
    }
    renderCurrent = null;   // keep what the user typed; don't re-render
    showView(renderCreateGroupPage(), "Create a group");
  }

  function showAllReviews(perfume = "") {
    if (allReviews.perfume !== perfume) {   // switching between all reviews and one perfume's: start fresh
      Object.assign(allReviews, { perfume, rating: "", since: "", q: "", items: [], total: 0, hasMore: false });
    }
    const p = perfume && byId(perfume);
    renderCurrent = renderAllReviewsPage;
    showView(renderAllReviewsPage(), p ? `Reviews of ${p.name}` : "All reviews");
    loadAllReviews(true);
  }

  /* ---------- Members  (#members): everyone on LUMIERE, A–Z, with search ---------- */
  const membersDir = { q: "", users: [], total: 0, hasMore: false, loading: false };
  let membersRequest = 0;

  function renderMembersPage() {
    const m = membersDir;
    let body;
    if (m.loading && !m.users.length) body = '<p class="pv__empty">Loading members…</p>';
    else if (!m.users.length) body = `<p class="pv__empty">No members match “${escapeHTML(m.q.trim())}”.</p>`;
    else body = `<ul class="member-list">${m.users.map(memberRow).join("")}</ul>`;
    return `
      <div class="container pv members-page">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          <span>Community / <strong>Members</strong></span>
        </nav>
        <div class="section-head">
          <div>
            <h1 class="section-title section-title--page">Members</h1>
            <p class="section-sub">${m.loading && !m.users.length ? "&nbsp;" : `${m.total.toLocaleString("en-US")} member${m.total === 1 ? "" : "s"}${m.q.trim() ? ` matching “${escapeHTML(m.q.trim())}”` : ""}`}</p>
          </div>
        </div>
        <div class="filter-fields" role="search">
          <label class="filter-field filter-field--wide">
            <span>Search members</span>
            <input id="membersQuery" type="search" value="${escapeHTML(m.q)}" placeholder="Name or @username" autocomplete="off" />
          </label>
        </div>
        <div class="${m.loading && m.users.length ? "is-loading" : ""}">${body}</div>
        ${m.hasMore ? `<div class="all-reviews__more"><button class="btn btn--ghost" data-members-more ${m.loading ? "disabled" : ""}>${m.loading ? "Loading…" : "Load more members"}</button></div>` : ""}
      </div>`;
  }

  function refreshMembersPage() {
    const input = document.activeElement && document.activeElement.id === "membersQuery" ? document.activeElement : null;
    const caret = input ? [input.selectionStart, input.selectionEnd] : null;
    refreshPage();
    const again = input && $("#membersQuery");
    if (again) { again.focus(); again.setSelectionRange(caret[0], caret[1]); }
  }

  async function loadMembers(reset) {
    const m = membersDir;
    const id = ++membersRequest;
    m.loading = true;
    refreshMembersPage();
    try {
      const q = new URLSearchParams({ limit: "30", offset: String(reset ? 0 : m.users.length) });
      if (m.q.trim()) q.set("search", m.q.trim());
      const res = await api(`/members/all?${q}`);
      if (renderCurrent !== renderMembersPage || id !== membersRequest) return;
      m.users = reset ? res.users : [...m.users, ...res.users];
      m.total = res.total;
      m.hasMore = res.hasMore;
    } catch (err) {
      toast(err.message);
    }
    m.loading = false;
    refreshMembersPage();
  }

  function showMembers() {
    renderCurrent = renderMembersPage;
    showView(renderMembersPage(), "Members");
    loadMembers(true);
  }

  function showEditPerfume(slug) {
    const p = byId(slug);
    if (!session.user) {
      history.replaceState(null, "", location.pathname + location.search);
      showHome();
      openAuth("login", "Log in to edit your perfume.");
      return;
    }
    if (!p || !ownsPerfume(p)) {
      toast("Only the member who added this perfume can edit it.");
      location.replace(p ? `#perfume/${encodeURIComponent(slug)}` : "#");
      return;
    }
    addPhoto = null;
    renderCurrent = null;   // keep what the user typed; don't re-render
    showView(renderAddPage(p), `Edit ${p.name}`);
  }

  function showAddPerfume() {
    if (!session.user) {
      history.replaceState(null, "", location.pathname + location.search);
      showHome();
      openAuth("signup", "Create a free account to add perfumes to LUMIERE.");
      return;
    }
    addPhoto = null;
    renderCurrent = null;   // keep what the user typed; don't re-render
    showView(renderAddPage(), "Add a perfume");
  }

  function route() {
    const token = ++routeToken;
    const hash = location.hash;
    let m;
    if ((m = hash.match(/^#perfume\/(.+)$/))) {
      const p = byId(decodeURIComponent(m[1]));
      if (p) return showPerfume(p, token);
      return showView(`<div class="container pv"><nav class="pv__crumbs">${BACK_BUTTON}</nav><p class="pv__empty">This perfume doesn't exist (anymore).</p></div>`, "Not found");
    }
    if ((m = hash.match(/^#profile\/(.+)$/))) return showProfile(decodeURIComponent(m[1]), token);
    if (hash === "#add-perfume") return showAddPerfume();
    if (hash === "#all-reviews") return showAllReviews();
    if ((m = hash.match(/^#all-reviews\/(.+)$/))) return showAllReviews(decodeURIComponent(m[1]));
    if ((m = hash.match(/^#edit-perfume\/(.+)$/))) return showEditPerfume(decodeURIComponent(m[1]));
    if (hash === "#about") { renderCurrent = renderAboutPage; return showView(renderAboutPage(), "About"); }
    if (hash === "#privacy") { renderCurrent = renderPrivacyPage; return showView(renderPrivacyPage(), "Privacy"); }
    if (hash === "#help") { renderCurrent = null; return showView(renderHelpPage(), "Help center"); }   // keep what's typed
    if (hash === "#groups") return showGroups();
    if (hash === "#members") return showMembers();
    if (hash === "#messages") return showMessenger();
    if ((m = hash.match(/^#messages\/(.+)$/))) return showMessenger(decodeURIComponent(m[1]));
    if (hash === "#create-group") return showCreateGroup();
    if ((m = hash.match(/^#edit-group\/(.+)$/))) return showEditGroup(decodeURIComponent(m[1]));
    if ((m = hash.match(/^#group\/(.+)$/))) return showGroup(decodeURIComponent(m[1]));
    showHome();
  }

  // Re-render the open page in place (keeps the scroll position)
  function refreshPage() {
    if (!renderCurrent) return;
    const y = window.scrollY;
    $("#perfumeView").innerHTML = renderCurrent();
    window.scrollTo({ top: y, behavior: "instant" });
    paintNotesCanvases($("#perfumeView"));
  }

  // Keep card ratings in sync after you post or delete a review
  function refreshCardRatings(p) {
    $$(`.perfume-card[data-perfume="${p.id}"] .rating`).forEach((el) => { el.outerHTML = ratingRow(p); });
    renderPerfumeFilters();
    if (state.rating) renderTrendingKeepScroll();
  }

  // Toggle a when-to-wear pick ("wear") or an agree vote on a pro/con ("agree")
  async function toggleOpinion(p, kind, value) {
    if (!session.user) {
      openAuth("login", kind === "wear"
        ? "Log in to say when you'd wear this perfume."
        : "Log in to vote on the pros and cons you agree with.");
      return;
    }
    if (!p.perf) await loadPerformance(p);
    const box = p.perf[kind];
    const on = !box.mine.includes(value);

    // optimistic update, then confirm with the server's totals
    const snapshot = JSON.parse(JSON.stringify(p.perf));
    box.mine = on ? [...box.mine, value] : box.mine.filter((v) => v !== value);
    box.counts[value] = Math.max(0, (box.counts[value] || 0) + (on ? 1 : -1));
    refreshPage();
    try {
      const body = kind === "wear" ? { pick: value, on } : { key: value, on };
      p.perf = await api(`/perfumes/${encodeURIComponent(p.id)}/${kind}`, { method: "PUT", body });
      refreshPage();
    } catch (err) {
      p.perf = snapshot;
      refreshPage();
      toast(err.message);
    }
  }

  // Click a level to vote; click your current level again to remove the vote
  async function votePerformance(p, value) {
    if (!session.user) {
      openAuth("login", "Log in to rate this perfume's longevity, sillage and value.");
      return;
    }
    if (!p.perf) await loadPerformance(p);
    const [key, raw] = value.split(":");
    const level = Number(raw);
    const previous = p.perf.mine[key];
    const next = previous === level ? null : level;

    // optimistic update, then confirm with the server's totals
    const snapshot = JSON.parse(JSON.stringify(p.perf));
    if (previous) p.perf.counts[key][previous - 1] -= 1;
    if (next) p.perf.counts[key][next - 1] += 1;
    p.perf.mine[key] = next;
    refreshPage();
    try {
      p.perf = await api(`/perfumes/${encodeURIComponent(p.id)}/performance`, { method: "PUT", body: { key, level: next } });
      refreshPage();
      toast(next ? "Thanks for voting!" : "Vote removed");
    } catch (err) {
      p.perf = snapshot;
      refreshPage();
      toast(err.message);
    }
  }

  function setStarInput(form, rating) {
    form.dataset.rating = rating;
    $$(".star-input__star", form).forEach((b) => {
      const n = Number(b.dataset.star);
      b.classList.toggle("is-on", n <= rating);
      b.setAttribute("aria-checked", String(n === rating));
    });
    $("#starLabel").textContent = STAR_LABELS[rating - 1];
    $("#composerError").textContent = "";
  }

  async function saveReview(p, form) {
    const rating = Number(form.dataset.rating);
    const text = form.text.value.trim();
    const error = $("#composerError");
    if (!rating) { error.textContent = "Please choose a star rating."; return; }
    if (text.length < 10) { error.textContent = "Please write at least a few words (10+ characters)."; form.text.focus(); return; }

    const wasEditing = editingReview;
    $("button[type=submit]", form).disabled = true;
    try {
      const res = wasEditing
        ? await api(`/reviews/${encodeURIComponent(wasEditing)}`, { method: "PUT", body: { rating, text } })
        : await api(`/perfumes/${encodeURIComponent(p.id)}/reviews`, { method: "POST", body: { rating, text } });
      p.real = { ...p.real, ...res.stats };
      await loadRealReviews(p);
      editingReview = null;
      refreshPage();
      refreshCardRatings(p);
      document.dispatchEvent(new CustomEvent("lumiere:reviews-changed"));
      toast(wasEditing ? "Your review was updated" : "Thanks! Your review was posted");
    } catch (err) {
      error.textContent = err.message;
      $("button[type=submit]", form).disabled = false;
    }
  }

  async function deleteReview(p, id) {
    try {
      const res = await api(`/reviews/${encodeURIComponent(id)}`, { method: "DELETE" });
      p.real = { ...p.real, ...res.stats };
      await loadRealReviews(p);
      editingReview = null;
      document.dispatchEvent(new CustomEvent("lumiere:reviews-changed"));
      refreshPage();
      refreshCardRatings(p);
      toast("Your review was deleted");
    } catch (err) {
      toast(err.message);
    }
  }

  function initPages() {
    const view = $("#perfumeView");

    // Open a perfume (or group) by clicking anywhere on its card (buttons keep their own actions)
    document.addEventListener("click", (e) => {
      const groupCardEl = e.target.closest(".group-card[data-group]");
      if (groupCardEl && !e.target.closest("button, a")) { location.hash = `group/${groupCardEl.dataset.group}`; return; }
      const card = e.target.closest(".perfume-card[data-perfume]");
      if (!card || e.target.closest("button, a")) return;
      openPerfume(card.dataset.perfume);
    });

    view.addEventListener("click", (e) => {
      // edit the notes of a perfume you added
      if (e.target.closest("[data-edit-notes]")) {
        const p = currentPerfume();
        if (!p) return;
        editingNotes = p.id;
        notesDraft = p.notes.join(", ");
        refreshPage();
        const input = $("#notesForm [name=notes]");
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
        return;
      }
      if (e.target.closest("[data-cancel-notes]")) { editingNotes = null; refreshPage(); return; }
      const delBtn = e.target.closest("[data-delete-perfume]");
      if (delBtn) { confirmingDelete = delBtn.dataset.deletePerfume; refreshPage(); return; }
      if (e.target.closest("[data-cancel-delete]")) { confirmingDelete = null; refreshPage(); return; }
      const yesBtn = e.target.closest("[data-confirm-delete]");
      if (yesBtn) { yesBtn.disabled = true; deletePerfume(yesBtn.dataset.confirmDelete); return; }
      if (e.target.closest("[data-back]")) {
        // Came from the site -> real Back; opened a shared link directly -> go home
        if (homeSeen) history.back();
        else location.hash = "";
        return;
      }

      // ----- Profile page -----
      const tab = e.target.closest("[data-profile-tab]");
      if (tab) {
        profileTab = tab.dataset.profileTab;
        refreshPage();
        if (profileTab === "followers" || profileTab === "following") loadProfileList(profileTab);
        return;
      }

      // ----- Groups -----
      const gFilter = e.target.closest("[data-groups-filter]");
      if (gFilter) { groups.filter = gFilter.dataset.groupsFilter; refreshPage(); return; }
      const pSort = e.target.closest("[data-posts-sort]");
      if (pSort) { groupView.sort = pSort.dataset.postsSort; loadGroupPosts(true); return; }
      if (e.target.closest("[data-posts-more]")) { loadGroupPosts(false); return; }
      const repliesBtn = e.target.closest("[data-toggle-replies]");
      if (repliesBtn) { toggleReplies(repliesBtn.dataset.toggleReplies); return; }
      const postLike = e.target.closest("[data-post-like]");
      if (postLike) { togglePostLike(postLike); return; }
      const postDelete = e.target.closest("[data-post-delete]");
      if (postDelete) { deletePost(postDelete.dataset.postDelete, postDelete.dataset.parent || null); return; }

      // (All reviews, Members, profile editing and the contact form: see initPageControls, jQuery)

      // ----- Add a perfume -----
      if (e.target.closest("#photoRemove")) { choosePhoto(null); return; }

      // ----- Perfume page -----
      const p = currentPerfume();
      if (!p) return;

      const agree = e.target.closest("[data-agree]");
      if (agree) { toggleOpinion(p, "agree", agree.dataset.agree); return; }

      const perf = e.target.closest("[data-perf]");
      if (perf) { votePerformance(p, perf.dataset.perf); return; }

      const wear = e.target.closest("[data-wear]");
      if (wear) { toggleOpinion(p, "wear", wear.dataset.wear); return; }

      const star = e.target.closest("[data-star]");
      if (star) { setStarInput(star.closest("form"), Number(star.dataset.star)); return; }

      if (e.target.closest("[data-write-review]")) {
        $("#pvReviews").scrollIntoView({ behavior: "smooth" });
        const textarea = $("#reviewForm textarea");
        if (textarea) textarea.focus({ preventScroll: true });
        return;
      }
      const editBtn = e.target.closest("[data-edit-review]");
      if (editBtn) {
        editingReview = editBtn.dataset.editReview;
        refreshPage();
        $("#pvReviews").scrollIntoView({ behavior: "smooth" });
        $("#reviewForm textarea").focus({ preventScroll: true });
        return;
      }
      if (e.target.closest("[data-cancel-edit]")) { editingReview = null; refreshPage(); return; }
      const deleteBtn = e.target.closest("[data-delete-review]");
      if (deleteBtn) { deleteReview(p, deleteBtn.dataset.deleteReview); }
    });

    view.addEventListener("input", (e) => {
      if (e.target.matches("#reviewForm textarea")) {
        $("#charCount").textContent = `${e.target.value.length} / 1000`;
        $("#composerError").textContent = "";
      }
      if (e.target.matches("#createGroupForm [name=name]")) {
        e.target.removeAttribute("aria-invalid");
        checkGroupNameSoon(e.target.value);
      }
      if (e.target.matches("#postForm textarea, #postForm input")) $("#postError").textContent = "";
      if (e.target.matches("#addForm [name=notes]")) updateNotesPreview(e.target);
      if (e.target.matches("#notesForm [name=notes]")) {
        notesDraft = e.target.value;
        updateNotesPreview(e.target, "notesFormPreview");
        $("#notesError").textContent = "";
      }
      if (e.target.matches("#addForm [name=brand], #addForm [name=name]")) {
        e.target.removeAttribute("aria-invalid");
        checkDuplicateSoon(e.target.form);
      }
    });

    view.addEventListener("change", (e) => {
      if (e.target.id === "photoInput") choosePhoto(e.target.files[0] || null);
    });

    initPageControls();

    view.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      if (form.id === "reviewForm") return saveReview(currentPerfume(), form);
      if (form.id === "addForm") return submitAddForm(form);
      if (form.id === "notesForm") return submitNotes(form);
      if (form.id === "postForm") return submitPost(form);
      if (form.id === "createGroupForm") return submitCreateGroup(form);
      if (form.dataset.replyForm) return submitReply(form);
      if (form.id === "profileForm") {
        try {
          const res = await api("/users/me", { method: "PATCH", body: { displayName: form.displayName.value, bio: form.bio.value } });
          session.user = res.user;
          profileData.user = res.user;
          editingProfile = false;
          applyAuthState();
          refreshPage();
          toast("Profile updated");
        } catch (err) {
          setFieldErrors(form, err.data && err.data.fields);
          toast(err.message);
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !view.hidden && !e.target.closest("input, select, textarea")) {
        location.hash = "";
      }
    });
  }

  /* =======================================================
     Groups: directory (#groups), group page (#group/<slug>),
     create a group (#create-group)
     ======================================================= */
  const GROUP_TONES = {
    woody: ["#f1ebe3", "#7a5a37"], floral: ["#f7e9ec", "#9a4a5c"], fresh: ["#e5f1ef", "#2f6f68"], amber: ["#f6ecdc", "#8a5a1c"],
    citrus: ["#f7f1d9", "#7a6512"], musk: ["#eef0ef", "#4b5f66"], spicy: ["#f6e6df", "#93492c"], gourmand: ["#f1e7e1", "#6e4330"],
  };
  const groups = { list: null, filter: "all", q: "", family: "" };   // q / family: search on the Groups page
  let groupView = null;   // the open group page: { slug, group, posts, total, hasMore, sort, loading, replies: {} }

  const groupTone = (g) => GROUP_TONES[g.family] || AVATAR_TONES[hash(g.slug) % AVATAR_TONES.length];

  function groupIcon(g, size = "") {
    const [bg, fg] = groupTone(g);
    const letters = g.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    return `<span class="group-icon ${size}" style="--g-bg:${bg};--g-fg:${fg}" aria-hidden="true">${escapeHTML(letters)}</span>`;
  }

  function joinButton(g, extra = "") {
    return `<button class="btn btn--sm ${g.isMember ? "btn--ghost" : "btn--primary"} ${extra}" data-join="${escapeHTML(g.slug)}" aria-pressed="${!!g.isMember}">${g.isMember ? "Joined" : "Join"}</button>`;
  }

  function groupCard(g) {
    return `
      <article class="group-card" data-group="${escapeHTML(g.slug)}">
        <div class="group-card__top">
          ${groupIcon(g)}
          ${joinButton(g)}
        </div>
        <h3 class="group-card__name"><a href="#group/${encodeURIComponent(g.slug)}">${escapeHTML(g.name)}</a></h3>
        <p class="group-card__desc">${escapeHTML(g.description)}</p>
        <p class="group-card__meta"><span data-members-of="${escapeHTML(g.slug)}">${formatCount(g.members)}</span> members · ${formatCount(g.postsThisWeek)} posts this week</p>
      </article>`;
  }

  async function loadGroups() {
    try {
      const res = await api("/groups");
      groups.list = res.groups;
    } catch (err) {
      groups.list = groups.list || [];
    }
    renderGroupsTeaser();
    if (renderCurrent === renderGroupsPage) refreshPage();
  }

  function renderGroupsTeaser() {
    const box = $("#groupsTeaser");
    if (!box || !groups.list) return;
    box.innerHTML = groups.list.slice(0, 4).map(groupCard).join("") || '<p class="pv__empty">No groups yet.</p>';
  }

  function renderGroupsPage() {
    const scope = !groups.list ? null : groups.filter === "mine" ? groups.list.filter((g) => g.isMember) : groups.list;
    const q = groups.q.trim().toLowerCase();
    const searching = !!(q || groups.family);
    const list = scope && scope.filter((g) => (!groups.family || g.family === groups.family)
      && (!q || `${g.name} ${g.description}`.toLowerCase().includes(q)));
    let body;
    if (!list) body = '<p class="pv__empty">Loading groups…</p>';
    else if (!list.length && searching) body = '<p class="pv__empty">No groups match your search.</p>';
    else if (!list.length) body = `<p class="pv__empty">You haven't joined any groups yet. Pick a few from “All groups”.</p>`;
    else body = `<div class="group-grid">${list.map(groupCard).join("")}</div>`;
    // scent families the groups actually use
    const usedFamilies = families.filter((f) => groups.family === f.key || (groups.list || []).some((g) => g.family === f.key));
    const search = `
        <div class="filter-fields" role="search" aria-label="Search groups">
          <label class="filter-field filter-field--wide">
            <span>Search groups</span>
            <input id="groupsQuery" type="search" value="${escapeHTML(groups.q)}" placeholder="Name or topic" autocomplete="off" />
          </label>
          <label class="filter-field">
            <span>Scent family</span>
            <select id="groupsFamily">
              <option value="">All families</option>
              ${usedFamilies.map((f) => `<option value="${f.key}"${groups.family === f.key ? " selected" : ""}>${f.name}</option>`).join("")}
            </select>
          </label>
        </div>`;
    return `
      <div class="container pv">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          <span>Community / <strong>Groups</strong></span>
        </nav>
        <div class="section-head">
          <div>
            <h1 class="section-title section-title--page">Discussion groups</h1>
            <p class="section-sub">Join groups about the scents you love and talk with people who get it.</p>
          </div>
          <div class="section-head__actions">
            <a class="btn btn--ghost" href="#members">Browse members</a>
            ${session.user ? '<a class="btn btn--primary" href="#create-group">Create a group</a>' : '<button class="btn btn--primary" data-auth="signup" data-reason="Join the community to join groups and start discussions.">Join to take part</button>'}
          </div>
        </div>
        ${session.user ? `
          <div class="segmented groups-filter" role="tablist" aria-label="Which groups">
            <button role="tab" aria-selected="${groups.filter === "all"}" data-groups-filter="all">All groups</button>
            <button role="tab" aria-selected="${groups.filter === "mine"}" data-groups-filter="mine">My groups <span class="tab-count">${groups.list ? groups.list.filter((g) => g.isMember).length : 0}</span></button>
          </div>` : ""}
        ${search}
        ${body}
      </div>`;
  }

  /* ---------- Group page ---------- */
  function perfumeTag(slug) {
    const p = byId(slug);
    if (!p) return "";
    const r = ratingFor(p);
    return `
      <a class="gpost__perfume" href="#perfume/${p.id}">
        ${perfumeMedia(p, "xs")}
        <span><strong>${escapeHTML(p.name)}</strong><span>${escapeHTML(p.brand)}${r.count ? ` · ★ ${r.avg.toFixed(1)}` : ""}</span></span>
      </a>`;
  }

  function postLikeButton(post) {
    const mine = session.user && post.user && post.user.username === session.user.username;
    return `<button class="social-btn" data-post-like="${post.id}" aria-pressed="${!!post.likedByMe}" ${mine ? "disabled" : ""} aria-label="Like post">${ICON.heart}<span>${post.likes}</span></button>`;
  }

  function replyItem(reply) {
    const mine = session.user && reply.user.username === session.user.username;
    return `
      <li class="greply">
        <a href="#profile/${encodeURIComponent(reply.user.username)}" aria-hidden="true" tabindex="-1">${avatar(authorFromUser(reply.user), "avatar--sm")}</a>
        <div class="greply__body">
          <p class="greply__head">${profileLink(reply.user)} <span>${timeAgo(reply.createdAt)}${reply.edited ? " · edited" : ""}</span></p>
          ${mine && groupView.editing === String(reply.id) ? postEditForm(reply) : `<p class="greply__text">${escapeHTML(reply.text)}</p>`}
          <div class="greply__actions">
            ${postLikeButton(reply)}
            ${mine ? `<button class="social-btn" data-post-edit="${reply.id}">Edit</button><button class="social-btn" data-post-delete="${reply.id}" data-parent="${reply.parent}">Delete</button>` : ""}
          </div>
        </div>
      </li>`;
  }

  // Edit your own post or reply in place
  function postEditForm(p) {
    return `
      <form class="composer gpost-edit" data-post-edit-form="${p.id}"${p.parent ? ` data-parent="${p.parent}"` : ""} novalidate>
        <textarea name="text" rows="3" maxlength="2000" aria-label="Edit your post">${escapeHTML(p.text)}</textarea>
        <div class="composer__foot">
          <span class="composer__error" data-post-edit-error role="alert"></span>
          <button type="button" class="btn btn--ghost btn--sm" data-cancel-post-edit>Cancel</button>
          <button type="submit" class="btn btn--primary btn--sm">Save</button>
        </div>
      </form>`;
  }

  function postItem(post) {
    const g = groupView.group;
    const mine = session.user && post.user.username === session.user.username;
    const replies = groupView.replies[post.id];
    let thread = "";
    if (replies) {
      thread = `
        <div class="gpost__thread">
          ${replies === "loading" ? '<p class="pv__hint">Loading replies…</p>' : `<ul class="greply-list">${replies.map(replyItem).join("")}</ul>`}
          ${g.isMember
            ? `<form class="greply-form" data-reply-form="${post.id}" novalidate>
                 <input name="text" maxlength="2000" placeholder="Write a reply…" aria-label="Write a reply" autocomplete="off" />
                 <button class="btn btn--primary btn--sm" type="submit">Reply</button>
               </form>`
            : `<p class="pv__hint">${session.user ? `<button class="link link--btn" data-join="${escapeHTML(g.slug)}">Join ${escapeHTML(g.name)}</button> to reply.` : '<button class="link link--btn" data-auth="login">Log in</button> and join the group to reply.'}</p>`}
        </div>`;
    }
    return `
      <article class="gpost" data-post="${post.id}">
        <header class="review__head">
          <a href="#profile/${encodeURIComponent(post.user.username)}" aria-hidden="true" tabindex="-1">${avatar(authorFromUser(post.user))}</a>
          <div>
            <p class="review__user">${profileLink(post.user)}</p>
            <p class="review__meta">@${escapeHTML(post.user.username)} · ${timeAgo(post.createdAt)}${post.edited ? " · edited" : ""}</p>
          </div>
        </header>
        ${mine && groupView.editing === String(post.id) ? postEditForm(post) : `<p class="gpost__text">${escapeHTML(post.text)}</p>`}
        ${post.perfume ? perfumeTag(post.perfume) : ""}
        <footer class="review__actions">
          ${postLikeButton(post)}
          <button class="social-btn" data-toggle-replies="${post.id}" aria-expanded="${!!replies}">
            ${ICON.comment}<span>${post.replies}</span> <span class="social-btn__label">${post.replies === 1 ? "reply" : "replies"}</span>
          </button>
          ${mine ? `<button class="social-btn" data-post-edit="${post.id}">Edit</button><button class="social-btn" data-post-delete="${post.id}">Delete</button>` : ""}
        </footer>
        ${thread}
      </article>`;
  }

  function renderGroupPage() {
    const v = groupView;
    if (!v.group) {
      return `<div class="container pv"><nav class="pv__crumbs">${BACK_BUTTON}</nav><p class="pv__empty">${v.error ? escapeHTML(v.error) : "Loading group…"}</p></div>`;
    }
    const g = v.group;
    const created = new Date(g.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const familyName = g.family ? families.find((f) => f.key === g.family).name : "";
    const isCreator = !!(session.user && g.createdBy && g.createdBy.username === session.user.username);
    const creatorActions = !isCreator ? "" : v.confirmDelete
      ? `<span class="owner-confirm">Delete this group and all its posts?</span>
         <button class="btn btn--ghost btn--sm" data-cancel-group-delete>Cancel</button>
         <button class="btn btn--danger btn--sm" data-confirm-group-delete>Yes, delete</button>`
      : `<a class="btn btn--ghost btn--follow-lg" href="#edit-group/${encodeURIComponent(g.slug)}">Edit group</a>
         <button class="btn btn--ghost btn--follow-lg" data-delete-group>Delete group</button>`;
    const searchingPosts = !!(v.q.trim() || v.since);

    let writeArea;
    if (!session.user) writeArea = joinPrompt(`Join the community to take part in ${escapeHTML(g.name)}.`);
    else if (!g.isMember) {
      writeArea = `
        <div class="join-prompt">
          <p>Join ${escapeHTML(g.name)} to start discussions and reply to posts.</p>
          ${joinButton(g)}
        </div>`;
    } else {
      writeArea = `
        <form class="composer" id="postForm" novalidate>
          <p class="composer__title">Start a discussion</p>
          <textarea name="text" rows="3" maxlength="2000" aria-label="Your post" placeholder="Ask a question or share something with ${escapeHTML(g.name)}…"></textarea>
          <div class="composer__foot">
            <input class="composer__perfume" name="perfume" list="perfumeOptions" placeholder="Tag a perfume (optional)" aria-label="Tag a perfume" autocomplete="off" />
            <span class="composer__error" id="postError" role="alert"></span>
            <button type="submit" class="btn btn--primary btn--sm">Post</button>
          </div>
          <datalist id="perfumeOptions">${perfumes.map((p) => `<option value="${escapeHTML(`${p.brand ? p.brand + " " : ""}${p.name}`)}"></option>`).join("")}</datalist>
        </form>`;
    }

    let posts;
    if (v.loading && !v.posts.length) posts = '<p class="pv__empty">Loading discussions…</p>';
    else if (!v.posts.length && searchingPosts) posts = '<p class="pv__empty">No posts match your search.</p>';
    else if (!v.posts.length) posts = '<p class="pv__empty">No discussions yet — start the first one!</p>';
    else posts = `<div class="gpost-list${v.loading ? " is-loading" : ""}">${v.posts.map(postItem).join("")}</div>`;

    return `
      <div class="container pv">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          <span><a class="link" href="#groups">Groups</a> / <strong>${escapeHTML(g.name)}</strong></span>
        </nav>

        <section class="group-head">
          ${groupIcon(g, "group-icon--lg")}
          <div class="group-head__info">
            <h1 class="group-head__name">${escapeHTML(g.name)}</h1>
            <p class="group-head__desc">${escapeHTML(g.description)}</p>
            <p class="group-head__meta">
              <strong data-members-of="${escapeHTML(g.slug)}">${formatCount(g.members)}</strong> members ·
              <strong>${formatCount(g.posts)}</strong> discussions ·
              <strong>${formatCount(g.postsThisWeek)}</strong> posts this week
            </p>
          </div>
          <div class="group-head__actions">${joinButton(g, "btn--follow-lg")}${creatorActions}</div>
        </section>

        <div class="pv__grid">
          <div class="pv__main">
            <section class="panel">
              ${writeArea}
              <div class="panel__head">
                <h2 class="panel__title">Discussions</h2>
                <div class="segmented" role="tablist" aria-label="Sort posts">
                  <button role="tab" aria-selected="${v.sort === "new"}" data-posts-sort="new">Newest</button>
                  <button role="tab" aria-selected="${v.sort === "top"}" data-posts-sort="top">Top</button>
                </div>
              </div>
              <div class="filter-fields" role="search" aria-label="Search posts">
                <label class="filter-field filter-field--wide">
                  <span>Search posts</span>
                  <input id="postsQuery" type="search" value="${escapeHTML(v.q)}" placeholder="Words or @member" autocomplete="off" />
                </label>
                <label class="filter-field">
                  <span>Date</span>
                  <select id="postsSince">
                    ${[["", "Any time"], ["week", "Past week"], ["month", "Past month"], ["year", "Past year"]]
                      .map(([val, label]) => `<option value="${val}"${v.since === val ? " selected" : ""}>${label}</option>`).join("")}
                  </select>
                </label>
              </div>
              ${posts}
              ${v.hasMore ? `<div class="all-reviews__more"><button class="btn btn--ghost" data-posts-more ${v.loading ? "disabled" : ""}>${v.loading ? "Loading…" : "Load more"}</button></div>` : ""}
            </section>
          </div>

          <aside class="pv__side">
            <section class="panel">
              <h2 class="panel__title">About</h2>
              <p class="group-about">${escapeHTML(g.description)}</p>
              <ul class="group-facts">
                ${familyName ? `<li><span>Scent family</span><strong>${familyName}</strong></li>` : ""}
                <li><span>Created</span><strong>${created}${g.createdBy ? ` by ${profileLink(g.createdBy, "@" + g.createdBy.username)}` : ""}</strong></li>
                <li><span>Posts & replies</span><strong>${formatCount(g.messages)}</strong></li>
              </ul>
            </section>

            ${g.topPerfumes && g.topPerfumes.length ? `
            <section class="panel">
              <h2 class="panel__title">Most discussed perfumes</h2>
              <ul class="group-perfumes">
                ${g.topPerfumes.filter((t) => byId(t.slug)).map((t) => {
                  const p = byId(t.slug);
                  return `<li><a href="#perfume/${p.id}">${perfumeMedia(p, "xs")}<span><strong>${escapeHTML(p.name)}</strong><span>${escapeHTML(p.brand)}</span></span></a><span class="group-perfumes__n">${t.mentions}</span></li>`;
                }).join("")}
              </ul>
            </section>` : ""}

            <section class="panel">
              <h2 class="panel__title">New members</h2>
              <ul class="reviewers">
                ${(g.recentMembers || []).map((u) => `
                  <li class="reviewer">
                    <a href="#profile/${encodeURIComponent(u.username)}" aria-hidden="true" tabindex="-1">${avatar(authorFromUser(u), "avatar--sm")}</a>
                    <div><p class="reviewer__name">${profileLink(u)}</p><p class="reviewer__meta">@${escapeHTML(u.username)}</p></div>
                  </li>`).join("") || '<li class="activity__empty">No members yet.</li>'}
              </ul>
            </section>
          </aside>
        </div>
      </div>`;
  }

  async function loadGroupPosts(reset) {
    const v = groupView;
    const slug = v.slug;
    v.loading = true;
    refreshKeepingFocus();
    try {
      const q = new URLSearchParams({ sort: v.sort, limit: "10", offset: String(reset ? 0 : v.posts.length) });
      if (v.q.trim()) q.set("q", v.q.trim());
      if (v.since) q.set("since", v.since);
      const res = await api(`/groups/${encodeURIComponent(slug)}/posts?${q}`);
      if (groupView !== v || renderCurrent !== renderGroupPage) return;
      v.posts = reset ? res.posts : [...v.posts, ...res.posts];
      v.total = res.total;
      v.hasMore = res.hasMore;
    } catch (err) {
      toast(err.message);
    }
    v.loading = false;
    refreshKeepingFocus();
  }

  async function loadGroup(slug) {
    const v = groupView;
    try {
      const res = await api(`/groups/${encodeURIComponent(slug)}`);
      if (groupView !== v) return;
      v.group = res.group;
      setTitle(`${res.group.name} — LUMIERE`);
      refreshPage();
      loadGroupPosts(true);
    } catch (err) {
      v.error = err.status === 404 ? "This group doesn't exist (anymore)." : err.message;
      refreshPage();
    }
  }

  async function toggleReplies(postId) {
    const v = groupView;
    if (v.replies[postId]) {
      delete v.replies[postId];
      refreshPage();
      return;
    }
    v.replies[postId] = "loading";
    refreshPage();
    try {
      const res = await api(`/groups/${encodeURIComponent(v.slug)}/posts/${postId}/replies`);
      if (groupView === v && v.replies[postId]) { v.replies[postId] = res.replies; refreshPage(); }
    } catch (err) {
      delete v.replies[postId];
      refreshPage();
      toast(err.message);
    }
  }

  // Update the open group, the directory and the homepage teaser after joining/leaving
  function applyMembership(slug, isMember, members) {
    (groups.list || []).forEach((g) => { if (g.slug === slug) Object.assign(g, { isMember, members }); });
    if (groupView && groupView.group && groupView.group.slug === slug) Object.assign(groupView.group, { isMember, members });
    if (profileData && session.user && profileData.user.username === session.user.username) {
      const g = (groups.list || []).find((x) => x.slug === slug);
      profileData.groups = isMember
        ? [{ slug, name: g ? g.name : slug, family: g ? g.family : null }, ...profileData.groups.filter((x) => x.slug !== slug)]
        : profileData.groups.filter((x) => x.slug !== slug);
    }
    renderGroupsTeaser();
    refreshPage();
  }

  async function toggleMembership(slug) {
    if (!session.user) {
      openAuth("signup", "Join the community to join groups and take part in discussions.");
      return;
    }
    const g = (groups.list || []).find((x) => x.slug === slug) || (groupView && groupView.group);
    const join = !(g && g.isMember);
    try {
      const res = await api(`/groups/${encodeURIComponent(slug)}/membership`, { method: join ? "PUT" : "DELETE" });
      applyMembership(slug, res.isMember, res.members);
      toast(join ? `Welcome to ${g ? g.name : "the group"}!` : `You left ${g ? g.name : "the group"}`);
    } catch (err) {
      toast(err.message);
    }
  }

  function perfumeFromLabel(label) {
    const q = label.trim().toLowerCase();
    if (!q) return null;
    return perfumes.find((p) => `${p.brand ? p.brand + " " : ""}${p.name}`.toLowerCase() === q)
      || perfumes.find((p) => p.name.toLowerCase() === q) || undefined;
  }

  async function submitPost(form) {
    const v = groupView;
    const text = form.text.value.trim();
    const error = $("#postError");
    const tagged = perfumeFromLabel(form.perfume.value);
    if (text.length < 2) { error.textContent = "Please write something first."; form.text.focus(); return; }
    if (tagged === undefined) { error.textContent = "Pick a perfume from the list, or leave it empty."; form.perfume.focus(); return; }
    $("button[type=submit]", form).disabled = true;
    try {
      const res = await api(`/groups/${encodeURIComponent(v.slug)}/posts`, { method: "POST", body: { text, perfume: tagged ? tagged.id : null } });
      v.sort = "new";
      v.posts = [res.post, ...v.posts.filter((p) => p.id !== res.post.id)];
      v.total += 1;
      v.group.posts += 1;
      v.group.postsThisWeek += 1;
      refreshPage();
      toast("Posted!");
    } catch (err) {
      error.textContent = err.message;
      $("button[type=submit]", form).disabled = false;
    }
  }

  async function submitReply(form) {
    const v = groupView;
    const postId = form.dataset.replyForm;
    const text = form.text.value.trim();
    if (text.length < 2) { form.text.focus(); return; }
    $("button", form).disabled = true;
    try {
      const res = await api(`/groups/${encodeURIComponent(v.slug)}/posts`, { method: "POST", body: { text, parent: postId } });
      const list = Array.isArray(v.replies[postId]) ? v.replies[postId] : [];
      v.replies[postId] = [...list, res.post];
      const post = v.posts.find((p) => String(p.id) === postId);
      if (post) post.replies += 1;
      refreshPage();
      const input = $(`[data-reply-form="${postId}"] input`);
      if (input) input.focus();
    } catch (err) {
      toast(err.message);
      $("button", form).disabled = false;
    }
  }

  async function deletePost(id, parent) {
    const v = groupView;
    try {
      await api(`/group-posts/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (parent) {
        v.replies[parent] = (v.replies[parent] || []).filter((r) => String(r.id) !== id);
        const post = v.posts.find((p) => String(p.id) === parent);
        if (post) post.replies -= 1;
      } else {
        v.posts = v.posts.filter((p) => String(p.id) !== id);
        v.total -= 1;
        v.group.posts -= 1;
      }
      refreshPage();
      toast(parent ? "Reply deleted" : "Post deleted");
    } catch (err) {
      toast(err.message);
    }
  }

  async function togglePostLike(btn) {
    if (!session.user) { openAuth("login", "Log in to like posts."); return; }
    if (btn.disabled) return;
    const id = btn.dataset.postLike;
    const on = btn.getAttribute("aria-pressed") !== "true";
    try {
      const res = await api(`/group-posts/${encodeURIComponent(id)}/like`, { method: on ? "PUT" : "DELETE" });
      const all = [...groupView.posts, ...Object.values(groupView.replies).filter(Array.isArray).flat()];
      all.forEach((p) => { if (String(p.id) === id) Object.assign(p, { likes: res.likes, likedByMe: on }); });
      $$(`[data-post-like="${CSS.escape(id)}"]`).forEach((b) => {
        b.setAttribute("aria-pressed", String(on));
        $("span", b).textContent = res.likes;
      });
    } catch (err) {
      toast(err.message);
    }
  }

  /* ---------- Create a group ---------- */
  // "Create a group", or (with `edit`) "Edit group" for a group you created
  function renderCreateGroupPage(edit = null) {
    return `
      <div class="container pv">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          <span><a class="link" href="#groups">Groups</a> / ${edit ? `${escapeHTML(edit.name)} / <strong>Edit</strong>` : "<strong>Create a group</strong>"}</span>
        </nav>
        <div class="add">
          <section class="panel add__form-panel">
            <h1 class="add__title">${edit ? "Edit group" : "Create a group"}</h1>
            <p class="section-sub">${edit ? `Update the name, description or scent family of ${escapeHTML(edit.name)}.` : "Start a space for a style, a house or a question you care about. You'll join it automatically."}</p>
            <form id="createGroupForm" class="add__form" novalidate${edit ? ` data-editing="${escapeHTML(edit.slug)}"` : ""}>
              <label class="field">
                <span class="field__label">Group name</span>
                <input name="name" maxlength="60" placeholder="e.g. Vetiver Fans" autocomplete="off" required${edit ? ` value="${escapeHTML(edit.name)}"` : ""} />
                <span class="field__error" data-error-for="name"></span>
              </label>
              <div class="notice" id="groupDupNotice" role="status" hidden></div>
              <label class="field">
                <span class="field__label">What is it about?</span>
                <textarea name="description" rows="3" maxlength="240" placeholder="Tell people what the group discusses" required>${edit ? escapeHTML(edit.description) : ""}</textarea>
                <span class="field__error" data-error-for="description"></span>
              </label>
              <fieldset class="field">
                <legend class="field__label">Scent family <span class="field__optional">(optional)</span></legend>
                <div class="check-chips">
                  <label class="check-chip"><input type="radio" name="family" value=""${!edit || !edit.family ? " checked" : ""} /><span>None</span></label>
                  ${families.map((f) => `<label class="check-chip"><input type="radio" name="family" value="${f.key}"${edit && edit.family === f.key ? " checked" : ""} /><span>${f.name}</span></label>`).join("")}
                </div>
              </fieldset>
              <div class="add__foot">
                <span class="composer__error" id="createGroupError" role="alert"></span>
                <button type="submit" class="btn btn--primary" id="createGroupSubmit">${edit ? "Save changes" : "Create group"}</button>
              </div>
            </form>
          </section>
          <aside class="panel add__tips">
            <h2 class="panel__title">Tips</h2>
            <ul>
              <li>Check the <a class="link" href="#groups">existing groups</a> first — we'll warn you if the name is taken.</li>
              <li>Keep the name short and clear.</li>
              <li>Kick things off with a first post once it's created.</li>
            </ul>
          </aside>
        </div>
      </div>`;
  }

  function showGroupDuplicate(existing) {
    const box = $("#groupDupNotice");
    if (!box) return;
    box.hidden = !existing;
    $("#createGroupSubmit").disabled = !!existing;
    box.innerHTML = existing ? `
      <div><strong>“${escapeHTML(existing.name)}” already exists.</strong><p>Join it instead, or pick a different name.</p></div>
      <a class="btn btn--primary btn--sm" href="#group/${encodeURIComponent(existing.slug)}">View group →</a>` : "";
  }

  let groupDupTimer = 0;
  function checkGroupNameSoon(name) {
    clearTimeout(groupDupTimer);
    groupDupTimer = setTimeout(async () => {
      if (name.trim().length < 3) return showGroupDuplicate(null);
      const form = $("#createGroupForm");
      const except = form && form.dataset.editing ? `&except=${encodeURIComponent(form.dataset.editing)}` : "";
      try {
        const res = await api(`/groups/check?name=${encodeURIComponent(name)}${except}`);
        showGroupDuplicate(res.exists ? res.group : null);
      } catch (err) { /* checked again on submit */ }
    }, 300);
  }

  async function submitCreateGroup(form) {
    const body = { name: form.name.value.trim(), description: form.description.value.trim(), family: form.family.value };
    const fields = {};
    if (body.name.length < 3) fields.name = "Please give the group a name (3+ characters).";
    if (body.description.length < 10) fields.description = "Tell people what the group is about (10+ characters).";
    setFieldErrors(form, fields);
    if (Object.keys(fields).length) return;
    if (form.dataset.editing) return saveEditedGroup(form, body);
    $("#createGroupSubmit").disabled = true;
    try {
      const res = await api("/groups", { method: "POST", body });
      groups.list = [res.group, ...(groups.list || [])];
      renderGroupsTeaser();
      location.hash = `group/${res.group.slug}`;
      toast(`${res.group.name} was created — say hi to your first members!`);
    } catch (err) {
      if (err.status === 409 && err.data.existing) showGroupDuplicate(err.data.existing);
      else {
        setFieldErrors(form, err.data && err.data.fields);
        $("#createGroupError").textContent = err.message;
        $("#createGroupSubmit").disabled = false;
      }
    }
  }

  async function saveEditedGroup(form, body) {
    const slug = form.dataset.editing;
    const submit = jQuery("#createGroupSubmit").prop("disabled", true).text("Saving…");
    try {
      const res = await api(`/groups/${encodeURIComponent(slug)}`, { method: "PATCH", body });
      groups.list = (groups.list || []).map((g) => (g.slug === slug ? res.group : g));
      if (groupView && groupView.slug === slug && groupView.group) Object.assign(groupView.group, res.group);
      renderGroupsTeaser();
      location.hash = `group/${encodeURIComponent(slug)}`;
      toast(`${res.group.name} was updated`);
    } catch (err) {
      if (err.status === 409 && err.data.existing) showGroupDuplicate(err.data.existing);
      else {
        setFieldErrors(form, err.data && err.data.fields);
        jQuery("#createGroupError").text(err.message);
      }
      submit.prop("disabled", !!(err.status === 409)).text("Save changes");
    }
  }

  async function showEditGroup(slug) {
    if (!session.user) {
      history.replaceState(null, "", location.pathname + location.search);
      showHome();
      openAuth("login", "Log in to edit your group.");
      return;
    }
    if (!groups.list) await loadGroups();
    const g = (groups.list || []).find((x) => x.slug === slug);
    if (!g || !g.createdBy || g.createdBy.username !== session.user.username) {
      toast("Only the member who created this group can edit it.");
      location.replace(g ? `#group/${encodeURIComponent(slug)}` : "#groups");
      return;
    }
    renderCurrent = null;   // keep what the user typed; don't re-render
    showView(renderCreateGroupPage(g), `Edit ${g.name}`);
  }

  async function deleteGroup(button) {
    const v = groupView;
    const slug = v.slug;
    button.disabled = true;
    try {
      await api(`/groups/${encodeURIComponent(slug)}`, { method: "DELETE" });
      const name = v.group.name;
      groups.list = (groups.list || []).filter((g) => g.slug !== slug);
      if (profileData) profileData.groups = (profileData.groups || []).filter((g) => g.slug !== slug);
      renderGroupsTeaser();
      location.hash = "groups";
      toast(`${name} was deleted`);
    } catch (err) {
      button.disabled = false;
      toast(err.message);
    }
  }

  async function saveEditedPost(form) {
    const v = groupView;
    const id = form.dataset.postEditForm;
    const text = String(jQuery(form).find("textarea").val() || "").trim();
    const $error = jQuery(form).find("[data-post-edit-error]");
    if (text.length < 2) { $error.text("Please write something first."); return; }
    const $save = jQuery(form).find("button[type=submit]").prop("disabled", true);
    try {
      const res = await api(`/group-posts/${encodeURIComponent(id)}`, { method: "PATCH", body: { text } });
      const replace = (list) => list.map((p) => (String(p.id) === id ? { ...p, ...res.post } : p));
      v.posts = replace(v.posts);
      Object.keys(v.replies).forEach((k) => { if (Array.isArray(v.replies[k])) v.replies[k] = replace(v.replies[k]); });
      v.editing = null;
      refreshPage();
      toast(res.post.parent ? "Reply updated" : "Post updated");
    } catch (err) {
      $error.text(err.message);
      $save.prop("disabled", false);
    }
  }

  /* ---------- Group posts chart (D3, see group-chart.js) ---------- */
  async function initGroupChart() {
    const box = $("#groupChart");
    if (!box) return;
    if (!window.LumiereGroupChart || !window.d3) { box.innerHTML = '<p class="pv__empty">The chart couldn\'t load.</p>'; return; }
    try {
      window.LumiereGroupChart.mount(box, await api("/stats/group-posts"));
    } catch (err) {
      box.innerHTML = `<p class="pv__empty">${escapeHTML(err.message)}</p>`;
    }
  }

  /* =======================================================
     Messenger  (#messages · #messages/<username>)
     History comes from the API; new messages, typing, read
     receipts and online status arrive live over Socket.io.
     ======================================================= */
  const messenger = {
    conversations: null,   // list (newest first)
    active: null,          // open conversation
    opening: false,        // a chat is being opened that isn't known yet
    threads: new Map(),    // conversation id -> { messages (oldest first), hasMore, loaded }, so chats reopen instantly
    thread: { messages: [], hasMore: false, loaded: false },   // the open conversation's entry in `threads`
    get messages() { return this.thread.messages; },
    set messages(list) { this.thread.messages = list; },
    get hasMore() { return this.thread.hasMore; },
    set hasMore(value) { this.thread.hasMore = value; },
    loading: false,
    online: new Set(),     // usernames online right now
    typingUntil: 0,
    unread: 0,
  };
  let socket = null;
  let typingTimer = 0;
  let lastTypingSent = 0;
  let chatToken = 0;

  function threadFor(conversationId) {
    const key = String(conversationId);
    if (!messenger.threads.has(key)) messenger.threads.set(key, { messages: [], hasMore: false, loaded: false });
    return messenger.threads.get(key);
  }

  // add a live message to a thread (or replace my optimistic copy of it)
  function addToThread(thread, message, clientId) {
    const i = thread.messages.findIndex((m) => String(m.id) === String(message.id) || (clientId && m.clientId === clientId));
    if (i >= 0) thread.messages[i] = message;
    else thread.messages.push(message);
  }

  const isMessengerOpen = () => renderCurrent === renderMessengerPage;
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  function dayLabel(iso) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

  function setUnread(count) {
    messenger.unread = Math.max(0, count);
    $$("[data-messages-link] .badge, [data-unread-badge]").forEach((b) => {
      b.textContent = messenger.unread > 99 ? "99+" : String(messenger.unread);
      b.hidden = !messenger.unread;
    });
    setTitle(document.title.replace(/^\(\d+\+?\) /, ""));
  }

  // Page titles keep the unread count in front, e.g. "(2) Groups — LUMIERE"
  function setTitle(text) {
    document.title = messenger.unread ? `(${messenger.unread}) ${text}` : text;
  }

  /* ---------- Live connection ---------- */
  function connectSocket() {
    disconnectSocket();
    if (!session.user || !window.io) return;
    socket = window.io({ withCredentials: true });

    let connectedBefore = false;
    socket.on("connect", () => {
      queryPresence();
      updateConnectionNote();
      // back after a dropped connection: catch up on what was sent meanwhile (badge, list, open chat)
      if (connectedBefore) {
        loadConversations();
        if (isMessengerOpen() && messenger.active) {
          loadMessages(false).then(() => { if (document.visibilityState === "visible") markActiveRead(); });
        }
      }
      connectedBefore = true;
    });
    socket.on("disconnect", updateConnectionNote);
    socket.on("connect_error", updateConnectionNote);

    socket.on("message:new", ({ message, conversation, totalUnread, clientId }) => {
      upsertConversation(conversation);
      const mine = message.sender === session.user.username;
      const viewing = isMessengerOpen() && messenger.active && String(messenger.active.id) === String(conversation.id);

      if (viewing) {
        addToThread(messenger.thread, message, clientId);
        if (!mine) messenger.typingUntil = 0;
        renderThreadBody(true);
        renderThreadHeader();
        if (!mine && document.visibilityState === "visible") markActiveRead();
      } else {
        // keep a chat that was opened before up to date, so it reopens instantly
        const thread = messenger.threads.get(String(conversation.id));
        if (thread) addToThread(thread, message, clientId);
        if (!mine) {
          showChatPopup(conversation, message);
          prefetchThread(conversation.id);   // the popup opens this chat: have its messages ready
        }
      }
      if (typeof totalUnread === "number") setUnread(totalUnread);
      renderConversationList();
    });

    socket.on("typing", ({ conversationId }) => {
      if (!messenger.active || String(messenger.active.id) !== String(conversationId)) return;
      messenger.typingUntil = Date.now() + 3500;
      renderThreadHeader();
      clearTimeout(typingTimer);
      typingTimer = setTimeout(renderThreadHeader, 3600);
    });

    socket.on("conversation:read", ({ conversationId, at }) => {
      if (!messenger.active || String(messenger.active.id) !== String(conversationId)) return;
      messenger.messages.forEach((m) => { if (m.sender === session.user.username && !m.readAt) m.readAt = at; });
      renderThreadBody(false);
    });

    socket.on("unread:changed", ({ count }) => setUnread(count));
    socket.on("reviews:changed", () => document.dispatchEvent(new CustomEvent("lumiere:reviews-changed")));

    socket.on("perfume:changed", ({ perfume }) => updatePerfume(perfume));
    socket.on("perfume:added", ({ perfume }) => {
      if (byId(perfume.slug)) return;   // e.g. the one I just added myself
      perfumes.push(buildPerfume(perfume));
      renderFilterBar();
      renderTrendingKeepScroll();
    });
    socket.on("perfume:deleted", ({ slug }) => removePerfume(slug));

    socket.on("perfume:notes", ({ slug, notes, notesAddedBy }) => {
      const p = byId(slug);
      if (!p || JSON.stringify(p.notes) === JSON.stringify(notes)) return;
      const typing = $("#notesForm") && $("#notesForm [name=notes]").value.trim();
      applyNotes(p, notes, notesAddedBy);
      if (typing) toast(`The notes of ${p.name} were just updated`);
    });

    socket.on("presence", ({ username, online }) => {
      if (online) messenger.online.add(username); else messenger.online.delete(username);
      renderConversationList();
      renderThreadHeader();
    });
  }

  function disconnectSocket() {
    if (socket) socket.disconnect();
    socket = null;
  }

  function queryPresence() {
    if (!socket || !socket.connected) return;
    const names = (messenger.conversations || []).map((c) => c.other.username);
    if (messenger.active) names.push(messenger.active.other.username);
    if (!names.length) return;
    socket.emit("presence:query", [...new Set(names)], (online) => {
      online.forEach((u) => messenger.online.add(u));
      renderConversationList();
      renderThreadHeader();
    });
  }

  function upsertConversation(conv) {
    if (!messenger.conversations) return;
    messenger.conversations = [conv, ...messenger.conversations.filter((c) => String(c.id) !== String(conv.id))];
    if (messenger.active && String(messenger.active.id) === String(conv.id)) {
      messenger.active = { ...messenger.active, ...conv, unread: 0 };
      messenger.conversations[0].unread = 0;
    }
  }

  async function loadConversations() {
    try {
      const res = await api("/conversations");
      messenger.conversations = res.conversations;
      res.conversations.forEach((c) => { if (c.online) messenger.online.add(c.other.username); });
      setUnread(res.unread);
    } catch (err) {
      messenger.conversations = messenger.conversations || [];
    }
    renderConversationList();
    queryPresence();
  }

  function markActiveRead() {
    if (!messenger.active || !socket) return;
    socket.emit("conversation:read", { conversationId: messenger.active.id });
    // update the badge right away (the server confirms with "unread:changed")
    const c = (messenger.conversations || []).find((x) => String(x.id) === String(messenger.active.id));
    const wasUnread = (c ? c.unread : messenger.active.unread) || 0;
    if (wasUnread) setUnread(messenger.unread - wasUnread);
    if (c) c.unread = 0;
    messenger.active.unread = 0;
    renderConversationList();
  }

  /* ---------- Rendering ---------- */
  function conversationItem(c) {
    const active = messenger.active && String(messenger.active.id) === String(c.id);
    const online = messenger.online.has(c.other.username);
    const last = c.lastMessage;
    return `
      <li>
        <a class="conv${active ? " is-active" : ""}${c.unread ? " is-unread" : ""}" href="#messages/${encodeURIComponent(c.other.username)}">
          <span class="conv__avatar">${avatar(authorFromUser(c.other))}${online ? '<span class="online-dot" aria-label="Online"></span>' : ""}</span>
          <span class="conv__body">
            <span class="conv__top"><strong>${escapeHTML(c.other.displayName)}</strong><span>${last ? timeAgo(last.at) : ""}</span></span>
            <span class="conv__last">${last ? `${last.mine ? "You: " : ""}${escapeHTML(last.text)}` : "No messages yet"}</span>
          </span>
          ${c.unread ? `<span class="badge conv__badge">${c.unread}</span>` : ""}
        </a>
      </li>`;
  }

  function renderConversationList() {
    const box = $("#convList");
    if (!box) return;
    const list = messenger.conversations;
    if (!list) { box.innerHTML = '<li class="conv-empty">Loading…</li>'; return; }
    box.innerHTML = list.length
      ? list.map(conversationItem).join("")
      : '<li class="conv-empty">No conversations yet. Search for a member above, or tap <strong>Message</strong> on someone\'s profile.</li>';
  }

  function threadStatus() {
    const a = messenger.active;
    if (!a) return "";
    if (messenger.typingUntil > Date.now()) return '<span class="thread__typing">typing<span class="dots"><span>.</span><span>.</span><span>.</span></span></span>';
    return messenger.online.has(a.other.username) ? '<span class="thread__online">Online</span>' : "Offline";
  }

  function renderThreadHeader() {
    const el = $("#threadStatus");
    if (el) el.innerHTML = threadStatus();
    const dot = $("#threadAvatarDot");
    if (dot && messenger.active) dot.hidden = !messenger.online.has(messenger.active.other.username);
  }

  function renderThreadBody(scrollToEnd) {
    const box = $("#threadMessages");
    if (!box || !messenger.active) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const me = session.user.username;
    const msgs = messenger.messages;
    let lastDay = "";
    const lastMine = [...msgs].reverse().find((m) => m.sender === me);

    let html = messenger.hasMore
      ? `<div class="thread__older"><button class="link link--btn" data-older ${messenger.loading ? "disabled" : ""}>${messenger.loading ? "Loading…" : "Load earlier messages"}</button></div>`
      : "";
    // only once the messages have loaded (never while they're on their way)
    if (!msgs.length && messenger.thread.loaded && !messenger.loading) {
      html += `<p class="thread__start">This is the start of your conversation with <strong>${escapeHTML(messenger.active.other.displayName)}</strong>. Say hi 👋</p>`;
    }
    msgs.forEach((m, i) => {
      const day = dayLabel(m.createdAt);
      if (day !== lastDay) { html += `<p class="thread__day"><span>${day}</span></p>`; lastDay = day; }
      const mine = m.sender === me;
      const next = msgs[i + 1];
      const grouped = next && next.sender === m.sender && new Date(next.createdAt) - new Date(m.createdAt) < 5 * 60 * 1000;
      html += `
        <div class="bubble-row${mine ? " bubble-row--mine" : ""}${grouped ? " is-grouped" : ""}">
          <div class="bubble${m.pending ? " is-pending" : ""}${m.failed ? " is-failed" : ""}">
            <p>${escapeHTML(m.text)}</p>
            <span class="bubble__time">${fmtTime(m.createdAt)}</span>
          </div>
        </div>`;
      if (m === lastMine) {
        const status = m.failed ? '<span class="is-failed">Not sent</span>' : m.pending ? "Sending…" : m.readAt ? "Seen" : "Sent";
        html += `<p class="bubble-status">${status}</p>`;
      }
    });
    box.innerHTML = html;
    if (scrollToEnd || atBottom) box.scrollTop = box.scrollHeight;
  }

  function renderMessengerPage() {
    const a = messenger.active;
    const thread = a ? `
      <header class="thread__head">
        <a class="thread__back" href="#messages" aria-label="Back to conversations">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
        </a>
        <a class="thread__who" href="#profile/${encodeURIComponent(a.other.username)}">
          <span class="conv__avatar">${avatar(authorFromUser(a.other))}<span class="online-dot" id="threadAvatarDot" ${messenger.online.has(a.other.username) ? "" : "hidden"}></span></span>
          <span><strong>${escapeHTML(a.other.displayName)}</strong><span class="thread__status" id="threadStatus">${threadStatus()}</span></span>
        </a>
      </header>
      <div class="thread__messages" id="threadMessages" aria-live="polite"></div>
      <p class="thread__note" id="connectionNote" hidden></p>
      <form class="thread__composer" id="chatForm" autocomplete="off">
        <textarea name="text" rows="1" maxlength="2000" placeholder="Write a message…" aria-label="Write a message"></textarea>
        <button class="btn btn--primary" type="submit" aria-label="Send">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z"/></svg>
        </button>
      </form>`
      : messenger.opening ? ""   // stays blank for the moment it takes to open the chat
      : `
      <div class="thread__empty">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>
        <p><strong>Your messages</strong></p>
        <p>Pick a conversation, or search for a member to start chatting.</p>
      </div>`;

    return `
      <div class="container pv messenger-page">
        <div class="messenger${a || messenger.opening ? " messenger--thread" : ""}">
          <aside class="messenger__list">
            <div class="messenger__head"><h1>Messages</h1></div>
            <form class="messenger__search" data-member-search>
              <input type="search" placeholder="Search members to message…" aria-label="Search members" autocomplete="off" />
              <div class="search-suggest" hidden></div>
            </form>
            <ul class="conv-list" id="convList"></ul>
          </aside>
          <section class="messenger__thread">${thread}</section>
        </div>
      </div>`;
  }

  function mountMessenger() {
    $("#perfumeView").innerHTML = renderMessengerPage();
    fillMessenger();
  }

  function fillMessenger() {
    renderConversationList();
    if (messenger.active) {
      renderThreadBody(true);
      updateConnectionNote();
    }
  }

  function updateConnectionNote() {
    const note = $("#connectionNote");
    if (!note) return;
    const ok = socket && socket.connected;
    note.hidden = ok;
    note.textContent = ok ? "" : "Reconnecting to live chat…";
  }

  /* ---------- Opening a chat ---------- */
  // Before the page is drawn: a chat we already know (from the list, a popup or an earlier visit)
  // opens straight away with the messages we have; an unknown one opens blank until the server answers.
  function prepareChat(username) {
    const name = username.toLowerCase();
    const known = (messenger.conversations || []).find((c) => c.other.username === name)
      || (messenger.active && messenger.active.other.username === name ? messenger.active : null);
    messenger.typingUntil = 0;
    if (known) setActiveChat(known);
    else { messenger.active = null; messenger.opening = true; }
  }

  function setActiveChat(conversation) {
    messenger.active = { ...conversation };
    messenger.thread = threadFor(conversation.id);
    messenger.opening = false;
  }

  async function openChat(username) {
    const token = ++chatToken;
    try {
      let fresh = false;
      if (!messenger.active) {   // not known yet: ask the server (this also starts a new conversation) + its messages
        const res = await api("/conversations", { method: "POST", body: { username, withMessages: true } });
        if (token !== chatToken || !isMessengerOpen()) return;
        const { conversation } = res;
        if (conversation.online) messenger.online.add(conversation.other.username);
        setActiveChat(conversation);
        if (Array.isArray(res.messages)) { storeMessages(messenger.thread, res, false); fresh = true; }
        mountMessenger();
      }
      setTitle(`${messenger.active.other.displayName} — Messages — LUMIERE`);
      markActiveRead();
      const input = $("#chatForm textarea");
      if (input && window.matchMedia("(min-width: 681px)").matches) input.focus();
      if (!fresh) await loadMessages(false);   // fresh copy from the server (the shown messages may be from earlier)
    } catch (err) {
      if (token !== chatToken) return;
      messenger.opening = false;
      toast(err.message);
      location.hash = "messages";
    }
  }

  // Fetch a chat's messages; `older` loads the page before the first one shown
  async function loadMessages(older) {
    const a = messenger.active;
    const thread = messenger.thread;
    if (!a) return;
    messenger.loading = true;
    if (older) renderThreadBody(false);
    try {
      const q = older && thread.messages.length ? `?before=${encodeURIComponent(thread.messages[0].createdAt)}` : "";
      const res = await api(`/conversations/${a.id}/messages${q}`);
      storeMessages(thread, res, older);
      if (messenger.thread !== thread) return;
      messenger.loading = false;
      const box = $("#threadMessages");
      const prevHeight = box ? box.scrollHeight : 0;
      renderThreadBody(!older);
      if (older && box) box.scrollTop = box.scrollHeight - prevHeight;   // keep your place
    } catch (err) {
      if (messenger.thread === thread) messenger.loading = false;
      toast(err.message);
    }
  }

  function storeMessages(thread, res, older) {
    if (older) thread.messages = [...res.messages, ...thread.messages];
    else {
      // keep messages I'm still sending, and live ones that arrived while this request was on its way
      const last = res.messages.length ? res.messages[res.messages.length - 1].createdAt : "";
      const keep = thread.messages.filter((m) => !res.messages.some((x) => String(x.id) === String(m.id))
        && (m.pending || m.failed || m.createdAt > last));
      thread.messages = [...res.messages, ...keep];
    }
    if (!older || !thread.loaded) thread.hasMore = res.hasMore;
    thread.loaded = true;
  }

  // Load a chat's messages in the background (when its popup appears, or you point at it in the list)
  const prefetching = new Set();
  function prefetchThread(conversationId) {
    const thread = threadFor(conversationId);
    const key = String(conversationId);
    if (thread.loaded || prefetching.has(key)) return;
    prefetching.add(key);
    api(`/conversations/${key}/messages`)
      .then((res) => { if (!thread.loaded) storeMessages(thread, res, false); })
      .catch(() => { /* it loads when the chat opens */ })
      .finally(() => prefetching.delete(key));
  }

  function sendChat(form) {
    const a = messenger.active;
    const text = form.text.value.trim();
    if (!a || !text) return;
    if (!socket || !socket.connected) { toast("Not connected to live chat yet — try again in a moment."); return; }
    const clientId = `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const temp = { id: clientId, clientId, sender: session.user.username, text, createdAt: new Date().toISOString(), pending: true };
    messenger.messages.push(temp);
    form.text.value = "";
    autosize(form.text);
    renderThreadBody(true);
    socket.emit("message:send", { conversationId: a.id, text, clientId }, (ack) => {
      const i = messenger.messages.findIndex((m) => m.clientId === clientId);
      if (ack && ack.ok) {
        if (i >= 0) messenger.messages[i] = ack.message;
      } else {
        if (i >= 0) messenger.messages[i] = { ...temp, pending: false, failed: true };
        toast((ack && ack.error) || "Couldn't send the message.");
      }
      if (messenger.active === a) renderThreadBody(false);
    });
  }

  function autosize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(140, textarea.scrollHeight)}px`;
  }

  /* ---------- Popup when a message arrives elsewhere on the site ---------- */
  function showChatPopup(conversation, message) {
    const stack = $("#chatPopups");
    if (!stack) return;
    const other = conversation.other;
    const el = document.createElement("a");
    el.className = "chat-popup";
    el.href = `#messages/${encodeURIComponent(other.username)}`;
    el.setAttribute("role", "status");
    el.innerHTML = `
      ${avatar(authorFromUser(other))}
      <span class="chat-popup__body">
        <strong>${escapeHTML(other.displayName)}</strong>
        <span>${escapeHTML(message.text.length > 90 ? message.text.slice(0, 89) + "…" : message.text)}</span>
      </span>
      <button class="chat-popup__close" aria-label="Dismiss">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>`;
    stack.prepend(el);
    while (stack.children.length > 3) stack.lastElementChild.remove();
    const remove = () => { el.classList.add("is-leaving"); setTimeout(() => el.remove(), 250); };
    el.addEventListener("click", (e) => { if (e.target.closest(".chat-popup__close")) { e.preventDefault(); } remove(); });
    setTimeout(remove, 7000);
  }

  /* ---------- Member search inside the messenger ---------- */
  let memberSearchTimer = 0;
  function searchMembers(input) {
    const box = $(".search-suggest", input.form);
    const q = input.value.trim();
    clearTimeout(memberSearchTimer);
    if (q.length < 2) { box.hidden = true; return; }
    memberSearchTimer = setTimeout(async () => {
      try {
        const res = await api(`/members?search=${encodeURIComponent(q)}&limit=6`);
        if (input.value.trim() !== q) return;
        const users = res.users.filter((u) => u.username !== session.user.username);
        box.innerHTML = users.length
          ? users.map((u) => `
              <a class="suggest-item" href="#messages/${encodeURIComponent(u.username)}">
                ${avatar(authorFromUser(u))}
                <span><span class="suggest-item__name">${escapeHTML(u.displayName)}</span><br><span class="suggest-item__meta">@${escapeHTML(u.username)}</span></span>
              </a>`).join("")
          : `<p class="suggest-empty">No members found for “${escapeHTML(q)}”</p>`;
        box.hidden = false;
      } catch (err) { /* ignore */ }
    }, 200);
  }

  /* ---------- Route ---------- */
  function showMessenger(username) {
    if (!session.user) {
      history.replaceState(null, "", location.pathname + location.search);
      showHome();
      openAuth("login", "Log in to see your messages.");
      return;
    }
    const wasOpen = isMessengerOpen();
    renderCurrent = renderMessengerPage;
    if (!username) {
      chatToken++;
      messenger.active = null;
      messenger.opening = false;
      if (wasOpen) mountMessenger(); else showView(renderMessengerPage(), "Messages");
      renderConversationList();
    } else {
      prepareChat(username);   // the chat (and its known messages) is in the very first render
      if (wasOpen) mountMessenger(); else { showView(renderMessengerPage(), "Messages"); fillMessenger(); }
      openChat(username);
    }
    if (!messenger.conversations || !wasOpen) loadConversations();
  }

  // Connect live chat when signed in; clear everything on log out
  function startMessenger() {
    if (session.user) {
      connectSocket();
      loadConversations();
    } else {
      disconnectSocket();
      messenger.conversations = null;
      messenger.active = null;
      messenger.opening = false;
      messenger.threads.clear();
      messenger.thread = { messages: [], hasMore: false, loaded: false };
      messenger.online.clear();
      setUnread(0);
      if (isMessengerOpen()) location.hash = "";
    }
  }

  function initMessenger() {
    const view = $("#perfumeView");

    view.addEventListener("submit", (e) => {
      if (e.target.id === "chatForm") { e.preventDefault(); sendChat(e.target); }
      if (e.target.matches("[data-member-search]")) e.preventDefault();
    }, true);

    view.addEventListener("keydown", (e) => {
      if (e.target.matches("#chatForm textarea") && e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        sendChat(e.target.form);
      }
    });

    view.addEventListener("input", (e) => {
      if (e.target.matches("#chatForm textarea")) {
        autosize(e.target);
        if (socket && messenger.active && Date.now() - lastTypingSent > 2000) {
          lastTypingSent = Date.now();
          socket.emit("typing", { conversationId: messenger.active.id });
        }
      }
      if (e.target.matches("[data-member-search] input")) searchMembers(e.target);
    });

    view.addEventListener("click", (e) => {
      if (e.target.closest("[data-older]")) loadMessages(true);
    });

    // pointing at a chat in the list starts loading it, so it opens instantly
    view.addEventListener("pointerover", (e) => {
      const link = e.target.closest("#convList a.conv");
      if (!link) return;
      const name = decodeURIComponent(link.hash.replace("#messages/", ""));
      const c = (messenger.conversations || []).find((x) => x.other.username === name);
      if (c) prefetchThread(c.id);
    });

    // reading a chat when you come back to the tab marks it read
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && isMessengerOpen() && messenger.active) markActiveRead();
    });
  }

  /* =======================================================
     Review trends chart (D3, see trends-chart.js)
     ======================================================= */
  async function initTrendsChart() {
    const box = $("#trendsChart");
    if (!box) return;
    if (!window.LumiereTrends || !window.d3) {
      box.innerHTML = '<p class="pv__empty">The chart couldn\'t load.</p>';
      return;
    }
    try {
      const data = await api("/stats/review-trends");
      const nameOf = (slug) => {
        const p = byId(slug);
        return p ? `${p.brand ? p.brand + " " : ""}${p.name}` : slug;
      };
      window.LumiereTrends.mount(box, data, { nameOf });
    } catch (err) {
      box.innerHTML = `<p class="pv__empty">${escapeHTML(err.message)}</p>`;
    }
  }

  /* =======================================================
     Bridge for React components (public/js/react/*)
     Events on document: "lumiere:ready", "lumiere:auth", "lumiere:follow"
     ======================================================= */
  let appReady = false;
  window.Lumiere = {
    api,
    isReady: () => appReady,
    getSession: () => ({ user: session.user, following: new Set(session.following) }),
    toggleFollow,
    formatCount,
    avatarFor(user) {
      const a = authorFromUser(user);
      const [bg, fg] = AVATAR_TONES[a.tone % AVATAR_TONES.length];
      return { initials: a.initials, bg, fg };
    },
  };

  /* =======================================================
     Init
     ======================================================= */
  document.addEventListener("DOMContentLoaded", async () => {
    $("#year").textContent = new Date().getFullYear();

    // Broken photo -> show the illustrated bottle in the same frame
    document.addEventListener("error", (e) => {
      if (e.target.matches && e.target.matches("img.perfume-media__img")) {
        e.target.closest(".perfume-media").classList.add("is-broken");
      }
    }, true);

    initSearch();
    initSocial();
    initNav();
    initAccounts();
    initPages();
    initCommunity();
    initMessenger();

    // Who is signed in + the perfume list (catalog and member-added perfumes)
    const [me, list] = await Promise.allSettled([api("/auth/me"), api("/perfumes")]);
    setSession(me.status === "fulfilled" ? me.value : null);
    if (list.status === "fulfilled") {
      perfumes = list.value.perfumes.map((rec) => buildPerfume(rec, list.value.stats[rec.slug]));
    } else {
      $("#trendingEmpty").textContent = "We couldn't load the perfumes right now. Please refresh the page in a moment.";
    }

    applyAuthState();
    initTrending();
    refreshCommunity();
    loadGroups();
    startMessenger();
    initTrendsChart();
    initGroupChart();

    window.addEventListener("hashchange", route);
    route();

    appReady = true;
    document.dispatchEvent(new CustomEvent("lumiere:ready"));
    keepLayoutSteady();
  });

  /* ---------- Steady layout on refresh ----------
     The home sections fill in as their data arrives. Their heights are saved when leaving the page,
     the script after </main> in home.html reserves them on the next load (so the restored scroll
     position doesn't jump), and they're released once the page has settled. */
  const STEADY_IDS = ["filterBar", "trendingGrid", "reviewList", "activityFeed", "topReviewersRoot", "groupsTeaser", "trendsChart", "groupChart"];

  function keepLayoutSteady() {
    window.addEventListener("pagehide", () => {
      if ($("main").hidden) return;   // a page is open, not the homepage
      const heights = {};
      STEADY_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el && !el.style.minHeight) heights[id] = Math.round(el.offsetHeight);
      });
      try {
        sessionStorage.setItem("lumiere:layout", JSON.stringify({ w: window.innerWidth, member: !!session.user, heights }));
      } catch (err) { /* storage unavailable */ }
    });

    // release the reserved heights once the sections stop changing (or after a few seconds at most)
    const reserved = STEADY_IDS.map((id) => document.getElementById(id)).filter((el) => el && el.style.minHeight);
    if (!reserved.length) return;
    let quiet;
    const release = () => {
      observer.disconnect();
      clearTimeout(quiet);
      clearTimeout(cap);
      reserved.forEach((el) => { el.style.minHeight = ""; });
    };
    const observer = new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(release, 700); });
    reserved.forEach((el) => observer.observe(el, { childList: true, subtree: true }));
    quiet = setTimeout(release, 700);
    const cap = setTimeout(release, 6000);
  }
})();
