// One animation step: the hovered circle springs towards 1.08, the others back to 1.
// Returns true while something is still moving.
export function stepHoverSpring(hover) {
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
  return moving;
}
