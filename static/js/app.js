/**
 * Y2Downloader - Frontend JavaScript Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const urlInput = document.getElementById('urlInput');
    const btnPaste = document.getElementById('btnPaste');
    const btnClear = document.getElementById('btnClear');
    const btnStart = document.getElementById('btnStart');
    const btnSpinner = document.getElementById('btnSpinner');
    const brandLogo = document.getElementById('brandLogo');

    // Theme Toggle
    const btnThemeToggle = document.getElementById('btnThemeToggle');
    const themeIcon = document.getElementById('themeIcon');

    // Navbar & History
    const btnOpenFolder = document.getElementById('btnOpenFolder');
    const btnToggleHistory = document.getElementById('btnToggleHistory');
    const historyCount = document.getElementById('historyCount');
    const historySection = document.getElementById('historySection');
    const historyList = document.getElementById('historyList');
    const historyFilesTotal = document.getElementById('historyFilesTotal');
    const btnRefreshHistory = document.getElementById('btnRefreshHistory');
    const btnOpenFolderFromHistory = document.getElementById('btnOpenFolderFromHistory');

    // Loading & Sections
    const loadingState = document.getElementById('loadingState');
    const loadingText = document.getElementById('loadingText');
    const searchResultsSection = document.getElementById('searchResultsSection');
    const searchQueryTerm = document.getElementById('searchQueryTerm');
    const resultsGrid = document.getElementById('resultsGrid');
    const btnCloseSearchResults = document.getElementById('btnCloseSearchResults');
    const videoInfoSection = document.getElementById('videoInfoSection');

    // Video details elements
    const videoThumb = document.getElementById('videoThumb');
    const videoDuration = document.getElementById('videoDuration');
    const videoTitle = document.getElementById('videoTitle');
    const videoUploader = document.getElementById('videoUploader');
    const videoViews = document.getElementById('videoViews');
    const videoDate = document.getElementById('videoDate');
    const videoOriginalLink = document.getElementById('videoOriginalLink');

    // Tables
    const videoFormatRows = document.getElementById('videoFormatRows');
    const audioFormatRows = document.getElementById('audioFormatRows');
    const originalAudioFormatRows = document.getElementById('originalAudioFormatRows');

    // Tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Modal
    const downloadModal = document.getElementById('downloadModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const modalFormatBadge = document.getElementById('modalFormatBadge');
    const modalVideoTitle = document.getElementById('modalVideoTitle');
    const progressBar = document.getElementById('progressBar');
    const progressPercentage = document.getElementById('progressPercentage');
    const statusText = document.getElementById('statusText');
    const statusSpinner = document.getElementById('statusSpinner');
    const statSpeed = document.getElementById('statSpeed');
    const statDownloaded = document.getElementById('statDownloaded');
    const statEta = document.getElementById('statEta');
    const modalActionsSuccess = document.getElementById('modalActionsSuccess');
    const modalActionsError = document.getElementById('modalActionsError');
    const btnBrowserDownload = document.getElementById('btnBrowserDownload');
    const btnOpenMediaFile = document.getElementById('btnOpenMediaFile');
    const btnOpenFolderModal = document.getElementById('btnOpenFolderModal');
    const btnRetryDownload = document.getElementById('btnRetryDownload');

    // State
    let currentVideoData = null;
    let currentTaskId = null;
    let pollingInterval = null;
    let lastDownloadConfig = null;

    // ==========================================
    // Theme Management
    // ==========================================
    const savedTheme = localStorage.getItem('y2downloader_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    }

    btnThemeToggle.addEventListener('click', () => {
        const isLight = document.body.classList.contains('theme-light');
        if (isLight) {
            document.body.classList.remove('theme-light');
            document.body.classList.add('theme-dark');
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('y2downloader_theme', 'dark');
        } else {
            document.body.classList.remove('theme-dark');
            document.body.classList.add('theme-light');
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('y2downloader_theme', 'light');
        }
    });

    // ==========================================
    // Toast Notification
    // ==========================================
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'fa-circle-info';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-circle-exclamation';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ==========================================
    // Input Bar Helpers
    // ==========================================
    urlInput.addEventListener('input', () => {
        if (urlInput.value.trim().length > 0) {
            btnClear.classList.remove('hidden');
        } else {
            btnClear.classList.add('hidden');
        }
    });

    btnClear.addEventListener('click', () => {
        urlInput.value = '';
        btnClear.classList.add('hidden');
        urlInput.focus();
    });

    btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                urlInput.value = text.trim();
                btnClear.classList.remove('hidden');
                fetchVideoOrSearch(urlInput.value);
            }
        } catch (err) {
            urlInput.focus();
            showToast('Vui lòng nhấn Ctrl+V để dán nội dung vào ô tìm kiếm.', 'info');
        }
    });

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = urlInput.value.trim();
            if (val) fetchVideoOrSearch(val);
        }
    });

    btnStart.addEventListener('click', () => {
        const val = urlInput.value.trim();
        if (val) {
            fetchVideoOrSearch(val);
        } else {
            urlInput.focus();
            showToast('Vui lòng nhập link YouTube hoặc tên bài hát cần tìm.', 'info');
        }
    });

    brandLogo.addEventListener('click', () => {
        searchResultsSection.classList.add('hidden');
        videoInfoSection.classList.add('hidden');
        loadingState.classList.add('hidden');
        urlInput.value = '';
        btnClear.classList.add('hidden');
    });

    // ==========================================
    // Tab Switching
    // ==========================================
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetTabId = btn.getAttribute('data-tab');
            document.getElementById(targetTabId).classList.add('active');
        });
    });

    // ==========================================
    // Fetch Video Info or Search
    // ==========================================
    async function fetchVideoOrSearch(query) {
        setLoading(true, 'Đang kết nối YouTube và phân tích định dạng...');
        searchResultsSection.classList.add('hidden');
        videoInfoSection.classList.add('hidden');

        try {
            const resp = await fetch(`/api/info?url=${encodeURIComponent(query)}`);
            const data = await resp.json();

            if (!data.success) {
                throw new Error(data.error || 'Không thể lấy thông tin video.');
            }

            if (data.is_search) {
                renderSearchResults(data.query, data.results);
            } else {
                renderVideoDetails(data.data);
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    function setLoading(isLoading, text = '') {
        if (isLoading) {
            loadingState.classList.remove('hidden');
            loadingText.textContent = text;
            btnStart.disabled = true;
            btnSpinner.classList.remove('hidden');
        } else {
            loadingState.classList.add('hidden');
            btnStart.disabled = false;
            btnSpinner.classList.add('hidden');
        }
    }

    // ==========================================
    // Render Search Results
    // ==========================================
    function renderSearchResults(query, results) {
        searchQueryTerm.textContent = `"${query}"`;
        resultsGrid.innerHTML = '';

        if (!results || results.length === 0) {
            resultsGrid.innerHTML = '<div class="history-empty">Không tìm thấy video nào phù hợp. Thử từ khóa khác!</div>';
            searchResultsSection.classList.remove('hidden');
            return;
        }

        results.forEach(item => {
            const card = document.createElement('div');
            card.className = 'search-item-card';
            card.innerHTML = `
                <div class="search-thumb-wrap">
                    <img src="${item.thumbnail}" alt="${escapeHtml(item.title)}" loading="lazy">
                    <span class="duration-badge">${item.duration_formatted}</span>
                </div>
                <div class="search-item-body">
                    <div class="search-item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                    <div class="search-item-channel">
                        <i class="fa-regular fa-user"></i> ${escapeHtml(item.uploader)} • ${item.view_count}
                    </div>
                    <button class="search-item-btn">
                        <i class="fa-solid fa-download"></i> Chọn tải video này
                    </button>
                </div>
            `;

            card.addEventListener('click', () => {
                urlInput.value = item.url;
                btnClear.classList.remove('hidden');
                fetchVideoOrSearch(item.url);
            });

            resultsGrid.appendChild(card);
        });

        searchResultsSection.classList.remove('hidden');
        searchResultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    btnCloseSearchResults.addEventListener('click', () => {
        searchResultsSection.classList.add('hidden');
    });

    // ==========================================
    // Render Video Details & Format Tables
    // ==========================================
    function renderVideoDetails(info) {
        currentVideoData = info;

        videoThumb.src = info.thumbnail;
        videoDuration.textContent = info.duration_formatted;
        videoTitle.textContent = info.title;
        videoUploader.textContent = info.uploader;
        videoViews.textContent = info.view_count;
        videoDate.textContent = info.upload_date;
        videoOriginalLink.href = info.url;

        // 1. Populate Video Formats (MP4)
        videoFormatRows.innerHTML = '';
        if (info.videos && info.videos.length > 0) {
            info.videos.forEach(v => {
                const tr = document.createElement('tr');
                
                let badge = '';
                if (v.height >= 2160) badge = '<span class="badge-4k">4K UHD</span>';
                else if (v.height >= 1440) badge = '<span class="badge-4k">2K</span>';
                else if (v.height >= 720) badge = '<span class="badge-hd">HD</span>';

                tr.innerHTML = `
                    <td>
                        <div class="res-tag">
                            <span>${v.label}</span>
                            ${badge}
                        </div>
                    </td>
                    <td><span class="badge-format">.mp4</span></td>
                    <td><span class="size-text">${v.filesize_str}</span></td>
                    <td>
                        <button class="btn-download-action" data-type="video" data-quality="${v.height}" data-ext="mp4" data-label="MP4 ${v.label}">
                            <i class="fa-solid fa-download"></i> Tải về
                        </button>
                    </td>
                `;
                videoFormatRows.appendChild(tr);
            });
        } else {
            videoFormatRows.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem;">Không tìm thấy luồng video MP4 phù hợp.</td></tr>';
        }

        // 2. Populate Audio Formats (MP3)
        audioFormatRows.innerHTML = '';
        if (info.audios && info.audios.length > 0) {
            const mp3List = info.audios.filter(a => a.type === 'mp3');
            mp3List.forEach(a => {
                const tr = document.createElement('tr');
                let hqBadge = a.bitrate >= 256 ? '<span class="badge-hq">Cao cấp</span>' : '';

                tr.innerHTML = `
                    <td>
                        <div class="res-tag">
                            <span>${escapeHtml(a.quality_title)}</span>
                            ${hqBadge}
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(a.description)}</div>
                    </td>
                    <td><span class="badge-format">.mp3</span></td>
                    <td><span class="size-text">${a.filesize_str}</span></td>
                    <td>
                        <button class="btn-download-action" data-type="audio" data-quality="${a.bitrate}" data-ext="mp3" data-label="MP3 ${a.label}">
                            <i class="fa-solid fa-music"></i> Tải MP3
                        </button>
                    </td>
                `;
                audioFormatRows.appendChild(tr);
            });
        }

        // 3. Populate Original Audio Formats (M4A)
        originalAudioFormatRows.innerHTML = '';
        const m4aList = info.audios.filter(a => a.type === 'm4a');
        if (m4aList.length > 0) {
            m4aList.forEach(a => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="badge-format">.m4a (AAC)</span></td>
                    <td>
                        <div class="res-tag">
                            <span>${escapeHtml(a.quality_title)}</span>
                            <span class="badge-hd">Gốc</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(a.description)}</div>
                    </td>
                    <td><span class="size-text">${a.filesize_str}</span></td>
                    <td>
                        <button class="btn-download-action" data-type="audio" data-quality="${a.bitrate}" data-ext="m4a" data-label="M4A Gốc">
                            <i class="fa-solid fa-bolt-lightning"></i> Tải nhanh
                        </button>
                    </td>
                `;
                originalAudioFormatRows.appendChild(tr);
            });
        } else {
            originalAudioFormatRows.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem;">Không có luồng audio riêng biệt.</td></tr>';
        }

        // Attach event listeners to all download buttons
        document.querySelectorAll('.btn-download-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = btn.getAttribute('data-type');
                const quality = btn.getAttribute('data-quality');
                const ext = btn.getAttribute('data-ext');
                const label = btn.getAttribute('data-label');

                startDownloadProcess({
                    url: info.url,
                    type,
                    quality,
                    ext,
                    label,
                    title: info.title
                });
            });
        });

        videoInfoSection.classList.remove('hidden');
        videoInfoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ==========================================
    // Download Execution & Progress Modal
    // ==========================================
    async function startDownloadProcess(config) {
        lastDownloadConfig = config;

        // Reset and prepare modal
        modalFormatBadge.textContent = config.label || `${config.ext.toUpperCase()}`;
        modalVideoTitle.textContent = config.title;
        progressBar.style.width = '0%';
        progressPercentage.textContent = '0%';
        statusText.textContent = 'Đang khởi tạo tác vụ và kết nối...';
        statusSpinner.className = 'fa-solid fa-circle-notch fa-spin status-spinner';
        statSpeed.textContent = '0 KB/s';
        statDownloaded.textContent = '0 B';
        statEta.textContent = '--:--';
        modalActionsSuccess.classList.add('hidden');
        modalActionsError.classList.add('hidden');

        downloadModal.classList.remove('hidden');

        try {
            const resp = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const res = await resp.json();

            if (!res.success) {
                throw new Error(res.error || 'Không thể bắt đầu tải xuống.');
            }

            currentTaskId = res.task_id;
            startPollingProgress(currentTaskId);
        } catch (err) {
            handleDownloadError(err.message);
        }
    }

    function startPollingProgress(taskId) {
        if (pollingInterval) clearInterval(pollingInterval);

        pollingInterval = setInterval(async () => {
            try {
                const resp = await fetch(`/api/progress/${taskId}`);
                const data = await resp.json();

                if (!data.success) {
                    clearInterval(pollingInterval);
                    handleDownloadError(data.error);
                    return;
                }

                const task = data.task;
                updateModalProgress(task);

                if (task.status === 'finished') {
                    clearInterval(pollingInterval);
                    handleDownloadSuccess(task);
                } else if (task.status === 'error') {
                    clearInterval(pollingInterval);
                    handleDownloadError(task.error_message || 'Quá trình tải gặp lỗi.');
                }
            } catch (e) {
                console.error("Polling error:", e);
            }
        }, 750);
    }

    function updateModalProgress(task) {
        const pct = task.progress || 0;
        progressBar.style.width = `${pct}%`;
        progressPercentage.textContent = `${Math.round(pct)}%`;
        statusText.textContent = task.status_text || 'Đang tải xuống...';

        statSpeed.textContent = task.speed_str || '0 KB/s';
        statDownloaded.textContent = `${task.downloaded_str || '0 B'} / ${task.total_str || '...'}`;
        statEta.textContent = task.eta_str || '--:--';
    }

    function handleDownloadSuccess(task) {
        progressBar.style.width = '100%';
        progressPercentage.textContent = '100%';
        statusText.innerHTML = '<span style="color:var(--success); font-weight:700;">🎉 Đã tải về và chuyển đổi thành công!</span>';
        statusSpinner.className = 'fa-solid fa-circle-check status-spinner';
        statusSpinner.style.color = 'var(--success)';

        statSpeed.textContent = 'Hoàn tất';
        statEta.textContent = '00:00';
        statDownloaded.textContent = task.filesize_str || 'Đã lưu';

        // Direct browser download trigger
        btnBrowserDownload.href = `/api/file/${task.id}`;
        btnBrowserDownload.setAttribute('download', task.filename);

        modalActionsSuccess.classList.remove('hidden');

        // Automatically trigger browser download to save in browser downloads folder too!
        const autoDownloadLink = document.createElement('a');
        autoDownloadLink.href = `/api/file/${task.id}`;
        autoDownloadLink.download = task.filename;
        document.body.appendChild(autoDownloadLink);
        autoDownloadLink.click();
        autoDownloadLink.remove();

        showToast(`Đã tải xong: ${task.filename}`, 'success');
        loadHistory();
    }

    function handleDownloadError(msg) {
        statusText.innerHTML = `<span style="color:var(--danger); font-weight:700;">Lỗi: ${escapeHtml(msg)}</span>`;
        statusSpinner.className = 'fa-solid fa-triangle-exclamation status-spinner';
        statusSpinner.style.color = 'var(--danger)';
        modalActionsError.classList.remove('hidden');
        showToast(`Lỗi: ${msg}`, 'error');
    }

    // Modal action buttons
    btnCloseModal.addEventListener('click', () => {
        downloadModal.classList.add('hidden');
        if (pollingInterval) clearInterval(pollingInterval);
    });

    btnRetryDownload.addEventListener('click', () => {
        if (lastDownloadConfig) {
            startDownloadProcess(lastDownloadConfig);
        }
    });

    btnOpenMediaFile.addEventListener('click', async () => {
        if (!currentTaskId) return;
        try {
            const resp = await fetch('/api/open-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: currentTaskId })
            });
            const res = await resp.json();
            if (!res.success) showToast(res.error || 'Không thể mở file.', 'error');
        } catch (e) {
            showToast('Lỗi mở file: ' + e.message, 'error');
        }
    });

    btnOpenFolderModal.addEventListener('click', openDownloadsFolder);
    btnOpenFolder.addEventListener('click', openDownloadsFolder);
    btnOpenFolderFromHistory.addEventListener('click', openDownloadsFolder);

    async function openDownloadsFolder() {
        try {
            const resp = await fetch('/api/open-folder', { method: 'POST' });
            const res = await resp.json();
            if (res.success) {
                showToast('Đang mở thư mục lưu trữ...', 'info');
            } else {
                showToast(res.error || 'Không thể mở thư mục.', 'error');
            }
        } catch (e) {
            showToast('Lỗi khi mở thư mục: ' + e.message, 'error');
        }
    }

    // ==========================================
    // History Section Management
    // ==========================================
    btnToggleHistory.addEventListener('click', () => {
        historySection.classList.toggle('hidden');
        if (!historySection.classList.contains('hidden')) {
            loadHistory();
            historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    btnRefreshHistory.addEventListener('click', loadHistory);

    async function loadHistory() {
        try {
            const resp = await fetch('/api/history');
            const data = await resp.json();

            if (!data.success) return;

            const files = data.files || [];
            historyCount.textContent = files.length;
            historyFilesTotal.textContent = files.length;

            historyList.innerHTML = '';
            if (files.length === 0) {
                historyList.innerHTML = '<div class="history-empty">Chưa có tệp tin nào được tải về.</div>';
                return;
            }

            files.forEach(f => {
                const item = document.createElement('div');
                item.className = 'history-item';

                const iconClass = f.is_audio ? 'icon-audio' : 'icon-video';
                const iconTag = f.is_audio ? '<i class="fa-solid fa-music"></i>' : '<i class="fa-solid fa-video"></i>';

                item.innerHTML = `
                    <div class="history-item-left">
                        <div class="file-type-icon ${iconClass}">
                            ${iconTag}
                        </div>
                        <div class="history-item-info">
                            <div class="history-item-name" title="${escapeHtml(f.filename)}">${escapeHtml(f.filename)}</div>
                            <div class="history-item-meta">${f.size_str} • ${f.mtime_str}</div>
                        </div>
                    </div>
                    <div class="history-item-actions">
                        <button class="btn-icon-action btn-play" title="Mở phát bằng ứng dụng mặc định">
                            <i class="fa-solid fa-play"></i>
                        </button>
                        <a href="/api/stream-file/${encodeURIComponent(f.filename)}" download="${escapeHtml(f.filename)}" class="btn-icon-action" title="Tải về trình duyệt">
                            <i class="fa-solid fa-download"></i>
                        </a>
                        <button class="btn-icon-action btn-delete" title="Xóa tệp tin này">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                `;

                // Play file handler
                item.querySelector('.btn-play').addEventListener('click', async () => {
                    try {
                        await fetch('/api/open-file', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename: f.filename })
                        });
                    } catch (e) {
                        showToast('Không thể mở file.', 'error');
                    }
                });

                // Delete file handler
                item.querySelector('.btn-delete').addEventListener('click', async () => {
                    if (confirm(`Bạn có chắc muốn xóa file "${f.filename}"?`)) {
                        try {
                            const res = await fetch('/api/delete-file', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ filename: f.filename })
                            });
                            const r = await res.json();
                            if (r.success) {
                                showToast('Đã xóa tệp tin.', 'success');
                                loadHistory();
                            } else {
                                showToast(r.error || 'Không thể xóa.', 'error');
                            }
                        } catch (e) {
                            showToast('Lỗi xóa file: ' + e.message, 'error');
                        }
                    }
                });

                historyList.appendChild(item);
            });
        } catch (e) {
            console.error("Load history error:", e);
        }
    }

    // Helper: Escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.toString().replace(/[&<>"']/g, m => map[m]);
    }

    // Initial load history count
    loadHistory();
});
