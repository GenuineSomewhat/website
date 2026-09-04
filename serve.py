#!/usr/bin/env python3
"""
Flask web server for Clanker website with patch encoding API.
Serves static files and provides API endpoint for creating patch images.
Run with: python3 serve.py
"""

from flask import Flask, request, send_file, jsonify
from pathlib import Path
import io
import os
from patch_encoder import encode_file_to_patch

app = Flask(__name__, static_folder='.', static_url_path='')


# Add error handler for API errors to ensure JSON responses
@app.errorhandler(Exception)
def handle_api_error(error):
    """Catch unhandled exceptions and return JSON for API routes"""
    if request.path.startswith('/api/'):
        print(f"[API ERROR] Unhandled exception: {str(error)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(error) or 'Internal server error'}), 500
    # For non-API routes, use default error handling
    raise error


@app.route('/')
def index():
    """Serve index.html"""
    return send_file('index.html')


@app.route('/<path:path>')
def serve_page(path):
    """Serve pages without .html extension"""
    # Try direct file first
    if Path(path).is_file():
        return send_file(path)
    
    # Try with .html extension
    html_file = Path(f"{path}.html")
    if html_file.is_file():
        return send_file(str(html_file))
    
    # Try directory with index.html
    dir_path = Path(path)
    if dir_path.is_dir() and (dir_path / 'index.html').is_file():
        return send_file(str(dir_path / 'index.html'))
    
    # 404
    if Path('404.html').is_file():
        with open('404.html', 'r') as f:
            return f.read(), 404
    return "Not found", 404


@app.route('/api/encode-patch', methods=['POST'])
def encode_patch():
    """
    API endpoint to encode a file into a patch image.
    
    POST /api/encode-patch
    Form data:
        - file: file upload
        - folderPath: target folder (e.g., /Audio)
    
    Returns:
        PNG image file or JSON error
    """
    try:
        # Check for file
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if not file or file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get folder path
        folder_path = request.form.get('folderPath', '/').strip()
        if not folder_path:
            folder_path = '/'
        
        print(f"[API] Encoding patch - file: {file.filename}, folder: {folder_path}")
        
        # Read file data
        file_data = file.read()
        if not file_data:
            return jsonify({'error': 'File is empty'}), 400
            
        print(f"[API] File size: {len(file_data)} bytes")
        
        # Encode to patch
        patch_png = encode_file_to_patch(file_data, file.filename, folder_path)
        
        # Return PNG file
        png_buffer = io.BytesIO(patch_png)
        return send_file(
            png_buffer,
            mimetype='image/png',
            as_attachment=True,
            download_name=f"{file.filename}.patch.png"
        )
    
    except Exception as e:
        print(f"[API ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e) or 'Internal server error'}), 500


if __name__ == '__main__':
    os.chdir(Path(__file__).parent)
    
    print("🚀 Website server running at http://localhost:8000")
    print("   /patch -> Patch maker")
    print("   /api/encode-patch -> Patch encoding API")
    print("   Press Ctrl+C to stop")
    
    app.run(host='0.0.0.0', port=8000, debug=False)
