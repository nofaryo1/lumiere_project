import React from "react";
import { formatCount } from "../../lib/format";
import { AvatarLink, MemberLink } from "../common/Avatar";
import { FollowButton } from "./FollowButton";

export function ReviewerRow({ reviewer, isMe, following, busy, onFollow }) {
  return (
    <li className="reviewer">
      <AvatarLink user={reviewer} />
      <div>
        <p className="reviewer__name"><MemberLink user={reviewer} /></p>
        <p className="reviewer__meta">
          {`${reviewer.reviews} review${reviewer.reviews === 1 ? "" : "s"} this month · ${formatCount(reviewer.followers)} followers`}
        </p>
      </div>
      {isMe ? null : <FollowButton following={following} busy={busy} onClick={() => onFollow(reviewer.username)} />}
    </li>
  );
}
