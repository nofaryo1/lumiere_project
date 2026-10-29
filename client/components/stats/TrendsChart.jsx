import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { api } from "../../lib/api";
import { app, byId } from "../../store/app";
import { COLORS, Kpi, Legend, ChartFigure, DataTable } from "./chartKit";

const fmt = d3.format(",");
const fmtWeek = d3.utcFormat("%b %-d, %Y");

const nameOf = (slug) => {
  const p = byId(slug);
  return p ? `${p.brand ? p.brand + " " : ""}${p.name}` : slug;
};

// Draws the lines, the "leader" strip and the hover crosshair (same drawing as before, now inside React)
function drawTrends({ root, figure: figureNode, tooltip: tooltipNode }, data, series) {
  const figure = d3.select(figureNode);
  const tooltip = d3.select(tooltipNode);
  const weeks = data.weeks.map((d) => new Date(d));
  const colorOf = new Map(series.map((s) => [s.slug, s.color]));
  const last = weeks.length - 1;
  const leaderNow = data.leaders[last];
  const leader = series.find((s) => s.slug === leaderNow);

  figure.selectAll("*").remove();
  const width = Math.max(300, root.clientWidth);
  const height = width < 560 ? 240 : 300;
  const m = { top: 12, right: width < 560 ? 12 : 120, bottom: 54, left: 48 };
  const stripH = 12;
  const plotH = height - m.top - m.bottom;

  const x = d3.scaleUtc().domain([weeks[0], weeks[last]]).range([m.left, width - m.right]);
  const yMax = d3.max(series, (s) => d3.max(s.values)) || 1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([m.top + plotH, m.top]);

  const svg = figure.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width).attr("height", height)
    .attr("role", "img")
    .attr("aria-label", `Cumulative reviews per perfume over the past year. Most reviewed now: ${leaderNow ? nameOf(leaderNow) : "none"}.`);

  svg.append("g").attr("class", "trends__grid")
    .selectAll("line").data(y.ticks(4)).join("line")
    .attr("x1", m.left).attr("x2", width - m.right)
    .attr("y1", (d) => y(d)).attr("y2", (d) => y(d));
  svg.append("g").attr("class", "trends__axis")
    .attr("transform", `translate(${m.left - 8},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(0).tickFormat(d3.format("~s")))
    .call((g) => g.select(".domain").remove());
  svg.append("g").attr("class", "trends__axis")
    .attr("transform", `translate(0,${m.top + plotH + stripH + 14})`)
    .call(d3.axisBottom(x).ticks(width < 560 ? 4 : 8).tickSize(0).tickFormat(d3.utcFormat("%b")))
    .call((g) => g.select(".domain").remove());

  const line = d3.line().x((d, i) => x(weeks[i])).y((d) => y(d)).curve(d3.curveMonotoneX);
  svg.append("g").selectAll("path").data(series).join("path")
    .attr("class", "trends__line")
    .attr("stroke", (s) => s.color)
    .attr("d", (s) => line(s.values));

  if (leader && width >= 560) {
    const ly = y(leader.values[last]);
    svg.append("circle").attr("cx", x(weeks[last])).attr("cy", ly).attr("r", 4)
      .attr("fill", leader.color).attr("class", "trends__end-dot");
    const label = svg.append("text").attr("class", "trends__end-label")
      .attr("x", x(weeks[last]) + 10).attr("y", ly).attr("dy", "0.32em");
    label.append("tspan").attr("class", "trends__end-value").text(fmt(leader.values[last]));
    label.append("tspan").attr("x", x(weeks[last]) + 10).attr("dy", "1.2em").text(leader.name.length > 14 ? leader.name.slice(0, 13) + "…" : leader.name);
  }

  const stripY = m.top + plotH + 8;
  const cellW = (width - m.left - m.right) / weeks.length;
  svg.append("text").attr("class", "trends__strip-label")
    .attr("x", m.left - 8).attr("y", stripY + stripH / 2).attr("dy", "0.32em").attr("text-anchor", "end").text("Leader");
  const cells = svg.append("g").selectAll("rect").data(data.leaders).join("rect")
    .attr("class", "trends__cell")
    .attr("x", (d, i) => m.left + i * cellW + 1)
    .attr("y", stripY)
    .attr("width", Math.max(1, cellW - 2))
    .attr("height", stripH)
    .attr("rx", 2)
    .attr("fill", (d) => colorOf.get(d) || "#dcdfdd");

  const cross = svg.append("line").attr("class", "trends__cross")
    .attr("y1", m.top).attr("y2", stripY + stripH).style("display", "none");
  const dots = svg.append("g").selectAll("circle").data(series).join("circle")
    .attr("r", 4).attr("fill", (s) => s.color).attr("class", "trends__dot").style("display", "none");

  let current = -1;
  function show(i) {
    current = Math.max(0, Math.min(last, i));
    const cx = x(weeks[current]);
    cross.attr("x1", cx).attr("x2", cx).style("display", null);
    dots.attr("cx", cx).attr("cy", (s) => y(s.values[current])).style("display", null);
    cells.classed("is-active", (d, j) => j === current);

    const rows = [...series].sort((a, b) => b.values[current] - a.values[current]);
    const lead = data.leaders[current];
    tooltip.html("");
    tooltip.append("p").attr("class", "trends__tip-date").text(`Week of ${fmtWeek(weeks[current])}`);
    tooltip.append("p").attr("class", "trends__tip-total")
      .call((p) => { p.append("strong").text(fmt(data.totals[current])); p.append("span").text(" total reviews"); });
    const list = tooltip.append("ul");
    rows.forEach((s) => {
      const li = list.append("li");
      li.append("span").attr("class", "trends__tip-key").style("background", s.color);
      li.append("strong").text(fmt(s.values[current]));
      li.append("span").text(` ${s.name}`);
      if (s.slug === lead) li.append("em").text("Leader");
    });
    if (lead && !colorOf.has(lead)) tooltip.append("p").attr("class", "trends__tip-total").text(`Leader: ${nameOf(lead)}`);

    const box = root.getBoundingClientRect();
    const tipW = tooltip.node().offsetWidth || 220;
    const left = cx + 16 + tipW > box.width ? cx - tipW - 16 : cx + 16;
    tooltip.style("left", `${Math.max(0, left)}px`).style("top", `${figureNode.offsetTop + m.top}px`).property("hidden", false);
  }
  function hide() {
    current = -1;
    cross.style("display", "none");
    dots.style("display", "none");
    cells.classed("is-active", false);
    tooltip.property("hidden", true);
  }

  svg.append("rect")
    .attr("class", "trends__hit")
    .attr("x", m.left).attr("y", m.top)
    .attr("width", width - m.left - m.right).attr("height", stripY + stripH - m.top)
    .attr("tabindex", 0)
    .attr("aria-label", "Explore the chart: use left and right arrow keys to move week by week")
    .on("pointermove", (event) => {
      const [px] = d3.pointer(event);
      show(d3.bisectCenter(weeks.map((w) => x(w)), px));
    })
    .on("pointerleave", hide)
    .on("focus", () => show(current < 0 ? last : current))
    .on("blur", hide)
    .on("keydown", (event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); show((current < 0 ? last : current) - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); show((current < 0 ? last : current) + 1); }
      if (event.key === "Escape") hide();
    });
}

function Trends({ data, rootRef }) {
  const series = useMemo(() => data.series.map((s, i) => ({ ...s, name: nameOf(s.slug), color: COLORS[i], href: `#perfume/${s.slug}` })), [data]);
  const draw = useMemo(() => (nodes) => drawTrends(nodes, data, series), [data, series]);
  const weeks = data.weeks.map((d) => new Date(d));
  const last = weeks.length - 1;
  const leaderNow = data.leaders[last];
  const leader = series.find((s) => s.slug === leaderNow);
  const leadChanges = data.leaders.filter((l, i) => i > 0 && l && l !== data.leaders[i - 1]).length;

  return (
    <div className="trends">
      <div className="trends__kpis">
        <Kpi label="Total reviews" value={fmt(data.totalReviews)} sub={`${fmt(data.totals[last] - data.totals[Math.max(0, last - 4)])} in the last 4 weeks`} />
        <Kpi label="Most reviewed right now" value={leaderNow ? nameOf(leaderNow) : "—"} sub={leader ? `${fmt(leader.values[last])} reviews` : ""} />
        <Kpi label="Lead changes this year" value={String(leadChanges)} sub="times a new perfume took the top spot" />
      </div>
      <Legend items={series} />
      <ChartFigure rootRef={rootRef} draw={draw} />
      <DataTable
        head={<>
          <th>Week</th>
          {series.map((s) => <th key={s.slug}>{s.name}</th>)}
          <th className="is-text">Leader</th>
          <th>All perfumes</th>
        </>}
        rows={weeks.slice().reverse().map((w, k) => {
          const i = last - k;
          return (
            <tr key={i}>
              <td>{fmtWeek(w)}</td>
              {series.map((s) => <td key={s.slug}>{fmt(s.values[i])}</td>)}
              <td className="is-text">{data.leaders[i] ? nameOf(data.leaders[i]) : "—"}</td>
              <td>{fmt(data.totals[i])}</td>
            </tr>
          );
        })}
      />
    </div>
  );
}

// "Review trends": total reviews per perfume over the past year, from /api/stats/review-trends
export function TrendsChart() {
  const { ready } = app.use();
  const rootRef = useRef(null);
  const [state, setState] = useState({ data: null, error: "" });

  useEffect(() => {
    if (!ready) return;
    api("/stats/review-trends")
      .then((data) => setState({ data, error: "" }))
      .catch((err) => setState({ data: null, error: err.message }));
  }, [ready]);

  let body = <p className="pv__empty">Loading chart…</p>;
  if (state.error) body = <p className="pv__empty">{state.error}</p>;
  else if (state.data) body = <Trends data={state.data} rootRef={rootRef} />;
  return <div className="panel trends-panel" id="trendsChart" ref={rootRef}>{body}</div>;
}
