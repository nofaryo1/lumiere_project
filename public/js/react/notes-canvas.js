(function () {
  "use strict";

  const { useEffect, useRef } = React;
  const h = React.createElement;

  const NOTE_FILLS = ["#e6efe9", "#e4ecf3", "#f3ece4", "#efe9f3", "#e9eef0", "#f1ebe3", "#f7e9ec", "#eef0ef"];
  const NOTE_INKS = ["#3f6b56", "#3d6283", "#83613d", "#6a4f83", "#4b5f66", "#7a5a37", "#9a4a5c", "#4b5f66"];
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animated = new Set();

  function fitLabel(ctx, text, maxWidth, maxSize) {
    for (let size = maxSize; size >= 9; size--) {
      ctx.font = `600 ${size}px ${getComputedStyle(document.body).fontFamily}`;
      if (ctx.measureText(text).width <= maxWidth) return { size, lines: [text] };
      const words = text.split(/\s+/);
      if (words.length > 1) {
        let best = null;
        for (let i = 1; i < words.length; i++) {
          const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
          const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
          if (w <= maxWidth && (!best || w < best.w)) best = { lines, w };
        }
        if (best) return { size, lines: best.lines };
      }
    }
    let t = text;
    while (t.length > 3 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    return { size: 9, lines: [`${t}…`] };
  }

  function draw(canvas, notes, progress, hover) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return [];
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
    if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const n = notes.length;
    const rows = n > 4 ? 2 : 1;
    const perRow = Math.ceil(n / rows);
    const cellW = width / perRow;
    const cellH = height / rows;
    const radius = Math.max(18, Math.min(cellW, cellH) / 2 - 8);
    const ease = 1 - Math.pow(1 - progress, 3);
    const circles = [];

    notes.forEach((note, i) => {
      const row = Math.floor(i / perRow);
      const inRow = row === rows - 1 ? n - perRow * (rows - 1) : perRow;
      const col = i - row * perRow;
      const cx = (width - inRow * cellW) / 2 + cellW * (col + 0.5);
      const cy = cellH * (row + 0.5);
      const r = radius * (0.6 + 0.4 * ease);
      const grow = hover.scale[i] || 1;
      const lift = (grow - 1) * 40;
      circles.push({ cx, cy, r: radius });

      ctx.save();
      ctx.translate(cx, cy - lift);
      ctx.scale(grow, grow);
      ctx.globalAlpha = ease;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = NOTE_FILLS[i % NOTE_FILLS.length];
      ctx.fill();
      ctx.lineWidth = 1.5 / grow;
      ctx.strokeStyle = NOTE_INKS[i % NOTE_INKS.length];
      ctx.globalAlpha = ease * (0.35 + (grow - 1) * 4);
      ctx.stroke();

      ctx.globalAlpha = ease;
      const { size, lines } = fitLabel(ctx, note, r * 1.6, Math.min(15, Math.round(radius / 2.6)));
      ctx.fillStyle = NOTE_INKS[i % NOTE_INKS.length];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lineH = size * 1.2;
      lines.forEach((line, k) => ctx.fillText(line, 0, (k - (lines.length - 1) / 2) * lineH));
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    return circles;
  }

  function NotesCanvas({ notes, animateKey }) {
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
      const paint = () => { st.circles = draw(canvas, notes, st.progress, st.hover); };

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
          let moving = false;
          hover.scale = hover.scale.map((s, i) => {
            const target = i === hover.index ? 1.08 : 1;
            hover.velocity[i] = (hover.velocity[i] || 0) * 0.62 + (target - s) * 0.22;
            const next = s + hover.velocity[i];
            const settled = Math.abs(target - next) < 0.0008 && Math.abs(hover.velocity[i]) < 0.0008;
            if (settled) { hover.velocity[i] = 0; return target; }
            moving = true;
            return next;
          });
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

    return h("canvas", {
      ref: canvasRef,
      className: `notes-canvas${notes.length > 4 ? " notes-canvas--tall" : ""}`,
      "data-notes": JSON.stringify(notes),
      role: "img",
      "aria-label": label,
    }, label);
  }

  const roots = new Map();

  function mountAll(scope = document) {
    roots.forEach((root, el) => {
      if (!el.isConnected) { root.unmount(); roots.delete(el); }
    });
    scope.querySelectorAll(".notes-canvas-root").forEach((el) => {
      if (roots.has(el)) return;
      let notes = [];
      try { notes = JSON.parse(el.dataset.notes || "[]"); } catch (err) { notes = []; }
      const root = ReactDOM.createRoot(el);
      roots.set(el, root);
      // render synchronously so the canvas is there before the page paints (no jump)
      ReactDOM.flushSync(() => {
        root.render(h(NotesCanvas, { notes, animateKey: `${location.hash}|${JSON.stringify(notes)}` }));
      });
    });
  }

  window.LumiereNotesCanvas = { mountAll };
})();
