# Baby Names Explorer

## Project Overview
Single-page D3.js web app visualizing U.S. baby name popularity (1880–2024) from SSA data. No frameworks or build tools — served via `python -m http.server`.

## Raw Dataset
- **Location:** `names/` directory (ignore `NationalReadMe.pdf`)
- **146 files**, named `yob####.txt` (e.g., `yob1880.txt`) covering 1880–2024
- CSV format with **no header row**, columns: `Name,Gender,Count`
- Gender values: `F` or `M`, line endings: Windows-style `\r\n`
- Files are pre-sorted: females first then males, each sorted by count descending

## Architecture

### Preprocessing (`preprocess.py`)
Parses all 146 CSVs and generates `data/` directory (gitignored, regenerate with `python preprocess.py`):
- **`data/names_index.json`** — Array of `{n, g, t}` (name, gender, totalCount), sorted by total descending. Used for typeahead. ~116K entries, ~3.4MB.
- **`data/yearly_top.json`** — `{year: {F: [{name, count}, ...top20], M: [...]}}`. Top 20 stored, top 10 displayed.
- **`data/details/<Name>_<Gender>.json`** — Per name+gender: `{name, gender, years: {year: {count, rank}}}`. Lazy-loaded on search. ~116K files.

### Frontend
- **`index.html`** — Single page: header, controls bar, name detail section (hidden until search), top names section
- **`app.js`** — All D3 charts, typeahead search, state management, event wiring
- **`styles.css`** — CSS Grid layout, system font stack, responsive (stacks at 768px)
- **D3.js v7** loaded via CDN

## Key Features
- **Typeahead search** — Debounced prefix match on ~116K names, filtered by gender, keyboard nav (arrows/enter/escape), top 8 results sorted by popularity
- **Name detail charts** — Count over time (line chart) + Rank over time (inverted y-axis, capped at 500), animated draw-in, interactive tooltips with tracking line
- **Top names bar charts** — Side-by-side female/male horizontal bars, single year or range aggregation mode, hover tooltips + static count labels
- **Dual-handle year range slider** — Two overlapping `<input type="range">` with filled track segment, live year labels
- **Gender filter** — Toggles search results, chart visibility, and grid layout
- **Responsive resize** — Debounced handler recalculates chart widths

## Design Decisions
- Gender colors: `#e15759` (female), `#4e79a7` (male) — colorblind-friendly
- Separate files per name+gender for simple lazy loading
- Line gaps for missing years (no interpolation across absent data)
- Rank y-axis inverted (#1 at top)
- `data/` is gitignored since it's fully reproducible from `preprocess.py`
