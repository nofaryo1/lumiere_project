import React from "react";
import { byId } from "../../store/app";
import { timeAgo } from "../../lib/format";
import { AvatarLink, MemberLink } from "../common/Avatar";

function GroupLink({ group }) {
  return <a className="activity__perfume" href={`#group/${encodeURIComponent(group.slug)}`}>{group.name}</a>;
}

function ActivityText({ a }) {
  const p = a.perfume && byId(a.perfume);
  const perfume = p ? <a className="activity__perfume" href={`#perfume/${p.id}`}>{`${p.brand ? p.brand + " " : ""}${p.name}`}</a> : "a perfume";
  switch (a.type) {
    case "review": return <>{" rated "}{perfume}{" "}<span className="activity__stars">{`★ ${a.rating}`}</span></>;
    case "like": return <>{" liked "}{perfume}</>;
    case "follow": return <>{" started following "}<MemberLink user={a.target} /></>;
    case "added": return <>{" added "}{perfume}{" to LUMIERE"}</>;
    case "joined": return <>{" joined "}<GroupLink group={a.group} /></>;
    case "posted": return <>{" posted in "}<GroupLink group={a.group} /></>;
    default: return null;
  }
}

export function ActivityItem({ a }) {
  return (
    <li className="activity__item">
      <AvatarLink user={a.user} size="avatar--sm" />
      <p><MemberLink user={a.user} /><ActivityText a={a} /><span className="activity__time">{timeAgo(a.at)}</span></p>
    </li>
  );
}
