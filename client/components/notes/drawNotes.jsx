import { NOTE_FILLS, NOTE_INKS } from "./palette";
import { fitLabel } from "./fitLabel";

// Draws one circle per note and returns where the circles are (used for hover)
export function drawNotes(canvas, notes, progress, hover) {
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
