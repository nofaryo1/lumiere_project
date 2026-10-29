import React, { useId, useState } from "react";

const SHAPES = {
  rect:  { body: (p) => <rect x="13" y="30" width="34" height="42" rx="5" {...p} />, cap: (p) => <rect x="22" y="13" width="16" height="13" rx="2" {...p} />, neck: [26, 25, 8, 6], liquid: 40 },
  tall:  { body: (p) => <rect x="18" y="24" width="24" height="48" rx="4" {...p} />, cap: (p) => <rect x="24" y="7" width="12" height="14" rx="2" {...p} />, neck: [27, 20, 6, 5], liquid: 34 },
  round: { body: (p) => <circle cx="30" cy="51" r="21" {...p} />, cap: (p) => <rect x="23" y="14" width="14" height="13" rx="3" {...p} />, neck: [26, 26, 8, 6], liquid: 42 },
};

// A drawn bottle, shown when a perfume has no photo (or the photo fails to load)
export function BottleThumb({ look, className = "" }) {
  const id = `t${useId().replace(/:/g, "")}`;
  const s = SHAPES[look.shape] || SHAPES.rect;
  const [nx, ny, nw, nh] = s.neck;
  return (
    <svg className={className} viewBox="0 0 60 80" aria-hidden="true">
      <defs><clipPath id={id}>{s.body()}</clipPath></defs>
      <ellipse cx="30" cy="74" rx="20" ry="2.5" fill="#000" opacity="0.08" />
      <g clipPath={`url(#${id})`}>
        <rect width="60" height="80" fill="#fff" opacity="0.85" />
        <rect y={s.liquid} width="60" height="40" fill={look.liquid} opacity="0.9" />
        <rect x="16" y="0" width="3" height="80" fill="#fff" opacity="0.7" />
      </g>
      <g fill="none" stroke="#1c2220" strokeOpacity="0.18" strokeWidth="0.8">{s.body()}</g>
      <rect x="22" y={s.liquid + 6} width="16" height="10" rx="1" fill="#fff" opacity="0.9" />
      <rect x={nx} y={ny} width={nw} height={nh} fill="#c9cecb" />
      <g fill={look.cap}>{s.cap()}</g>
      <g fill="#fff" opacity="0.18">{s.cap()}</g>
    </svg>
  );
}

function Media({ p, size }) {
  const [broken, setBroken] = useState(false);
  const classes = ["perfume-media", size && `perfume-media--${size}`, p.image && "has-photo", broken && "is-broken"].filter(Boolean).join(" ");
  return (
    <span className={classes}>
      {p.image ? (
        <img
          className="perfume-media__img"
          src={p.image}
          alt={p.name}
          loading="lazy"
          decoding="async"
          style={p.imageZoom ? { "--media-zoom": Number(p.imageZoom) } : undefined}
          onError={() => setBroken(true)}
        />
      ) : null}
      <BottleThumb look={p.look} className="perfume-media__img perfume-media__fallback" />
    </span>
  );
}

// The perfume's photo, with the drawn bottle as a fallback
export function PerfumeMedia({ p, size = "" }) {
  return <Media key={p.image || ""} p={p} size={size} />;
}
