import React from "react";
import { app } from "../../store/app";
import { loadMembers, setMembersQuery } from "../../store/members";
import { Crumbs } from "../common/BackButton";
import { MemberRow } from "../common/MemberRow";

export function MembersPage() {
  const { members: m } = app.use();
  const q = m.q.trim();
  let body;
  if (m.loading && !m.users.length) body = <p className="pv__empty">Loading members…</p>;
  else if (!m.users.length) body = <p className="pv__empty">{`No members match “${q}”.`}</p>;
  else body = <ul className="member-list">{m.users.map((u) => <MemberRow key={u.username} user={u} />)}</ul>;

  return (
    <div className="container pv members-page">
      <Crumbs>
        <span>Community / <strong>Members</strong></span>
      </Crumbs>
      <div className="section-head">
        <div>
          <h1 className="section-title section-title--page">Members</h1>
          <p className="section-sub">{m.loading && !m.users.length ? " " : `${m.total.toLocaleString("en-US")} member${m.total === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}`}</p>
        </div>
      </div>
      <div className="filter-fields" role="search">
        <label className="filter-field filter-field--wide">
          <span>Search members</span>
          <input id="membersQuery" type="search" value={m.q} placeholder="Name or @username" autoComplete="off" onChange={(e) => setMembersQuery(e.target.value)} />
        </label>
      </div>
      <div className={m.loading && m.users.length ? "is-loading" : ""}>{body}</div>
      {m.hasMore ? (
        <div className="all-reviews__more">
          <button className="btn btn--ghost" data-members-more="" disabled={m.loading} onClick={() => loadMembers(false)}>{m.loading ? "Loading…" : "Load more members"}</button>
        </div>
      ) : null}
    </div>
  );
}
