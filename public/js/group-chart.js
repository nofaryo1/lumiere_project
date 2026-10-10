/* =========================================================
   LUMIERE — Group posts per month (D3)
   Same minimal line style as the review trends chart: one line per
   group for the five most active groups; the hover tooltip and the
   data table include every group.

   LumiereGroupChart.mount(container, data)
     data = response of GET /api/stats/group-posts
   ========================================================= */
(function () {
  "use strict";

  // Same categorical slots as the review trends chart (validated palette)
  const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
  const fmt = d3.format(",");
  const fmtMonth = d3.utcFormat("%B %Y");

  function mount(container, data) {
    const root = typeof container === "string" ? document.querySelector(container) : container;
    const months = data.months.map((d) => new Date(d));
    const last = months.length - 1;
    const all = data.series;
    const lines = all.slice(0, 5).map((s, i) => ({ ...s, color: COLORS[i] }));

    root.innerHTML = "";
    const wrap = d3.select(root).append("div").attr("class", "trends");

    // ---- headline numbers ----
    const busiest = all.length ? all.reduce((a, b) => (b.values[last] > a.values[last] ? b : a), all[0]) : null;
    const peakIdx = data.totals.indexOf(Math.max(...data.totals));
    const kpis = wrap.append("div").attr("class", "trends__kpis");
    const kpi = (label, value, sub) => {
      const el = kpis.append("div").attr("class", "trends__kpi");
      el.append("p").attr("class", "trends__kpi-label").text(label);
      el.append("p").attr("class", "trends__kpi-value").text(value);
      if (sub) el.append("p").attr("class", "trends__kpi-sub").text(sub);
    };
    kpi("Group posts this year", fmt(data.totalPosts), `${fmt(data.totals[last])} so far in ${fmtMonth(months[last])}`);
    kpi("Busiest group this month", busiest && busiest.values[last] ? busiest.name : "—", busiest ? `${fmt(busiest.values[last])} posts` : "");
    kpi("Busiest month", data.totalPosts ? fmtMonth(months[peakIdx]) : "—", data.totalPosts ? `${fmt(data.totals[peakIdx])} posts across all groups` : "");

    if (!all.length) {
      wrap.append("p").attr("class", "pv__empty").text("No group posts yet.");
      return;
    }

    // ---- legend (line keys) ----
    const legend = wrap.append("ul").attr("class", "trends__legend").attr("aria-label", "Legend");
    lines.forEach((s) => {
      const li = legend.append("li");
      li.append("span").attr("class", "trends__key").style("background", s.color);
      li.append("a").attr("href", `#group/${s.slug}`).text(s.name);
    });

    const figure = wrap.append("div").attr("class", "trends__figure");
    const tooltip = wrap.append("div").attr("class", "trends__tooltip").attr("role", "status").property("hidden", true);

    function draw() {
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

      // grid + axes (recessive)
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

      // lines: solid for finished months, dashed for the current (partial) month
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

      // direct label for the busiest group in the last full month (legend carries the rest)
      const full = last - 1;
      const top = [...lines].sort((a, b) => b.values[full] - a.values[full])[0];
      if (top && !narrow) {
        const ly = y(top.values[full]);
        svg.append("circle").attr("class", "trends__end-dot").attr("cx", x(months[full])).attr("cy", ly).attr("r", 4).attr("fill", top.color);
        const label = svg.append("text").attr("class", "trends__end-label").attr("x", x(months[last]) + 10).attr("y", ly).attr("dy", "0.32em");
        label.append("tspan").attr("class", "trends__end-value").text(fmt(top.values[full]));
        label.append("tspan").attr("x", x(months[last]) + 10).attr("dy", "1.2em").text(top.name.length > 14 ? top.name.slice(0, 13) + "…" : top.name);
      }

      // ---- crosshair + tooltip ----
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
        tooltip.style("left", `${Math.max(0, left)}px`).style("top", `${figure.node().offsetTop + m.top}px`).property("hidden", false);
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

    // ---- table view: every group, every month ----
    const details = wrap.append("details").attr("class", "trends__table");
    details.append("summary").text("Show data table");
    const table = details.append("div").attr("class", "trends__table-scroll").append("table");
    const head = table.append("thead").append("tr");
    head.append("th").text("Group");
    months.forEach((mth) => head.append("th").text(d3.utcFormat("%b %Y")(mth)));
    head.append("th").text("Total");
    const body = table.append("tbody");
    [...all, { name: "All groups", values: data.totals }].forEach((s) => {
      const tr = body.append("tr");
      tr.append("td").text(s.name);
      s.values.forEach((v) => tr.append("td").text(fmt(v)));
      tr.append("td").text(fmt(s.values.reduce((a, b) => a + b, 0)));
    });

    draw();
    let lastWidth = root.clientWidth;
    new ResizeObserver(() => {
      if (Math.abs(root.clientWidth - lastWidth) < 8) return;
      lastWidth = root.clientWidth;
      draw();
    }).observe(root);
  }

  window.LumiereGroupChart = { mount };
})();
