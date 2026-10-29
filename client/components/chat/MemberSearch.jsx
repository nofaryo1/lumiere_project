import React, { useRef, useState } from "react";
import { searchMembersToMessage } from "../../store/chat";
import { Avatar } from "../common/Avatar";

// "Search members to message…" at the top of the conversation list
export function MemberSearch() {
  const [result, setResult] = useState(null);
  const timer = useRef(0);
  const inputRef = useRef(null);

  const onInput = (e) => {
    const q = e.target.value.trim();
    clearTimeout(timer.current);
    if (q.length < 2) { setResult(null); return; }
    timer.current = setTimeout(async () => {
      try {
        const users = await searchMembersToMessage(q);
        if (inputRef.current.value.trim() !== q) return;
        setResult({ q, users });
      } catch (err) {}
    }, 200);
  };

  return (
    <form className="messenger__search" data-member-search="" onSubmit={(e) => e.preventDefault()}>
      <input type="search" placeholder="Search members to message…" aria-label="Search members" autoComplete="off" ref={inputRef} onChange={onInput} />{" "}
      <div className="search-suggest" hidden={!result}>
        {result ? (result.users.length ? result.users.map((u) => (
          <a className="suggest-item" key={u.username} href={`#messages/${encodeURIComponent(u.username)}`}>
            <Avatar user={u} />
            <span><span className="suggest-item__name">{u.displayName}</span><br /><span className="suggest-item__meta">{`@${u.username}`}</span></span>
          </a>
        )) : <p className="suggest-empty">{`No members found for “${result.q}”`}</p>) : null}
      </div>
    </form>
  );
}
