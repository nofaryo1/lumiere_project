import React from "react";
import { app } from "../../store/app";
import { followShown, isMe, toggleFollow } from "../../store/session";

export function FollowButton({ username, extra = "" }) {
  app.use();
  if (isMe(username)) return null;
  const on = followShown(username);
  return (
    <button className={`btn btn--ghost btn--sm btn--follow ${extra}`} data-follow={username} aria-pressed={String(on)} onClick={() => toggleFollow(username)}>
      {on ? "Following" : "Follow"}
    </button>
  );
}
