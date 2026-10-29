import React from "react";
import { app } from "../../store/app";
import { families, ratingFor, rankedPerfumes, ownsPerfume } from "../../store/catalog";
import { baseDetails, similarPerfumes, STAR_LABELS, SEASONS, TIMES, setEditing, deleteReview } from "../../store/perfumePage";
import { likeShown, isLiked, toggleLike } from "../../store/session";
import { runAfterRender } from "../../store/router";
import { share } from "../../store/ui";
import { formatCount, sum } from "../../lib/format";
import { Crumbs } from "../common/BackButton";
import { PerfumeMedia } from "../common/PerfumeMedia";
import { PerfumeCard } from "../common/PerfumeCard";
import { OwnerButtons } from "../common/OwnerButtons";
import { JoinPrompt } from "../common/JoinPrompt";
import { Stars } from "../common/Stars";
import { Icon } from "../common/Icon";
import { Bars, PerfMeter, WearBlock, VerdictList } from "./Opinions";
import { ReviewItem } from "./ReviewItem";
import { Composer } from "./Composer";
import { NotesPanel } from "./NotesPanel";

const n = (x) => x.toLocaleString("en-US");

function focusComposer(smooth) {
  const section = document.getElementById("pvReviews");
  if (section) section.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  const textarea = document.querySelector("#reviewForm textarea");
  if (textarea) textarea.focus({ preventScroll: true });
}

export function PerfumePage({ p }) {
  const { session, perfumePage } = app.use();
  const base = baseDetails(p);
  const r = ratingFor(p);
  const me = session.user;
  const real = p.realReviews || [];
  const myReviews = me ? real.filter((rv) => rv.user.username === me.username) : [];
  const myReview = myReviews[0] || null;
  const editing = perfumePage.editingReview ? myReviews.find((rv) => String(rv.id) === String(perfumePage.editingReview)) : null;
  const others = real.filter((rv) => !myReviews.includes(rv));
  const rankWeek = rankedPerfumes("week").findIndex((o) => o.id === p.id) + 1;
  const breakdown = p.breakdown || [0, 0, 0, 0, 0];
  const perfVotes = sum(base.perf.longevity) + (p.perf ? p.perf.voters : 0);

  const editReview = (rv) => {
    setEditing({ editingReview: rv.id });
    runAfterRender(() => focusComposer(true));
  };

  const reviewList = [
    ...myReviews.filter((rv) => rv !== editing).map((rv) => <ReviewItem key={rv.id} review={rv} mine onEdit={editReview} onDelete={(x) => deleteReview(p, x.id)} />),
    ...others.map((rv) => <ReviewItem key={rv.id} review={rv} />),
  ];

  return (
    <div className="container pv">
      <Crumbs>
        <span>{`Perfumes${p.brand ? ` / ${p.brand}` : ""} / `}<strong>{p.name}</strong></span>
      </Crumbs>

      <section className="pv__hero">
        <div className="pv__media">
          <PerfumeMedia p={p} size="lg" />
          <span className="rank">{p.score.all ? `#${rankWeek} this week` : "New"}</span>
        </div>

        <div className="pv__info">
          {p.brand ? <p className="pv__brand">{p.brand}</p> : null}
          <h1 className="pv__name">{p.name}</h1>
          {p.addedBy ? <p className="pv__added">Added by <a href={`#profile/${encodeURIComponent(p.addedBy)}`}>{`@${p.addedBy}`}</a></p> : null}

          <div className="pv__rating">
            <span className="pv__score">{r.count ? r.avg.toFixed(1) : "–"}</span>
            <div>
              <Stars rating={r.avg} />{" "}
              <p>{r.count ? `${n(r.count)} ratings · ${n(r.reviews)} reviews` : "No ratings yet — be the first"}</p>
            </div>
          </div>

          {p.tags.length ? (
            <div className="pv__row"><span className="pv__label">Scent family</span><div className="pv__chips">
              {p.tags.map((t) => <span className="tag tag--static" key={t}>{families.find((f) => f.key === t).name}</span>)}
            </div></div>
          ) : null}
          {p.notes.length ? (
            <div className="pv__row"><span className="pv__label">Main notes</span><div className="pv__chips">
              {p.notes.map((note) => <span className="chip" key={note}>{note}</span>)}
            </div></div>
          ) : null}

          <dl className="pv__stats">
            <div><dt data-like-count={p.id}>{formatCount(p.real.likes)}</dt><dd>Likes</dd></div>
            <div><dt>{formatCount(r.reviews)}</dt><dd>Reviews</dd></div>
            <div><dt>{formatCount(p.score.week)}</dt><dd>Activity this week</dd></div>
          </dl>

          <div className="pv__actions">
            <button className="btn btn--primary" data-write-review="" onClick={() => focusComposer(true)}>Write a review</button>
            <button className="action-btn" data-action="love" data-id={p.id} aria-pressed={String(likeShown(p.id))} aria-label={`Like ${p.name}`} onClick={() => toggleLike(p)}>
              <Icon name="heart" /><span>{isLiked(p.id) ? "Liked" : "Like"}</span>
            </button>
            <button className="action-btn action-btn--icon" data-action="share" aria-label="Share" onClick={() => share()}><Icon name="share" /></button>
            {ownsPerfume(p) ? <OwnerButtons p={p} cls="action-btn" /> : null}
          </div>
        </div>
      </section>

      <div className="pv__grid">
        <div className="pv__main">
          <section className="panel verdict">
            <div className="panel__head">
              <h2 className="panel__title">Community verdict</h2>
              <span className="section-sub">Vote for the points you agree with</span>
            </div>
            <div className="verdict__cols">
              <div className="verdict__col verdict__col--pros">
                <h3>Pros</h3>
                <ul><VerdictList kind="pros" items={base.pros} p={p} /></ul>
              </div>
              <div className="verdict__col verdict__col--cons">
                <h3>Cons</h3>
                <ul><VerdictList kind="cons" items={base.cons} p={p} /></ul>
              </div>
            </div>
          </section>

          <section className="panel" id="pvReviews">
            <div className="panel__head">
              <h2 className="panel__title">Reviews <span className="section-sub">{`(${n(r.reviews)})`}</span></h2>
            </div>
            {me
              ? <Composer key={`${editing ? editing.id : "new"}:${perfumePage.composerSeq || 0}`} p={p} draft={editing} again={myReviews.length > 0} />
              : <JoinPrompt>{`Tried ${p.name}? Join the community to rate it and share your review.`}</JoinPrompt>}
            {!p.realReviews ? <p className="pv__hint">Loading member reviews…</p> : null}
            <div className="pv__reviews">
              {reviewList.length ? reviewList : (p.realReviews ? <p className="pv__empty">No reviews yet — be the first to share your opinion.</p> : null)}
            </div>
            {r.reviews > real.length && p.realReviews ? (
              <p className="pv__hint pv__hint--after">{`Showing the ${real.length} most helpful of ${n(r.reviews)} reviews · `}<a className="link" href={`#all-reviews/${encodeURIComponent(p.id)}`}>See all reviews</a></p>
            ) : null}
          </section>
        </div>

        <aside className="pv__side">
          <section className="panel notes-panel">
            <h2 className="panel__title">Notes at a glance</h2>
            <NotesPanel p={p} />
          </section>

          <section className="panel">
            <h2 className="panel__title">Rating breakdown</h2>
            <div className="pv__bars"><Bars entries={[5, 4, 3, 2, 1].map((s) => [`${s}★`, breakdown[s - 1], formatCount(breakdown[s - 1]), myReview && myReview.rating === s])} /></div>
            {myReview ? (
              <p className="pv__hint pv__hint--after">{`Your ${myReviews.length > 1 ? "latest " : ""}rating: `}<strong>{`${myReview.rating}★`}</strong>{` — ${STAR_LABELS[myReview.rating - 1]}`}</p>
            ) : null}
          </section>

          <section className="panel">
            <h2 className="panel__title">Performance</h2>
            <p className="pv__hint">{perfVotes ? `Based on ${n(perfVotes)} votes · add yours below` : "No votes yet — add yours below"}</p>
            <PerfMeter name="longevity" label="Longevity" base={base} p={p} />
            <PerfMeter name="sillage" label="Sillage" base={base} p={p} />
            <PerfMeter name="value" label="Value for money" base={base} p={p} />
          </section>

          <section className="panel">
            <h2 className="panel__title">When to wear</h2>
            <p className="pv__hint">Pick every season and time that fits</p>
            <WearBlock keys={SEASONS} base={base} p={p} />
            <div className="pv__split"><WearBlock keys={TIMES} base={base} p={p} /></div>
          </section>
        </aside>
      </div>

      <section className="pv__similar">
        <div className="section-head">
          <div>
            <h2 className="section-title">You might also like</h2>
            <p className="section-sub">{p.tags.length ? "Perfumes with a similar scent profile" : "Popular with the community"}</p>
          </div>
        </div>
        <div className="perfume-grid">{similarPerfumes(p).map((o) => <PerfumeCard key={o.id} p={o} />)}</div>
      </section>
    </div>
  );
}
