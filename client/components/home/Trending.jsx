import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import $ from "jquery";
import { app } from "../../store/app";
import { families, rankedPerfumes, matchesQuery } from "../../store/catalog";
import { PERIOD_LABEL, filterOptions, hasPerfumeFilters, matchesPerfumeFilters, setTrending, setFamily, runSearch, clearFilters } from "../../store/trending";
import { PerfumeCard } from "../common/PerfumeCard";
import { Icon } from "../common/Icon";
import { NotesFilter } from "./NotesFilter";

const PERIODS = [["week", "This week"], ["month", "This month"], ["all", "All time"]];

function FilterBar() {
  const { ready, perfumes, trending } = app.use();
  if (!ready) return <div className="filter-bar" id="filterBar" role="group" aria-label="Filter by scent family" />;
  const used = families.filter((f) => trending.family === f.key || perfumes.some((p) => p.tags.includes(f.key)));
  return (
    <div className="filter-bar" id="filterBar" role="group" aria-label="Filter by scent family">
      {[{ key: "all", name: "All" }, ...used].map((f) => {
        const count = f.key === "all" ? perfumes.length : perfumes.filter((p) => p.tags.includes(f.key)).length;
        return (
          <button key={f.key} className="tag" data-family={f.key} aria-pressed={String(trending.family === f.key)} onClick={() => setFamily(f.key)}>
            {f.name}<span className="tag__count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function PerfumeFilters() {
  const { ready, trending } = app.use();
  const { brands, brandKeys, noteNames } = filterOptions();

  // a brand that no longer has perfumes on the site stops filtering
  useEffect(() => {
    if (ready && trending.brand && !brandKeys.has(trending.brand)) setTrending({ brand: "" });
  });

  return (
    <div className="filter-fields" id="perfumeFilters" role="group" aria-label="Refine perfumes">
      <label className="filter-field">
        <span>Brand</span>
        <select id="filterBrand" value={trending.brand} onChange={(e) => setTrending({ brand: e.target.value })}>
          <option value="">All brands</option>
          {ready ? brands.map(([k, name]) => <option key={k} value={k}>{name}</option>) : null}
        </select>
      </label>
      <NotesFilter noteNames={noteNames} />
      <label className="filter-field">
        <span>Rating</span>
        <select id="filterRating" value={trending.rating || ""} onChange={(e) => setTrending({ rating: Number(e.target.value) || 0 })}>
          <option value="">Any rating</option>
          {ready ? [5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{`${n}★`}</option>) : null}
        </select>
      </label>
      <button type="button" className="link link--btn filter-fields__clear" id="clearPerfumeFilters"
              hidden={!ready || (!hasPerfumeFilters() && trending.family === "all")} onClick={clearFilters}>Clear filters</button>
    </div>
  );
}

function useCarousel(trackRef, deps, enabled) {
  const [status, setStatus] = useState({ text: "", prev: false, next: false });

  const metrics = () => {
    const track = trackRef.current;
    const first = track.firstElementChild;
    if (!first) return { track, step: 1, perView: 0, total: 0 };
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = first.getBoundingClientRect().width + gap;
    return { track, step, perView: Math.max(1, Math.floor((track.clientWidth + gap) / step)), total: track.children.length };
  };

  const update = () => {
    if (!enabled.current || !trackRef.current.clientWidth) return;   // not while the home page is hidden
    const { track, step, perView, total } = metrics();
    const start = total ? Math.round(track.scrollLeft / step) + 1 : 0;
    const end = Math.min(total, start + perView - 1);
    setStatus({
      text: total ? `${start}–${end} of ${total}` : "",
      prev: track.scrollLeft <= 2,
      next: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2,
    });
  };

  const scroll = (direction) => {
    const { track, step, perView } = metrics();
    track.scrollBy({ left: direction * step * perView, behavior: "smooth" });
  };

  useLayoutEffect(update, deps);
  useEffect(() => {
    $(window).on("resize", update);
    return () => $(window).off("resize", update);
  }, []);

  return { status, update, scroll };
}

export function Trending() {
  const { ready, perfumes, perfumesFailed, trending, view } = app.use();
  const trackRef = useRef(null);

  let list = ready ? rankedPerfumes(trending.period) : [];
  const ranks = new Map(list.map((p, i) => [p.id, i + 1]));
  if (trending.family !== "all") list = list.filter((p) => p.tags.includes(trending.family));
  list = list.filter(matchesPerfumeFilters);
  if (trending.query) list = list.filter((p) => matchesQuery(p, trending.query));

  let title = "Trending perfumes";
  let sub = PERIOD_LABEL[trending.period];
  if (trending.query) {
    title = "Search results";
    sub = <>{`${list.length} result${list.length === 1 ? "" : "s"} for “${trending.query}” · `}<button className="link link--btn" id="clearSearch" onClick={() => runSearch("")}>Clear search</button></>;
  } else if (hasPerfumeFilters()) {
    sub = `${list.length} perfume${list.length === 1 ? " matches" : "s match"} your filters`;
  }

  // a new filter or search starts the carousel from the first perfume
  useLayoutEffect(() => { trackRef.current.scrollTo({ left: 0, behavior: "instant" }); }, [trending.scrollSeq]);
  const enabled = useRef(false);
  enabled.current = ready;
  const carousel = useCarousel(trackRef, [ready, list.length, perfumes, trending.scrollSeq, !view], enabled);

  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); carousel.scroll(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); carousel.scroll(-1); }
  };

  return (
    <section className="section" id="trending">
      <div className="container">
        <div className="section-head">
          <div>
            <h2 className="section-title">{title}</h2>
            <p className="section-sub">{sub}</p>
          </div>
          <div className="section-head__actions">
            <div className="segmented" role="tablist" aria-label="Trending period" id="trendTabs">
              {PERIODS.map(([key, label]) => (
                <button key={key} role="tab" aria-selected={String(trending.period === key)} data-period={key} onClick={() => setTrending({ period: key })}>{label}</button>
              )).reduce((acc, el, i) => (i ? [...acc, " ", el] : [el]), [])}
            </div>
            <div className="carousel-controls">
              <span className="carousel-controls__status" id="trendStatus" aria-live="polite">{carousel.status.text}</span>
              <button className="icon-btn" id="trendPrev" aria-label="Previous perfumes" disabled={carousel.status.prev} onClick={() => carousel.scroll(-1)}>
                <Icon name="back" />
              </button>
              <button className="icon-btn" id="trendNext" aria-label="Next perfumes" disabled={carousel.status.next} onClick={() => carousel.scroll(1)}>
                <Icon name="next" />
              </button>
            </div>
          </div>
        </div>

        <FilterBar />
        <PerfumeFilters />

        <div className="carousel" id="trendingGrid" tabIndex={0} aria-label="Trending perfumes, scroll sideways for more"
             ref={trackRef} onScroll={carousel.update} onKeyDown={onKeyDown}>
          {list.map((p) => <PerfumeCard key={p.id} p={p} rank={trending.query ? null : ranks.get(p.id)} />)}
        </div>
        <p className="empty-state" id="trendingEmpty" hidden={!ready || list.length > 0}>
          {perfumesFailed ? "We couldn't load the perfumes right now. Please refresh the page in a moment." : "No perfumes match this filter yet."}
        </p>
      </div>
    </section>
  );
}
