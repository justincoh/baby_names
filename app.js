// State
const state = {
    namesIndex: [],
    yearlyTop: {},
    yearStart: 1880,
    yearEnd: 2024,
    selectedName: null, // {name, gender}
    nameDetail: null,
    rangeMode: false,
};

const COLORS = { F: "#c4553a", M: "#2a7f8e" };
const MARGIN = { top: 20, right: 30, bottom: 40, left: 55 };

// ── URL State ──

function buildUrlParams() {
    const params = new URLSearchParams();
    if (state.selectedName) {
        params.set("name", state.selectedName.name);
        params.set("gender", state.selectedName.gender);
    }
    if (state.yearStart !== 1880) params.set("start", state.yearStart);
    if (state.yearEnd !== 2024) params.set("end", state.yearEnd);
    if (state.rangeMode) {
        params.set("range", "1");
    } else {
        const year = document.getElementById("top-year-select").value;
        if (year !== "2024") params.set("year", year);
    }
    return params;
}

function syncUrl(push = false) {
    const params = buildUrlParams();
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (push) {
        history.pushState(null, "", newUrl);
    } else {
        history.replaceState(null, "", newUrl);
    }
}

function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = { name: null, gender: null, yearStart: null, yearEnd: null, rangeMode: false, topYear: null };

    const name = params.get("name")?.trim();
    if (name) {
        result.name = name;
        const g = params.get("gender");
        if (g === "F" || g === "M") {
            result.gender = g;
        } else {
            // Infer gender from most popular entry (namesIndex is sorted by total descending)
            const match = state.namesIndex.find(e => e.n === name);
            result.gender = match ? match.g : null;
        }
        if (!result.gender) { result.name = null; }
    }

    let start = parseInt(params.get("start"));
    let end = parseInt(params.get("end"));
    if (!isNaN(start)) result.yearStart = Math.max(1880, Math.min(2024, start));
    if (!isNaN(end)) result.yearEnd = Math.max(1880, Math.min(2024, end));
    if (result.yearStart !== null && result.yearEnd !== null && result.yearStart > result.yearEnd) {
        [result.yearStart, result.yearEnd] = [result.yearEnd, result.yearStart];
    }

    result.rangeMode = params.get("range") === "1";

    const topYear = parseInt(params.get("year"));
    if (!isNaN(topYear)) result.topYear = Math.max(1880, Math.min(2024, topYear));

    return result;
}

async function restoreFromUrl(params) {
    // Year range
    if (params.yearStart !== null) state.yearStart = params.yearStart;
    if (params.yearEnd !== null) state.yearEnd = params.yearEnd;

    const startInput = document.getElementById("year-start");
    const endInput = document.getElementById("year-end");
    startInput.value = state.yearStart;
    endInput.value = state.yearEnd;
    document.getElementById("range-label-start").textContent = state.yearStart;
    document.getElementById("range-label-end").textContent = state.yearEnd;

    // Update fill bar
    const fill = document.getElementById("range-track-fill");
    const pctStart = ((state.yearStart - 1880) / (2024 - 1880)) * 100;
    const pctEnd = ((state.yearEnd - 1880) / (2024 - 1880)) * 100;
    fill.style.left = pctStart + "%";
    fill.style.right = (100 - pctEnd) + "%";

    // Range mode
    if (params.rangeMode) {
        state.rangeMode = true;
        const rangeBtn = document.getElementById("range-mode-btn");
        const rangeLabel = document.getElementById("range-mode-label");
        const select = document.getElementById("top-year-select");
        rangeBtn.classList.add("active");
        select.classList.add("hidden");
        rangeLabel.classList.remove("hidden");
        rangeLabel.textContent = `${state.yearStart}\u2013${state.yearEnd}`;
    }

    // Top year dropdown
    if (params.topYear !== null && !state.rangeMode) {
        document.getElementById("top-year-select").value = params.topYear;
    }

    renderTopNames();

    // Selected name
    if (params.name && params.gender && state.nameSet.has(`${params.name}_${params.gender}`)) {
        await selectName(params.name, params.gender);
    } else if (params.name) {
        // Invalid name — clean the URL
        syncUrl();
    }
}

async function onPopState() {
    // Reset state to defaults
    state.yearStart = 1880;
    state.yearEnd = 2024;
    state.rangeMode = false;
    state.selectedName = null;
    state.nameDetail = null;

    // Reset DOM
    document.getElementById("name-detail-section").classList.add("hidden");
    document.getElementById("search-input").value = "";
    document.getElementById("range-mode-btn").classList.remove("active");
    document.getElementById("top-year-select").classList.remove("hidden");
    document.getElementById("range-mode-label").classList.add("hidden");
    document.getElementById("top-year-select").value = "2024";

    await restoreFromUrl(parseUrlParams());
}

// ── Init ──

async function init() {
    const [namesIndex, yearlyTop] = await Promise.all([
        fetch("data/names_index.json").then((r) => r.json()),
        fetch("data/yearly_top.json").then((r) => r.json()),
    ]);
    state.namesIndex = namesIndex;
    state.yearlyTop = yearlyTop;
    state.nameSet = new Set(namesIndex.map(e => `${e.n}_${e.g}`));

    setupSearch();
    setupYearInputs();
    setupTopNamesControls();

    await restoreFromUrl(parseUrlParams());

    window.addEventListener("resize", debounce(onResize, 200));
    window.addEventListener("popstate", onPopState);
}

// ── Search / Typeahead ──

function setupSearch() {
    const input = document.getElementById("search-input");
    const dropdown = document.getElementById("typeahead-dropdown");

    // Event delegation for typeahead clicks
    dropdown.addEventListener("click", (e) => {
        const item = e.target.closest(".typeahead-item[data-name]");
        if (item) selectName(item.dataset.name, item.dataset.gender);
    });

    input.addEventListener("input", debounce(() => {
        const query = input.value.trim().toLowerCase();
        if (query.length === 0) {
            dropdown.classList.add("hidden");
            return;
        }
        const results = state.namesIndex
            .filter((e) => e.n.toLowerCase().startsWith(query))
            .slice(0, 8);

        if (results.length === 0) {
            dropdown.innerHTML = '<div class="typeahead-item no-matches">No matches</div>';
        } else {
            dropdown.innerHTML = results
                .map(
                    (r, i) =>
                        `<div class="typeahead-item" data-index="${i}" data-name="${escapeAttr(r.n)}" data-gender="${r.g}">
                            <span class="gender-dot ${r.g}"></span>
                            <span>${escapeHtml(r.n)}</span>
                            <span class="typeahead-count">${r.t.toLocaleString()}</span>
                        </div>`
                )
                .join("");
        }
        dropdown.classList.remove("hidden");
    }, 150));

    // Keyboard navigation
    input.addEventListener("keydown", (e) => {
        const items = dropdown.querySelectorAll(".typeahead-item[data-name]");
        const active = dropdown.querySelector(".typeahead-item.active");
        let idx = [...items].indexOf(active);

        function setActive(newIdx) {
            items.forEach((el) => el.classList.remove("active"));
            items[newIdx]?.classList.add("active");
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive(Math.min(idx + 1, items.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(Math.max(idx - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (active) {
                selectName(active.dataset.name, active.dataset.gender);
            }
        } else if (e.key === "Escape") {
            dropdown.classList.add("hidden");
        }
    });

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-wrapper")) {
            dropdown.classList.add("hidden");
        }
    });
}

async function selectName(name, gender) {
    document.getElementById("search-input").value = `${name} (${gender})`;
    document.getElementById("typeahead-dropdown").classList.add("hidden");
    state.selectedName = { name, gender };

    const url = `data/details/${encodeURIComponent(name)}_${gender}.json`;
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("not found");
        state.nameDetail = await resp.json();
    } catch {
        state.nameDetail = null;
    }

    const section = document.getElementById("name-detail-section");
    section.classList.remove("hidden");
    if (state.nameDetail) {
        document.getElementById("name-detail-title").textContent =
            `${name} (${gender === "F" ? "Female" : "Male"})`;
        renderCountChart();
        renderRankChart();
    } else {
        document.getElementById("name-detail-title").textContent = `${name} — no data found`;
        document.getElementById("count-chart").innerHTML = "";
        document.getElementById("rank-chart").innerHTML = "";
    }
    syncUrl(true);
}

// ── Year Range Slider ──

function setupYearInputs() {
    const startInput = document.getElementById("year-start");
    const endInput = document.getElementById("year-end");
    const labelStart = document.getElementById("range-label-start");
    const labelEnd = document.getElementById("range-label-end");
    const fill = document.getElementById("range-track-fill");
    const rangeLabel = document.getElementById("range-mode-label");

    function updateFill() {
        const min = parseInt(startInput.min);
        const max = parseInt(startInput.max);
        const pctStart = ((state.yearStart - min) / (max - min)) * 100;
        const pctEnd = ((state.yearEnd - min) / (max - min)) * 100;
        fill.style.left = pctStart + "%";
        fill.style.right = (100 - pctEnd) + "%";
    }

    const renderCharts = debounce(() => {
        if (state.nameDetail) {
            renderCountChart();
            renderRankChart();
        }
        if (state.rangeMode) {
            renderTopNames();
        }
        syncUrl();
    }, 80);

    function onInput() {
        let s = parseInt(startInput.value);
        let e = parseInt(endInput.value);

        // Prevent handles from crossing
        if (s > e) {
            if (this === startInput) startInput.value = e;
            else endInput.value = s;
            return;
        }

        state.yearStart = s;
        state.yearEnd = e;
        labelStart.textContent = s;
        labelEnd.textContent = e;
        updateFill();
        if (state.rangeMode) rangeLabel.textContent = `${s}\u2013${e}`;
        renderCharts();
    }

    startInput.addEventListener("input", onInput);
    endInput.addEventListener("input", onInput);
    updateFill();
}

// ── Top Names Controls ──

function setupTopNamesControls() {
    const select = document.getElementById("top-year-select");
    for (let y = 2024; y >= 1880; y--) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        select.appendChild(opt);
    }
    select.addEventListener("change", () => { renderTopNames(); syncUrl(); });

    const rangeBtn = document.getElementById("range-mode-btn");
    const rangeLabel = document.getElementById("range-mode-label");

    function updateRangeMode() {
        rangeBtn.classList.toggle("active", state.rangeMode);
        select.classList.toggle("hidden", state.rangeMode);
        rangeLabel.classList.toggle("hidden", !state.rangeMode);
        if (state.rangeMode) {
            rangeLabel.textContent = `${state.yearStart}\u2013${state.yearEnd}`;
        }
    }

    rangeBtn.addEventListener("click", () => {
        state.rangeMode = !state.rangeMode;
        updateRangeMode();
        renderTopNames();
        syncUrl();
    });
}

// ── Line Charts ──

function getChartWidth(containerId) {
    const el = document.getElementById(containerId);
    return el.clientWidth - 1; // 1px for border rounding
}

// Shared tooltip element — created once, reused by all charts
const tooltip = d3.select("body").append("div").attr("class", "chart-tooltip").style("opacity", 0);

function renderCountChart() {
    const container = document.getElementById("count-chart");
    container.innerHTML = "";
    const detail = state.nameDetail;
    if (!detail) return;

    const width = getChartWidth("count-chart");
    const height = 300;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;
    const color = COLORS[detail.gender];

    const data = [];
    for (let y = state.yearStart; y <= state.yearEnd; y++) {
        const entry = detail.years[y];
        data.push({ year: y, count: entry ? entry.count : null });
    }

    const x = d3.scaleLinear().domain([state.yearStart, state.yearEnd]).range([0, innerW]);
    const maxCount = d3.max(data, (d) => d.count) || 1;
    const y = d3.scaleLinear().domain([0, maxCount]).nice().range([innerH, 0]);

    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid
    g.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(""));

    // Axes
    g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(Math.min(innerW / 80, 10)).tickFormat(d3.format("d")));

    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",d")));

    // Line
    const line = d3
        .line()
        .defined((d) => d.count !== null)
        .x((d) => x(d.year))
        .y((d) => y(d.count));

    const path = g
        .append("path")
        .datum(data)
        .attr("class", "line-path")
        .attr("stroke", color)
        .attr("d", line);

    // Animate
    const totalLength = path.node().getTotalLength();
    path.attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(800)
        .attr("stroke-dashoffset", 0);

    // Tooltip
    addLineTooltip(svg, g, data, x, (d) => y(d.count), innerW, innerH, color, (d) => `${d.year}: ${d.count.toLocaleString()}`);
}

function renderRankChart() {
    const container = document.getElementById("rank-chart");
    container.innerHTML = "";
    const detail = state.nameDetail;
    if (!detail) return;

    const width = getChartWidth("rank-chart");
    const height = 300;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;
    const color = COLORS[detail.gender];
    const maxRank = 500;

    const data = [];
    for (let y = state.yearStart; y <= state.yearEnd; y++) {
        const entry = detail.years[y];
        data.push({
            year: y,
            rank: entry ? entry.rank : null,
            count: entry ? entry.count : null,
            capped: entry ? entry.rank > maxRank : false,
        });
    }

    const x = d3.scaleLinear().domain([state.yearStart, state.yearEnd]).range([0, innerW]);
    const y = d3.scaleLinear().domain([maxRank, 1]).range([innerH, 0]);

    const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    const rankTicks = [1, 100, 200, 300, 400, 500];

    // Grid
    g.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickValues(rankTicks).tickSize(-innerW).tickFormat(""));

    // Axes
    g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(Math.min(innerW / 80, 10)).tickFormat(d3.format("d")));

    g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickValues(rankTicks));

    // Axis label
    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -45)
        .attr("x", -innerH / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#8c8478")
        .text("Rank (#1 = top)");

    // Line — exclude ranks beyond cap
    const line = d3
        .line()
        .defined((d) => d.rank !== null && !d.capped)
        .x((d) => x(d.year))
        .y((d) => y(d.rank));

    const path = g
        .append("path")
        .datum(data)
        .attr("class", "line-path")
        .attr("stroke", color)
        .attr("d", line);

    const totalLength = path.node().getTotalLength();
    path.attr("stroke-dasharray", `${totalLength} ${totalLength}`)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(800)
        .attr("stroke-dashoffset", 0);

    // Tooltip
    const filteredData = data.filter((d) => d.rank !== null && !d.capped);
    addLineTooltip(svg, g, filteredData, x, (d) => y(d.rank), innerW, innerH, color, (d) =>
        `${d.year}: Rank #${d.rank} (${d.count.toLocaleString()})`
    );
}

function addLineTooltip(svg, g, data, xScale, yFn, innerW, innerH, color, formatFn) {
    const validData = data.filter((d) => (d.count !== null && d.count !== undefined));
    if (validData.length === 0) return;

    const tooltipLine = g.append("line").attr("class", "tooltip-line").attr("y1", 0).attr("y2", innerH).style("opacity", 0);
    const tooltipCircle = g.append("circle").attr("class", "tooltip-circle").attr("r", 4).attr("fill", color).style("opacity", 0);

    const bisect = d3.bisector((d) => d.year).left;

    svg.append("rect")
        .attr("width", innerW)
        .attr("height", innerH)
        .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mousemove", function (event) {
            const [mx] = d3.pointer(event, this);
            const year = xScale.invert(mx);
            let i = bisect(validData, year);
            if (i >= validData.length) i = validData.length - 1;
            if (i > 0 && Math.abs(validData[i - 1].year - year) < Math.abs(validData[i].year - year)) {
                i = i - 1;
            }
            const d = validData[i];
            if (!d) return;

            const px = xScale(d.year);
            const py = yFn(d);

            tooltipLine.attr("x1", px).attr("x2", px).style("opacity", 1);
            tooltipCircle.attr("cx", px).attr("cy", py).style("opacity", 1);
            tooltip
                .style("opacity", 1)
                .html(formatFn(d))
                .style("left", event.pageX + 12 + "px")
                .style("top", event.pageY - 20 + "px");
        })
        .on("mouseleave", () => {
            tooltipLine.style("opacity", 0);
            tooltipCircle.style("opacity", 0);
            tooltip.style("opacity", 0);
        });
}

// ── Top Names Bar Charts ──

function renderTopNames() {
    ["F", "M"].forEach((gender) => {
        const containerId = gender === "F" ? "top-female-chart" : "top-male-chart";
        const container = document.getElementById(containerId);
        container.innerHTML = "";

        let topData;
        if (state.rangeMode) {
            // Aggregate across year range
            const counts = {};
            for (let y = state.yearStart; y <= state.yearEnd; y++) {
                const yearData = state.yearlyTop[y];
                if (!yearData || !yearData[gender]) continue;
                yearData[gender].forEach(({ name, count }) => {
                    counts[name] = (counts[name] || 0) + count;
                });
            }
            topData = Object.entries(counts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
        } else {
            const year = document.getElementById("top-year-select").value;
            const yearData = state.yearlyTop[year];
            topData = yearData && yearData[gender] ? yearData[gender].slice(0, 10) : [];
        }

        if (topData.length === 0) {
            container.innerHTML = '<div class="no-data-msg">No data available</div>';
            return;
        }

        const width = container.clientWidth - 1;
        const barHeight = 28;
        const height = MARGIN.top + topData.length * barHeight + MARGIN.bottom;
        const innerW = width - MARGIN.left - MARGIN.right;
        const innerH = topData.length * barHeight;
        const color = COLORS[gender];

        const x = d3.scaleLinear().domain([0, d3.max(topData, (d) => d.count)]).range([0, innerW]);
        const y = d3
            .scaleBand()
            .domain(topData.map((d) => d.name))
            .range([0, innerH])
            .padding(0.2);

        const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
        const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

        // Bars
        g.selectAll("rect")
            .data(topData)
            .enter()
            .append("rect")
            .attr("y", (d) => y(d.name))
            .attr("height", y.bandwidth())
            .attr("fill", color)
            .attr("rx", 3)
            .attr("width", 0)
            .on("mousemove", (event, d) => {
                tooltip
                    .style("opacity", 1)
                    .html(`${d.name}: <b>${d.count.toLocaleString()}</b>`)
                    .style("left", event.pageX + 12 + "px")
                    .style("top", event.pageY - 20 + "px");
            })
            .on("mouseleave", () => {
                tooltip.style("opacity", 0);
            })
            .transition()
            .duration(600)
            .attr("width", (d) => x(d.count));

        // Labels
        g.selectAll(".bar-label")
            .data(topData)
            .enter()
            .append("text")
            .attr("class", "bar-label")
            .attr("x", (d) => x(d.count) + 5)
            .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
            .attr("dy", "0.35em")
            .text((d) => d.count.toLocaleString())
            .style("pointer-events", "none")
            .style("opacity", 0)
            .transition()
            .delay(400)
            .duration(200)
            .style("opacity", 1);

        // Y axis (names)
        g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickSize(0).tickPadding(8));
    });
}

// ── Resize ──

let lastWidth = window.innerWidth;
function onResize() {
    if (Math.abs(window.innerWidth - lastWidth) < 2) return;
    lastWidth = window.innerWidth;
    if (state.nameDetail) {
        renderCountChart();
        renderRankChart();
    }
    renderTopNames();
}

// ── Utilities ──

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(str) {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// ── Start ──
init();
