#!/usr/bin/env python3
"""
Clean URL web server using only Python standard library (no Flask needed)
Handles: /music -> music.html, / -> index.html
Run with: python3 serve.py
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import urllib.parse
import os

class CleanURLHandler(SimpleHTTPRequestHandler):
    """HTTP handler that supports clean URLs without .html extensions"""
    
    def do_GET(self):
        """Handle GET requests with clean URL logic"""
        # Parse the request path
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        # Remove query string and fragments for file lookup
        if '?' in path:
            path = path.split('?')[0]
        if '#' in path:
            path = path.split('#')[0]
        
        # Normalize path
        path = path.lstrip('/')
        
        # Security: prevent directory traversal
        normalized = Path(path).resolve()
        base = Path.cwd().resolve()
        try:
            normalized.relative_to(base)
        except ValueError:
            self.send_error(403, "Forbidden")
            return
        
        # Try different file resolution strategies
        file_path = None
        
        # Strategy 1: Root path -> index.html
        if path == '' or path == '/':
            if Path('index.html').is_file():
                file_path = 'index.html'
        else:
            # Strategy 2: Direct file match (already has extension)
            if Path(path).is_file():
                file_path = path
            # Strategy 3: Add .html extension (clean URL)
            elif Path(f"{path}.html").is_file():
                file_path = f"{path}.html"
            # Strategy 4: Directory with index.html
            elif Path(path).is_dir() and Path(f"{path}/index.html").is_file():
                file_path = f"{path}/index.html"
        
        # Serve the file or 404
        if file_path:
            self.path = '/' + file_path
            super().do_GET()
        else:
            # Try to serve custom 404.html
            if Path('404.html').is_file():
                self.path = '/404.html'
                self.send_response(404)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                with open('404.html', 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, "Not Found")
    
    def log_message(self, format, *args):
        """Custom logging"""
        print(f"[{self.client_address[0]}] {format % args}")

if __name__ == '__main__':
    os.chdir(Path(__file__).parent)
    
    server_address = ('0.0.0.0', 8000)
    httpd = HTTPServer(server_address, CleanURLHandler)
    
    print("🚀 Website server running at http://localhost:8000")
    print("   Clean URLs enabled (no .html needed)")
    print("   /music -> music.html")
    print("   / -> index.html")
    print("   Press Ctrl+C to stop")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Server stopped")
        httpd.shutdown()
