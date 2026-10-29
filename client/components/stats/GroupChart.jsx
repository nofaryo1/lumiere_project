import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { api } from "../../lib/api";
import { app } from "../../store/app";
import { COLORS, Kpi, Legend, ChartFigure, DataTable } from "./chartKit";

const fmt = d3.format(",");
const fmtMonth = d3.utcFormat("%B %Y");

// Draws the posts-per-month lines (the current month dashed, it isn't over yet) and the hover crosshair
function drawGroups({ root, figure: figureNode, tooltip: tooltipNode }, data, lines, busiest) {
  const figure = d3.select(figureNode);
  const tooltip = d3.select(tooltipNode);
  const months = data.months.map((d) => new Date(d));
  const last = months.length - 1;
  const all = data.series;

  figure.selectAll("*").remove();
  const width = Math.max(300, root.clientWidth);
  const narrow = width < 560;
  const height = narrow ? 240 : 300;
  const m = { top: 12, right: narrow ? 12 : 120, bottom: 44, left: 48 };

  const x = d3.scaleUtc().domain([months[0], months[last]]).range([m.left, width - m.right]);
  const y = d3.scaleLinear().domain([0, d3.max(lines, (s) => d3.max(s.values)) || 1]).nice().range([height - m.bottom, m.top]);

  const svg = figure.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height)
    .attr("role", "img")
    .attr("aria-label", `Posts per month in the five most active groups over the past year. Busiest this month: ${busiest ? busiest.name : "none"}.`);

  svg.append("g").attr("class", "trends__grid")
    .selectAll("line").data(y.ticks(4)).join("line")
    .attr("x1", m.left).attr("x2", width - m.right).attr("y1", (d) => y(d)).attr("y2", (d) => y(d));
  svg.append("g").attr("class", "trends__axis")
    .attr("transform", `translate(${m.left - 8},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(0).tickFormat(d3.format("~s")))
    .call((g) => g.select(".domain").remove());
  svg.append("g").attr("class", "trends__axis")
    .attr("transform", `translate(0,${height - m.bottom + 14})`)
    .call(d3.axisBottom(x).ticks(narrow ? 4 : 12).tickSize(0).tickFormat(d3.utcFormat("%b")))
    .call((g) => g.select(".domain").remove());

  const line = d3.line().x((d) => x(months[d.i])).y((d) => y(d.v)).curve(d3.curveMonotoneX);
  const points = (s) => s.values.map((v, i) => ({ v, i }));
  svg.append("g").selectAll("path").data(lines).join("path")
    .attr("class", "trends__line")
    .attr("stroke", (s) => s.color)
    .attr("d", (s) => line(points(s).slice(0, last)));
  svg.append("g").selectAll("path").data(lines).join("path")
    .attr("class", "trends__line trends__line--partial")
    .attr("stroke", (s) => s.color)
    .attr("d", (s) => line(points(s).slice(last - 1)));
  svg.append("text").attr("class", "trends__partial-note")
    .attr("x", x(months[last])).attr("y", height - m.bottom + 36).attr("text-anchor", "middle")
    .text("so far");

  const full = last - 1;
  const top = [...lines].sort((a, b) => b.values[full] - a.values[full])[0];
  if (top && !narrow) {
    const ly = y(top.values[full]);
    svg.append("circle").attr("class", "trends__end-dot").attr("cx", x(months[full])).attr("cy", ly).attr("r", 4).attr("fill", top.color);
    const label = svg.append("text").attr("class", "trends__end-label").attr("x", x(months[last]) + 10).attr("y", ly).attr("dy", "0.32em");
    label.append("tspan").attr("class", "trends__end-value").text(fmt(top.values[full]));
    label.append("tspan").attr("x", x(months[last]) + 10).attr("dy", "1.2em").text(top.name.length > 14 ? top.name.slice(0, 13) + "…" : top.name);
  }

  const cross = svg.append("line").attr("class", "trends__cross").attr("y1", m.top).attr("y2", height - m.bottom).style("display", "none");
  const dots = svg.append("g").selectAll("circle").data(lines).join("circle")
    .attr("class", "trends__dot").attr("r", 4).attr("fill", (s) => s.color).style("display", "none");

  let current = -1;
  function show(i) {
    current = Math.max(0, Math.min(last, i));
    const cx = x(months[current]);
    cross.attr("x1", cx).attr("x2", cx).style("display", null);
    dots.attr("cx", cx).attr("cy", (s) => y(s.values[current])).style("display", null);

    tooltip.html("");
    tooltip.append("p").attr("class", "trends__tip-date").text(`${fmtMonth(months[current])}${current === last ? " (so far)" : ""}`);
    tooltip.append("p").attr("class", "trends__tip-total")
      .call((p) => { p.append("strong").text(fmt(data.totals[current])); p.append("span").text(" posts across all groups"); });
    const list = tooltip.append("ul");
    [...all].sort((a, b) => b.values[current] - a.values[current]).forEach((s) => {
      const li = list.append("li");
      const color = (lines.find((l) => l.slug === s.slug) || {}).color;
      li.append("span").attr("class", "trends__tip-key").style("background", color || "transparent");
      li.append("strong").text(fmt(s.values[current]));
      li.append("span").text(` ${s.name}`);
    });

    const tipW = tooltip.node().offsetWidth || 220;
    const left = cx + 16 + tipW > width ? cx - tipW - 16 : cx + 16;
    tooltip.style("left", `${Math.max(0, left)}px`).style("top", `${figureNode.offsetTop + m.top}px`).property("hidden", false);
  }
  function hide() {
    current = -1;
    cross.style("display", "none");
    dots.style("display", "none");
    tooltip.property("hidden", true);
  }

  svg.append("rect")
    .attr("class", "trends__hit")
    .attr("x", m.left).attr("y", m.top)
    .attr("width", width - m.left - m.right).attr("height", height - m.top - m.bottom)
    .attr("tabindex", 0)
    .attr("aria-label", "Explore the chart: use left and right arrow keys to move month by month")
    .on("pointermove", (event) => {
      const [px] = d3.pointer(event);
      show(d3.bisectCenter(months.map((mth) => x(mth)), px));
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

function Groups({ data, rootRef }) {
  const months = data.months.map((d) => new Date(d));
  const last = months.length - 1;
  const all = data.series;
  const lines = useMemo(() => all.slice(0, 5).map((s, i) => ({ ...s, color: COLORS[i], href: `#group/${s.slug}` })), [data]);
  const busiest = all.length ? all.reduce((a, b) => (b.values[last] > a.values[last] ? b : a), all[0]) : null;
  const draw = useMemo(() => (nodes) => drawGroups(nodes, data, lines, busiest), [data, lines]);
  const peakIdx = data.totals.indexOf(Math.max(...data.totals));

  return (
    <div className="trends">
      <div className="trends__kpis">
        <Kpi label="Group posts this year" value={fmt(data.totalPosts)} sub={`${fmt(data.totals[last])} so far in ${fmtMonth(months[last])}`} />
        <Kpi label="Busiest group this month" value={busiest && busiest.values[last] ? busiest.name : "—"} sub={busiest ? `${fmt(busiest.values[last])} posts` : ""} />
        <Kpi label="Busiest month" value={data.totalPosts ? fmtMonth(months[peakIdx]) : "—"} sub={data.totalPosts ? `${fmt(data.totals[peakIdx])} posts across all groups` : ""} />
      </div>
      {!all.length ? <p className="pv__empty">No group posts yet.</p> : (
        <>
          <Legend items={lines} />
          <ChartFigure rootRef={rootRef} draw={draw} />
          <DataTable
            head={<>
              <th>Group</th>
              {months.map((mth, i) => <th key={i}>{d3.utcFormat("%b %Y")(mth)}</th>)}
              <th>Total</th>
            </>}
            rows={[...all, { slug: "", name: "All groups", values: data.totals }].map((s) => (
              <tr key={s.slug || "all"}>
                <td>{s.name}</td>
                {s.values.map((v, i) => <td key={i}>{fmt(v)}</td>)}
                <td>{fmt(s.values.reduce((a, b) => a + b, 0))}</td>
              </tr>
            ))}
          />
        </>
      )}
    </div>
  );
}

// "Group activity": posts per month in the busiest groups, from /api/stats/group-posts
export function GroupChart() {
  const { ready } = app.use();
  const rootRef = useRef(null);
  const [state, setState] = useState({ data: null, error: "" });

  useEffect(() => {
    if (!ready) return;
    api("/stats/group-posts")
      .then((data) => setState({ data, error: "" }))
      .catch((err) => setState({ data: null, error: err.message }));
  }, [ready]);

  let body = <p className="pv__empty">Loading chart…</p>;
  if (state.error) body = <p className="pv__empty">{state.error}</p>;
  else if (state.data) body = <Groups data={state.data} rootRef={rootRef} />;
  return <div className="panel trends-panel" id="groupChart" ref={rootRef}>{body}</div>;
}
