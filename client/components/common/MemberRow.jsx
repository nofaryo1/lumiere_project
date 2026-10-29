import React from "react";
import { AvatarLink, MemberLink } from "./Avatar";
import { FollowButton } from "./FollowButton";

export function MemberRow({ user }) {
  return (
    <li className="member-row">
      <AvatarLink user={user} />
      <div className="member-row__info">
        <p className="member-row__name"><MemberLink user={user} /></p>
        <p className="member-row__meta">{`@${user.username}${user.bio ? ` · ${user.bio}` : ""}`}</p>
      </div>
      <FollowButton username={user.username} />
    </li>
  );
}
