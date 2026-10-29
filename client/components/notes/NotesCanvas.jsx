import React, { useEffect, useRef } from "react";
import { drawNotes } from "./drawNotes";
import { stepHoverSpring } from "./hoverSpring";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animated = new Set();

export function NotesCanvas({ notes, animateKey }) {
  const canvasRef = useRef(null);
  const label = `${notes.length} note${notes.length === 1 ? "" : "s"}: ${notes.join(", ")}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduced = reducedMotion();
    const st = {
      progress: 1,
      circles: [],
      hover: { index: -1, scale: notes.map(() => 1), velocity: notes.map(() => 0), raf: 0 },
    };
    const paint = () => { st.circles = drawNotes(canvas, notes, st.progress, st.hover); };

    let growRaf = 0;
    if (!reduced && !animated.has(animateKey)) {
      animated.add(animateKey);
      st.progress = 0;
      const start = performance.now();
      const step = (now) => {
        st.progress = Math.min(1, (now - start) / 380);
        paint();
        if (st.progress < 1) growRaf = requestAnimationFrame(step);
      };
      growRaf = requestAnimationFrame(step);
    } else {
      paint();
    }

    const resizer = "ResizeObserver" in window ? new ResizeObserver(paint) : null;
    if (resizer) resizer.observe(canvas);

    const hover = st.hover;
    const animateHover = () => {
      if (hover.raf) return;
      const tick = () => {
        const moving = stepHoverSpring(hover);
        if (st.progress === 1) paint();
        hover.raf = moving ? requestAnimationFrame(tick) : 0;
      };
      hover.raf = requestAnimationFrame(tick);
    };
    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const i = st.circles.findIndex((c) => Math.hypot(x - c.cx, y - c.cy) <= c.r);
      if (i !== hover.index) { hover.index = i; animateHover(); }
    };
    const onLeave = () => { hover.index = -1; animateHover(); };
    if (!reduced) {
      canvas.addEventListener("pointerover", onMove);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(growRaf);
      cancelAnimationFrame(hover.raf);
      if (resizer) resizer.disconnect();
      canvas.removeEventListener("pointerover", onMove);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [notes.join("\u0000"), animateKey]);

  return (
    <canvas
      ref={canvasRef}
      className={`notes-canvas${notes.length > 4 ? " notes-canvas--tall" : ""}`}
      data-notes={JSON.stringify(notes)}
      role="img"
      aria-label={label}
    >
      {label}
    </canvas>
  );
}
