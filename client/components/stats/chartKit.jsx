import React, { useEffect, useRef } from "react";

export const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

export function Kpi({ label, value, sub }) {
  return (
    <div className="trends__kpi">
      <p className="trends__kpi-label">{label}</p>
      <p className="trends__kpi-value">{value}</p>
      {sub ? <p className="trends__kpi-sub">{sub}</p> : null}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <ul className="trends__legend" aria-label="Legend">
      {items.map((s) => (
        <li key={s.slug}>
          <span className="trends__key" style={{ background: s.color }} />
          <a href={s.href}>{s.name}</a>
        </li>
      ))}
    </ul>
  );
}

// D3 draws the plot into the figure, and again whenever the panel's width changes
export function ChartFigure({ rootRef, draw }) {
  const figureRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const nodes = { root, figure: figureRef.current, tooltip: tooltipRef.current };
    draw(nodes);
    let lastWidth = root.clientWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (Math.abs(root.clientWidth - lastWidth) < 8) return;
      lastWidth = root.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => draw(nodes));
    });
    observer.observe(root);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [draw]);

  return (
    <>
      <div className="trends__figure" ref={figureRef} />
      <div className="trends__tooltip" role="status" hidden ref={tooltipRef} />
    </>
  );
}

// The chart's numbers as a table, for anyone who can't use the chart
export function DataTable({ head, rows }) {
  return (
    <details className="trends__table">
      <summary>Show data table</summary>
      <div className="trends__table-scroll">
        <table>
          <thead><tr>{head}</tr></thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </details>
  );
}
