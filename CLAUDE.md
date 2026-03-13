# Baby Names Explorer

## Project Overview
Single-page D3.js web app visualizing U.S. baby name popularity (1880–2024) from SSA data. No frameworks or build tools. Hosted on GitHub Pages, deployed via GitHub Actions workflow.

## Raw Dataset
- **Location:** `names/` directory (ignore `NationalReadMe.pdf`)
- **146 files**, named `yob####.txt` (e.g., `yob1880.txt`) covering 1880–2024
- CSV format with **no header row**, columns: `Name,Gender,Count`
- Gender values: `F` or `M`, line endings: Windows-style `\r\n`
- Files are pre-sorted: females first then males, each sorted by count descending
- Total recorded names across all files: ~372 million

## Local Development
Run a local HTTP server (required — `file://` URLs block fetch requests):
```
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

## Architecture

### Preprocessing (`preprocess.py`)
Parses all 146 CSVs and generates `data/` directory (regenerate with `python preprocess.py`):
- **`data/names_index.json`** — Array of `{n, g, t}` (name, gender, totalCount), sorted by total descending. Used for typeahead. ~116K entries, ~3.4MB.
- **`data/yearly_top.json`** — `{year: {F: [{name, count}, ...top20], M: [...]}}`. Top 20 stored, top 10 displayed.
- **`data/details/<Name>_<Gender>.json`** — Per name+gender: `{name, gender, years: {year: {count, rank}}}`. Lazy-loaded on search. ~116K files.

### Frontend
- **`index.html`** — Single page: header, controls bar, name detail section (hidden until search), top names section, footer
- **`app.js`** — All D3 charts, typeahead search, state management, event wiring
- **`styles.css`** — CSS Grid layout, responsive (stacks at 768px)
- **D3.js v7** loaded via CDN
- **Fonts** — Instrument Serif (not currently used but loaded) + DM Sans (all text) via Google Fonts

### Deployment
- **GitHub Pages** via `.github/workflows/deploy.yml`
- `data/` is committed (not gitignored) so Pages can serve it directly
- Deploys automatically on push to `main`

## Key Features
- **Typeahead search** — Debounced prefix match on ~116K names, keyboard nav (arrows/enter/escape), top 8 results sorted by popularity, event delegation for click handling
- **Name detail charts** — Count over time (line chart) + Rank over time (inverted y-axis, capped at 500, gridline at rank 1), animated draw-in, interactive tooltips with tracking line
- **Top names bar charts** — Side-by-side female/male horizontal bars, single year or range aggregation mode, hover tooltips + static count labels
- **Dual-handle year range slider** — Two overlapping `<input type="range">` with filled track segment, live year labels
- **Range mode toggle** — "Use Date Range Above" button hides year dropdown, shows active range label (e.g. "1901–2023"), updates live with slider
- **Shared tooltip** — Single tooltip div created once, reused by all charts to avoid stale DOM elements
- **Responsive** — Resize handler only fires on width change (prevents mobile scroll flashing from address bar), charts stack vertically at 768px, `min-width: 0` + `overflow-x: auto` prevents mobile overflow

## Design
- **Aesthetic:** Editorial/data-story — warm parchment background, subtle paper grain texture, shadow-based cards, fade-up section animations
- **Colors:** Terracotta `#c4553a` (female), deep teal `#2a7f8e` (male), parchment `#f5f0e8` (bg), cream `#fffdf8` (surfaces)
- **Typography:** DM Sans for all text (headings weight 400, body weight 400-600)
- Separate files per name+gender for simple lazy loading
- Line gaps for missing years (no interpolation across absent data)
- Rank y-axis inverted (#1 at top)
