import React from "react";
import { StarIcon } from "./Icon";

const row = [0, 1, 2, 3, 4].map((i) => <StarIcon key={i} />);

export function Stars({ rating }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span className="stars" aria-hidden="true">
      <span className="stars__base">{row}</span>
      <span className="stars__fill" style={{ width: `${pct}%` }}>{row}</span>
    </span>
  );
}
