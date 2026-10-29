import React from "react";
import { Icon } from "./Icon";
import { isMe } from "../../store/session";
import { toggleHelpful } from "../../store/community";

export function HelpfulButton({ review }) {
  const mine = !!review.user && isMe(review.user.username);
  return (
    <button
      className="social-btn"
      data-helpful={review.id}
      aria-pressed={String(!!review.likedByMe)}
      disabled={mine}
      aria-label="Mark review as helpful"
      title={mine ? "Your review" : "Helpful"}
      onClick={() => toggleHelpful(review)}
    >
      <Icon name="thumb" /><span>{review.likes || 0}</span> <span className="social-btn__label">Helpful</span>
    </button>
  );
}
