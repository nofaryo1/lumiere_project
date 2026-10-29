import { React } from "../shared/react";

export function FollowButton({ following, busy, onClick }) {
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm btn--follow"
      aria-pressed={String(following)}
      aria-busy={busy ? "true" : undefined}
      disabled={busy}
      onClick={onClick}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
