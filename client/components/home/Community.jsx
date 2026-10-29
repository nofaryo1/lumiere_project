import React from "react";
import { app } from "../../store/app";
import { setActivityScope } from "../../store/community";
import { memberGuess } from "../../store/session";
import { ReviewCard } from "../reviews/ReviewCard";
import { ActivityItem } from "../reviews/ActivityItem";
import { TopReviewers } from "../reviewers/TopReviewers";

function PopularReviews() {
  const { community } = app.use();
  let body = null;
  if (community.popularError) body = <p className="pv__empty">{community.popularError}</p>;
  else if (community.popular) {
    const cards = community.popular.map((r) => <ReviewCard key={r.id} review={r} />);
    body = community.popular.length ? cards : <p className="pv__empty">No reviews yet.</p>;
  }
  return <div className="review-list" id="reviewList">{body}</div>;
}

function ActivityFeed() {
  const { community } = app.use();
  const a = community.activity;
  let body = null;
  if (a && a.error) body = <li className="activity__empty">{a.error}</li>;
  else if (a && a.scope === "following" && !a.followingCount) {
    body = <li className="activity__empty">You're not following anyone yet. Tap <strong>Follow</strong> on a reviewer to see their activity here.</li>;
  } else if (a) {
    body = a.items.length ? a.items.map((item, i) => <ActivityItem key={i} a={item} />) : <li className="activity__empty">No activity yet.</li>;
  }
  return <ul className={`activity${community.activityLoading ? " is-loading" : ""}`} id="activityFeed">{body}</ul>;
}

export function Community() {
  const { community } = app.use();
  const scope = community.activityScope;
  return (
    <section className="section section--alt">
      <div className="container two-col">
        <div id="reviews">
          <div className="section-head">
            <div>
              <h2 className="section-title">Popular reviews</h2>
              <p className="section-sub">The reviews members found most helpful</p>
            </div>
            <a href="#all-reviews" className="link">See all reviews</a>
          </div>
          <PopularReviews />
        </div>

        <aside className="sidebar" id="activity">
          <div className="panel">
            <div className="panel__head">
              <h2 className="panel__title" id="activityTitle">{scope === "following" ? "People you follow" : "Community activity"}</h2>
              <span className="live-dot" aria-label="Live" />
            </div>
            <div className="segmented activity-tabs" id="activityTabs" role="tablist" aria-label="Whose activity" hidden={!memberGuess()}>
              <button role="tab" data-scope="following" aria-selected={String(scope === "following")} onClick={() => setActivityScope("following")}>Following</button>{" "}
              <button role="tab" data-scope="all" aria-selected={String(scope === "all")} onClick={() => setActivityScope("all")}>Everyone</button>
            </div>
            <ActivityFeed />
          </div>

          <div id="topReviewersRoot"><TopReviewers /></div>
        </aside>
      </div>
    </section>
  );
}
