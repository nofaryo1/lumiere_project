/* =========================================================
   LUMIERE — Review trends chart (D3)
   Cumulative reviews per perfume over the past year. The line on
   top is the most-reviewed perfume at that moment; the strip under
   the chart shows which perfume led each week.

   LumiereTrends.mount(container, data, { nameOf })
     data   = response of GET /api/stats/review-trends
     nameOf = slug -> display name
   ========================================================= */
(function () {
  "use strict";

  // Categorical slots, fixed order (validated: CVD-safe on white, see dataviz palette)
  const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
  const fmt = d3.format(",");
  const fmtWeek = d3.utcFormat("%b %-d, %Y");

  function mount(container, data, { nameOf }) {
    const root = typeof container === "string" ? document.querySelector(container) : container;
    const weeks = data.weeks.map((d) => new Date(d));
    const series = data.series.map((s, i) => ({ ...s, name: nameOf(s.slug), color: COLORS[i] }));
    const colorOf = new Map(series.map((s) => [s.slug, s.color]));
    const last = weeks.length - 1;
    const leaderNow = data.leaders[last];
    const leadChanges = data.leaders.filter((l, i) => i > 0 && l && l !== data.leaders[i - 1]).length;

    root.innerHTML = "";
    const wrap = d3.select(root).append("div").attr("class", "trends");

    // ---- headline numbers ----
    const kpis = wrap.append("div").attr("class", "trends__kpis");
    const kpi = (label, value, sub) => {
      const el = kpis.append("div").attr("class", "trends__kpi");
      el.append("p").attr("class", "trends__kpi-label").text(label);
      el.append("p").attr("class", "trends__kpi-value").text(value);
      if (sub) el.append("p").attr("class", "trends__kpi-sub").text(sub);
    };
    kpi("Total reviews", fmt(data.totalReviews), `${fmt(data.totals[last] - data.totals[Math.max(0, last - 4)])} in the last 4 weeks`);
    const leader = series.find((s) => s.slug === leaderNow);
    kpi("Most reviewed right now", leaderNow ? nameOf(leaderNow) : "—", leader ? `${fmt(leader.values[last])} reviews` : "");
    kpi("Lead changes this year", String(leadChanges), "times a new perfume took the top spot");

    // ---- legend (line keys) ----
    const legend = wrap.append("ul").attr("class", "trends__legend").attr("aria-label", "Legend");
    series.forEach((s) => {
      const li = legend.append("li");
      li.append("span").attr("class", "trends__key").style("background", s.color);
      li.append("a").attr("href", `#perfume/${s.slug}`).text(s.name);
    });

    // ---- chart ----
    const figure = wrap.append("div").attr("class", "trends__figure");
    const tooltip = wrap.append("div").attr("class", "trends__tooltip").attr("role", "status").property("hidden", true);

    function draw() {
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

      // grid + axes (recessive)
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

      // lines
      const line = d3.line().x((d, i) => x(weeks[i])).y((d) => y(d)).curve(d3.curveMonotoneX);
      svg.append("g").selectAll("path").data(series).join("path")
        .attr("class", "trends__line")
        .attr("stroke", (s) => s.color)
        .attr("d", (s) => line(s.values));

      // direct label for the current leader only (legend carries the rest)
      if (leader && width >= 560) {
        const ly = y(leader.values[last]);
        svg.append("circle").attr("cx", x(weeks[last])).attr("cy", ly).attr("r", 4)
          .attr("fill", leader.color).attr("class", "trends__end-dot");
        const label = svg.append("text").attr("class", "trends__end-label")
          .attr("x", x(weeks[last]) + 10).attr("y", ly).attr("dy", "0.32em");
        label.append("tspan").attr("class", "trends__end-value").text(fmt(leader.values[last]));
        label.append("tspan").attr("x", x(weeks[last]) + 10).attr("dy", "1.2em").text(leader.name.length > 14 ? leader.name.slice(0, 13) + "…" : leader.name);
      }

      // leader strip: one cell per week, colored by that week's leader
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

      // ---- crosshair + tooltip ----
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
        tooltip.style("left", `${Math.max(0, left)}px`).style("top", `${figure.node().offsetTop + m.top}px`).property("hidden", false);
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

    // ---- table view (every value reachable without hovering) ----
    const details = wrap.append("details").attr("class", "trends__table");
    details.append("summary").text("Show data table");
    const scroller = details.append("div").attr("class", "trends__table-scroll");
    const table = scroller.append("table");
    const head = table.append("thead").append("tr");
    head.append("th").text("Week");
    series.forEach((s) => head.append("th").text(s.name));
    head.append("th").attr("class", "is-text").text("Leader");
    head.append("th").text("All perfumes");
    const body = table.append("tbody");
    weeks.slice().reverse().forEach((w, k) => {
      const i = last - k;
      const tr = body.append("tr");
      tr.append("td").text(fmtWeek(w));
      series.forEach((s) => tr.append("td").text(fmt(s.values[i])));
      tr.append("td").attr("class", "is-text").text(data.leaders[i] ? nameOf(data.leaders[i]) : "—");
      tr.append("td").text(fmt(data.totals[i]));
    });

    draw();
    let lastWidth = root.clientWidth;
    new ResizeObserver(() => {
      if (Math.abs(root.clientWidth - lastWidth) < 8) return;
      lastWidth = root.clientWidth;
      draw();
    }).observe(root);
  }

  window.LumiereTrends = { mount };
})();
