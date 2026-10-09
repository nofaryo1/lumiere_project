/* =========================================================
   LUMIERE — Homepage scripts
   All data below is placeholder content. Later it can be
   replaced with data fetched from the Express API / MongoDB.
   ========================================================= */

(function () {
  "use strict";

  /* =======================================================
     Placeholder data
     ======================================================= */

  // Scent families used by the trending filters
  const families = [
    { key: "woody",    name: "Woody",    count: 642 },
    { key: "floral",   name: "Floral",   count: 811 },
    { key: "fresh",    name: "Fresh",    count: 534 },
    { key: "amber",    name: "Amber",    count: 397 },
    { key: "citrus",   name: "Citrus",   count: 415 },
    { key: "musk",     name: "Musk",     count: 288 },
    { key: "spicy",    name: "Spicy",    count: 263 },
    { key: "gourmand", name: "Gourmand", count: 219 },
  ];

  // Most popular first, per Trending tab. Everything else follows.
  const POPULAR = {
    week:  ["dior-sauvage", "lattafa-yara", "dolce-gabbana-light-blue", "byredo-gypsy-water", "versace-eros", "chanel-no-5", "tom-ford-ombre-leather"],
    month: ["dior-sauvage", "tom-ford-ombre-leather", "xerjoff-naxos", "chanel-coco-mademoiselle", "lattafa-yara", "armani-acqua-di-gio"],
    all:   ["chanel-no-5", "dior-sauvage", "armani-acqua-di-gio", "dior-jadore", "dolce-gabbana-light-blue", "chanel-coco-mademoiselle"],
  };

  // Small stable hash so placeholder numbers stay the same on every load
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  const LIQUID = { woody: "#b98a57", floral: "#e7b9b4", fresh: "#cfe0dc", amber: "#d9a85e",
                   citrus: "#f0d98a", musk: "#e6ebe8", spicy: "#c98a5e", gourmand: "#8a5a3b" };

  // Filled from the API (/api/perfumes) when the page loads
  let perfumes = [];

  // Turns an API record into what the page uses. Catalog perfumes get
  // placeholder ratings/trends on top of real member activity; perfumes
  // added by members only show real activity.
  function buildPerfume(rec, stat = {}) {
    const id = rec.slug;
    const h = hash(id);
    const tags = rec.tags || [];
    const isCatalog = rec.source === "catalog";
    const ratings = isCatalog ? 300 + (h % 4200) : 0;
    const score = {};
    for (const period of Object.keys(POPULAR)) {
      const rank = POPULAR[period].indexOf(id);
      score[period] = !isCatalog ? -1 : rank >= 0 ? 100 - rank : (hash(id + period) % 60);
    }
    return {
      id,
      name: rec.name,
      brand: rec.brand,
      tags,
      notes: rec.notes || [],
      image: rec.image || "",
      source: rec.source,
      addedBy: rec.addedBy || null,
      rating: isCatalog ? 3.8 + (h % 11) / 10 : 0,
      ratings,
      reviews: Math.round(ratings * 0.18),
      saves: Math.round(ratings * 2.3),
      change: isCatalog ? 2 + (h % 25) : 0,
      score,
      real: { reviews: stat.reviews || 0, ratingSum: stat.ratingSum || 0, likes: stat.likes || 0 },
      // fallback illustration if there's no photo
      look: { shape: ["rect", "tall", "round"][h % 3], liquid: LIQUID[tags[0]] || "#e3e6e4", cap: "#2b2f2d" },
    };
  }

  const users = {
    camille: { name: "Camille R.", initials: "CR", level: "Top reviewer", reviews: 142, followers: "2.1k", tone: 0 },
    julien:  { name: "Julien M.",  initials: "JM", level: "Collector",    reviews: 87,  followers: "940",  tone: 1 },
    noa:     { name: "Noa L.",     initials: "NL", level: "Rising",       reviews: 34,  followers: "312",  tone: 2 },
    sam:     { name: "Sam K.",     initials: "SK", level: "Top reviewer", reviews: 201, followers: "3.4k", tone: 3 },
    maya:    { name: "Maya T.",    initials: "MT", level: "Member",       reviews: 12,  followers: "86",   tone: 4 },
    leo:     { name: "Leo A.",     initials: "LA", level: "Member",       reviews: 19,  followers: "120",  tone: 1 },
  };

  const reviews = [
    {
      user: "camille", perfume: "dior-sauvage", rating: 4.5, posted: "2h ago",
      text: "Fresh and peppery, and pretty loud for the first hour. It settles into a clean, ambery skin scent that lasts all day. Easy compliment-getter — just know a lot of people wear it.",
      traits: { Longevity: "8h+", Sillage: "Strong", Season: "All year" },
      likes: 124, comments: 18,
    },
    {
      user: "sam", perfume: "lattafa-yara", rating: 5, posted: "5h ago",
      text: "Sweet tropical fruit and creamy vanilla over a soft musk. Cozy and very easy to like — perfect for cooler evenings. Two sprays is plenty, it projects more than you'd think.",
      traits: { Longevity: "10h", Sillage: "Strong", Season: "Winter" },
      likes: 98, comments: 11,
    },
    {
      user: "noa", perfume: "dolce-gabbana-light-blue", rating: 4, posted: "Yesterday",
      text: "Crisp lemon and green apple — summer holiday in a bottle. It fades after a few hours, so I keep a travel spray in my bag.",
      traits: { Longevity: "5h", Sillage: "Soft", Season: "Summer" },
      likes: 76, comments: 9,
    },
  ];

  // First 3 entries are "incoming" live events; the rest seed the feed.
  const activityPool = [
    { user: "maya",    html: "added <strong>Gucci Bloom</strong> to their wishlist",     time: "just now" },
    { user: "leo",     html: "rated <strong>Tom Ford Ombre Leather</strong> ★ 4.5",     time: "just now" },
    { user: "julien",  html: "started a discussion: <strong>Best vanilla for winter?</strong>", time: "just now" },
    { user: "noa",     html: "added <strong>Chanel No 5</strong> to their collection",  time: "4m ago" },
    { user: "camille", html: "reviewed <strong>Dior Sauvage</strong>",                  time: "12m ago" },
    { user: "sam",     html: "followed <strong>Maya T.</strong>",                        time: "18m ago" },
    { user: "maya",    html: "asked: <strong>Something like Gypsy Water but lighter?</strong>", time: "24m ago" },
    { user: "leo",     html: "saved <strong>Xerjoff Naxos</strong>",                    time: "31m ago" },
  ];

  const topReviewers = ["sam", "camille", "julien", "noa"];
  const onlineUsers = ["camille", "sam", "noa", "maya", "leo"];

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

  const AVATAR_TONES = [
    ["#e6efe9", "#3f6b56"], ["#e4ecf3", "#3d6283"], ["#efe9f3", "#6a4f83"],
    ["#f3ece4", "#83613d"], ["#e9eef0", "#4b5f66"],
  ];
  // `who` is a sample member key ("camille") or an author object { initials, tone }
  function avatar(who, size = "") {
    const u = typeof who === "string" ? users[who] : who;
    const [bg, fg] = AVATAR_TONES[u.tone % AVATAR_TONES.length];
    return `<span class="avatar ${size}" style="--avatar-bg:${bg};--avatar-fg:${fg}" aria-hidden="true">${escapeHTML(u.initials)}</span>`;
  }

  const ICON = {
    star: '<svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 1.8l2.4 5.2 5.7.6-4.3 3.9 1.2 5.6L10 14.2l-5 2.9 1.2-5.6L1.9 7.6l5.7-.6z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16l-6-4-6 4z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12"><path d="M7 14l5-5 5 5"/></svg>',
  };

  /* ---------- Bottle thumbnail (placeholder product image) ---------- */
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
     centering are handled entirely in CSS.
     - p.image      optional photo URL (e.g. from the API later)
     - p.imageZoom  optional fine-tune for photos with lots of empty space
     Without a photo, or if the photo fails to load, the illustrated
     bottle is shown in the same frame. */
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
    const el = $("#toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  /* =======================================================
     Renderers
     ======================================================= */
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

  function perfumeCard(p, { rank, match, reason } = {}) {
    const badge = match
      ? `<span class="match">${match}% match</span>`
      : rank ? `<span class="rank">#${rank}</span>` : "";
    const trend = !match && p.change ? `<span class="trend">${ICON.up}${p.change}%</span>` : "";

    return `
      <article class="perfume-card" data-perfume="${p.id}">
        <div class="perfume-card__media">
          ${badge}${trend}
          ${perfumeMedia(p)}
        </div>
        <div class="perfume-card__body">
          <p class="perfume-card__brand">${escapeHTML(p.brand)}</p>
          <h3 class="perfume-card__name"><a href="#perfume/${p.id}">${escapeHTML(p.name)}</a></h3>
          ${ratingRow(p)}
          ${reason
            ? `<p class="perfume-card__reason">${escapeHTML(reason)}</p>`
            : `<div class="perfume-card__notes">${p.notes.map((n) => `<span class="chip">${escapeHTML(n)}</span>`).join("")}</div>`}
          <div class="perfume-card__actions">
            <button class="action-btn" data-action="save" data-count="${p.saves}" aria-pressed="false" aria-label="Save ${escapeHTML(p.name)}">
              ${ICON.bookmark}<span>${formatCount(p.saves)}</span>
            </button>
            <button class="action-btn" data-action="review" aria-label="Reviews of ${escapeHTML(p.name)}">
              ${ICON.comment}<span>${formatCount(ratingFor(p).reviews)}</span>
            </button>
            <button class="action-btn action-btn--icon" data-action="love" data-id="${p.id}" aria-pressed="${isLiked(p.id)}" aria-label="Like ${escapeHTML(p.name)}">
              ${ICON.heart}
            </button>
          </div>
        </div>
      </article>`;
  }

  function reviewCard(r) {
    const u = users[r.user];
    const p = byId(r.perfume);
    const traits = Object.entries(r.traits)
      .map(([k, v]) => `<span class="chip">${k}<strong>${escapeHTML(v)}</strong></span>`).join("");

    return `
      <article class="review">
        <header class="review__head">
          ${avatar(r.user)}
          <div>
            <p class="review__user">${escapeHTML(u.name)} <span class="review__level">${u.level}</span></p>
            <p class="review__meta">${u.reviews} reviews · ${r.posted}</p>
          </div>
          <button class="btn btn--ghost btn--sm btn--follow review__follow" data-action="follow" aria-pressed="false">Follow</button>
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
        <div class="review__traits">${traits}</div>

        <footer class="review__actions">
          <button class="social-btn" data-action="like" data-count="${r.likes}" aria-pressed="false" aria-label="Like review">
            ${ICON.heart}<span>${r.likes}</span>
          </button>
          <button class="social-btn" data-action="comment" aria-label="${r.comments} comments">
            ${ICON.comment}<span>${r.comments}</span>
          </button>
          <button class="social-btn" data-action="share" aria-label="Share review">
            ${ICON.share}<span>Share</span>
          </button>
        </footer>
      </article>`;
  }

  function activityItem(a, isNew = false) {
    const u = users[a.user];
    return `
      <li class="activity__item${isNew ? " is-new" : ""}">
        ${avatar(a.user, "avatar--sm")}
        <p><strong>${escapeHTML(u.name)}</strong> ${a.html}<span class="activity__time">${a.time}</span></p>
      </li>`;
  }

  function reviewerItem(key) {
    const u = users[key];
    return `
      <li class="reviewer">
        ${avatar(key)}
        <div>
          <p class="reviewer__name">${escapeHTML(u.name)}</p>
          <p class="reviewer__meta">${u.reviews} reviews · ${u.followers} followers</p>
        </div>
        <button class="btn btn--ghost btn--sm btn--follow" data-action="follow" aria-pressed="false">Follow</button>
      </li>`;
  }

  /* =======================================================
     Trending: period tabs + family filter + search query
     ======================================================= */
  const state = { period: "week", family: "all", query: "" };

  function matchesQuery(p, q) {
    const hay = [p.name, p.brand, ...p.notes, ...p.tags].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
  }

  function renderFilterBar() {
    const all = { key: "all", name: "All" };
    $("#filterBar").innerHTML = [all, ...families].map((f) => {
      const count = f.key === "all" ? perfumes.length : perfumes.filter((p) => p.tags.includes(f.key)).length;
      return `<button class="tag" data-family="${f.key}" aria-pressed="${state.family === f.key}">${f.name}<span class="tag__count">${count}</span></button>`;
    }).join("");
  }

  function renderTrending() {
    const title = $("#trending .section-title");
    const sub = $("#trending .section-sub");

    let list = [...perfumes].sort((a, b) => b.score[state.period] - a.score[state.period]);
    const ranks = new Map(list.map((p, i) => [p.id, i + 1]));

    if (state.family !== "all") list = list.filter((p) => p.tags.includes(state.family));

    if (state.query) {
      list = list.filter((p) => matchesQuery(p, state.query));
      title.textContent = "Search results";
      sub.innerHTML = `${list.length} result${list.length === 1 ? "" : "s"} for “${escapeHTML(state.query)}” · <button class="link link--btn" id="clearSearch">Clear search</button>`;
    } else {
      title.textContent = "Trending perfumes";
      sub.textContent = "Most saved and reviewed by the community";
    }

    const track = $("#trendingGrid");
    track.innerHTML = list
      .map((p) => perfumeCard(p, { rank: state.query ? null : ranks.get(p.id) })).join("");
    track.scrollTo({ left: 0, behavior: "instant" });
    $("#trendingEmpty").hidden = list.length > 0;
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
    if (state.query) $("#trending").scrollIntoView({ behavior: "smooth" });
  }

  function initTrending() {
    renderFilterBar();
    renderTrending();

    const track = $("#trendingGrid");
    track.addEventListener("scroll", updateCarousel, { passive: true });
    window.addEventListener("resize", updateCarousel);
    $("#trendPrev").addEventListener("click", () => scrollCarousel(-1));
    $("#trendNext").addEventListener("click", () => scrollCarousel(1));
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); scrollCarousel(1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); scrollCarousel(-1); }
    });

    $("#trendTabs").addEventListener("click", (e) => {
      const tab = e.target.closest("[data-period]");
      if (!tab) return;
      $$("#trendTabs [role=tab]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      state.period = tab.dataset.period;
      renderTrending();
    });

    $("#filterBar").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-family]");
      if (btn) setFamily(btn.dataset.family);
    });

    $("#trending").addEventListener("click", (e) => {
      if (e.target.id === "clearSearch") runSearch("");
    });
  }

  /* =======================================================
     Search with suggestions (header + hero)
     ======================================================= */
  function closeAllSuggestions() {
    $$(".search-suggest").forEach((s) => { s.hidden = true; s.innerHTML = ""; });
  }

  function initSearch() {
    $$("[data-search]").forEach((form) => {
      const input = $("input", form);
      const box = $(".search-suggest", form);
      let active = -1;

      const update = () => {
        const q = input.value.trim();
        active = -1;
        if (!q) { box.hidden = true; return; }
        const hits = perfumes.filter((p) => matchesQuery(p, q)).slice(0, 5);
        box.innerHTML = hits.length
          ? hits.map((p) => `
              <button type="button" class="suggest-item" data-name="${escapeHTML(p.name)}" data-id="${p.id}">
                ${perfumeMedia(p, "xs")}
                <span><span class="suggest-item__name">${escapeHTML(p.name)}</span><br><span class="suggest-item__meta">${escapeHTML(p.brand)} · ${p.notes.slice(0, 2).join(", ")}</span></span>
                <span class="suggest-item__rating">★ ${p.rating.toFixed(1)}</span>
              </button>`).join("")
          : `<p class="suggest-empty">No perfumes found for “${escapeHTML(q)}”</p>`;
        box.hidden = false;
      };

      input.addEventListener("input", update);
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
        if (item) { closeAllSuggestions(); input.blur(); openPerfume(item.dataset.id); }
      });

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const chosen = $(".suggest-item.is-active", box);
        if (chosen) { closeAllSuggestions(); input.blur(); openPerfume(chosen.dataset.id); }
        else runSearch(input.value);
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest("[data-search]")) closeAllSuggestions();
    });

    $$(".hero__popular [data-query]").forEach((btn) =>
      btn.addEventListener("click", () => runSearch(btn.dataset.query)));
  }

  /* =======================================================
     Social interactions (save, like, follow, share…)
     Likes are saved to your account; the rest are placeholders.
     ======================================================= */
  function togglePressed(btn) {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    return on;
  }

  function toggleCount(btn, format = String) {
    const on = togglePressed(btn);
    $("span", btn).textContent = format(Number(btn.dataset.count) + (on ? 1 : 0));
    return on;
  }

  function initSocial() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      switch (btn.dataset.action) {
        case "save":
          toast(toggleCount(btn, formatCount) ? "Saved to your collection" : "Removed from your collection");
          break;
        case "love": {
          const p = byId(btn.dataset.id);
          if (p) toggleLike(p);
          break;
        }
        case "like":
          toggleCount(btn);
          break;
        case "follow":
          btn.textContent = togglePressed(btn) ? "Following" : "Follow";
          break;
        case "share":
          if (navigator.clipboard) navigator.clipboard.writeText(location.href).catch(() => {});
          toast("Link copied");
          break;
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

  /* ---------- Live activity feed (simulated) ---------- */
  function initActivity() {
    const feed = $("#activityFeed");
    feed.innerHTML = activityPool.slice(3).map((a) => activityItem(a)).join("");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let next = 0;
    const timer = setInterval(() => {
      feed.insertAdjacentHTML("afterbegin", activityItem(activityPool[next], true));
      while (feed.children.length > 5) feed.lastElementChild.remove();
      if (++next === 3) clearInterval(timer);   // only 3 simulated events
    }, 9000);
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
     Perfume page  (#perfume/<id>)
     Everything below is generated placeholder community data,
     stable per perfume, until real reviews come from the backend.
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

  const REVIEW_USERS = ["camille", "julien", "noa", "sam", "maya", "leo"];
  const POSTED = ["2h ago", "Yesterday", "3 days ago", "1 week ago", "2 weeks ago", "1 month ago"];

  const SEASONS = ["Spring", "Summer", "Fall", "Winter"];
  const TIMES = ["Day", "Night"];
  const STAR_LABELS = ["Didn't like it", "Not for me", "It's OK", "Like it", "Love it"];

  /* ---------- Your own votes (performance, when to wear, pros & cons) ----------
     Saved in this browser (localStorage). Reviews and likes are saved to
     your account on the server. */
  const STORE_KEY = "lumiere:my-activity";
  const emptyMine = () => ({ perf: {}, wear: [], agree: [] });
  let store = {};
  try { store = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (err) { store = {}; }

  const myData = (id) => ({ ...emptyMine(), ...store[id] });
  function updateMine(id, change) {
    store[id] = myData(id);
    change(store[id]);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (err) { /* storage unavailable */ }
  }

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

  const initialsOf = (name) => String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";

  // Author shown on a review: a sample community member or a real account
  function authorFromKey(key) {
    const u = users[key];
    return { name: u.name, level: u.level, initials: u.initials, tone: u.tone };
  }
  function authorFromUser(u) {
    return { name: u.displayName, username: u.username, level: "Member", initials: initialsOf(u.displayName), tone: hash(u.username) % 5 };
  }

  /* ---------- Generated community data (catalog perfumes only) ---------- */
  const baseCache = {};

  function baseDetails(p) {
    if (baseCache[p.id]) return baseCache[p.id];
    const h = hash(p.id);
    const fam = p.tags;
    const isCatalog = p.source === "catalog";

    // Performance (1–5); perfumes added by members start with no votes
    const famLong = fam.length ? Math.round(fam.reduce((s, t) => s + BASE_LONGEVITY[t], 0) / fam.length) : 3;
    const known = KNOWN_PERFORMANCE[p.id] || {};
    const longevity = known.longevity || Math.max(1, Math.min(5, famLong + ((h >> 3) % 3) - 1));
    const sillage = known.sillage || Math.max(1, Math.min(5, longevity + ((h >> 5) % 3) - 1));
    const value = 2 + ((h >> 7) % 4);
    const votes = isCatalog ? Math.round(p.ratings * 0.4) : 0;

    // Default pros & cons (consistent with performance for catalog perfumes)
    const pros = [], cons = [];
    if (isCatalog) {
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
      votes: isCatalog ? Math.max(4, Math.round(p.reviews * (0.9 - i * 0.17)) - (hash(text + p.id) % 15) * k) : 0,
    })).sort((a, b) => b.votes - a.votes);

    // When to wear: family leaning -> vote counts
    const lean = { Spring: 2, Summer: 2, Fall: 2, Winter: 2, Day: 3, Night: 3 };
    fam.forEach((t) => Object.keys(lean).forEach((k) => { lean[k] += WEAR[t][k]; }));
    const toVotes = (keys) => {
      const total = sum(keys.map((k) => lean[k]));
      return Object.fromEntries(keys.map((k) => [k, Math.round((lean[k] / total) * votes)]));
    };

    // Star breakdown that matches the average rating
    const weights = [1, 2, 3, 4, 5].map((star) => Math.exp(-((star - p.rating) ** 2) / 0.9));
    const wSum = sum(weights);

    const details = {
      pros: toItems(pros, 5, 1),
      cons: toItems(cons, 4, 2),
      perf: { longevity: spread(longevity, votes), sillage: spread(sillage, votes), value: spread(value, votes) },
      wear: { ...toVotes(SEASONS), ...toVotes(TIMES) },
      breakdown: weights.map((w) => Math.round((w / wSum) * p.ratings)),   // index 0 = 1★
      reviews: [],
    };

    if (isCatalog) {
      details.reviews = pick(REVIEW_USERS, 3, p.id + "u").map((user, i) => {
        const rating = Math.max(3, Math.min(5, Math.round(p.rating * 2 + ((hash(p.id + user) % 3) - 1)) / 2));
        const pro = details.pros[i % details.pros.length].text;
        const con = details.cons[i % details.cons.length].text;
        const note = p.notes[i % Math.max(1, p.notes.length)];
        const templates = rating >= 4.5
          ? [`Honestly one of my favorites. ${pro}, and it just works on my skin. Small downside: ${con.toLowerCase()}.`,
             `Bought a full bottle after one sample. ${pro}. If I had to nitpick: ${con.toLowerCase()}.`,
             `This is the one people ask me about. ${pro}${note ? `, and the ${note.toLowerCase()} is gorgeous` : ""}. ${con} — but I don't mind.`]
          : rating >= 4
            ? [`Really nice${note ? `, the ${note.toLowerCase()} comes through beautifully` : ""}. ${pro}. Only thing: ${con.toLowerCase()}.`,
               `Solid choice. ${pro}. ${con}, so I keep it for the right occasions.`,
               `Grew on me after a few wears. ${pro}, though ${con.toLowerCase()}.`]
            : [`Good, but not a blind buy. ${pro}, but ${con.toLowerCase()}. Test it on skin first.`,
               `Mixed feelings. ${pro}, yet ${con.toLowerCase()}. Try a sample before buying.`];
        return { author: authorFromKey(user), rating, text: templates[i % templates.length], posted: POSTED[hash(p.id + i) % POSTED.length], likes: 5 + (hash(user + p.id) % 90) };
      });

      const featured = reviews.find((r) => r.perfume === p.id);
      if (featured) {
        details.reviews = [
          { author: authorFromKey(featured.user), rating: featured.rating, text: featured.text, posted: featured.posted, likes: featured.likes },
          ...details.reviews.filter((r) => r.author.name !== users[featured.user].name).slice(0, 2),
        ];
      }
    }

    baseCache[p.id] = details;
    return details;
  }

  // Overall rating = sample ratings (catalog) + real member reviews
  function ratingFor(p) {
    const count = p.ratings + p.real.reviews;
    const total = p.rating * p.ratings + p.real.ratingSum;
    return { avg: count ? total / count : 0, count, reviews: p.reviews + p.real.reviews };
  }

  const likesFor = (p) => (p.source === "catalog" ? Math.round(p.saves * 0.6) : 0) + p.real.likes;

  function similarPerfumes(p, n = 5) {
    return perfumes
      .filter((o) => o.id !== p.id)
      .map((o) => ({ o, shared: o.tags.filter((t) => p.tags.includes(t)).length }))
      .sort((a, b) => b.shared - a.shared || b.o.score.week - a.o.score.week)
      .slice(0, n)
      .map((x) => x.o);
  }

  // Real member reviews for a perfume (cached on the perfume)
  async function loadRealReviews(p) {
    try {
      const data = await api(`/perfumes/${encodeURIComponent(p.id)}/reviews`);
      p.realReviews = data.reviews.map((r) => ({
        author: authorFromUser(r.user), rating: r.rating, text: r.text,
        posted: postedLabel(r.updatedAt || r.createdAt), username: r.user.username, likes: 0, real: true,
      }));
    } catch (err) {
      p.realReviews = [];
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

  function perfMeter(key, label, base, mine) {
    const names = LEVELS[key];
    const my = mine.perf[key];
    const level = levelOf(base.perf[key].map((c, i) => c + (my === i + 1 ? 1 : 0)));
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

  function wearBlock(keys, base, mine) {
    const counts = keys.map((k) => base.wear[k] + (mine.wear.includes(k) ? 1 : 0));
    const total = sum(counts) || 1;
    return `
      <div class="pv__bars">${bars(keys.map((k, i) => [k, counts[i], `${Math.round((counts[i] / total) * 100)}%`, mine.wear.includes(k)]))}</div>
      ${voteChips("data-wear", keys.map((k) => [k, k]), (k) => mine.wear.includes(k), "Your picks")}`;
  }

  function verdictList(kind, items, mine) {
    const icon = kind === "pros"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    return items.map((it) => {
      const key = `${kind}:${it.text}`;
      const agreed = mine.agree.includes(key);
      return `
        <li class="verdict__item">
          <span class="verdict__icon">${icon}</span>
          <span class="verdict__text">${escapeHTML(it.text)}</span>
          <button class="verdict__vote" data-agree="${escapeHTML(key)}" aria-pressed="${agreed}" aria-label="Agree: ${escapeHTML(it.text)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7"/></svg>
            <span>${it.votes + (agreed ? 1 : 0)}</span>
          </button>
        </li>`;
    }).join("");
  }

  function reviewItem(r, { mine = false } = {}) {
    const a = r.author;
    const name = a.username
      ? `<a class="review__name-link" href="#profile/${encodeURIComponent(a.username)}">${escapeHTML(a.name)}</a>`
      : escapeHTML(a.name);
    return `
      <article class="pv-review${mine ? " pv-review--mine" : ""}">
        <header class="review__head">
          ${avatar(a)}
          <div>
            <p class="review__user">${name} <span class="review__level">${mine ? "Your review" : escapeHTML(a.level)}</span></p>
            <p class="review__meta">${escapeHTML(r.posted)}</p>
          </div>
          <span class="pv-review__score">${stars(r.rating)}<strong>${r.rating.toFixed(1)}</strong></span>
        </header>
        <p class="review__text">${escapeHTML(r.text)}</p>
        <footer class="review__actions">
          ${mine
            ? `<button class="social-btn" data-edit-review>Edit</button><button class="social-btn" data-delete-review>Delete</button>`
            : r.real
              ? `<button class="social-btn" data-action="comment">${ICON.comment}<span>Reply</span></button>`
              : `<button class="social-btn" data-action="like" data-count="${r.likes}" aria-pressed="false" aria-label="Like review">${ICON.heart}<span>${r.likes}</span></button>
                 <button class="social-btn" data-action="comment">${ICON.comment}<span>Reply</span></button>`}
        </footer>
      </article>`;
  }

  function composer(p, draft) {
    const rating = draft ? draft.rating : 0;
    return `
      <form class="composer" id="reviewForm" data-rating="${rating}" novalidate>
        <p class="composer__title">${draft ? "Edit your review" : `Rate & review ${escapeHTML(p.name)}`}</p>
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

  function postedLabel(iso) {
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days < 1) return "Today";
    if (days === 1) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const BACK_BUTTON = `
    <button class="pv__back" data-back>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg> Back
    </button>`;

  /* =======================================================
     Perfume page  (#perfume/<slug>)
     ======================================================= */
  let editingReview = false;

  function renderPerfumePage(p) {
    const base = baseDetails(p);
    const mine = myData(p.id);
    const r = ratingFor(p);
    const me = session.user;
    const real = p.realReviews || [];
    const myReview = me ? real.find((rv) => rv.username === me.username) : null;
    const others = real.filter((rv) => rv !== myReview);
    const rankWeek = [...perfumes].sort((a, b) => b.score.week - a.score.week).findIndex((o) => o.id === p.id) + 1;
    const familyChips = p.tags.map((t) => `<span class="tag tag--static">${families.find((f) => f.key === t).name}</span>`).join("");
    const breakdown = base.breakdown.map((c, i) => c + real.filter((rv) => rv.rating === i + 1).length);
    const perfVotes = sum(base.perf.longevity) + (Object.keys(mine.perf).length ? 1 : 0);

    let writeArea = "";
    if (!me) writeArea = joinPrompt(`Tried ${escapeHTML(p.name)}? Join the community to rate it and share your review.`);
    else if (!myReview || editingReview) writeArea = composer(p, editingReview && myReview);

    const reviewList = [
      myReview && !editingReview ? reviewItem(myReview, { mine: true }) : "",
      ...others.map((rv) => reviewItem(rv)),
      ...base.reviews.map((rv) => reviewItem(rv)),
    ].join("");
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
            ${p.source === "catalog" ? `<span class="rank">#${rankWeek} this week</span>` : '<span class="rank">New</span>'}
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
              <div><dt>${formatCount(likesFor(p))}</dt><dd>Likes</dd></div>
              <div><dt>${formatCount(Math.round(p.saves * 0.35))}</dt><dd>Own it</dd></div>
              <div><dt>${formatCount(Math.round(p.saves * 0.6))}</dt><dd>Want it</dd></div>
            </dl>

            <div class="pv__actions">
              <button class="btn btn--primary" data-write-review>${myReview ? "View your review" : "Write a review"}</button>
              <button class="action-btn" data-action="save" data-count="${p.saves}" aria-pressed="false">${ICON.bookmark}<span>${formatCount(p.saves)}</span></button>
              <button class="action-btn action-btn--icon" data-action="love" data-id="${p.id}" aria-pressed="${isLiked(p.id)}" aria-label="Like ${escapeHTML(p.name)}">${ICON.heart}</button>
              <button class="action-btn action-btn--icon" data-action="share" aria-label="Share">${ICON.share}</button>
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
                  <ul>${verdictList("pros", base.pros, mine)}</ul>
                </div>
                <div class="verdict__col verdict__col--cons">
                  <h3>Cons</h3>
                  <ul>${verdictList("cons", base.cons, mine)}</ul>
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
            </section>
          </div>

          <aside class="pv__side">
            <section class="panel">
              <h2 class="panel__title">Rating breakdown</h2>
              <div class="pv__bars">${bars([5, 4, 3, 2, 1].map((s) => [`${s}★`, breakdown[s - 1], formatCount(breakdown[s - 1]), myReview && myReview.rating === s]))}</div>
              ${myReview ? `<p class="pv__hint pv__hint--after">Your rating: <strong>${myReview.rating}★</strong> — ${STAR_LABELS[myReview.rating - 1]}</p>` : ""}
            </section>

            <section class="panel">
              <h2 class="panel__title">Performance</h2>
              <p class="pv__hint">${perfVotes ? `Based on ${perfVotes.toLocaleString("en-US")} votes · add yours below` : "No votes yet — add yours below"}</p>
              ${perfMeter("longevity", "Longevity", base, mine)}
              ${perfMeter("sillage", "Sillage", base, mine)}
              ${perfMeter("value", "Value for money", base, mine)}
            </section>

            <section class="panel">
              <h2 class="panel__title">When to wear</h2>
              <p class="pv__hint">Pick every season and time that fits</p>
              ${wearBlock(SEASONS, base, mine)}
              <div class="pv__split">${wearBlock(TIMES, base, mine)}</div>
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
          <div class="profile-review__meta">${stars(rv.rating)}<strong>${rv.rating}.0</strong><span>· ${postedLabel(rv.updatedAt || rv.createdAt)}</span></div>
          <p>${escapeHTML(rv.text)}</p>
        </div>
      </article>`;
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
      ["added", "Added perfumes", addedPerfumes.length],
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
    } else {
      content = addedPerfumes.length
        ? `<div class="perfume-grid">${addedPerfumes.map((p) => perfumeCard(p)).join("")}</div>`
        : `<p class="pv__empty">${who} added any perfumes yet.${isMe ? ' <a class="link" href="#add-perfume">Add a perfume</a>' : ""}</p>`;
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

    return `
      <div class="container pv">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          <span>Members / <strong>@${escapeHTML(user.username)}</strong></span>
        </nav>

        <section class="profile-head">
          ${avatar(authorFromUser(user), "avatar--xl")}
          <div class="profile-head__info">
            ${isMe && editingProfile ? editForm : `
              <h1 class="profile-head__name">${escapeHTML(user.displayName)}</h1>
              <p class="profile-head__meta">@${escapeHTML(user.username)} · Joined ${joined}</p>
              ${user.bio ? `<p class="profile-head__bio">${escapeHTML(user.bio)}</p>` : ""}`}
            <dl class="profile-head__stats">
              <div><dt>${liked.length}</dt><dd>Liked</dd></div>
              <div><dt>${userReviews.length}</dt><dd>Reviews</dd></div>
              <div><dt>${addedPerfumes.length}</dt><dd>Added</dd></div>
            </dl>
          </div>
          ${isMe && !editingProfile ? `
            <div class="profile-head__actions">
              <button class="btn btn--ghost btn--sm" data-edit-profile>Edit profile</button>
              <a class="btn btn--primary btn--sm" href="#add-perfume">Add a perfume</a>
              <button class="btn btn--ghost btn--sm" data-logout>Log out</button>
            </div>` : ""}
        </section>

        <div class="segmented profile-tabs" role="tablist" aria-label="Profile sections">
          ${tabs.map(([key, label, n]) => `<button role="tab" aria-selected="${profileTab === key}" data-profile-tab="${key}">${label} <span class="tab-count">${n}</span></button>`).join("")}
        </div>

        <div class="profile-content">${content}</div>
      </div>`;
  }

  /* =======================================================
     Add a perfume  (#add-perfume)
     ======================================================= */
  const MAX_PHOTO = 5 * 1024 * 1024;
  const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
  let addPhoto = null;   // File chosen in the form

  function renderAddPage() {
    return `
      <div class="container pv">
        <nav class="pv__crumbs" aria-label="Breadcrumb">
          ${BACK_BUTTON}
          <span>Perfumes / <strong>Add a perfume</strong></span>
        </nav>

        <div class="add">
          <section class="panel add__form-panel">
            <h1 class="add__title">Add a perfume</h1>
            <p class="section-sub">Can't find a perfume on LUMIERE? Add it so the community can rate and review it.</p>

            <form id="addForm" class="add__form" novalidate>
              <div class="add__row">
                <label class="field">
                  <span class="field__label">Brand</span>
                  <input name="brand" maxlength="60" placeholder="e.g. Creed" autocomplete="off" required />
                  <span class="field__error" data-error-for="brand"></span>
                </label>
                <label class="field">
                  <span class="field__label">Perfume name</span>
                  <input name="name" maxlength="80" placeholder="e.g. Aventus" autocomplete="off" required />
                  <span class="field__error" data-error-for="name"></span>
                </label>
              </div>

              <div class="notice" id="dupNotice" role="status" hidden></div>

              <fieldset class="field">
                <legend class="field__label">Scent family <span class="field__optional">(pick all that fit)</span></legend>
                <div class="check-chips">
                  ${families.map((f) => `<label class="check-chip"><input type="checkbox" name="tags" value="${f.key}" /><span>${f.name}</span></label>`).join("")}
                </div>
              </fieldset>

              <label class="field">
                <span class="field__label">Main notes <span class="field__optional">(optional, separate with commas)</span></span>
                <input name="notes" maxlength="300" placeholder="e.g. Bergamot, Vanilla, Musk" autocomplete="off" />
              </label>

              <div class="field">
                <span class="field__label">Photo <span class="field__optional">(optional · JPG, PNG or WebP, max 5 MB)</span></span>
                <div class="add__photo">
                  <div class="add__preview" id="photoPreview">
                    ${perfumeMedia({ name: "", image: "", look: { shape: "rect", liquid: "#e3e6e4", cap: "#2b2f2d" } }, "sm")}
                  </div>
                  <label class="btn btn--ghost btn--sm add__file">
                    <input type="file" id="photoInput" accept="image/jpeg,image/png,image/webp" />
                    Choose a photo
                  </label>
                  <button type="button" class="link link--btn" id="photoRemove" hidden>Remove</button>
                </div>
                <span class="field__error" data-error-for="photo"></span>
              </div>

              <div class="add__foot">
                <span class="composer__error" id="addError" role="alert"></span>
                <button type="submit" class="btn btn--primary" id="addSubmit">Add perfume</button>
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
        const res = await api(`/perfumes/check?brand=${encodeURIComponent(brand)}&name=${encodeURIComponent(name)}`);
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
    setFieldErrors(form, fields);
    error.textContent = "";
    if (Object.keys(fields).length) return;

    submit.disabled = true;
    submit.textContent = "Adding…";
    try {
      const { perfume } = await api("/perfumes", { method: "POST", body });
      if (addPhoto) {
        try {
          const res = await api(`/perfumes/${encodeURIComponent(perfume.slug)}/image`, { method: "PUT", file: addPhoto });
          perfume.image = res.image;
        } catch (err) {
          toast(`Perfume added, but the photo failed: ${err.message}`);
        }
      }
      const p = buildPerfume(perfume);
      perfumes.push(p);
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

  function choosePhoto(file) {
    const errorEl = $('[data-error-for="photo"]');
    errorEl.textContent = "";
    if (file && !PHOTO_TYPES.includes(file.type)) { errorEl.textContent = "Please choose a JPG, PNG or WebP image."; file = null; }
    if (file && file.size > MAX_PHOTO) { errorEl.textContent = "That photo is larger than 5 MB."; file = null; }
    addPhoto = file;
    const preview = $("#photoPreview");
    preview.innerHTML = perfumeMedia({
      name: "Preview", image: file ? URL.createObjectURL(file) : "",
      look: { shape: "rect", liquid: "#e3e6e4", cap: "#2b2f2d" },
    }, "sm");
    $("#photoRemove").hidden = !file;
    if (!file) $("#photoInput").value = "";
  }

  /* =======================================================
     Accounts: session, sign up / log in window, account menu
     ======================================================= */
  const session = { user: null, likes: new Set() };
  const isLiked = (id) => session.likes.has(id);

  function setSession(data) {
    session.user = data && data.user ? data.user : null;
    session.likes = new Set((data && data.likes) || []);
  }

  async function api(path, { method = "GET", body, file } = {}) {
    const opts = { method, headers: {}, credentials: "same-origin" };
    if (file) {
      opts.headers["Content-Type"] = file.type;
      opts.body = file;
    } else if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(`/api${path}`, opts);
    } catch (err) {
      throw Object.assign(new Error("Can't reach the server. Please check your connection."), { status: 0, data: {} });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { status: res.status, data });
    return data;
  }

  const LOCK_ICON = '<svg class="nav__lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
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
  }

  function renderSnapshot() {
    const me = session.user;
    $("#snapshotWelcome").innerHTML = me
      ? `<p class="snapshot__title">Welcome back, ${escapeHTML(me.displayName.split(" ")[0])} 👋</p>
         <p>Rate the perfumes you've tried, like your favorites, or add one the community hasn't found yet.</p>`
      : `<p class="snapshot__title">Welcome to LUMIERE 👋</p>
         <p>Want to chat with other fragrance lovers and share your opinion in reviews? Join the community — it only takes a minute.</p>`;
    $("#snapshotCta").innerHTML = me
      ? `<div class="snapshot__actions">
           <a href="#add-perfume" class="btn btn--primary">Add a perfume</a>
           <a href="#profile/${encodeURIComponent(me.username)}" class="btn btn--ghost">My profile</a>
         </div>`
      : `<button class="btn btn--primary btn--block" data-auth="signup">Join the community — it’s free</button>`;
  }

  // Signed-out visitors only get "Home"; the other sections are for members
  function applyAuthState() {
    const signedIn = !!session.user;
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
    if (perfumes.length) renderTrending();
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
      p.real = res.stats;
      if (liked) session.likes.add(p.id); else session.likes.delete(p.id);
      toast(liked ? "Added to your liked perfumes" : "Removed from your liked perfumes");
    } catch (err) {
      setUI(!liked);
      toast(err.message);
    }
  }

  function initAccounts() {
    // Lock icons for members-only nav links (shown only while signed out)
    $$("[data-members-only]").forEach((link) => link.insertAdjacentHTML("afterbegin", LOCK_ICON));

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
    document.title = `${title} — LUMIERE`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function showHome() {
    homeSeen = true;
    renderCurrent = null;
    const view = $("#perfumeView");
    if (view.hidden) return;
    view.hidden = true;
    view.innerHTML = "";
    $("main").hidden = false;
    document.title = "LUMIERE — Fragrance discovery & community";
    const target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
    else window.scrollTo({ top: returnScroll, behavior: "instant" });
  }

  function showPerfume(p, token) {
    editingReview = false;
    renderCurrent = () => renderPerfumePage(p);
    showView(renderCurrent(), `${p.brand ? p.brand + " " : ""}${p.name}`);
    if (pendingSection === "reviews") $("#pvReviews").scrollIntoView({ behavior: "instant" });
    pendingSection = null;
    if (!p.realReviews) loadRealReviews(p).then(() => { if (token === routeToken) refreshPage(); });
  }

  async function showProfile(username, token) {
    if (!profileData || profileData.user.username !== username.toLowerCase()) {
      profileTab = "liked";
      editingProfile = false;
    }
    renderCurrent = null;
    showView(`<div class="container pv"><p class="pv__empty">Loading profile…</p></div>`, `@${username}`);
    try {
      const data = await api(`/users/${encodeURIComponent(username)}`);
      if (token !== routeToken) return;
      profileData = data;
      renderCurrent = renderProfilePage;
      refreshPage();
      document.title = `${data.user.displayName} (@${data.user.username}) — LUMIERE`;
    } catch (err) {
      if (token !== routeToken) return;
      $("#perfumeView").innerHTML = `
        <div class="container pv">
          <nav class="pv__crumbs">${BACK_BUTTON}</nav>
          <p class="pv__empty">${err.status === 404 ? `We couldn't find @${escapeHTML(username)}.` : escapeHTML(err.message)}</p>
        </div>`;
    }
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
    showHome();
  }

  // Re-render the open page in place (keeps the scroll position)
  function refreshPage() {
    if (!renderCurrent) return;
    const y = window.scrollY;
    $("#perfumeView").innerHTML = renderCurrent();
    window.scrollTo({ top: y, behavior: "instant" });
  }

  // Keep card ratings in sync after you post or delete a review
  function refreshCardRatings(p) {
    $$(`.perfume-card[data-perfume="${p.id}"] .rating`).forEach((el) => { el.outerHTML = ratingRow(p); });
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
      const res = await api(`/perfumes/${encodeURIComponent(p.id)}/review`, { method: "PUT", body: { rating, text } });
      p.real = res.stats;
      await loadRealReviews(p);
      editingReview = false;
      refreshPage();
      refreshCardRatings(p);
      toast(wasEditing ? "Your review was updated" : "Thanks! Your review was posted");
    } catch (err) {
      error.textContent = err.message;
      $("button[type=submit]", form).disabled = false;
    }
  }

  async function deleteReview(p) {
    try {
      const res = await api(`/perfumes/${encodeURIComponent(p.id)}/review`, { method: "DELETE" });
      p.real = res.stats;
      await loadRealReviews(p);
      editingReview = false;
      refreshPage();
      refreshCardRatings(p);
      toast("Your review was deleted");
    } catch (err) {
      toast(err.message);
    }
  }

  function initPages() {
    const view = $("#perfumeView");

    // Open a perfume by clicking anywhere on its card (buttons keep their own actions)
    document.addEventListener("click", (e) => {
      const card = e.target.closest(".perfume-card[data-perfume]");
      if (!card || e.target.closest("button, a")) return;
      openPerfume(card.dataset.perfume);
    });

    view.addEventListener("click", (e) => {
      if (e.target.closest("[data-back]")) {
        // Came from the site -> real Back; opened a shared link directly -> go home
        if (homeSeen) history.back();
        else location.hash = "";
        return;
      }

      // ----- Profile page -----
      const tab = e.target.closest("[data-profile-tab]");
      if (tab) { profileTab = tab.dataset.profileTab; refreshPage(); return; }
      if (e.target.closest("[data-edit-profile]")) { editingProfile = true; refreshPage(); $("#profileForm input").focus(); return; }
      if (e.target.closest("[data-cancel-profile]")) { editingProfile = false; refreshPage(); return; }

      // ----- Add a perfume -----
      if (e.target.closest("#photoRemove")) { choosePhoto(null); return; }

      // ----- Perfume page -----
      const p = currentPerfume();
      if (!p) return;

      const agree = e.target.closest("[data-agree]");
      if (agree) {
        const key = agree.dataset.agree;
        updateMine(p.id, (m) => {
          m.agree = m.agree.includes(key) ? m.agree.filter((k) => k !== key) : [...m.agree, key];
        });
        refreshPage();
        return;
      }

      const perf = e.target.closest("[data-perf]");
      if (perf) {
        const [key, level] = perf.dataset.perf.split(":");
        let removed = false;
        updateMine(p.id, (m) => {
          removed = m.perf[key] === Number(level);
          m.perf = { ...m.perf };
          if (removed) delete m.perf[key];
          else m.perf[key] = Number(level);
        });
        refreshPage();
        toast(removed ? "Vote removed" : "Thanks for voting!");
        return;
      }

      const wear = e.target.closest("[data-wear]");
      if (wear) {
        const k = wear.dataset.wear;
        updateMine(p.id, (m) => { m.wear = m.wear.includes(k) ? m.wear.filter((x) => x !== k) : [...m.wear, k]; });
        refreshPage();
        return;
      }

      const star = e.target.closest("[data-star]");
      if (star) { setStarInput(star.closest("form"), Number(star.dataset.star)); return; }

      if (e.target.closest("[data-write-review]")) {
        $("#pvReviews").scrollIntoView({ behavior: "smooth" });
        const textarea = $("#reviewForm textarea");
        if (textarea) textarea.focus({ preventScroll: true });
        return;
      }
      if (e.target.closest("[data-edit-review]")) { editingReview = true; refreshPage(); $("#reviewForm textarea").focus(); return; }
      if (e.target.closest("[data-cancel-edit]")) { editingReview = false; refreshPage(); return; }
      if (e.target.closest("[data-delete-review]")) { deleteReview(p); }
    });

    view.addEventListener("input", (e) => {
      if (e.target.matches("#reviewForm textarea")) {
        $("#charCount").textContent = `${e.target.value.length} / 1000`;
        $("#composerError").textContent = "";
      }
      if (e.target.matches("#addForm [name=brand], #addForm [name=name]")) {
        e.target.removeAttribute("aria-invalid");
        checkDuplicateSoon(e.target.form);
      }
    });

    view.addEventListener("change", (e) => {
      if (e.target.id === "photoInput") choosePhoto(e.target.files[0] || null);
    });

    view.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      if (form.id === "reviewForm") return saveReview(currentPerfume(), form);
      if (form.id === "addForm") return submitAddForm(form);
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
     Init
     ======================================================= */
  document.addEventListener("DOMContentLoaded", async () => {
    $("#onlineAvatars").innerHTML = onlineUsers.map((u) => avatar(u)).join("");
    $("#topReviewers").innerHTML = topReviewers.map(reviewerItem).join("");
    $("#year").textContent = new Date().getFullYear();

    // Broken photo -> show the illustrated bottle in the same frame
    document.addEventListener("error", (e) => {
      if (e.target.matches && e.target.matches("img.perfume-media__img")) {
        e.target.closest(".perfume-media").classList.add("is-broken");
      }
    }, true);

    initSearch();
    initSocial();
    initActivity();
    initNav();
    initAccounts();
    initPages();

    // Who is signed in + the perfume list (catalog and member-added perfumes)
    const [me, list] = await Promise.allSettled([api("/auth/me"), api("/perfumes")]);
    setSession(me.status === "fulfilled" ? me.value : null);
    if (list.status === "fulfilled") {
      perfumes = list.value.perfumes.map((rec) => buildPerfume(rec, list.value.stats[rec.slug]));
    } else {
      $("#trendingEmpty").textContent = "We couldn't load the perfumes right now. Please refresh the page in a moment.";
    }

    applyAuthState();
    $("#reviewList").innerHTML = reviews.filter((r) => byId(r.perfume)).map(reviewCard).join("");
    initTrending();

    window.addEventListener("hashchange", route);
    route();
  });
})();
