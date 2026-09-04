/**
 * Patch Encoder - Client communicates with server-side patch encoder
 */

class PatchEncoder {
    constructor() {
        this.file = null;
    }

    /**
     * Send file to server for encoding
     */
    async encodeFile(folderPath) {
        if (!this.file) {
            throw new Error('No file selected');
        }

        if (!folderPath) {
            throw new Error('Folder path is required');
        }

        const formData = new FormData();
        formData.append('file', this.file);
        formData.append('folderPath', folderPath);

        try {
            const response = await fetch('/api/encode-patch', {
                method: 'POST',
                body: formData
            });

            console.log('[API Response] Status:', response.status, 'OK:', response.ok);
            console.log('[API Response] Content-Type:', response.headers.get('content-type'));
            
            if (!response.ok) {
                // Try to parse as JSON first, fall back to text if it's HTML
                const contentType = response.headers.get('content-type') || '';
                let errorMessage = 'Failed to encode patch';
                
                try {
                    if (contentType.includes('application/json')) {
                        const err = await response.json();
                        errorMessage = err.error || errorMessage;
                    } else {
                        // Server returned HTML (error page) or other format
                        const text = await response.text();
                        console.error('Server error response:', text.substring(0, 200));
                        errorMessage = `Server error (${response.status}): ${response.statusText}`;
                    }
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    errorMessage = `Server error (${response.status}): ${response.statusText}`;
                }
                
                throw new Error(errorMessage);
            }

            // Get blob
            const blob = await response.blob();
            console.log('[API Response] Blob received, size:', blob.size);

            return {
                blob: blob,
                filename: this.file.name,
                folderPath: folderPath,
                fileSize: this.file.size,
                patchSize: blob.size
            };
        } catch (error) {
            console.error('[API Error]', error);
            throw error;
        }
    }

    /**
     * Set file from File object
     */
    setFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }
            
            this.file = file;
            resolve({
                name: file.name,
                size: file.size
            });
        });
    }

    /**
     * Download patch image
     */
    downloadPatch(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.patch.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPatchEncoder);
} else {
    // DOM is already loaded
    initPatchEncoder();
}

function initPatchEncoder() {
    console.log('[PatchEncoder] === Initialization Started ===');
    
    try {
        const encoder = new PatchEncoder();
        
        // Get all required DOM elements
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const clearFileBtn = document.getElementById('clearFile');
        const folderPathInput = document.getElementById('folderPath');
        const createBtn = document.getElementById('createBtn');
        const progress = document.getElementById('progress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const status = document.getElementById('status');
        const downloadSection = document.getElementById('downloadSection');
        const downloadBtn = document.getElementById('downloadBtn');
        const createAnother = document.getElementById('createAnother');
        const patchInfo = document.getElementById('patchInfo');
        
        // Check if all required elements exist
        if (!dropZone) {
            console.error('[PatchEncoder] ERROR: dropZone element not found!');
            return;
        }
        if (!fileInput) {
            console.error('[PatchEncoder] ERROR: fileInput element not found!');
            return;
        }
        
        console.log('[PatchEncoder] ✓ All DOM elements found');
        
        let patchBlob = null;
        let patchFilename = null;
        
        // === Click to select file ===
        dropZone.addEventListener('click', function(e) {
            console.log('[Event] Drop zone clicked');
            e.preventDefault();
            fileInput.click();
        });
        
        console.log('[PatchEncoder] ✓ Click handler attached to drop zone');
        
        // === Drag and drop ===
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
            console.log('[Event] Dragover detected');
        });
        
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
            console.log('[Event] Dragleave detected');
        });
        
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
            console.log('[Event] Drop detected, files:', e.dataTransfer.files.length);
            
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                handleFileSelect(file);
            }
        });
        
        console.log('[PatchEncoder] ✓ Drag and drop handlers attached');
        
        // === File input change ===
        fileInput.addEventListener('change', function(e) {
            console.log('[Event] File input changed, files:', e.target.files.length);
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
        
        console.log('[PatchEncoder] ✓ File input handler attached');
        
        // === Handle file selection ===
        function handleFileSelect(file) {
            try {
                console.log('[Handler] File selected:', file.name, '(' + file.size + ' bytes)');
                encoder.file = file;
                
                fileName.textContent = '📄 ' + file.name;
                fileSize.textContent = formatBytes(file.size);
                fileInfo.style.display = 'flex';
                dropZone.style.display = 'none';
                createBtn.disabled = false;
                status.style.display = 'none';
                
                console.log('[Handler] ✓ File loaded successfully');
            } catch (error) {
                console.error('[Handler] Error:', error);
                showStatus('Error reading file: ' + error.message, 'error');
            }
        }
        
        // === Clear file ===
        clearFileBtn.addEventListener('click', function() {
            console.log('[Event] Clear file clicked');
            encoder.file = null;
            fileInput.value = '';
            fileInfo.style.display = 'none';
            dropZone.style.display = 'block';
            createBtn.disabled = true;
            status.style.display = 'none';
        });
        
        console.log('[PatchEncoder] ✓ Clear button handler attached');
        
        // === Create patch ===
        createBtn.addEventListener('click', async function() {
            const folderPath = folderPathInput.value.trim();
            console.log('[Event] Create patch clicked - folder:', folderPath);
            
            if (!folderPath) {
                showStatus('Please specify a folder path', 'error');
                return;
            }
            
            if (!encoder.file) {
                showStatus('Please select a file', 'error');
                return;
            }
            
            try {
                createBtn.disabled = true;
                progress.style.display = 'block';
                status.style.display = 'none';
                downloadSection.style.display = 'none';
                progressText.textContent = 'Sending to server...';
                progressFill.style.width = '30%';
                
                console.log('[Handler] Sending file to server...');
                const result = await encoder.encodeFile(folderPath);
                console.log('[Handler] ✓ Server response received');
                
                progressFill.style.width = '100%';
                progressText.textContent = 'Complete!';
                
                patchBlob = result.blob;
                patchFilename = result.filename;
                
                patchInfo.innerHTML = '<div><strong>Filename:</strong> <code>' + result.filename + '</code></div>' +
                    '<div><strong>Target:</strong> <code>' + result.folderPath + '</code></div>' +
                    '<div><strong>File Size:</strong> ' + formatBytes(result.fileSize) + '</div>' +
                    '<div><strong>Patch Size:</strong> ' + formatBytes(result.patchSize) + '</div>';
                
                setTimeout(function() {
                    progress.style.display = 'none';
                    downloadSection.style.display = 'block';
                }, 500);
                
            } catch (error) {
                console.error('[Handler] Error creating patch:', error);
                progress.style.display = 'none';
                createBtn.disabled = false;
                showStatus('Error creating patch: ' + error.message, 'error');
            }
        });
        
        console.log('[PatchEncoder] ✓ Create button handler attached');
        
        // === Download patch ===
        downloadBtn.addEventListener('click', function() {
            console.log('[Event] Download clicked');
            if (patchBlob && patchFilename) {
                encoder.downloadPatch(patchBlob, patchFilename);
            }
        });
        
        // === Create another ===
        createAnother.addEventListener('click', function() {
            console.log('[Event] Create another clicked');
            clearFileBtn.click();
            downloadSection.style.display = 'none';
            progress.style.display = 'none';
            createBtn.disabled = false;
            folderPathInput.focus();
        });
        
        console.log('[PatchEncoder] ✓ Download handlers attached');
        
        // === Helper functions ===
        function showStatus(message, type) {
            status.textContent = message;
            status.className = 'status-message ' + (type || 'error');
            status.style.display = 'block';
            console.log('[Status] ' + (type || 'error').toUpperCase() + ': ' + message);
        }
        
        function formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return (Math.round(bytes / Math.pow(k, i) * 100) / 100) + ' ' + sizes[i];
        }
        
        console.log('[PatchEncoder] === ✓ Initialization Complete ===');
        
    } catch (error) {
        console.error('[PatchEncoder] FATAL ERROR during initialization:', error);
    }
}
