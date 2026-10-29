import React, { useEffect, useRef, useState } from "react";
import $ from "jquery";
import { api } from "../../lib/api";
import { app } from "../../store/app";
import { matchesQuery, ratingFor } from "../../store/catalog";
import { runSearch } from "../../store/trending";
import { openPerfume } from "../../store/router";
import { toast } from "../../store/ui";
import { SearchIcon } from "../common/Icon";
import { PerfumeMedia } from "../common/PerfumeMedia";
import { Avatar } from "../common/Avatar";

// The search box in the header and in the hero: perfumes and members as you type, @name for members only
export function SearchBox({ hero = false }) {
  const { perfumes, trending } = app.use();
  const formRef = useRef(null);
  const inputRef = useRef(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef(0);
  const request = useRef(0);

  // a search from anywhere on the page shows its words in both boxes
  useEffect(() => {
    if (!trending.searchSeq) return;
    setValue(trending.query);
    setOpen(false);
  }, [trending.searchSeq]);

  // clicking anywhere outside the search boxes closes the suggestions
  useEffect(() => {
    const close = (e) => { if (!$(e.target).closest("[data-search]").length) setOpen(false); };
    $(document).on("click", close);
    return () => $(document).off("click", close);
  }, []);

  const lookUp = (text, keepMembers) => {
    clearTimeout(timer.current);
    const q = text.trim();
    const name = q.replace(/^@/, "");
    setMembersLoading(!!name);
    setOpen(!!q);
    setActive(-1);
    if (!keepMembers) setMembers([]);
    if (!name) { setMembers([]); return; }
    timer.current = setTimeout(async () => {
      const id = ++request.current;
      try {
        const res = await api(`/members?search=${encodeURIComponent(name)}&limit=${q.startsWith("@") ? 6 : 4}`);
        if (id === request.current && inputRef.current.value.trim() === q) { setMembers(res.users); setMembersLoading(false); }
      } catch (err) {
        if (id === request.current) setMembersLoading(false);
      }
    }, 150);
  };

  const q = value.trim();
  const hits = !q || q.startsWith("@") ? [] : perfumes.filter((p) => matchesQuery(p, q)).slice(0, 5);
  const items = [...hits.map((p) => ({ perfume: p })), ...members.map((u) => ({ user: u }))];

  const choose = (item) => {
    setOpen(false);
    inputRef.current.blur();
    if (item.user) location.hash = `profile/${encodeURIComponent(item.user.username)}`;
    else openPerfume(item.perfume.id);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!open || !items.length || !["ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (open && items[active]) return choose(items[active]);
    if (q.startsWith("@") && q.length > 1) {
      const res = await api(`/members?search=${encodeURIComponent(q.slice(1))}&limit=1`).catch(() => ({ users: [] }));
      if (res.users[0]) { setOpen(false); inputRef.current.blur(); location.hash = `profile/${encodeURIComponent(res.users[0].username)}`; }
      else toast(`No members match “${q}”`);
      return;
    }
    runSearch(value);
  };

  let index = -1;
  const row = (item, body) => {
    index += 1;
    const i = index;
    return (
      <button type="button" key={item.user ? `u:${item.user.username}` : `p:${item.perfume.id}`}
              className={`suggest-item${i === active ? " is-active" : ""}`}
              data-id={item.perfume ? item.perfume.id : undefined} data-user={item.user ? item.user.username : undefined}
              onClick={() => choose(item)}>
        {body}
      </button>
    );
  };
  const perfumeRows = hits.map((p) => {
    const r = ratingFor(p);
    const meta = [p.brand, p.notes.slice(0, 2).join(", ")].filter(Boolean).join(" · ");
    return row({ perfume: p }, <>
      <PerfumeMedia p={p} size="xs" />
      <span><span className="suggest-item__name">{p.name}</span><br /><span className="suggest-item__meta">{meta}</span></span>
      <span className="suggest-item__rating">{r.count ? `★ ${r.avg.toFixed(1)}` : ""}</span>
    </>);
  });
  const memberRows = members.map((u) => row({ user: u }, <>
    <Avatar user={u} />
    <span><span className="suggest-item__name">{u.displayName}</span><br /><span className="suggest-item__meta">{`@${u.username}`}</span></span>
  </>));

  let suggestions = null;
  if (perfumeRows.length || memberRows.length) {
    suggestions = <>
      {perfumeRows.length ? <><p className="suggest-group">Perfumes</p>{perfumeRows}</> : null}
      {memberRows.length ? <><p className="suggest-group">Members</p>{memberRows}</> : null}
    </>;
  } else if (membersLoading) suggestions = <p className="suggest-empty">Searching members…</p>;
  else suggestions = <p className="suggest-empty">{`Nothing found for “${q}”`}</p>;

  return (
    <form className={hero ? "hero-search" : "header-search"} role="search" data-search="" ref={formRef} onSubmit={onSubmit}>
      <SearchIcon className={hero ? "hero-search__icon" : "header-search__icon"} />{" "}
      <input
        ref={inputRef}
        type="search"
        placeholder={hero ? "Search perfumes, brands, notes or @members…" : "Search perfumes, notes or members…"}
        aria-label="Search perfumes, brands, notes and members"
        autoComplete="off"
        value={value}
        onChange={(e) => { setValue(e.target.value); lookUp(e.target.value, false); }}
        onFocus={(e) => lookUp(e.target.value, true)}
        onKeyDown={onKeyDown}
      />{" "}
      {hero ? <button type="submit" className="btn btn--primary">Search</button> : null}
      <div className="search-suggest" hidden={!(open && q)}>{open && q ? suggestions : null}</div>
    </form>
  );
}
