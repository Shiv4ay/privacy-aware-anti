"""
Serve the live dashboard at http://localhost:8888

Opens live_dashboard.html in your browser automatically.
Run this in a separate terminal while run_bulk_test.py is running.

Usage:
    python backend/scripts/serve_dashboard.py
"""

import http.server
import os
import threading
import webbrowser

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8888


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SCRIPT_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # suppress per-request logs


def main():
    server = http.server.HTTPServer(("localhost", PORT), NoCacheHandler)
    url = f"http://localhost:{PORT}/live_dashboard.html"
    print(f"[Dashboard] Serving at {url}")
    print(f"[Dashboard] Press Ctrl+C to stop\n")

    # Open browser after short delay
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Dashboard] Stopped.")


if __name__ == "__main__":
    main()
