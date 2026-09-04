/**
 * Patch Encoder - Encodes files into patch PNG images entirely in browser
 */

console.log('[PatchEncoder] Script loaded');

class PatchEncoder {
    constructor() {
        this.file = null;
    }

    /**
     * Encode a file to a patch PNG image in the browser
     */
    async encodeFile(folderPath) {
        if (!this.file) {
            throw new Error('No file selected');
        }

        if (!folderPath) {
            throw new Error('Folder path is required');
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    console.log('[Encoder] File loaded, size:', event.total);
                    const fileData = new Uint8Array(event.target.result);
                    
                    // Create header: n_<filename>-p_<folder_path>
                    const headerStr = `n_${this.file.name}-p_${folderPath}`;
                    const headerBytes = new TextEncoder().encode(headerStr);
                    
                    console.log('[Encoder] Header:', headerStr, '(' + headerBytes.length + ' bytes)');
                    
                    // Combine: header + null byte + file data
                    const patchData = new Uint8Array(headerBytes.length + 1 + fileData.length);
                    patchData.set(headerBytes, 0);
                    patchData[headerBytes.length] = 0; // null byte separator
                    patchData.set(fileData, headerBytes.length + 1);
                    
                    console.log('[Encoder] Total patch data:', patchData.length, 'bytes');
                    
                    // Calculate image dimensions
                    const pixelCount = Math.ceil(patchData.length / 3);
                    const width = Math.max(1, Math.floor(Math.sqrt(pixelCount)));
                    const height = Math.ceil(pixelCount / width);
                    
                    console.log('[Encoder] Image dimensions:', width + 'x' + height);
                    
                    // Create canvas for drawing
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    const imageData = ctx.createImageData(width, height);
                    const pixelData = imageData.data;
                    
                    // Fill pixels with patch data (RGBA format)
                    let byteIndex = 0;
                    for (let i = 0; i < pixelData.length; i += 4) {
                        // RGB channels get patch data
                        pixelData[i] = byteIndex < patchData.length ? patchData[byteIndex++] : 0;     // R
                        pixelData[i + 1] = byteIndex < patchData.length ? patchData[byteIndex++] : 0; // G
                        pixelData[i + 2] = byteIndex < patchData.length ? patchData[byteIndex++] : 0; // B
                        pixelData[i + 3] = 255; // A (always opaque)
                    }
                    
                    // Put image data on canvas
                    ctx.putImageData(imageData, 0, 0);
                    
                    console.log('[Encoder] Canvas created and filled');
                    
                    // Convert canvas to blob (PNG)
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create PNG blob'));
                            return;
                        }
                        
                        console.log('[Encoder] PNG blob created:', blob.size, 'bytes');
                        
                        resolve({
                            blob: blob,
                            filename: this.file.name,
                            folderPath: folderPath,
                            fileSize: this.file.size,
                            patchSize: blob.size
                        });
                    }, 'image/png');
                    
                } catch (error) {
                    console.error('[Encoder] Error during encoding:', error);
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                console.error('[Encoder] File read error:', error);
                reject(new Error('Failed to read file'));
            };
            
            console.log('[Encoder] Starting file read...');
            reader.readAsArrayBuffer(this.file);
        });
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
                progressText.textContent = 'Creating patch image...';
                progressFill.style.width = '50%';
                
                console.log('[Handler] Encoding file locally...');
                const result = await encoder.encodeFile(folderPath);
                console.log('[Handler] ✓ Patch encoding complete');
                
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

// Initialize when DOM is ready or if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPatchEncoder);
} else {
    initPatchEncoder();
}
