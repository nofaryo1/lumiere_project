import React, { useRef } from "react";
import { app } from "../../store/app";
import { families } from "../../store/catalog";
import { setGroupsFilter } from "../../store/groups";
import { openAuth } from "../../store/ui";
import { Crumbs } from "../common/BackButton";
import { GroupCard } from "./GroupCard";

export function GroupsPage() {
  const { groups, session } = app.use();
  const timer = useRef(0);
  const [typed, setTyped] = React.useState(groups.q);

  const scope = !groups.list ? null : groups.filter === "mine" ? groups.list.filter((g) => g.isMember) : groups.list;
  const q = groups.q.trim().toLowerCase();
  const searching = !!(q || groups.family);
  const list = scope && scope.filter((g) => (!groups.family || g.family === groups.family)
    && (!q || `${g.name} ${g.description}`.toLowerCase().includes(q)));

  let body;
  if (!list) body = <p className="pv__empty">Loading groups…</p>;
  else if (!list.length && searching) body = <p className="pv__empty">No groups match your search.</p>;
  else if (!list.length) body = <p className="pv__empty">You haven't joined any groups yet. Pick a few from “All groups”.</p>;
  else body = <div className="group-grid">{list.map((g) => <GroupCard key={g.slug} g={g} />)}</div>;
  const usedFamilies = families.filter((f) => groups.family === f.key || (groups.list || []).some((g) => g.family === f.key));

  return (
    <div className="container pv">
      <Crumbs>
        <span>Community / <strong>Groups</strong></span>
      </Crumbs>
      <div className="section-head">
        <div>
          <h1 className="section-title section-title--page">Discussion groups</h1>
          <p className="section-sub">Join groups about the scents you love and talk with people who get it.</p>
        </div>
        <div className="section-head__actions">
          <a className="btn btn--ghost" href="#members">Browse members</a>
          {session.user
            ? <a className="btn btn--primary" href="#create-group">Create a group</a>
            : <button className="btn btn--primary" data-auth="signup" data-reason="Join the community to join groups and start discussions."
                      onClick={() => openAuth("signup", "Join the community to join groups and start discussions.")}>Join to take part</button>}
        </div>
      </div>
      {session.user ? (
        <div className="segmented groups-filter" role="tablist" aria-label="Which groups">
          <button role="tab" aria-selected={String(groups.filter === "all")} data-groups-filter="all" onClick={() => setGroupsFilter({ filter: "all" })}>All groups</button>
          <button role="tab" aria-selected={String(groups.filter === "mine")} data-groups-filter="mine" onClick={() => setGroupsFilter({ filter: "mine" })}>
            My groups <span className="tab-count">{groups.list ? groups.list.filter((g) => g.isMember).length : 0}</span>
          </button>
        </div>
      ) : null}
      <div className="filter-fields" role="search" aria-label="Search groups">
        <label className="filter-field filter-field--wide">
          <span>Search groups</span>
          <input id="groupsQuery" type="search" value={typed} placeholder="Name or topic" autoComplete="off"
                 onChange={(e) => {
                   const value = e.target.value;
                   setTyped(value);
                   clearTimeout(timer.current);
                   timer.current = setTimeout(() => setGroupsFilter({ q: value }), 150);
                 }} />
        </label>
        <label className="filter-field">
          <span>Scent family</span>
          <select id="groupsFamily" value={groups.family} onChange={(e) => setGroupsFilter({ family: e.target.value })}>
            <option value="">All families</option>
            {usedFamilies.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
          </select>
        </label>
      </div>
      {body}
    </div>
  );
}
