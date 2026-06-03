"""Serve af_dashboard.html on port 8889."""
import http.server
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8889

os.chdir(SCRIPT_DIR)

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silence logs

print(f"[Dashboard] http://localhost:{PORT}/af_dashboard.html")
http.server.HTTPServer(("", PORT), Handler).serve_forever()
