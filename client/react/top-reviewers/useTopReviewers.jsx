import { useState, useEffect, useCallback } from "../shared/react";
import { app } from "../shared/lumiere";

// This month's top reviewers, kept up to date with the rest of the page (login, follows, new reviews)
export function useTopReviewers() {
  const [reviewers, setReviewers] = useState(null);
  const [error, setError] = useState("");
  const [session, setSession] = useState(app.getSession());
  const [pending, setPending] = useState({});

  const load = useCallback(async () => {
    try {
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
    const onFollow = (e) => {
      const { username, followers } = e.detail;
      setSession(app.getSession());
      setReviewers((list) => list && list.map((u) => (u.username === username ? { ...u, followers } : u)));
    };
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

  const follow = useCallback(async (username) => {
    const current = app.getSession().following.has(username);
    if (app.getSession().user) setPending((p) => ({ ...p, [username]: !current }));
    await app.toggleFollow(username);
    setSession(app.getSession());
    setPending((p) => { const next = { ...p }; delete next[username]; return next; });
  }, []);

  return { reviewers, error, session, pending, follow };
}
