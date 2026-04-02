// ── Minimal Test Runner ──

const output = document.getElementById("test-output");
let totalPass = 0;
let totalFail = 0;
let currentSuite = null;
let suiteDiv = null;

function suite(name) {
    currentSuite = name;
    suiteDiv = document.createElement("div");
    suiteDiv.className = "suite";
    suiteDiv.innerHTML = `<div class="suite-name">${name}</div>`;
    output.appendChild(suiteDiv);
}

function assert(description, condition) {
    const div = document.createElement("div");
    div.className = "result";
    if (condition) {
        div.classList.add("pass");
        div.textContent = `  PASS  ${description}`;
        totalPass++;
    } else {
        div.classList.add("fail");
        div.textContent = `  FAIL  ${description}`;
        totalFail++;
    }
    suiteDiv.appendChild(div);
}

function assertEqual(description, actual, expected) {
    const pass = actual === expected;
    if (!pass) {
        description += ` (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`;
    }
    assert(description, pass);
}

function showSummary() {
    const div = document.createElement("div");
    div.className = "summary";
    const total = totalPass + totalFail;
    div.innerHTML = totalFail === 0
        ? `<span class="pass">${totalPass}/${total} tests passed</span>`
        : `<span class="fail">${totalFail} failed</span>, <span class="pass">${totalPass} passed</span> of ${total}`;
    output.appendChild(div);
    document.title = totalFail === 0 ? `PASS — Tests` : `FAIL (${totalFail}) — Tests`;
}

// ── Wait for app init, then run tests ──

function waitForInit() {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (state.namesIndex.length > 0 && state.yearlyTop["2024"]) {
                clearInterval(check);
                resolve();
            }
        }, 50);
    });
}

async function runTests() {
    await waitForInit();

    testUtilities();
    testInitialState();
    testBuildUrlParams();
    testParseUrlParams();
    testSliderState();
    testRangeMode();
    testTopNamesRendering();
    await testSelectName();
    await testSelectNameInvalid();
    testUrlSyncAfterInteractions();
    await testUrlRestore();

    showSummary();
}

// ── Test Suites ──

function testUtilities() {
    suite("Utilities");

    assertEqual("escapeHtml escapes &", escapeHtml("a&b"), "a&amp;b");
    assertEqual("escapeHtml escapes <", escapeHtml("<div>"), "&lt;div&gt;");
    assertEqual('escapeHtml escapes "', escapeHtml('a"b'), "a&quot;b");
    assertEqual("escapeHtml passes plain text", escapeHtml("hello"), "hello");

    assertEqual("escapeAttr escapes &", escapeAttr("a&b"), "a&amp;b");
    assertEqual('escapeAttr escapes "', escapeAttr('a"b'), "a&quot;b");
    assertEqual("escapeAttr does not escape <", escapeAttr("<b>"), "<b>");

    // debounce
    let callCount = 0;
    const debounced = debounce(() => callCount++, 30);
    debounced(); debounced(); debounced();
    assertEqual("debounce does not fire synchronously", callCount, 0);
}

function testInitialState() {
    suite("Initial State");

    assert("namesIndex loaded", state.namesIndex.length > 100000);
    assert("yearlyTop has 2024", state.yearlyTop["2024"] !== undefined);
    assert("yearlyTop has 1880", state.yearlyTop["1880"] !== undefined);
    assert("nameSet built", state.nameSet instanceof Set && state.nameSet.size > 0);
    assertEqual("yearStart default", state.yearStart, 1880);
    assertEqual("yearEnd default", state.yearEnd, 2024);
    assertEqual("rangeMode default", state.rangeMode, false);
    assertEqual("selectedName default", state.selectedName, null);
    assertEqual("nameDetail default", state.nameDetail, null);

    // Verify namesIndex structure
    const first = state.namesIndex[0];
    assert("namesIndex entries have name", typeof first.n === "string");
    assert("namesIndex entries have gender", first.g === "F" || first.g === "M");
    assert("namesIndex entries have total", typeof first.t === "number" && first.t > 0);

    // Verify yearlyTop structure
    const y2024 = state.yearlyTop["2024"];
    assert("yearlyTop has F array", Array.isArray(y2024.F) && y2024.F.length > 0);
    assert("yearlyTop has M array", Array.isArray(y2024.M) && y2024.M.length > 0);
    assert("yearlyTop entries have name", typeof y2024.F[0].name === "string");
    assert("yearlyTop entries have count", typeof y2024.F[0].count === "number");

    // Year dropdown populated
    const select = document.getElementById("top-year-select");
    assert("year dropdown populated", select.options.length > 100);
    assertEqual("year dropdown default is 2024", select.value, "2024");
}

function testBuildUrlParams() {
    suite("buildUrlParams");

    // Save original state
    const orig = { ...state, selectedName: state.selectedName };

    // Default state — should produce no params
    state.selectedName = null;
    state.yearStart = 1880;
    state.yearEnd = 2024;
    state.rangeMode = false;
    document.getElementById("top-year-select").value = "2024";
    let params = buildUrlParams();
    assertEqual("default state produces empty params", params.toString(), "");

    // With selected name
    state.selectedName = { name: "Mary", gender: "F" };
    params = buildUrlParams();
    assertEqual("name param set", params.get("name"), "Mary");
    assertEqual("gender param set", params.get("gender"), "F");

    // With custom year range
    state.yearStart = 1950;
    state.yearEnd = 2000;
    params = buildUrlParams();
    assertEqual("start param set", params.get("start"), "1950");
    assertEqual("end param set", params.get("end"), "2000");

    // With range mode
    state.rangeMode = true;
    params = buildUrlParams();
    assertEqual("range param set", params.get("range"), "1");
    assertEqual("year param absent in range mode", params.get("year"), null);

    // With custom top year (not range mode)
    state.rangeMode = false;
    document.getElementById("top-year-select").value = "1990";
    params = buildUrlParams();
    assertEqual("year param set", params.get("year"), "1990");

    // Restore
    Object.assign(state, orig);
    document.getElementById("top-year-select").value = "2024";
}

function testParseUrlParams() {
    suite("parseUrlParams");

    const origSearch = window.location.search;

    // No params
    history.replaceState(null, "", window.location.pathname);
    let p = parseUrlParams();
    assertEqual("no params: name is null", p.name, null);
    assertEqual("no params: yearStart is null", p.yearStart, null);
    assertEqual("no params: rangeMode is false", p.rangeMode, false);

    // Name + gender
    history.replaceState(null, "", "?name=Mary&gender=F");
    p = parseUrlParams();
    assertEqual("name parsed", p.name, "Mary");
    assertEqual("gender parsed", p.gender, "F");

    // Year range
    history.replaceState(null, "", "?start=1950&end=2000");
    p = parseUrlParams();
    assertEqual("start parsed", p.yearStart, 1950);
    assertEqual("end parsed", p.yearEnd, 2000);

    // Swapped years get corrected
    history.replaceState(null, "", "?start=2000&end=1950");
    p = parseUrlParams();
    assertEqual("swapped start corrected", p.yearStart, 1950);
    assertEqual("swapped end corrected", p.yearEnd, 2000);

    // Out of range clamped
    history.replaceState(null, "", "?start=1800&end=2100");
    p = parseUrlParams();
    assertEqual("start clamped to 1880", p.yearStart, 1880);
    assertEqual("end clamped to 2024", p.yearEnd, 2024);

    // Range mode
    history.replaceState(null, "", "?range=1");
    p = parseUrlParams();
    assertEqual("range mode parsed", p.rangeMode, true);

    // Top year
    history.replaceState(null, "", "?year=1990");
    p = parseUrlParams();
    assertEqual("top year parsed", p.topYear, 1990);

    // Invalid gender infers from namesIndex
    history.replaceState(null, "", "?name=Mary&gender=X");
    p = parseUrlParams();
    assertEqual("invalid gender inferred", p.gender, "F");
    assertEqual("name preserved with inferred gender", p.name, "Mary");

    // Nonexistent name with no gender
    history.replaceState(null, "", "?name=Zzzznotaname");
    p = parseUrlParams();
    assertEqual("nonexistent name returns null", p.name, null);

    // Invalid numeric values
    history.replaceState(null, "", "?start=abc&end=xyz");
    p = parseUrlParams();
    assertEqual("non-numeric start is null", p.yearStart, null);
    assertEqual("non-numeric end is null", p.yearEnd, null);

    // Restore original URL
    history.replaceState(null, "", origSearch || window.location.pathname);
}

function testSliderState() {
    suite("Year Slider State");

    const startInput = document.getElementById("year-start");
    const endInput = document.getElementById("year-end");
    const labelStart = document.getElementById("range-label-start");
    const labelEnd = document.getElementById("range-label-end");

    // Simulate slider change
    const origStart = state.yearStart;
    const origEnd = state.yearEnd;

    startInput.value = 1950;
    endInput.value = 2000;
    startInput.dispatchEvent(new Event("input"));

    // The onInput handler reads from the inputs and updates state
    assertEqual("yearStart updated by slider", state.yearStart, 1950);
    assertEqual("label start updated", labelStart.textContent, "1950");

    endInput.dispatchEvent(new Event("input"));
    assertEqual("yearEnd updated by slider", state.yearEnd, 2000);
    assertEqual("label end updated", labelEnd.textContent, "2000");

    // Restore
    startInput.value = origStart;
    endInput.value = origEnd;
    startInput.dispatchEvent(new Event("input"));
    endInput.dispatchEvent(new Event("input"));
}

function testRangeMode() {
    suite("Range Mode Toggle");

    const rangeBtn = document.getElementById("range-mode-btn");
    const rangeLabel = document.getElementById("range-mode-label");
    const select = document.getElementById("top-year-select");

    assertEqual("rangeMode starts false", state.rangeMode, false);
    assert("range label hidden initially", rangeLabel.classList.contains("hidden"));
    assert("year select visible initially", !select.classList.contains("hidden"));

    // Toggle on
    rangeBtn.click();
    assertEqual("rangeMode toggled to true", state.rangeMode, true);
    assert("range label visible after toggle", !rangeLabel.classList.contains("hidden"));
    assert("year select hidden after toggle", select.classList.contains("hidden"));
    assert("button has active class", rangeBtn.classList.contains("active"));
    assert("range label shows year range", rangeLabel.textContent.includes("\u2013"));

    // Toggle off
    rangeBtn.click();
    assertEqual("rangeMode toggled back to false", state.rangeMode, false);
    assert("range label hidden again", rangeLabel.classList.contains("hidden"));
    assert("year select visible again", !select.classList.contains("hidden"));
    assert("button active class removed", !rangeBtn.classList.contains("active"));
}

function testTopNamesRendering() {
    suite("Top Names Rendering");

    const femaleChart = document.getElementById("top-female-chart");
    const maleChart = document.getElementById("top-male-chart");

    // After init, top names should be rendered
    assert("female chart has SVG", femaleChart.querySelector("svg") !== null);
    assert("male chart has SVG", maleChart.querySelector("svg") !== null);

    // Should have bars (rect elements)
    const femaleBars = femaleChart.querySelectorAll("rect");
    const maleBars = maleChart.querySelectorAll("rect");
    assert("female chart has 10 bars", femaleBars.length === 10);
    assert("male chart has 10 bars", maleBars.length === 10);

    // Change year and re-render
    const select = document.getElementById("top-year-select");
    select.value = "1950";
    select.dispatchEvent(new Event("change"));

    const newFemaleBars = femaleChart.querySelectorAll("rect");
    assert("female chart re-rendered for 1950", newFemaleBars.length === 10);

    // Restore
    select.value = "2024";
    select.dispatchEvent(new Event("change"));
}

async function testSelectName() {
    suite("Select Name");

    const section = document.getElementById("name-detail-section");
    const title = document.getElementById("name-detail-title");
    const countChart = document.getElementById("count-chart");
    const rankChart = document.getElementById("rank-chart");
    const searchInput = document.getElementById("search-input");

    assert("detail section hidden before selection", section.classList.contains("hidden"));

    await selectName("Mary", "F");

    assertEqual("selectedName set", state.selectedName.name, "Mary");
    assertEqual("selectedName gender", state.selectedName.gender, "F");
    assert("nameDetail loaded", state.nameDetail !== null);
    assert("nameDetail has years", Object.keys(state.nameDetail.years).length > 50);
    assert("detail section visible", !section.classList.contains("hidden"));
    assert("title set", title.textContent.includes("Mary"));
    assertEqual("search input shows name", searchInput.value, "Mary (F)");

    // Charts rendered
    assert("count chart has SVG", countChart.querySelector("svg") !== null);
    assert("rank chart has SVG", rankChart.querySelector("svg") !== null);

    // Count chart has a line path
    assert("count chart has line path", countChart.querySelector(".line-path") !== null);
    assert("rank chart has line path", rankChart.querySelector(".line-path") !== null);

    // Select a different name
    await selectName("James", "M");
    assertEqual("selectedName updated", state.selectedName.name, "James");
    assert("title updated", title.textContent.includes("James"));

    // Clean up
    state.selectedName = null;
    state.nameDetail = null;
    section.classList.add("hidden");
    searchInput.value = "";
    countChart.innerHTML = "";
    rankChart.innerHTML = "";
}

async function testSelectNameInvalid() {
    suite("Select Name — Invalid");

    const section = document.getElementById("name-detail-section");
    const title = document.getElementById("name-detail-title");

    await selectName("Zzzzzznotreal", "F");

    assert("detail section shown even for invalid", !section.classList.contains("hidden"));
    assertEqual("nameDetail is null for invalid name", state.nameDetail, null);
    assert("title shows no data message", title.textContent.includes("no data found"));

    // Clean up
    state.selectedName = null;
    state.nameDetail = null;
    section.classList.add("hidden");
    document.getElementById("search-input").value = "";
}

function testUrlSyncAfterInteractions() {
    suite("URL Sync");

    // Reset to clean state
    state.selectedName = null;
    state.yearStart = 1880;
    state.yearEnd = 2024;
    state.rangeMode = false;
    document.getElementById("top-year-select").value = "2024";

    syncUrl();
    assertEqual("default state produces clean URL", window.location.search, "");

    // Simulate slider change that triggers syncUrl
    state.yearStart = 1950;
    state.yearEnd = 2000;
    syncUrl();
    assert("URL has start param", window.location.search.includes("start=1950"));
    assert("URL has end param", window.location.search.includes("end=2000"));

    // pushState for name
    state.selectedName = { name: "Sarah", gender: "F" };
    syncUrl(true);
    assert("URL has name param after push", window.location.search.includes("name=Sarah"));
    assert("URL has gender param after push", window.location.search.includes("gender=F"));

    // Clean up
    state.selectedName = null;
    state.yearStart = 1880;
    state.yearEnd = 2024;
    syncUrl();
    history.replaceState(null, "", window.location.pathname);
}

async function testUrlRestore() {
    suite("URL Restore");

    // Set URL with state params and restore
    history.replaceState(null, "", "?name=Mary&gender=F&start=1920&end=1980");
    const params = parseUrlParams();
    await restoreFromUrl(params);

    assertEqual("yearStart restored", state.yearStart, 1920);
    assertEqual("yearEnd restored", state.yearEnd, 1980);
    assertEqual("slider start value", document.getElementById("year-start").value, "1920");
    assertEqual("slider end value", document.getElementById("year-end").value, "1980");
    assertEqual("name selected from URL", state.selectedName.name, "Mary");
    assert("detail section visible from URL", !document.getElementById("name-detail-section").classList.contains("hidden"));

    // Restore with range mode
    state.selectedName = null;
    state.nameDetail = null;
    document.getElementById("name-detail-section").classList.add("hidden");
    document.getElementById("search-input").value = "";

    history.replaceState(null, "", "?range=1&start=1900&end=1950");
    const params2 = parseUrlParams();
    // Reset rangeMode before restoring
    state.rangeMode = false;
    document.getElementById("range-mode-btn").classList.remove("active");
    document.getElementById("top-year-select").classList.remove("hidden");
    document.getElementById("range-mode-label").classList.add("hidden");

    await restoreFromUrl(params2);
    assertEqual("rangeMode restored", state.rangeMode, true);
    assert("range button active", document.getElementById("range-mode-btn").classList.contains("active"));

    // Clean up — full reset
    state.yearStart = 1880;
    state.yearEnd = 2024;
    state.rangeMode = false;
    state.selectedName = null;
    state.nameDetail = null;
    document.getElementById("year-start").value = 1880;
    document.getElementById("year-end").value = 2024;
    document.getElementById("range-label-start").textContent = "1880";
    document.getElementById("range-label-end").textContent = "2024";
    document.getElementById("range-mode-btn").classList.remove("active");
    document.getElementById("top-year-select").classList.remove("hidden");
    document.getElementById("top-year-select").value = "2024";
    document.getElementById("range-mode-label").classList.add("hidden");
    document.getElementById("name-detail-section").classList.add("hidden");
    document.getElementById("search-input").value = "";
    history.replaceState(null, "", window.location.pathname);
}

// ── Run ──
runTests();
