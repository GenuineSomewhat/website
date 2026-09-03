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

        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', this.file);
            formData.append('folderPath', folderPath);

            fetch('/api/encode-patch', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || 'Failed to encode patch');
                    });
                }
                return response.blob();
            })
            .then(blob => {
                resolve({
                    blob: blob,
                    filename: this.file.name,
                    folderPath: folderPath,
                    fileSize: this.file.size,
                    patchSize: blob.size
                });
            })
            .catch(error => {
                reject(error);
            });
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const encoder = new PatchEncoder();
    
    // DOM Elements
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
    
    let patchBlob = null;
    let patchFilename = null;
    
    // File input click
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
    
    // Handle file selection
    async function handleFileSelect(file) {
        try {
            const info = await encoder.setFile(file);
            fileName.textContent = `📄 ${info.name}`;
            fileSize.textContent = `${formatBytes(info.size)}`;
            fileInfo.style.display = 'flex';
            dropZone.style.display = 'none';
            createBtn.disabled = false;
            status.style.display = 'none';
        } catch (error) {
            showStatus('Error reading file: ' + error.message, 'error');
        }
    }
    
    // Clear file
    clearFileBtn.addEventListener('click', () => {
        encoder.file = null;
        encoder.fileData = null;
        fileInput.value = '';
        fileInfo.style.display = 'none';
        dropZone.style.display = 'block';
        createBtn.disabled = true;
        status.style.display = 'none';
    });
    
    // Create patch
    createBtn.addEventListener('click', async () => {
        const folderPath = folderPathInput.value.trim();
        
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
            
            // Encode file
            const result = await encoder.encodeFile(folderPath);
            
            progressFill.style.width = '100%';
            progressText.textContent = 'Complete!';
            
            patchBlob = result.blob;
            patchFilename = result.filename;
            
            // Show patch info
            patchInfo.innerHTML = `
                <div><strong>Filename:</strong> <code>${result.filename}</code></div>
                <div><strong>Target:</strong> <code>${result.folderPath}</code></div>
                <div><strong>File Size:</strong> ${formatBytes(result.fileSize)}</div>
                <div><strong>Patch Size:</strong> ${formatBytes(result.patchSize)}</div>
            `;
            
            // Show download section after a brief delay
            setTimeout(() => {
                progress.style.display = 'none';
                downloadSection.style.display = 'block';
            }, 500);
            
        } catch (error) {
            progress.style.display = 'none';
            createBtn.disabled = false;
            showStatus('Error creating patch: ' + error.message, 'error');
        }
    });
    
    // Download patch
    downloadBtn.addEventListener('click', () => {
        if (patchBlob && patchFilename) {
            encoder.downloadPatch(patchBlob, patchFilename);
        }
    });
    
    // Create another
    createAnother.addEventListener('click', () => {
        clearFileBtn.click();
        downloadSection.style.display = 'none';
        progress.style.display = 'none';
        createBtn.disabled = false;
        folderPathInput.focus();
    });
    
    // Show status message
    function showStatus(message, type = 'error') {
        status.textContent = message;
        status.className = `status-message ${type}`;
        status.style.display = 'block';
    }
    
    // Format bytes for display
    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
});
