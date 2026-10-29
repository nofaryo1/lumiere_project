import React from "react";
import { Icon, UpIcon } from "./Icon";
import { PerfumeMedia } from "./PerfumeMedia";
import { RatingRow } from "./RatingRow";
import { OwnerButtons } from "./OwnerButtons";
import { formatCount } from "../../lib/format";
import { ownsPerfume } from "../../store/catalog";
import { likeShown, toggleLike } from "../../store/session";
import { openPerfume } from "../../store/router";

export function PerfumeCard({ p, rank, owner = false }) {
  const openCard = (e) => { if (!e.target.closest("button, a")) openPerfume(p.id); };
  return (
    <article className="perfume-card" data-perfume={p.id} onClick={openCard}>
      <div className="perfume-card__media">
        {rank ? <span className="rank">{`#${rank}`}</span> : null}
        {p.change > 0 ? <span className="trend"><UpIcon />{`${p.change}%`}</span> : null}
        <PerfumeMedia p={p} />
      </div>
      <div className="perfume-card__body">
        <p className="perfume-card__brand">{p.brand || " "}</p>
        <h3 className="perfume-card__name"><a href={`#perfume/${p.id}`}>{p.name}</a></h3>
        <RatingRow p={p} />
        <div className="perfume-card__notes">{p.notes.map((n) => <span className="chip" key={n}>{n}</span>)}</div>
        <div className="perfume-card__actions">
          <button className="action-btn" data-action="love" data-id={p.id} aria-pressed={String(likeShown(p.id))} aria-label={`Like ${p.name}`} onClick={() => toggleLike(p)}>
            <Icon name="heart" /><span data-like-count={p.id}>{formatCount(p.real.likes)}</span>
          </button>
          <button className="action-btn" data-action="review" aria-label={`Reviews of ${p.name}`} onClick={() => openPerfume(p.id, "reviews")}>
            <Icon name="comment" /><span>{formatCount(p.real.reviews)}</span>
          </button>
        </div>
        {owner && ownsPerfume(p) ? <div className="perfume-card__owner"><OwnerButtons p={p} cls="social-btn" /></div> : null}
      </div>
    </article>
  );
}
