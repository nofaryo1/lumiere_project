import { React } from "../shared/react";
import { app } from "../shared/lumiere";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";

export function ReviewerRow({ reviewer, isMe, following, busy, onFollow }) {
  const href = `#profile/${encodeURIComponent(reviewer.username)}`;
  return (
    <li className="reviewer">
      <a href={href} aria-hidden="true" tabIndex={-1}><Avatar user={reviewer} /></a>
      <div>
        <p className="reviewer__name">
          <a className="member-link" href={href}>{reviewer.displayName}</a>
        </p>
        <p className="reviewer__meta">
          {`${reviewer.reviews} review${reviewer.reviews === 1 ? "" : "s"} this month · ${app.formatCount(reviewer.followers)} followers`}
        </p>
      </div>
      {isMe ? null : <FollowButton following={following} busy={busy} onClick={() => onFollow(reviewer.username)} />}
    </li>
  );
}
