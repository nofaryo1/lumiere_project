import React from "react";
import { Stars } from "./Stars";
import { ratingFor } from "../../store/catalog";
import { formatCount } from "../../lib/format";

export function RatingRow({ p }) {
  const r = ratingFor(p);
  if (!r.count) return <div className="rating rating--empty">No ratings yet</div>;
  return (
    <div className="rating" aria-label={`Rated ${r.avg.toFixed(1)} out of 5 from ${r.count} ratings`}>
      <span className="rating__score">{r.avg.toFixed(1)}</span>
      <Stars rating={r.avg} />
      <span>{`(${formatCount(r.count)})`}</span>
    </div>
  );
}
