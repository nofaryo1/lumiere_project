import React from "react";
import { hash, initialsOf } from "../../lib/format";

export const AVATAR_TONES = [
  ["#e6efe9", "#3f6b56"], ["#e4ecf3", "#3d6283"], ["#efe9f3", "#6a4f83"],
  ["#f3ece4", "#83613d"], ["#e9eef0", "#4b5f66"],
];

export function Avatar({ user, size = "" }) {
  const [bg, fg] = AVATAR_TONES[(hash(user.username) % 5) % AVATAR_TONES.length];
  return (
    <span className={`avatar ${size}`} style={{ "--avatar-bg": bg, "--avatar-fg": fg }} aria-hidden="true">
      {initialsOf(user.displayName)}
    </span>
  );
}

const profileHref = (username) => `#profile/${encodeURIComponent(username)}`;

// The avatar as a link to the member's profile (hidden from screen readers; the name link follows)
export function AvatarLink({ user, size }) {
  return <a href={profileHref(user.username)} aria-hidden="true" tabIndex={-1}><Avatar user={user} size={size} /></a>;
}

export function MemberLink({ user, children }) {
  return <a className="member-link" href={profileHref(user.username)}>{children ?? user.displayName}</a>;
}
