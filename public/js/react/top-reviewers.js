
(function () {
  "use strict";

  const { useState, useEffect, useCallback } = React;
  const h = React.createElement;
  const app = window.Lumiere;

  function Avatar({ user }) {
    const a = app.avatarFor(user);
    return h("span", {
      className: "avatar",
      style: { "--avatar-bg": a.bg, "--avatar-fg": a.fg },
      "aria-hidden": "true",
    }, a.initials);
  }

  function FollowButton({ following, busy, onClick }) {
    return h("button", {
      type: "button",
      className: "btn btn--ghost btn--sm btn--follow",
      "aria-pressed": String(following),
      "aria-busy": busy ? "true" : undefined,
      disabled: busy,
      onClick,
    }, following ? "Following" : "Follow");
  }

  function ReviewerRow({ reviewer, isMe, following, busy, onFollow }) {
    const href = `#profile/${encodeURIComponent(reviewer.username)}`;
    return h("li", { className: "reviewer" },
      h("a", { href, "aria-hidden": "true", tabIndex: -1 }, h(Avatar, { user: reviewer })),
      h("div", null,
        h("p", { className: "reviewer__name" },
          h("a", { className: "member-link", href }, reviewer.displayName)),
        h("p", { className: "reviewer__meta" },
          `${reviewer.reviews} review${reviewer.reviews === 1 ? "" : "s"} this month · ${app.formatCount(reviewer.followers)} followers`)),
      isMe ? null : h(FollowButton, { following, busy, onClick: () => onFollow(reviewer.username) }));
  }

  function TopReviewers() {
    const [reviewers, setReviewers] = useState(null);   // null = loading
    const [error, setError] = useState("");
    const [session, setSession] = useState(app.getSession());
    const [pending, setPending] = useState({});          // username -> optimistic follow state

    const load = useCallback(async () => {
      try {
        // top 4 by reviews submitted during the current month
        const res = await app.api("/members/top?period=month&limit=4");
        setReviewers(res.users);
        setError("");
      } catch (err) {
        setError(err.message);
      }
    }, []);

    useEffect(() => {
      if (app.isReady()) load();
      const onReady = () => { setSession(app.getSession()); load(); };
      const onAuth = () => { setSession(app.getSession()); setPending({}); load(); };
      // a follow changed anywhere on the page (here, a review card, a profile…)
      const onFollow = (e) => {
        const { username, followers } = e.detail;
        setSession(app.getSession());
        setReviewers((list) => list && list.map((u) => (u.username === username ? { ...u, followers } : u)));
      };
      // re-rank when anyone posts or deletes a review (live), and once a minute as a fallback
      const onReviews = () => load();
      const timer = setInterval(load, 60 * 1000);
      document.addEventListener("lumiere:ready", onReady);
      document.addEventListener("lumiere:auth", onAuth);
      document.addEventListener("lumiere:follow", onFollow);
      document.addEventListener("lumiere:reviews-changed", onReviews);
      return () => {
        clearInterval(timer);
        document.removeEventListener("lumiere:ready", onReady);
        document.removeEventListener("lumiere:auth", onAuth);
        document.removeEventListener("lumiere:follow", onFollow);
        document.removeEventListener("lumiere:reviews-changed", onReviews);
      };
    }, [load]);

    const onFollow = useCallback(async (username) => {
      const current = app.getSession().following.has(username);
      if (app.getSession().user) setPending((p) => ({ ...p, [username]: !current }));
      await app.toggleFollow(username);   // opens the sign-up window when signed out
      setSession(app.getSession());
      setPending((p) => { const next = { ...p }; delete next[username]; return next; });
    }, []);

    let body;
    if (error) body = h("li", { className: "activity__empty" }, error);
    else if (!reviewers) body = h("li", { className: "activity__empty" }, "Loading…");
    else if (!reviewers.length) body = h("li", { className: "activity__empty" }, "No reviews yet this month — be the first!");
    else {
      body = reviewers.map((r) => h(ReviewerRow, {
        key: r.username,
        reviewer: r,
        isMe: !!(session.user && session.user.username === r.username),
        following: r.username in pending ? pending[r.username] : session.following.has(r.username),
        busy: r.username in pending,
        onFollow,
      }));
    }

    return h("div", { className: "panel" },
      h("div", { className: "panel__head" },
        h("h2", { className: "panel__title" }, "Top reviewers"),
        h("span", { className: "panel__meta" }, new Date().toLocaleDateString("en-US", { month: "long" }))),
      h("ul", { className: "reviewers", "aria-live": "polite" }, body));
  }

  const container = document.getElementById("topReviewersRoot");
  if (container && app) ReactDOM.createRoot(container).render(h(TopReviewers));
})();
