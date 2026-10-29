import React from "react";
import { byId } from "../../store/app";
import { share } from "../../store/ui";
import { timeAgo } from "../../lib/format";
import { AvatarLink, MemberLink } from "../common/Avatar";
import { FollowButton } from "../common/FollowButton";
import { HelpfulButton } from "../common/HelpfulButton";
import { PerfumeMedia } from "../common/PerfumeMedia";
import { Stars } from "../common/Stars";
import { Icon } from "../common/Icon";

export function ReviewCard({ review: r }) {
  const p = byId(r.perfume);
  if (!p || !r.user) return null;
  return (
    <article className="review">
      <header className="review__head">
        <AvatarLink user={r.user} />
        <div>
          <p className="review__user"><MemberLink user={r.user} /></p>
          <p className="review__meta">{`@${r.user.username} · ${timeAgo(r.createdAt)}`}</p>
        </div>
        <FollowButton username={r.user.username} extra="review__follow" />
      </header>

      <a href={`#perfume/${p.id}`} className="review__perfume">
        <PerfumeMedia p={p} size="sm" />
        <div>
          <p className="review__perfume-name">{p.name}</p>
          <p className="review__perfume-brand">{p.brand}</p>
        </div>
        <div className="review__score" aria-label={`Rated ${r.rating} out of 5`}>
          <span className="rating__score">{r.rating.toFixed(1)}</span>{" "}
          <Stars rating={r.rating} />
        </div>
      </a>

      <p className="review__text">{r.text}</p>

      <footer className="review__actions">
        <HelpfulButton review={r} />
        <button className="social-btn" data-action="share" data-share={`#perfume/${p.id}`} aria-label="Share review" onClick={() => share(`#perfume/${p.id}`)}>
          <Icon name="share" /><span>Share</span>
        </button>
      </footer>
    </article>
  );
}
