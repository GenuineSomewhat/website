#!/usr/bin/env python3
"""
Simple GitHub webhook receiver that auto-pulls on push
Listens on port 9000 for GitHub webhook events
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import subprocess
import os
from pathlib import Path

REPO_PATH = Path(__file__).parent
SECRET = "d70bb22d1d9398995774dd120d4286b9623a2f533d1409543c8d9daaa9531a9c"  # Change this!

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle incoming webhook POST requests"""
        if self.path != '/webhook':
            self.send_error(404)
            return
        
        # Verify GitHub signature (optional but recommended)
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        try:
            event = json.loads(body)
            event_type = self.headers.get('X-GitHub-Event', '')
            
            # Only pull on push events
            if event_type == 'push':
                print(f"📍 Push detected by {event.get('pusher', {}).get('name', 'unknown')}")
                self.pull_repo()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'success'}).encode())
            else:
                self.send_response(202)  # Accepted but not processed
                self.end_headers()
                
        except Exception as e:
            print(f"❌ Error: {e}")
            self.send_error(500)
    
    def pull_repo(self):
        """Execute git pull"""
        try:
            os.chdir(REPO_PATH)
            result = subprocess.run(
                ['git', 'pull'],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0:
                print(f"✓ Git pull successful")
                print(f"  Output: {result.stdout[:100]}")
            else:
                print(f"⚠ Git pull failed: {result.stderr[:100]}")
        except Exception as e:
            print(f"❌ Pull error: {e}")
    
    def log_message(self, format, *args):
        """Quiet logging"""
        pass

if __name__ == '__main__':
    server_address = ('0.0.0.0', 9000)
    httpd = HTTPServer(server_address, WebhookHandler)
    
    print("🪝 GitHub Webhook receiver running on port 9000")
    print("   Waiting for push events...")
    print("   Configure webhook at: https://github.com/YOUR-USERNAME/website/settings/hooks")
    print("   Payload URL: http://YOUR-ZIMA-IP:9000/webhook")
    print("   Press Ctrl+C to stop")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ Webhook receiver stopped")
        httpd.shutdown()
