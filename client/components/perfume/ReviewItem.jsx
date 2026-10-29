import React from "react";
import { timeAgo } from "../../lib/format";
import { AvatarLink, MemberLink } from "../common/Avatar";
import { HelpfulButton } from "../common/HelpfulButton";
import { Stars } from "../common/Stars";
import { Icon } from "../common/Icon";

export function ReviewItem({ review: r, mine = false, onEdit, onDelete }) {
  return (
    <article className={`pv-review${mine ? " pv-review--mine" : ""}`}>
      <header className="review__head">
        <AvatarLink user={r.user} />
        <div>
          <p className="review__user"><MemberLink user={r.user} />{mine ? <> <span className="review__level">Your review</span></> : null}</p>
          <p className="review__meta">{`@${r.user.username} · ${timeAgo(r.updatedAt || r.createdAt)}`}</p>
        </div>
        <span className="pv-review__score"><Stars rating={r.rating} /><strong>{r.rating.toFixed(1)}</strong></span>
      </header>
      <p className="review__text">{r.text}</p>
      <footer className="review__actions">
        {mine ? (
          <>
            <span className="social-btn social-btn--static"><Icon name="thumb" /><span>{r.likes || 0}</span> <span className="social-btn__label">found it helpful</span></span>
            <button className="social-btn" data-edit-review={r.id} onClick={() => onEdit(r)}>Edit</button><button className="social-btn" data-delete-review={r.id} onClick={() => onDelete(r)}>Delete</button>
          </>
        ) : <HelpfulButton review={r} />}
      </footer>
    </article>
  );
}
