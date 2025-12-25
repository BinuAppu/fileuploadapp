document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const fileList = document.getElementById('file-list');
    const breadcrumbs = document.getElementById('breadcrumbs');

    // Upload Elements
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressPercent = document.getElementById('upload-percent');
    const uploadFilename = document.getElementById('upload-filename');

    let currentPath = '';

    // Initial Load
    loadFiles('');

    const previewContainer = document.getElementById('file-preview-container');
    const previewList = document.getElementById('preview-list');
    const clearBtn = document.getElementById('clear-btn');

    let selectedFiles = [];

    // --- Upload Logic ---
    // Prevent button click from bubbling to dropZone
    if (uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectedFiles.length > 0) {
                performUpload();
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedFiles = [];
            renderPreview();
        });
    }

    dropZone.addEventListener('click', () => fileInput.click());

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
        if (e.dataTransfer.files.length) {
            addFilesToPreview(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            addFilesToPreview(fileInput.files);
            // reset input so same files can be selected again if cleared
            fileInput.value = '';
        }
    });

    function addFilesToPreview(files) {
        Array.from(files).forEach(file => {
            // Avoid adding duplicates by name (simple check)
            if (!selectedFiles.some(f => f.name === file.name)) {
                selectedFiles.push(file);
            }
        });
        renderPreview();
    }

    function renderPreview() {
        previewList.innerHTML = '';
        if (selectedFiles.length === 0) {
            previewContainer.classList.add('hidden');
            return;
        }

        previewContainer.classList.remove('hidden');
        selectedFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${file.name}</span>
                <span style="color:var(--text-secondary); font-size:0.8rem;">${formatSize(file.size)}</span>
            `;
            previewList.appendChild(li);
        });

        // Update button text
        uploadBtn.innerText = `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`;
    }

    function performUpload() {
        uploadFilename.innerText = `Uploading ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}...`;
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressPercent.innerText = '0%';

        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('file', file);
        });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = percentComplete + '%';
                progressPercent.innerText = Math.round(percentComplete) + '%';
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                uploadFilename.innerText = 'Upload Complete!';
                selectedFiles = []; // Clear queue
                renderPreview();
                setTimeout(() => {
                    progressContainer.classList.add('hidden');
                    loadFiles(currentPath); // Refresh list
                }, 1500);
            } else {
                uploadFilename.innerText = 'Upload Failed';
                progressBar.style.backgroundColor = 'var(--error)';
            }
        };

        xhr.onerror = () => {
            uploadFilename.innerText = 'Error processing upload';
        };

        xhr.send(formData);
    }

    // --- File Browser Logic ---
    function loadFiles(path) {
        fetch(`/api/files?path=${encodeURIComponent(path)}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                currentPath = data.current_path;
                renderBreadcrumbs(currentPath);
                renderFiles(data.files);
            })
            .catch(err => console.error(err));
    }

    function renderBreadcrumbs(path) {
        breadcrumbs.innerHTML = '';

        // Root crumb
        const rootCrumb = document.createElement('span');
        rootCrumb.className = 'crumb';
        rootCrumb.innerHTML = '<span class="material-icons-round" style="font-size:16px; vertical-align:middle;">home</span>';
        rootCrumb.onclick = () => loadFiles('');
        breadcrumbs.appendChild(rootCrumb);

        if (!path) return;

        const parts = path.split('/');
        let buildPath = '';
        parts.forEach((part, index) => {
            breadcrumbs.appendChild(document.createTextNode(' / ')); // Separator

            buildPath += (index > 0 ? '/' : '') + part;
            const crumb = document.createElement('span');
            crumb.className = 'crumb';
            crumb.innerText = part;
            const targetPath = buildPath; // closure
            crumb.onclick = () => loadFiles(targetPath);
            breadcrumbs.appendChild(crumb);
        });
    }

    function renderFiles(files) {
        fileList.innerHTML = '';
        if (files.length === 0) {
            fileList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 20px;">Empty Directory</div>';
            return;
        }

        // Sort folders first
        files.sort((a, b) => {
            if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
            return a.is_dir ? -1 : 1;
        });

        files.forEach(file => {
            const el = document.createElement('div');
            el.className = `file-item ${file.is_dir ? 'folder' : 'file'}`;

            const icon = file.is_dir ? 'folder' : 'description';

            el.innerHTML = `
                <span class="material-icons-round file-icon">${icon}</span>
                <div class="file-details">
                    <span class="file-name" title="${file.name}">${file.name}</span>
                    <span class="file-meta">${file.is_dir ? 'Folder' : formatSize(file.size)}</span>
                </div>
            `;

            if (file.is_dir) {
                el.onclick = () => loadFiles(file.path);
            } else {
                el.onclick = () => {
                    window.location.href = `/api/download?path=${encodeURIComponent(file.path)}`;
                };
            }

            fileList.appendChild(el);
        });
    }

    function formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});
