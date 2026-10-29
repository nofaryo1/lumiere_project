// Splits a note name into at most 2 lines that fit `maxWidth`, shrinking the font if needed
export function fitLabel(ctx, text, maxWidth, maxSize) {
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
