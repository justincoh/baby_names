.PHONY: run

# Serve the site locally. Requires a real HTTP server because the app uses
# fetch(), which is blocked on file:// URLs.
run:
	@echo "Serving Baby Names Explorer at http://localhost:8000"
	@echo "Open http://localhost:8000 in your browser (Ctrl+C to stop)."
	@python3 -m http.server 8000
