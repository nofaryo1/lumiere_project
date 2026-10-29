import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api";
import { on } from "../../lib/events";
import { app } from "../../store/app";
import { toggleFollow } from "../../store/session";

// This month's top reviewers, kept up to date with the rest of the page (login, follows, new reviews)
export function useTopReviewers() {
  const { session, ready } = app.use();
  const [reviewers, setReviewers] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState({});

  const load = useCallback(async () => {
    try {
      const res = await api("/members/top?period=month&limit=4");
      setReviewers(res.users);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    load();
    const offAuth = on("auth", () => { setPending({}); load(); });
    const offFollow = on("follow", ({ username, followers }) => {
      setReviewers((list) => list && list.map((u) => (u.username === username ? { ...u, followers } : u)));
    });
    const offReviews = on("reviews-changed", load);
    const timer = setInterval(load, 60 * 1000);
    return () => { clearInterval(timer); offAuth(); offFollow(); offReviews(); };
  }, [ready, load]);

  const follow = useCallback(async (username) => {
    const current = app.state.session.following.has(username);
    if (app.state.session.user) setPending((p) => ({ ...p, [username]: !current }));
    await toggleFollow(username);
    setPending((p) => { const next = { ...p }; delete next[username]; return next; });
  }, []);

  return { reviewers, error, session, pending, follow };
}
