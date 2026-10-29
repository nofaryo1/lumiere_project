import React from "react";
import { app } from "../../store/app";
import { GroupCard } from "../groups/GroupCard";

export function GroupsTeaser() {
  const { groups } = app.use();
  let body = <p className="pv__empty">Loading groups…</p>;
  if (groups.list) body = groups.list.length ? groups.list.slice(0, 4).map((g) => <GroupCard key={g.slug} g={g} />) : <p className="pv__empty">No groups yet.</p>;
  return (
    <section className="section" id="groups-home">
      <div className="container">
        <div className="section-head">
          <div>
            <h2 className="section-title">Discussion groups</h2>
            <p className="section-sub">Join a group about the scents you love and talk with people who get it</p>
          </div>
          <a href="#groups" className="link">Browse all groups</a>
        </div>
        <div className="group-grid group-grid--teaser" id="groupsTeaser">{body}</div>
      </div>
    </section>
  );
}
