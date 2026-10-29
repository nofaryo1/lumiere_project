import React from "react";
import { ReviewerRow } from "./ReviewerRow";

export function ReviewerList({ reviewers, error, session, pending, onFollow }) {
  let body;
  if (error) body = <li className="activity__empty">{error}</li>;
  else if (!reviewers) body = <li className="activity__empty">Loading…</li>;
  else if (!reviewers.length) body = <li className="activity__empty">No reviews yet this month — be the first!</li>;
  else {
    body = reviewers.map((r) => (
      <ReviewerRow
        key={r.username}
        reviewer={r}
        isMe={!!(session.user && session.user.username === r.username)}
        following={r.username in pending ? pending[r.username] : session.following.has(r.username)}
        busy={r.username in pending}
        onFollow={onFollow}
      />
    ));
  }
  return <ul className="reviewers" aria-live="polite">{body}</ul>;
}
