import React from "react";
import { app, byId } from "../../store/app";
import { loadAllReviews, setReviewFilters, setReviewQuery } from "../../store/reviews";
import { Crumbs } from "../common/BackButton";
import { ReviewCard } from "./ReviewCard";

const SINCE = [["", "Any time"], ["week", "Past week"], ["month", "Past month"], ["year", "Past year"]];

function Segment({ value, label, current, attr, onPick }) {
  return <button role="tab" aria-selected={String(current === value)} {...{ [attr]: value }} onClick={() => onPick(value)}>{label}</button>;
}

export function AllReviewsPage() {
  const { allReviews: a, session } = app.use();
  const only = a.perfume ? byId(a.perfume) || { id: a.perfume, name: "this perfume" } : null;

  let body;
  if (a.loading && !a.items.length) body = <p className="pv__empty">Loading reviews…</p>;
  else if (!a.items.length) {
    body = a.scope === "following"
      ? <p className="pv__empty">No reviews from people you follow yet. Follow reviewers you like to see their reviews here.</p>
      : <p className="pv__empty">No reviews match this filter.</p>;
  } else body = <div className="review-list">{a.items.map((r) => <ReviewCard key={r.id} review={r} />)}</div>;

  return (
    <div className="container pv all-reviews">
      <Crumbs>
        {only
          ? <span>Perfumes / <a href={`#perfume/${encodeURIComponent(only.id)}`}>{only.name}</a> / <strong>Reviews</strong></span>
          : <span>Community / <strong>All reviews</strong></span>}
      </Crumbs>

      <div className="section-head">
        <div>
          <h1 className="section-title">{only ? `Reviews of ${only.name}` : "All reviews"}</h1>
          <p className="section-sub">{a.loading && !a.items.length ? " " : `${a.total.toLocaleString("en-US")} review${a.total === 1 ? "" : "s"}`}</p>
        </div>
      </div>

      <div className="all-reviews__controls">
        <div className="segmented" role="tablist" aria-label="Sort reviews">
          <Segment attr="data-reviews-sort" value="popular" label="Most helpful" current={a.sort} onPick={(sort) => setReviewFilters({ sort })} />
          <Segment attr="data-reviews-sort" value="newest" label="Newest" current={a.sort} onPick={(sort) => setReviewFilters({ sort })} />
        </div>
        {session.user ? (
          <div className="segmented" role="tablist" aria-label="Whose reviews">
            <Segment attr="data-reviews-scope" value="all" label="Everyone" current={a.scope} onPick={(scope) => setReviewFilters({ scope })} />
            <Segment attr="data-reviews-scope" value="following" label="People I follow" current={a.scope} onPick={(scope) => setReviewFilters({ scope })} />
          </div>
        ) : null}
        <div className="all-reviews__ratings" role="group" aria-label="Filter by rating">
          {["", "5", "4", "3", "2", "1"].map((r) => (
            <button key={r} className="tag" data-reviews-rating={r} aria-pressed={String(a.rating === r)} onClick={() => setReviewFilters({ rating: r })}>{r ? `${r}★` : "All ratings"}</button>
          ))}
        </div>
      </div>

      <div className="filter-fields" role="group" aria-label="Search reviews">
        <label className="filter-field">
          <span>Date</span>
          <select id="reviewsSince" value={a.since} onChange={(e) => setReviewFilters({ since: e.target.value })}>
            {SINCE.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
        <label className="filter-field filter-field--wide">
          <span>Reviewer or keyword</span>
          <input id="reviewsQuery" type="search" value={a.q} placeholder="e.g. @alice or long lasting" autoComplete="off" onChange={(e) => setReviewQuery(e.target.value)} />
        </label>
        {a.rating || a.since || a.q.trim()
          ? <button type="button" className="link link--btn filter-fields__clear" data-clear-review-filters="" onClick={() => setReviewFilters({ rating: "", since: "", q: "" })}>Clear filters</button>
          : null}
      </div>

      <div className={a.loading && a.items.length ? "is-loading" : ""}>{body}</div>

      {a.hasMore ? (
        <div className="all-reviews__more">
          <button className="btn btn--ghost" data-load-more="" disabled={a.loading} onClick={() => loadAllReviews(false)}>{a.loading ? "Loading…" : "Load more reviews"}</button>
        </div>
      ) : null}
    </div>
  );
}
