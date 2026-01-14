import http.server
import socketserver
from pathlib import Path

PORT = 8080
DIRECTORY = "/workspace"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

Handler.extensions_map.update({
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
})

print(f"Serving at http://localhost:{PORT}")
print(f"Directory: {DIRECTORY}")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()