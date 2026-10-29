import React from "react";
import { hash, formatCount } from "../../lib/format";
import { AVATAR_TONES } from "../common/Avatar";
import { toggleMembership } from "../../store/groups";

const GROUP_TONES = {
  woody: ["#f1ebe3", "#7a5a37"], floral: ["#f7e9ec", "#9a4a5c"], fresh: ["#e5f1ef", "#2f6f68"], amber: ["#f6ecdc", "#8a5a1c"],
  citrus: ["#f7f1d9", "#7a6512"], musk: ["#eef0ef", "#4b5f66"], spicy: ["#f6e6df", "#93492c"], gourmand: ["#f1e7e1", "#6e4330"],
};

const groupTone = (g) => GROUP_TONES[g.family] || AVATAR_TONES[hash(g.slug) % AVATAR_TONES.length];

export function GroupIcon({ g, size = "" }) {
  const [bg, fg] = groupTone(g);
  const letters = g.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <span className={`group-icon ${size}`} style={{ "--g-bg": bg, "--g-fg": fg }} aria-hidden="true">{letters}</span>;
}

export function JoinButton({ g, extra = "" }) {
  return (
    <button className={`btn btn--sm ${g.isMember ? "btn--ghost" : "btn--primary"} ${extra}`} data-join={g.slug} aria-pressed={String(!!g.isMember)}
            onClick={() => toggleMembership(g.slug)}>
      {g.isMember ? "Joined" : "Join"}
    </button>
  );
}

export function GroupCard({ g }) {
  const open = (e) => { if (!e.target.closest("button, a")) location.hash = `group/${g.slug}`; };
  return (
    <article className="group-card" data-group={g.slug} onClick={open}>
      <div className="group-card__top">
        <GroupIcon g={g} />
        <JoinButton g={g} />
      </div>
      <h3 className="group-card__name"><a href={`#group/${encodeURIComponent(g.slug)}`}>{g.name}</a></h3>
      <p className="group-card__desc">{g.description}</p>
      <p className="group-card__meta"><span data-members-of={g.slug}>{formatCount(g.members)}</span>{` members · ${formatCount(g.postsThisWeek)} posts this week`}</p>
    </article>
  );
}
