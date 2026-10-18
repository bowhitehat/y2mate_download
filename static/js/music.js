/**
 * Y2Music - Spotify-style Music Player Engine
 * Frontend Client Architecture
 */

(function () {
    'use strict';

    // ==========================================
    // State Management
    // ==========================================
    const state = {
        currentTrack: null,
        currentQueueIndex: -1,
        isPlaying: false,
        volume: 0.8,
        isMuted: false,
        repeatMode: 'off', // 'off' | 'all' | 'one'
        isShuffle: false,
        queue: [],
        playlists: [],
        currentPlaylist: null,
        activeView: 'home',
        history: ['home'],
        historyIdx: 0,
        isSeeking: false,
        isDockExpanded: false,
        isDockHidden: false
    };

    // Global references for YouTube & Audio
    let ytPlayer = null;
    let isYtReady = false;
    let localAudio = null;
    let progressTimer = null;
    let currentSearchController = null;
    let searchDebounceTimer = null;
    let currentSearchQuery = '';
    let pendingYouTubeId = null;
    let loadedYouTubeId = null;
    let loadedLocalId = null;
    let youtubeWaitTimer = null;
    let playbackVersion = 0;

    // ==========================================
    // DOM Elements Cache
    // ==========================================
    const el = {};

    function cacheElements() {
        // Nav & Topbar
        el.navHome = document.getElementById('navHome');
        el.navSearch = document.getElementById('navSearch');
        el.navLibrary = document.getElementById('navLibrary');
        el.navPlaylists = document.getElementById('navPlaylists');
        el.sidebarPlaylistsList = document.getElementById('sidebarPlaylistsList');
        el.btnOpenCreatePlaylistModal = document.getElementById('btnOpenCreatePlaylistModal');
        el.btnTopCreatePlaylist = document.getElementById('btnTopCreatePlaylist');
        el.btnHistoryBack = document.getElementById('btnHistoryBack');
        el.btnHistoryForward = document.getElementById('btnHistoryForward');
        el.musicSearchInput = document.getElementById('musicSearchInput');
        el.btnClearSearch = document.getElementById('btnClearSearch');
        el.btnQuickQueue = document.getElementById('btnQuickQueue');
        el.queueBadgeCount = document.getElementById('queueBadgeCount');

        // Views
        el.viewHome = document.getElementById('viewHome');
        el.viewSearch = document.getElementById('viewSearch');
        el.viewLibrary = document.getElementById('viewLibrary');
        el.viewPlaylistsList = document.getElementById('viewPlaylistsList');
        el.viewPlaylist = document.getElementById('viewPlaylist');
        el.viewQueue = document.getElementById('viewQueue');

        // Home View elements
        el.btnHeroGoSearch = document.getElementById('btnHeroGoSearch');
        el.btnHeroGoLibrary = document.getElementById('btnHeroGoLibrary');
        el.cardLikedSongs = document.getElementById('cardLikedSongs');
        el.likedSongsCount = document.getElementById('likedSongsCount');
        el.btnPlayLikedPlaylist = document.getElementById('btnPlayLikedPlaylist');
        el.cardOfflineMusic = document.getElementById('cardOfflineMusic');
        el.localFilesCount = document.getElementById('localFilesCount');
        el.btnPlayAllLocal = document.getElementById('btnPlayAllLocal');
        el.cardSearchShortcut = document.getElementById('cardSearchShortcut');
        el.homePlaylistsGrid = document.getElementById('homePlaylistsGrid');
        el.btnHomeCreatePlaylist = document.getElementById('btnHomeCreatePlaylist');

        // Search View elements
        el.searchLoadingState = document.getElementById('searchLoadingState');
        el.searchEmptyState = document.getElementById('searchEmptyState');
        el.searchEmptyMessage = document.getElementById('searchEmptyMessage');
        el.searchErrorState = document.getElementById('searchErrorState');
        el.searchErrorMessage = document.getElementById('searchErrorMessage');
        el.btnRetrySearch = document.getElementById('btnRetrySearch');
        el.searchResultsContainer = document.getElementById('searchResultsContainer');
        el.searchResultsTableBody = document.getElementById('searchResultsTableBody');

        // Library View elements
        el.btnRefreshLibrary = document.getElementById('btnRefreshLibrary');
        el.btnPlayAllLibrary = document.getElementById('btnPlayAllLibrary');
        el.libraryLoadingState = document.getElementById('libraryLoadingState');
        el.libraryEmptyState = document.getElementById('libraryEmptyState');
        el.libraryTableBody = document.getElementById('libraryTableBody');

        // All Playlists View elements
        el.allPlaylistsGrid = document.getElementById('allPlaylistsGrid');
        el.btnPlaylistsListCreate = document.getElementById('btnPlaylistsListCreate');

        // Playlist View elements
        el.playlistBannerCover = document.getElementById('playlistBannerCover');
        el.playlistBannerTitle = document.getElementById('playlistBannerTitle');
        el.playlistBannerCreator = document.getElementById('playlistBannerCreator');
        el.playlistBannerTrackCount = document.getElementById('playlistBannerTrackCount');
        el.playlistBannerDuration = document.getElementById('playlistBannerDuration');
        el.btnPlaylistPlayAll = document.getElementById('btnPlaylistPlayAll');
        el.btnPlaylistShuffle = document.getElementById('btnPlaylistShuffle');
        el.btnPlaylistRename = document.getElementById('btnPlaylistRename');
        el.btnPlaylistDelete = document.getElementById('btnPlaylistDelete');
        el.playlistTracksContainer = document.getElementById('playlistTracksContainer');
        el.playlistTracksTableBody = document.getElementById('playlistTracksTableBody');
        el.playlistEmptyState = document.getElementById('playlistEmptyState');
        el.btnPlaylistFindSongs = document.getElementById('btnPlaylistFindSongs');

        // Queue View elements
        el.btnClearQueue = document.getElementById('btnClearQueue');
        el.queueNowPlayingCard = document.getElementById('queueNowPlayingCard');
        el.queueTableBody = document.getElementById('queueTableBody');
        el.queueEmptyState = document.getElementById('queueEmptyState');

        // YouTube Dock
        el.videoDock = document.getElementById('videoDock');
        el.videoDockTitleText = document.getElementById('videoDockTitleText');
        el.btnExpandVideoDock = document.getElementById('btnExpandVideoDock');
        el.iconExpandDock = document.getElementById('iconExpandDock');
        el.btnCloseVideoDock = document.getElementById('btnCloseVideoDock');
        el.ytErrorOverlay = document.getElementById('ytErrorOverlay');
        el.ytErrorMessage = document.getElementById('ytErrorMessage');
        el.btnOpenOnYouTube = document.getElementById('btnOpenOnYouTube');
        el.ytAutoplayOverlay = document.getElementById('ytAutoplayOverlay');
        el.btnResumeAutoplay = document.getElementById('btnResumeAutoplay');

        // Bottom Player Bar
        el.playerTrackThumb = document.getElementById('playerTrackThumb');
        el.playerThumbPlaceholder = document.getElementById('playerThumbPlaceholder');
        el.playerTrackTitle = document.getElementById('playerTrackTitle');
        el.playerTrackArtist = document.getElementById('playerTrackArtist');
        el.btnPlayerLike = document.getElementById('btnPlayerLike');
        el.iconPlayerLike = document.getElementById('iconPlayerLike');
        el.btnPlayerAddToPlaylist = document.getElementById('btnPlayerAddToPlaylist');

        el.btnShuffle = document.getElementById('btnShuffle');
        el.btnPrev = document.getElementById('btnPrev');
        el.btnPlayPause = document.getElementById('btnPlayPause');
        el.iconPlayPause = document.getElementById('iconPlayPause');
        el.btnNext = document.getElementById('btnNext');
        el.btnRepeat = document.getElementById('btnRepeat');
        el.repeatOneBadge = document.getElementById('repeatOneBadge');

        el.playerCurrentTime = document.getElementById('playerCurrentTime');
        el.playerProgressBarFill = document.getElementById('playerProgressBarFill');
        el.playerSeekInput = document.getElementById('playerSeekInput');
        el.playerTotalTime = document.getElementById('playerTotalTime');

        el.btnToggleVideoDock = document.getElementById('btnToggleVideoDock');
        el.btnToggleQueue = document.getElementById('btnToggleQueue');
        el.btnVolumeMute = document.getElementById('btnVolumeMute');
        el.iconVolume = document.getElementById('iconVolume');
        el.playerVolumeFill = document.getElementById('playerVolumeFill');
        el.playerVolumeInput = document.getElementById('playerVolumeInput');

        // Local Audio element
        localAudio = document.getElementById('localAudioPlayer');

        // Modals
        el.modalCreatePlaylist = document.getElementById('modalCreatePlaylist');
        el.inputPlaylistName = document.getElementById('inputPlaylistName');
        el.btnConfirmCreatePlaylist = document.getElementById('btnConfirmCreatePlaylist');

        el.modalRenamePlaylist = document.getElementById('modalRenamePlaylist');
        el.inputRenamePlaylistName = document.getElementById('inputRenamePlaylistName');
        el.btnConfirmRenamePlaylist = document.getElementById('btnConfirmRenamePlaylist');

        el.modalAddToPlaylist = document.getElementById('modalAddToPlaylist');
        el.modalTargetTrackPreview = document.getElementById('modalTargetTrackPreview');
        el.modalPlaylistsList = document.getElementById('modalPlaylistsList');
        el.btnModalCreateNewPlaylist = document.getElementById('btnModalCreateNewPlaylist');

        el.toastContainer = document.getElementById('toastContainer');
    }

    // ==========================================
    // Utilities: Formatting & Safe Elements
    // ==========================================
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
        seconds = Math.floor(seconds);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function extractYouTubeId(urlOrId) {
        if (!urlOrId) return '';
        urlOrId = urlOrId.trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
            return urlOrId;
        }
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = urlOrId.match(regExp);
        return (match && match[2].length === 11) ? match[2] : urlOrId;
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;

        let iconClass = 'fa-circle-info';
        if (type === 'success') iconClass = 'fa-circle-check';
        if (type === 'error') iconClass = 'fa-circle-exclamation';

        const icon = document.createElement('i');
        icon.className = `fa-solid ${iconClass}`;
        const span = document.createElement('span');
        span.textContent = message;

        toast.appendChild(icon);
        toast.appendChild(span);
        el.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, 3500);
    }

    // ==========================================
    // LocalStorage State Persistence
    // ==========================================
    const STORAGE_KEY = 'y2music_state_v1';

    function saveState() {
        try {
            const data = {
                queue: state.queue,
                currentQueueIndex: state.currentQueueIndex,
                volume: state.volume,
                isMuted: state.isMuted,
                repeatMode: state.repeatMode,
                isShuffle: state.isShuffle
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Could not save state to localStorage:', e);
        }
    }

    function loadSavedState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);

            if (!parsed || typeof parsed !== 'object') return;
            const storedQueue = Array.isArray(parsed.queue) ? parsed.queue : [];
            state.queue = storedQueue.map(safeStoredTrack).filter(Boolean).slice(0, 1000);
            const selected = Number.isInteger(parsed.currentQueueIndex)
                ? safeStoredTrack(storedQueue[parsed.currentQueueIndex]) : null;
            if (selected) {
                state.currentQueueIndex = state.queue.findIndex(track => track.id === selected.id);
                state.currentTrack = state.queue[state.currentQueueIndex];
            }
            if (typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)) {
                state.volume = Math.max(0, Math.min(1, parsed.volume));
            }
            if (typeof parsed.isMuted === 'boolean') {
                state.isMuted = parsed.isMuted;
            }
            if (['off', 'all', 'one'].includes(parsed.repeatMode)) {
                state.repeatMode = parsed.repeatMode;
            }
            if (typeof parsed.isShuffle === 'boolean') {
                state.isShuffle = parsed.isShuffle;
            }
        } catch (e) {
            console.warn('Could not load state from localStorage:', e);
        }
    }

    // ==========================================
    // YouTube IFrame API Initialization
    // ==========================================
    function safeStoredTrack(track) {
        if (!track || typeof track !== 'object' || typeof track.id !== 'string'
            || typeof track.title !== 'string') return null;
        const clean = {
            id: track.id, title: track.title.slice(0, 500),
            uploader: typeof track.uploader === 'string' ? track.uploader.slice(0, 300) : '',
            duration: Number.isFinite(track.duration) && track.duration >= 0 ? track.duration : 0,
            thumbnail: ''
        };
        if (track.source === 'youtube' && /^[\w-]{11}$/.test(track.id)) {
            return {...clean, source: 'youtube', url: `https://www.youtube.com/watch?v=${track.id}`,
                thumbnail: `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`};
        }
        if (track.source === 'local' && typeof track.filename === 'string'
            && track.filename && !/[\\/:\x00]/.test(track.filename)
            && !['.', '..'].includes(track.filename)) {
            return {...clean, source: 'local', filename: track.filename,
                url: `/api/music/file/${encodeURIComponent(track.filename)}`};
        }
        return null;
    }

    window.onYouTubeIframeAPIReady = function () {
        if (!el.videoDock || ytPlayer) return;
        ytPlayer = new YT.Player('ytPlayer', {
            height: '100%',
            width: '100%',
            playerVars: {
                autoplay: 1,
                controls: 1,
                rel: 0,
                playsinline: 1,
                enablejsapi: 1,
                origin: window.location.origin
            },
            events: {
                onReady: onYTPlayerReady,
                onStateChange: onYTPlayerStateChange,
                onError: onYTPlayerError,
                onAutoplayBlocked: () => {
                    if (state.currentTrack?.source !== 'youtube') return;
                    state.isPlaying = false;
                    updatePlayPauseIcon(false);
                    el.ytAutoplayOverlay.classList.remove('hidden');
                }
            }
        });
    };

    function onYTPlayerReady() {
        isYtReady = true;
        clearTimeout(youtubeWaitTimer);
        if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
            ytPlayer.setVolume(state.isMuted ? 0 : Math.round(state.volume * 100));
        }
        if (state.currentTrack && state.currentTrack.source === 'youtube') {
            updatePlayerBarUI(state.currentTrack);
            if (pendingYouTubeId === state.currentTrack.id) {
                loadedYouTubeId = pendingYouTubeId;
                ytPlayer.loadVideoById(pendingYouTubeId);
                pendingYouTubeId = null;
            }
        }
    }

    function onYTPlayerStateChange(event) {
        if (!event || state.currentTrack?.source !== 'youtube') return;
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                state.isPlaying = true;
                updatePlayPauseIcon(true);
                el.ytErrorOverlay.classList.add('hidden');
                el.ytAutoplayOverlay.classList.add('hidden');
                startProgressTimer();
                break;
            case YT.PlayerState.PAUSED:
                state.isPlaying = false;
                updatePlayPauseIcon(false);
                break;
            case YT.PlayerState.ENDED:
                handleTrackEnded();
                break;
        }
    }

    function onYTPlayerError(event) {
        if (state.currentTrack?.source !== 'youtube') return;
        console.warn('[YouTube Player Error]:', event.data);
        state.isPlaying = false;
        updatePlayPauseIcon(false);

        let msg = 'Không thể phát video YouTube này.';
        if (event.data === 101 || event.data === 150) {
            msg = 'Chủ sở hữu video không cho phép phát nhúng bên ngoài YouTube.';
        } else if (event.data === 100) {
            msg = 'Video không tồn tại hoặc đã được đặt ở chế độ riêng tư.';
        } else if (event.data === 2) {
            msg = 'Tham số video không hợp lệ.';
        } else if (event.data === 153) {
            msg = 'YouTube chưa xác nhận được trình phát. Hãy mở video trên YouTube.';
        }

        el.ytErrorMessage.textContent = msg;
        const videoId = state.currentTrack ? extractYouTubeId(state.currentTrack.id || state.currentTrack.url) : '';
        el.btnOpenOnYouTube.href = `https://www.youtube.com/watch?v=${videoId}`;
        el.ytErrorOverlay.classList.remove('hidden');

        showToast(msg, 'error');
        // Do NOT automatically skip infinitely on error! Stop and let user choose.
    }

    // ==========================================
    // Local Audio Player Listeners
    // ==========================================
    function initLocalAudio() {
        if (!localAudio) return;

        localAudio.addEventListener('play', () => {
            if (state.currentTrack?.source !== 'local') return;
            state.isPlaying = true;
            updatePlayPauseIcon(true);
            startProgressTimer();
        });

        localAudio.addEventListener('pause', () => {
            if (state.currentTrack?.source !== 'local') return;
            state.isPlaying = false;
            updatePlayPauseIcon(false);
        });

        localAudio.addEventListener('ended', () => {
            if (state.currentTrack?.source !== 'local') return;
            handleTrackEnded();
        });

        localAudio.addEventListener('error', (e) => {
            if (state.currentTrack?.source !== 'local') return;
            console.error('[Local Audio Error]:', e);
            state.isPlaying = false;
            updatePlayPauseIcon(false);
            showToast('Không thể phát tệp âm thanh cục bộ này.', 'error');
        });
    }

    // ==========================================
    // Unified Playback Controller
    // ==========================================
    function playTrack(track, queueIndex = -1) {
        if (!track) return;

        const version = ++playbackVersion;
        pendingYouTubeId = null;
        clearTimeout(youtubeWaitTimer);
        state.isPlaying = false;
        updatePlayPauseIcon(false);

        state.currentTrack = track;
        if (queueIndex >= 0) {
            state.currentQueueIndex = queueIndex;
        } else {
            const foundIdx = state.queue.findIndex(t => t.id === track.id);
            if (foundIdx >= 0) {
                state.currentQueueIndex = foundIdx;
            } else {
                state.queue.push(track);
                state.currentQueueIndex = state.queue.length - 1;
            }
        }

        saveState();
        updatePlayerBarUI(track);
        updateQueueBadge();
        highlightActiveRow();
        if (state.activeView === 'queue') renderQueueView();
        el.playerCurrentTime.textContent = '0:00';
        el.playerTotalTime.textContent = formatTime(track.duration);
        el.playerSeekInput.value = 0;
        el.playerProgressBarFill.style.width = '0%';

        // Hide overlays
        el.ytErrorOverlay.classList.add('hidden');
        el.ytAutoplayOverlay.classList.add('hidden');

        if (track.source === 'youtube') {
            // Stop local audio
            if (localAudio) {
                localAudio.pause();
                localAudio.currentTime = 0;
            }

            // Always ensure YouTube Dock is visible when YouTube track plays
            showVideoDock();
            el.videoDockTitleText.textContent = track.title || 'YouTube Music';

            const videoId = extractYouTubeId(track.id || track.url);
            if (isYtReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
                ytPlayer.setVolume(state.isMuted ? 0 : Math.round(state.volume * 100));
                loadedYouTubeId = videoId;
                ytPlayer.loadVideoById(videoId);
            } else {
                pendingYouTubeId = videoId;
                youtubeWaitTimer = setTimeout(() => {
                    if (pendingYouTubeId !== videoId || playbackVersion !== version) return;
                    el.ytErrorMessage.textContent = 'Chưa kết nối được trình phát YouTube. Bạn có thể mở video trực tiếp.';
                    el.btnOpenOnYouTube.href = `https://www.youtube.com/watch?v=${videoId}`;
                    el.ytErrorOverlay.classList.remove('hidden');
                }, 12000);
            }
        } else {
            el.videoDock.classList.add('is-hidden');
            state.isDockHidden = true;
            // Local file playback
            if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                ytPlayer.pauseVideo();
            }

            let fileUrl = track.url;
            if (!fileUrl && track.filename) {
                fileUrl = `/api/music/file/${encodeURIComponent(track.filename)}`;
            } else if (fileUrl && !fileUrl.startsWith('http') && !fileUrl.startsWith('/api/music/file/')) {
                fileUrl = `/api/music/file/${encodeURIComponent(fileUrl)}`;
            }

            localAudio.src = fileUrl;
            loadedLocalId = track.id;
            localAudio.volume = state.isMuted ? 0 : state.volume;

            const playPromise = localAudio.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    if (version !== playbackVersion) return;
                    console.warn('[Autoplay policy blocked]:', err);
                    state.isPlaying = false;
                    updatePlayPauseIcon(false);
                    showToast('Bấm nút Phát để bắt đầu nghe nhạc.', 'info');
                });
            }
        }
    }

    function togglePlay() {
        if (!state.currentTrack) {
            if (state.queue.length > 0) {
                playTrack(state.queue[0], 0);
            } else {
                showToast('Chưa có bài hát nào được chọn.', 'info');
            }
            return;
        }

        if (state.isPlaying) {
            pausePlayback();
        } else {
            resumePlayback();
        }
    }

    function pausePlayback() {
        pendingYouTubeId = null;
        clearTimeout(youtubeWaitTimer);
        if (state.currentTrack && state.currentTrack.source === 'youtube') {
            if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                ytPlayer.pauseVideo();
            }
        } else if (localAudio) {
            localAudio.pause();
        }
        state.isPlaying = false;
        updatePlayPauseIcon(false);
    }

    function resumePlayback() {
        if (!state.currentTrack) return;
        if (state.currentTrack && state.currentTrack.source === 'youtube') {
            showVideoDock();
            el.ytAutoplayOverlay.classList.add('hidden');
            if (!isYtReady || loadedYouTubeId !== state.currentTrack.id) {
                playTrack(state.currentTrack, state.currentQueueIndex);
            } else if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
                ytPlayer.playVideo();
            }
        } else if (localAudio) {
            if (loadedLocalId !== state.currentTrack.id) {
                playTrack(state.currentTrack, state.currentQueueIndex);
            } else {
                const version = playbackVersion;
                localAudio.play().catch(() => {
                    if (version !== playbackVersion) return;
                    state.isPlaying = false;
                    updatePlayPauseIcon(false);
                    showToast('Chưa phát được bài hát. Kiểm tra tệp nhạc và bấm phát lại.', 'error');
                });
            }
        }
    }

    function nextTrack() {
        if (state.queue.length === 0) return;

        let nextIdx;
        if (state.isShuffle && state.queue.length > 1) {
            do {
                nextIdx = Math.floor(Math.random() * state.queue.length);
            } while (nextIdx === state.currentQueueIndex && state.queue.length > 1);
        } else {
            nextIdx = state.currentQueueIndex + 1;
        }

        if (nextIdx >= state.queue.length) {
            if (state.repeatMode === 'all') {
                nextIdx = 0;
            } else {
                showToast('Đã đến cuối danh sách phát.', 'info');
                return;
            }
        }

        playTrack(state.queue[nextIdx], nextIdx);
    }

    function prevTrack() {
        if (state.queue.length === 0) return;

        const curTime = getCurrentPlaybackTime();
        if (curTime > 3) {
            seekTo(0);
            return;
        }

        let prevIdx = state.currentQueueIndex - 1;
        if (prevIdx < 0) {
            prevIdx = state.repeatMode === 'all' ? state.queue.length - 1 : 0;
        }

        playTrack(state.queue[prevIdx], prevIdx);
    }

    function handleTrackEnded() {
        if (state.repeatMode === 'one') {
            seekTo(0);
            resumePlayback();
            return;
        }

        let nextIdx;
        if (state.isShuffle && state.queue.length > 1) {
            do {
                nextIdx = Math.floor(Math.random() * state.queue.length);
            } while (nextIdx === state.currentQueueIndex && state.queue.length > 1);
        } else {
            nextIdx = state.currentQueueIndex + 1;
        }

        if (nextIdx >= state.queue.length) {
            if (state.repeatMode === 'all') {
                playTrack(state.queue[0], 0);
            } else {
                state.isPlaying = false;
                updatePlayPauseIcon(false);
                seekTo(0);
            }
        } else {
            playTrack(state.queue[nextIdx], nextIdx);
        }
    }

    function getCurrentPlaybackTime() {
        if (state.currentTrack && state.currentTrack.source === 'youtube') {
            return (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') ? ytPlayer.getCurrentTime() : 0;
        }
        return localAudio ? localAudio.currentTime : 0;
    }

    function getPlaybackDuration() {
        if (state.currentTrack && state.currentTrack.source === 'youtube') {
            const dur = (ytPlayer && typeof ytPlayer.getDuration === 'function') ? ytPlayer.getDuration() : 0;
            return dur > 0 ? dur : (state.currentTrack.duration || 0);
        }
        const localDur = localAudio ? localAudio.duration : 0;
        return (localDur && !isNaN(localDur)) ? localDur : (state.currentTrack ? state.currentTrack.duration || 0 : 0);
    }

    function seekTo(seconds) {
        if (state.currentTrack && state.currentTrack.source === 'youtube') {
            if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
                ytPlayer.seekTo(seconds, true);
            }
        } else if (localAudio) {
            localAudio.currentTime = seconds;
        }
    }

    function setVolume(val) {
        state.volume = Math.max(0, Math.min(1, val));
        state.isMuted = state.volume === 0;

        if (localAudio) {
            localAudio.volume = state.isMuted ? 0 : state.volume;
        }
        if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
            ytPlayer.setVolume(state.isMuted ? 0 : Math.round(state.volume * 100));
        }

        updateVolumeUI();
        saveState();
    }

    function toggleMute() {
        state.isMuted = !state.isMuted;
        if (localAudio) localAudio.volume = state.isMuted ? 0 : state.volume;
        if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
            ytPlayer.setVolume(state.isMuted ? 0 : Math.round(state.volume * 100));
        }
        updateVolumeUI();
        saveState();
    }

    function cycleRepeatMode() {
        if (state.repeatMode === 'off') {
            state.repeatMode = 'all';
            showToast('Lặp lại: Tất cả bài hát', 'info');
        } else if (state.repeatMode === 'all') {
            state.repeatMode = 'one';
            showToast('Lặp lại: Một bài hát', 'info');
        } else {
            state.repeatMode = 'off';
            showToast('Lặp lại: Tắt', 'info');
        }
        updateRepeatUI();
        saveState();
    }

    function toggleShuffle() {
        state.isShuffle = !state.isShuffle;
        el.btnShuffle.classList.toggle('is-active', state.isShuffle);
        showToast(state.isShuffle ? 'Phát ngẫu nhiên: Bật' : 'Phát ngẫu nhiên: Tắt', 'info');
        saveState();
    }

    // ==========================================
    // Video Dock Controller
    // Mandatory: ONLY close dock after pausing YouTube!
    // ==========================================
    function showVideoDock() {
        el.videoDock.classList.remove('is-hidden');
        state.isDockHidden = false;
    }

    function hideVideoDock() {
        if (state.currentTrack?.source === 'youtube') pausePlayback();
        el.videoDock.classList.add('is-hidden');
        state.isDockHidden = true;
    }

    function requestCloseVideoDock() {
        // Strict requirement: Pause YouTube before closing dock
        if (state.currentTrack && state.currentTrack.source === 'youtube' && state.isPlaying) {
            pausePlayback();
            showToast('Đã tạm dừng video YouTube trước khi đóng màn hình.', 'info');
        }
        hideVideoDock();
    }

    // ==========================================
    // UI Update Helpers
    // ==========================================
    function updatePlayerBarUI(track) {
        if (!track) return;

        el.playerTrackTitle.textContent = track.title || 'Không có tiêu đề';
        el.playerTrackArtist.textContent = track.uploader || (track.source === 'local' ? 'Tệp máy tính' : 'YouTube');

        if (track.thumbnail) {
            el.playerTrackThumb.src = track.thumbnail;
            el.playerTrackThumb.classList.remove('hidden');
            el.playerThumbPlaceholder.classList.add('hidden');
        } else {
            el.playerTrackThumb.classList.add('hidden');
            el.playerThumbPlaceholder.classList.remove('hidden');
        }

        checkIfCurrentTrackLiked();
    }

    function updatePlayPauseIcon(isPlaying) {
        el.iconPlayPause.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }

    function updateVolumeUI() {
        const displayVal = state.isMuted ? 0 : state.volume;
        el.playerVolumeInput.value = Math.round(displayVal * 100);
        el.playerVolumeFill.style.width = `${Math.round(displayVal * 100)}%`;

        if (state.isMuted || displayVal === 0) {
            el.iconVolume.className = 'fa-solid fa-volume-xmark';
        } else if (displayVal < 0.5) {
            el.iconVolume.className = 'fa-solid fa-volume-low';
        } else {
            el.iconVolume.className = 'fa-solid fa-volume-high';
        }
    }

    function updateRepeatUI() {
        el.btnRepeat.classList.toggle('is-active', state.repeatMode !== 'off');
        el.repeatOneBadge.classList.toggle('hidden', state.repeatMode !== 'one');
        el.btnRepeat.title = state.repeatMode === 'one' ? 'Lặp lại: 1 bài' : state.repeatMode === 'all' ? 'Lặp lại: Tất cả' : 'Lặp lại: Tắt';
    }

    function updateQueueBadge() {
        el.queueBadgeCount.textContent = state.queue.length;
    }

    function startProgressTimer() {
        if (progressTimer) clearInterval(progressTimer);

        progressTimer = setInterval(() => {
            if (!state.isPlaying || state.isSeeking) return;

            const cur = getCurrentPlaybackTime();
            const dur = getPlaybackDuration();

            el.playerCurrentTime.textContent = formatTime(cur);
            el.playerTotalTime.textContent = formatTime(dur);

            if (dur > 0) {
                const pct = (cur / dur) * 100;
                el.playerProgressBarFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
                el.playerSeekInput.value = pct;
            }
        }, 300);
    }

    // ==========================================
    // Navigation & Views Routing
    // ==========================================
    function switchView(viewName, addToHistory = true) {
        state.activeView = viewName;

        // Reset nav links
        el.navHome.classList.toggle('active', viewName === 'home');
        el.navSearch.classList.toggle('active', viewName === 'search');
        el.navLibrary.classList.toggle('active', viewName === 'library');
        if (el.navPlaylists) {
            el.navPlaylists.classList.toggle('active', viewName === 'playlists');
        }

        // Toggle panels
        el.viewHome.classList.toggle('active', viewName === 'home');
        el.viewSearch.classList.toggle('active', viewName === 'search');
        el.viewLibrary.classList.toggle('active', viewName === 'library');
        el.viewPlaylistsList.classList.toggle('active', viewName === 'playlists');
        el.viewPlaylist.classList.toggle('active', viewName === 'playlist');
        el.viewQueue.classList.toggle('active', viewName === 'queue');

        if (viewName === 'search') {
            el.musicSearchInput.focus();
        } else if (viewName === 'library') {
            loadLibrary();
        } else if (viewName === 'playlists') {
            renderAllPlaylistsView();
        } else if (viewName === 'queue') {
            renderQueueView();
        }

        if (addToHistory) {
            state.history = state.history.slice(0, state.historyIdx + 1);
            state.history.push(viewName);
            state.historyIdx = state.history.length - 1;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function navigateHistory(direction) {
        const nextIdx = state.historyIdx + direction;
        if (nextIdx >= 0 && nextIdx < state.history.length) {
            state.historyIdx = nextIdx;
            switchView(state.history[state.historyIdx], false);
        }
    }

    // ==========================================
    // Search View Handler (Debounce & Stale Check)
    // ==========================================
    function setupSearch() {
        el.musicSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            currentSearchQuery = query;
            if (currentSearchController) currentSearchController.abort();
            el.btnClearSearch.classList.toggle('hidden', query.length === 0);

            if (state.activeView !== 'search') {
                switchView('search');
            }

            if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

            if (query.length === 0) {
                renderSearchEmpty('Nhập từ khóa bài hát hoặc dán link YouTube để tìm kiếm.');
                return;
            }

            searchDebounceTimer = setTimeout(() => {
                executeSearch(query);
            }, 350);
        });

        el.btnClearSearch.addEventListener('click', () => {
            clearTimeout(searchDebounceTimer);
            if (currentSearchController) currentSearchController.abort();
            currentSearchQuery = '';
            el.musicSearchInput.value = '';
            el.btnClearSearch.classList.add('hidden');
            renderSearchEmpty('Nhập từ khóa bài hát hoặc dán link YouTube để tìm kiếm.');
            el.musicSearchInput.focus();
        });

        el.btnRetrySearch.addEventListener('click', () => {
            if (currentSearchQuery) executeSearch(currentSearchQuery);
        });
    }

    async function executeSearch(query) {
        currentSearchQuery = query;

        if (currentSearchController) {
            currentSearchController.abort();
        }
        currentSearchController = new AbortController();

        el.searchLoadingState.classList.remove('hidden');
        el.searchEmptyState.classList.add('hidden');
        el.searchErrorState.classList.add('hidden');
        el.searchResultsContainer.classList.add('hidden');

        try {
            const resp = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`, {
                signal: currentSearchController.signal
            });
            const data = await resp.json();

            if (query !== currentSearchQuery) return;

            el.searchLoadingState.classList.add('hidden');

            if (!data.success) {
                throw new Error(data.error || 'Lỗi khi tìm kiếm');
            }

            const tracks = data.tracks || [];
            if (tracks.length === 0) {
                renderSearchEmpty(`Không tìm thấy kết quả nào cho "${query}". Thử từ khóa khác!`);
            } else {
                renderSearchResults(tracks);
            }
        } catch (err) {
            if (err.name === 'AbortError' || query !== currentSearchQuery) return;

            el.searchLoadingState.classList.add('hidden');
            el.searchErrorState.classList.remove('hidden');
            el.searchErrorMessage.textContent = `Lỗi tìm kiếm: ${err.message}`;
        }
    }

    function renderSearchEmpty(msg) {
        el.searchLoadingState.classList.add('hidden');
        el.searchErrorState.classList.add('hidden');
        el.searchResultsContainer.classList.add('hidden');
        el.searchEmptyState.classList.remove('hidden');
        el.searchEmptyMessage.textContent = msg;
    }

    function renderSearchResults(tracks) {
        el.searchResultsTableBody.innerHTML = '';

        tracks.forEach((track, idx) => {
            const tr = createTrackTableRow(track, idx, {
                showPlayBtn: true,
                showAddBtn: true,
                onPlay: () => {
                    setQueueAndPlay(tracks, idx);
                }
            });
            el.searchResultsTableBody.appendChild(tr);
        });

        el.searchResultsContainer.classList.remove('hidden');
    }

    // ==========================================
    // Library View Handler (Local Tracks)
    // ==========================================
    async function loadLibrary() {
        el.libraryLoadingState.classList.remove('hidden');
        el.libraryEmptyState.classList.add('hidden');
        el.libraryTableBody.innerHTML = '';

        try {
            const resp = await fetch('/api/music/library');
            const data = await resp.json();

            el.libraryLoadingState.classList.add('hidden');

            if (!data.success) throw new Error(data.error || 'Không thể tải thư viện');

            const tracks = data.tracks || [];
            el.localFilesCount.textContent = `${tracks.length} bài hát`;

            if (tracks.length === 0) {
                el.libraryEmptyState.classList.remove('hidden');
                return;
            }

            tracks.forEach((track, idx) => {
                const tr = createTrackTableRow(track, idx, {
                    showPlayBtn: true,
                    showAddBtn: true,
                    onPlay: () => {
                        setQueueAndPlay(tracks, idx);
                    }
                });
                el.libraryTableBody.appendChild(tr);
            });
        } catch (err) {
            el.libraryLoadingState.classList.add('hidden');
            showToast(`Lỗi nạp thư viện: ${err.message}`, 'error');
        }
    }

    // ==========================================
    // Playlists Engine (API Contract)
    // ==========================================
    async function loadPlaylists() {
        try {
            const resp = await fetch('/api/playlists');
            const data = await resp.json();

            if (!data.success) return;

            state.playlists = data.playlists || [];
            renderSidebarPlaylists();
            renderHomePlaylists();
            renderAllPlaylistsView();
            checkIfCurrentTrackLiked();
        } catch (err) {
            console.error('Failed to load playlists:', err);
        }
    }

    function renderSidebarPlaylists() {
        el.sidebarPlaylistsList.innerHTML = '';

        state.playlists.forEach(pl => {
            const a = document.createElement('a');
            a.className = 'playlist-nav-item';
            if (state.currentPlaylist && String(state.currentPlaylist.id) === String(pl.id) && state.activeView === 'playlist') {
                a.classList.add('active');
            }

            const icon = document.createElement('i');
            icon.className = pl.name === 'Bài hát đã thích' ? 'fa-solid fa-heart' : 'fa-solid fa-music';

            const span = document.createElement('span');
            span.textContent = pl.name;

            a.appendChild(icon);
            a.appendChild(span);

            a.addEventListener('click', (e) => {
                e.preventDefault();
                openPlaylistView(pl.id);
            });

            el.sidebarPlaylistsList.appendChild(a);
        });
    }

    function renderHomePlaylists() {
        el.homePlaylistsGrid.innerHTML = '';

        const likedPl = state.playlists.find(p => p.name === 'Bài hát đã thích');
        const likedCount = likedPl && Array.isArray(likedPl.tracks) ? likedPl.tracks.length : 0;
        el.likedSongsCount.textContent = `${likedCount} bài hát`;

        if (state.playlists.length === 0) {
            const p = document.createElement('p');
            p.style.color = 'var(--text-muted)';
            p.style.fontSize = '0.9rem';
            p.textContent = 'Bạn chưa tạo danh sách phát nào. Nhấn nút "Tạo Playlist" để bắt đầu!';
            el.homePlaylistsGrid.appendChild(p);
            return;
        }

        state.playlists.forEach(pl => {
            const card = createPlaylistCardElement(pl);
            el.homePlaylistsGrid.appendChild(card);
        });
    }

    function renderAllPlaylistsView() {
        if (!el.allPlaylistsGrid) return;
        el.allPlaylistsGrid.innerHTML = '';

        if (state.playlists.length === 0) {
            const p = document.createElement('p');
            p.style.color = 'var(--text-muted)';
            p.style.fontSize = '0.95rem';
            p.textContent = 'Chưa có playlist nào. Bấm nút "Tạo Playlist" ở trên để tạo danh sách đầu tiên!';
            el.allPlaylistsGrid.appendChild(p);
            return;
        }

        state.playlists.forEach(pl => {
            const card = createPlaylistCardElement(pl);
            el.allPlaylistsGrid.appendChild(card);
        });
    }

    function createPlaylistCardElement(pl) {
        const card = document.createElement('div');
        card.className = 'playlist-card';

        const cover = document.createElement('div');
        cover.className = 'playlist-card-cover';
        const icon = document.createElement('i');
        icon.className = pl.name === 'Bài hát đã thích' ? 'fa-solid fa-heart' : 'fa-solid fa-music';
        if (pl.name === 'Bài hát đã thích') icon.style.color = '#1db954';
        cover.appendChild(icon);

        const playBtn = document.createElement('button');
        playBtn.className = 'playlist-card-play-btn';
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (pl.tracks && pl.tracks.length > 0) {
                setQueueAndPlay(pl.tracks, 0);
            } else {
                showToast('Playlist này chưa có bài hát.', 'info');
            }
        });
        cover.appendChild(playBtn);

        const title = document.createElement('div');
        title.className = 'playlist-card-title';
        title.textContent = pl.name;

        const sub = document.createElement('div');
        sub.className = 'playlist-card-sub';
        sub.textContent = `${pl.tracks ? pl.tracks.length : 0} bài hát`;

        card.appendChild(cover);
        card.appendChild(title);
        card.appendChild(sub);

        card.addEventListener('click', () => {
            openPlaylistView(pl.id);
        });

        return card;
    }

    async function openPlaylistView(playlistId) {
        const found = state.playlists.find(p => String(p.id) === String(playlistId));
        if (!found) {
            showToast('Không tìm thấy danh sách phát.', 'error');
            return;
        }

        state.currentPlaylist = found;
        switchView('playlist');
        renderSidebarPlaylists();

        el.playlistBannerTitle.textContent = found.name;
        const tracks = found.tracks || [];
        el.playlistBannerTrackCount.textContent = `${tracks.length} bài hát`;

        const totalSecs = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
        const mins = Math.floor(totalSecs / 60);
        el.playlistBannerDuration.textContent = tracks.some(track => !track.duration)
            ? 'Chưa rõ thời lượng' : mins > 0 ? `khoảng ${mins} phút` : `${totalSecs} giây`;

        el.playlistTracksTableBody.innerHTML = '';
        if (tracks.length === 0) {
            el.playlistTracksContainer.classList.add('hidden');
            el.playlistEmptyState.classList.remove('hidden');
        } else {
            el.playlistTracksContainer.classList.remove('hidden');
            el.playlistEmptyState.classList.add('hidden');

            tracks.forEach((track, idx) => {
                const tr = createTrackTableRow(track, idx, {
                    showPlayBtn: true,
                    showOrderBtns: true,
                    showRemoveBtn: true,
                    totalCount: tracks.length,
                    onPlay: () => {
                        setQueueAndPlay(tracks, idx);
                    },
                    onMoveUp: () => movePlaylistTrack(found.id, idx, idx - 1),
                    onMoveDown: () => movePlaylistTrack(found.id, idx, idx + 1),
                    onRemove: () => removeTrackFromPlaylist(found.id, track.id)
                });
                el.playlistTracksTableBody.appendChild(tr);
            });
        }
    }

    async function createPlaylist(name) {
        if (!name || !name.trim()) return;
        name = name.trim();
        const initialTrack = targetTrackForModal;

        try {
            const resp = await fetch('/api/playlists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await resp.json();

            if (!data.success) throw new Error(data.error || 'Không thể tạo playlist');

            showToast(`Đã tạo playlist "${name}" thành công!`, 'success');
            if (initialTrack && data.playlist?.id) {
                await addTrackToPlaylist(data.playlist.id, initialTrack);
            }
            await loadPlaylists();
            if (data.playlist && data.playlist.id) {
                openPlaylistView(data.playlist.id);
            }
        } catch (err) {
            showToast(`Lỗi tạo playlist: ${err.message}`, 'error');
        }
    }

    async function renamePlaylist(playlistId, newName) {
        if (!newName || !newName.trim()) return;
        newName = newName.trim();

        try {
            const resp = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
            const data = await resp.json();

            if (!data.success) throw new Error(data.error || 'Không thể đổi tên');

            showToast(`Đã đổi tên thành "${newName}"!`, 'success');
            await loadPlaylists();
            openPlaylistView(playlistId);
        } catch (err) {
            showToast(`Lỗi đổi tên: ${err.message}`, 'error');
        }
    }

    async function deletePlaylist(playlistId) {
        const pl = state.playlists.find(p => String(p.id) === String(playlistId));
        const name = pl ? pl.name : 'này';

        if (!confirm(`Bạn có chắc chắn muốn xóa danh sách phát "${name}"?`)) return;

        try {
            const resp = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}`, {
                method: 'DELETE'
            });
            const data = await resp.json();

            if (!data.success) throw new Error(data.error || 'Không thể xóa');

            showToast(`Đã xóa playlist "${name}".`, 'info');
            state.currentPlaylist = null;
            await loadPlaylists();
            switchView('home');
        } catch (err) {
            showToast(`Lỗi xóa playlist: ${err.message}`, 'error');
        }
    }

    async function addTrackToPlaylist(playlistId, track) {
        try {
            const resp = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}/tracks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track })
            });
            const data = await resp.json();

            if (!data.success) throw new Error(data.error || 'Không thể thêm bài hát');

            const pl = state.playlists.find(p => String(p.id) === String(playlistId));
            showToast(`Đã thêm bài hát vào "${pl ? pl.name : 'playlist'}"!`, 'success');

            await loadPlaylists();
            if (state.activeView === 'playlist' && state.currentPlaylist && String(state.currentPlaylist.id) === String(playlistId)) {
                openPlaylistView(playlistId);
            }
        } catch (err) {
            showToast(`Lỗi thêm bài: ${err.message}`, 'error');
        }
    }

    async function removeTrackFromPlaylist(playlistId, trackId) {
        try {
            const resp = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`, {
                method: 'DELETE'
            });
            const data = await resp.json();

            if (!data.success) throw new Error(data.error || 'Không thể xóa');

            showToast('Đã xóa bài hát khỏi danh sách.', 'info');
            await loadPlaylists();
            openPlaylistView(playlistId);
        } catch (err) {
            showToast(`Lỗi xóa bài: ${err.message}`, 'error');
        }
    }

    async function movePlaylistTrack(playlistId, fromIdx, toIdx) {
        const pl = state.playlists.find(p => String(p.id) === String(playlistId));
        if (!pl || !pl.tracks) return;

        const tracks = [...pl.tracks];
        if (toIdx < 0 || toIdx >= tracks.length) return;

        const item = tracks.splice(fromIdx, 1)[0];
        tracks.splice(toIdx, 0, item);

        const track_ids = tracks.map(t => t.id);

        try {
            const resp = await fetch(`/api/playlists/${encodeURIComponent(playlistId)}/tracks`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_ids })
            });
            const data = await resp.json();

            if (!data.success) throw new Error(data.error || 'Không thể đổi thứ tự');

            await loadPlaylists();
            openPlaylistView(playlistId);
        } catch (err) {
            showToast(`Lỗi đổi thứ tự: ${err.message}`, 'error');
        }
    }

    // ==========================================
    // "Bài hát đã thích" (Liked Songs Handler)
    // ==========================================
    async function toggleLikeCurrentTrack() {
        if (!state.currentTrack) {
            showToast('Chưa có bài hát nào đang phát.', 'info');
            return;
        }

        let likedPl = state.playlists.find(p => p.name === 'Bài hát đã thích');
        if (!likedPl) {
            try {
                const resp = await fetch('/api/playlists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Bài hát đã thích' })
                });
                const data = await resp.json();
                if (data.success && data.playlist) {
                    likedPl = data.playlist;
                    await loadPlaylists();
                }
            } catch (e) {
                console.error(e);
            }
        }

        if (!likedPl) return;

        const isLiked = likedPl.tracks && likedPl.tracks.some(t => String(t.id) === String(state.currentTrack.id));

        if (isLiked) {
            await removeTrackFromPlaylist(likedPl.id, state.currentTrack.id);
            showToast('Đã bỏ thích bài hát này.', 'info');
        } else {
            await addTrackToPlaylist(likedPl.id, state.currentTrack);
            showToast('Đã thêm vào Bài hát đã thích!', 'success');
        }

        checkIfCurrentTrackLiked();
    }

    function checkIfCurrentTrackLiked() {
        if (!state.currentTrack) {
            el.iconPlayerLike.className = 'fa-regular fa-heart';
            el.btnPlayerLike.classList.remove('is-active');
            return;
        }

        const likedPl = state.playlists.find(p => p.name === 'Bài hát đã thích');
        const isLiked = likedPl && likedPl.tracks && likedPl.tracks.some(t => String(t.id) === String(state.currentTrack.id));

        if (isLiked) {
            el.iconPlayerLike.className = 'fa-solid fa-heart';
            el.btnPlayerLike.classList.add('is-active');
        } else {
            el.iconPlayerLike.className = 'fa-regular fa-heart';
            el.btnPlayerLike.classList.remove('is-active');
        }
    }

    // ==========================================
    // Queue View & Operations
    // ==========================================
    function setQueueAndPlay(tracksList, startIndex = 0) {
        state.queue = [...tracksList];
        saveState();
        updateQueueBadge();
        playTrack(state.queue[startIndex], startIndex);
    }

    function renderQueueView() {
        el.queueNowPlayingCard.innerHTML = '';
        if (state.currentTrack) {
            const thumb = document.createElement('img');
            thumb.className = 'track-thumb';
            thumb.src = state.currentTrack.thumbnail || '';
            thumb.alt = '';

            const info = document.createElement('div');
            info.className = 'track-title-col';
            const title = document.createElement('div');
            title.className = 'track-title-text';
            title.textContent = state.currentTrack.title;
            const artist = document.createElement('div');
            artist.className = 'track-artist-text';
            artist.textContent = state.currentTrack.uploader;

            info.appendChild(title);
            info.appendChild(artist);

            el.queueNowPlayingCard.appendChild(thumb);
            el.queueNowPlayingCard.appendChild(info);
        } else {
            el.queueNowPlayingCard.innerHTML = '<span style="color:var(--text-muted);">Chưa có bài hát nào đang phát.</span>';
        }

        el.queueTableBody.innerHTML = '';
        const upcomingTracks = state.queue.slice(state.currentQueueIndex + 1);

        if (upcomingTracks.length === 0) {
            el.queueContainer.classList.add('hidden');
            el.queueEmptyState.classList.remove('hidden');
        } else {
            el.queueContainer.classList.remove('hidden');
            el.queueEmptyState.classList.add('hidden');

            upcomingTracks.forEach((track, relIdx) => {
                const actualIdx = state.currentQueueIndex + 1 + relIdx;
                const tr = createTrackTableRow(track, relIdx, {
                    showPlayBtn: true,
                    showRemoveBtn: true,
                    onPlay: () => {
                        playTrack(state.queue[actualIdx], actualIdx);
                    },
                    onRemove: () => {
                        state.queue.splice(actualIdx, 1);
                        saveState();
                        updateQueueBadge();
                        renderQueueView();
                    }
                });
                el.queueTableBody.appendChild(tr);
            });
        }
    }

    // ==========================================
    // Render Track Table Row Helper (Strict XSS safe)
    // ==========================================
    function createTrackTableRow(track, index, options = {}) {
        const tr = document.createElement('tr');
        tr.className = 'track-row';
        if (state.currentTrack && String(state.currentTrack.id) === String(track.id)) {
            tr.classList.add('is-active');
        }

        const tdNum = document.createElement('td');
        tdNum.className = 'col-num';
        const numWrap = document.createElement('div');
        numWrap.className = 'row-index-wrap';

        const numSpan = document.createElement('span');
        numSpan.className = 'row-num-text';
        numSpan.textContent = index + 1;

        const playBtn = document.createElement('button');
        playBtn.className = 'row-play-btn';
        playBtn.title = `Phát ${track.title || 'bài hát'}`;
        playBtn.setAttribute('aria-label', playBtn.title);
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (options.onPlay) options.onPlay();
        });

        numWrap.appendChild(numSpan);
        numWrap.appendChild(playBtn);
        tdNum.appendChild(numWrap);

        const tdTitle = document.createElement('td');
        const mainWrap = document.createElement('div');
        mainWrap.className = 'track-cell-main';

        if (track.thumbnail) {
            const thumbImg = document.createElement('img');
            thumbImg.className = 'track-thumb';
            thumbImg.src = track.thumbnail;
            thumbImg.alt = '';
            thumbImg.loading = 'lazy';
            mainWrap.appendChild(thumbImg);
        } else {
            const thumbPlaceholder = document.createElement('div');
            thumbPlaceholder.className = 'track-thumb-placeholder';
            thumbPlaceholder.innerHTML = '<i class="fa-solid fa-music"></i>';
            mainWrap.appendChild(thumbPlaceholder);
        }

        const titleCol = document.createElement('div');
        titleCol.className = 'track-title-col';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'track-title-text';
        titleSpan.textContent = track.title || 'Không tên';

        const artistSpan = document.createElement('span');
        artistSpan.className = 'track-artist-text';
        artistSpan.textContent = track.uploader || (track.source === 'local' ? 'Tệp máy tính' : 'YouTube');

        titleCol.appendChild(titleSpan);
        titleCol.appendChild(artistSpan);
        mainWrap.appendChild(titleCol);
        tdTitle.appendChild(mainWrap);

        const tdSource = document.createElement('td');
        tdSource.className = 'col-source';
        const sourceBadge = document.createElement('span');
        if (track.source === 'youtube') {
            sourceBadge.className = 'badge-source badge-youtube';
            sourceBadge.innerHTML = '<i class="fa-brands fa-youtube"></i> YouTube';
        } else {
            sourceBadge.className = 'badge-source badge-local';
            sourceBadge.innerHTML = '<i class="fa-solid fa-hard-drive"></i> Local';
        }
        tdSource.appendChild(sourceBadge);

        const tdTime = document.createElement('td');
        tdTime.className = 'col-time';
        tdTime.textContent = track.duration > 0 ? formatTime(track.duration) : '—';

        tr.appendChild(tdNum);
        tr.appendChild(tdTitle);
        tr.appendChild(tdSource);
        tr.appendChild(tdTime);

        if (options.showOrderBtns) {
            const tdOrder = document.createElement('td');
            tdOrder.className = 'col-order';
            const orderWrap = document.createElement('div');
            orderWrap.className = 'order-btn-wrap';

            const upBtn = document.createElement('button');
            upBtn.className = 'row-action-btn';
            upBtn.title = 'Di chuyển lên';
            upBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            if (index === 0) upBtn.disabled = true;
            upBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (options.onMoveUp) options.onMoveUp();
            });

            const downBtn = document.createElement('button');
            downBtn.className = 'row-action-btn';
            downBtn.title = 'Di chuyển xuống';
            downBtn.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
            if (index === options.totalCount - 1) downBtn.disabled = true;
            downBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (options.onMoveDown) options.onMoveDown();
            });

            orderWrap.appendChild(upBtn);
            orderWrap.appendChild(downBtn);
            tdOrder.appendChild(orderWrap);
            tr.appendChild(tdOrder);
        }

        const tdActions = document.createElement('td');
        tdActions.className = 'col-actions';

        if (options.showAddBtn) {
            const addBtn = document.createElement('button');
            addBtn.className = 'row-action-btn';
            addBtn.title = 'Thêm vào Playlist';
            addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openAddToPlaylistModal(track);
            });
            tdActions.appendChild(addBtn);
        }

        if (options.showRemoveBtn) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'row-action-btn btn-remove';
            removeBtn.title = 'Xóa bài hát';
            removeBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (options.onRemove) options.onRemove();
            });
            tdActions.appendChild(removeBtn);
        }

        tr.appendChild(tdActions);

        tr.addEventListener('click', () => {
            if (options.onPlay) options.onPlay();
        });

        return tr;
    }

    function highlightActiveRow() {
        document.querySelectorAll('.track-row').forEach(r => r.classList.remove('is-active'));
        if (!state.currentTrack) return;
        document.querySelectorAll('.track-row').forEach(row => {
            const titleEl = row.querySelector('.track-title-text');
            if (titleEl && titleEl.textContent === state.currentTrack.title) {
                row.classList.add('is-active');
            }
        });
    }

    // ==========================================
    // Modals Management
    // ==========================================
    let targetTrackForModal = null;

    function openAddToPlaylistModal(track) {
        targetTrackForModal = track;
        el.modalTargetTrackPreview.innerHTML = '';

        const thumb = document.createElement('img');
        thumb.className = 'track-thumb';
        thumb.src = track.thumbnail || '';
        thumb.alt = '';
        const title = document.createElement('div');
        title.className = 'track-title-text';
        title.textContent = track.title;

        el.modalTargetTrackPreview.appendChild(thumb);
        el.modalTargetTrackPreview.appendChild(title);

        el.modalPlaylistsList.innerHTML = '';
        state.playlists.forEach(pl => {
            const item = document.createElement('div');
            item.className = 'modal-playlist-item';
            item.setAttribute('role', 'button');
            item.tabIndex = 0;
            item.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    item.click();
                }
            });

            const name = document.createElement('span');
            name.className = 'modal-playlist-name';
            name.textContent = pl.name;

            const count = document.createElement('span');
            count.className = 'modal-playlist-count';
            count.textContent = `${pl.tracks ? pl.tracks.length : 0} bài`;

            item.appendChild(name);
            item.appendChild(count);

            item.addEventListener('click', async () => {
                await addTrackToPlaylist(pl.id, targetTrackForModal);
                closeAllModals();
            });

            el.modalPlaylistsList.appendChild(item);
        });

        el.modalAddToPlaylist.classList.remove('hidden');
    }

    function closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
        targetTrackForModal = null;
    }

    // ==========================================
    // Event Listeners Binding
    // ==========================================
    function bindEvents() {
        // Navigation clicks
        el.navHome.addEventListener('click', (e) => { e.preventDefault(); switchView('home'); });
        el.navSearch.addEventListener('click', (e) => { e.preventDefault(); switchView('search'); });
        el.navLibrary.addEventListener('click', (e) => { e.preventDefault(); switchView('library'); });
        if (el.navPlaylists) {
            el.navPlaylists.addEventListener('click', (e) => { e.preventDefault(); switchView('playlists'); });
        }

        el.btnHeroGoSearch.addEventListener('click', () => switchView('search'));
        el.btnHeroGoLibrary.addEventListener('click', () => switchView('library'));
        el.cardSearchShortcut.addEventListener('click', () => switchView('search'));

        el.btnHomeCreatePlaylist.addEventListener('click', () => {
            el.inputPlaylistName.value = '';
            el.modalCreatePlaylist.classList.remove('hidden');
            el.inputPlaylistName.focus();
        });

        if (el.btnPlaylistsListCreate) {
            el.btnPlaylistsListCreate.addEventListener('click', () => {
                el.inputPlaylistName.value = '';
                el.modalCreatePlaylist.classList.remove('hidden');
                el.inputPlaylistName.focus();
            });
        }

        el.btnHistoryBack.addEventListener('click', () => navigateHistory(-1));
        el.btnHistoryForward.addEventListener('click', () => navigateHistory(1));

        // Quick shortcuts on home
        el.cardLikedSongs.addEventListener('click', () => {
            const likedPl = state.playlists.find(p => p.name === 'Bài hát đã thích');
            if (likedPl) openPlaylistView(likedPl.id);
            else showToast('Chưa có bài hát nào được thích.', 'info');
        });

        el.btnPlayLikedPlaylist.addEventListener('click', (e) => {
            e.stopPropagation();
            const likedPl = state.playlists.find(p => p.name === 'Bài hát đã thích');
            if (likedPl && likedPl.tracks && likedPl.tracks.length > 0) {
                setQueueAndPlay(likedPl.tracks, 0);
            } else {
                showToast('Chưa có bài hát nào được thích.', 'info');
            }
        });

        el.cardOfflineMusic.addEventListener('click', () => switchView('library'));
        el.btnPlayAllLocal.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const resp = await fetch('/api/music/library');
                const data = await resp.json();
                if (data.success && data.tracks && data.tracks.length > 0) {
                    setQueueAndPlay(data.tracks, 0);
                } else {
                    showToast('Kho nhạc offline đang trống.', 'info');
                }
            } catch (err) {
                showToast('Không thể phát thư viện.', 'error');
            }
        });

        // Player Controls
        el.btnPlayPause.addEventListener('click', togglePlay);
        el.btnNext.addEventListener('click', nextTrack);
        el.btnPrev.addEventListener('click', prevTrack);
        el.btnRepeat.addEventListener('click', cycleRepeatMode);
        el.btnShuffle.addEventListener('click', toggleShuffle);
        el.btnPlayerLike.addEventListener('click', toggleLikeCurrentTrack);
        el.btnPlayerAddToPlaylist.addEventListener('click', () => {
            if (state.currentTrack) openAddToPlaylistModal(state.currentTrack);
            else showToast('Chưa có bài hát nào đang phát.', 'info');
        });

        // Seek Bar handling
        el.playerSeekInput.addEventListener('mousedown', () => { state.isSeeking = true; });
        el.playerSeekInput.addEventListener('touchstart', () => { state.isSeeking = true; });

        el.playerSeekInput.addEventListener('input', (e) => {
            const pct = parseFloat(e.target.value);
            el.playerProgressBarFill.style.width = `${pct}%`;
            const dur = getPlaybackDuration();
            el.playerCurrentTime.textContent = formatTime((pct / 100) * dur);
        });

        el.playerSeekInput.addEventListener('change', (e) => {
            const pct = parseFloat(e.target.value);
            const dur = getPlaybackDuration();
            const targetSecs = (pct / 100) * dur;
            seekTo(targetSecs);
            state.isSeeking = false;
        });

        // Volume controls
        el.playerVolumeInput.addEventListener('input', (e) => {
            setVolume(parseFloat(e.target.value) / 100);
        });
        el.btnVolumeMute.addEventListener('click', toggleMute);

        // Video Dock Controls: Strict requirement -> Close dock only after pausing YouTube
        el.btnToggleVideoDock.addEventListener('click', () => {
            if (state.isDockHidden) {
                showVideoDock();
            } else {
                requestCloseVideoDock();
            }
        });

        el.btnCloseVideoDock.addEventListener('click', requestCloseVideoDock);

        el.btnExpandVideoDock.addEventListener('click', () => {
            state.isDockExpanded = !state.isDockExpanded;
            el.videoDock.classList.toggle('is-expanded', state.isDockExpanded);
            el.iconExpandDock.className = state.isDockExpanded ?
                'fa-solid fa-down-left-and-up-right-to-center' :
                'fa-solid fa-up-right-and-down-left-from-center';
        });

        el.btnResumeAutoplay.addEventListener('click', resumePlayback);

        // Queue Toggles
        el.btnToggleQueue.addEventListener('click', () => switchView('queue'));
        el.btnQuickQueue.addEventListener('click', () => switchView('queue'));
        el.btnClearQueue.addEventListener('click', () => {
            state.queue = state.currentTrack ? [state.currentTrack] : [];
            state.currentQueueIndex = 0;
            saveState();
            updateQueueBadge();
            renderQueueView();
            showToast('Đã xóa hàng đợi phát nhạc.', 'info');
        });

        // Library actions
        el.btnRefreshLibrary.addEventListener('click', loadLibrary);
        el.btnPlayAllLibrary.addEventListener('click', () => {
            fetch('/api/music/library')
                .then(r => r.json())
                .then(data => {
                    if (data.success && data.tracks && data.tracks.length > 0) {
                        setQueueAndPlay(data.tracks, 0);
                    }
                });
        });

        // Playlist View Buttons
        el.btnPlaylistPlayAll.addEventListener('click', () => {
            if (state.currentPlaylist && state.currentPlaylist.tracks && state.currentPlaylist.tracks.length > 0) {
                setQueueAndPlay(state.currentPlaylist.tracks, 0);
            } else {
                showToast('Playlist này chưa có bài hát.', 'info');
            }
        });

        el.btnPlaylistShuffle.addEventListener('click', () => {
            if (state.currentPlaylist && state.currentPlaylist.tracks && state.currentPlaylist.tracks.length > 0) {
                state.isShuffle = true;
                el.btnShuffle.classList.add('is-active');
                setQueueAndPlay(state.currentPlaylist.tracks, Math.floor(Math.random() * state.currentPlaylist.tracks.length));
                showToast('Đang phát ngẫu nhiên playlist!', 'info');
            }
        });

        el.btnPlaylistRename.addEventListener('click', () => {
            if (!state.currentPlaylist) return;
            el.inputRenamePlaylistName.value = state.currentPlaylist.name;
            el.modalRenamePlaylist.classList.remove('hidden');
            el.inputRenamePlaylistName.focus();
        });

        el.btnPlaylistDelete.addEventListener('click', () => {
            if (state.currentPlaylist) deletePlaylist(state.currentPlaylist.id);
        });

        el.btnPlaylistFindSongs.addEventListener('click', () => switchView('search'));

        // Modals Buttons
        el.btnOpenCreatePlaylistModal.addEventListener('click', () => {
            el.inputPlaylistName.value = '';
            el.modalCreatePlaylist.classList.remove('hidden');
            el.inputPlaylistName.focus();
        });

        el.btnTopCreatePlaylist.addEventListener('click', () => {
            el.inputPlaylistName.value = '';
            el.modalCreatePlaylist.classList.remove('hidden');
            el.inputPlaylistName.focus();
        });

        el.btnConfirmCreatePlaylist.addEventListener('click', () => {
            createPlaylist(el.inputPlaylistName.value);
            closeAllModals();
        });

        el.inputPlaylistName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                createPlaylist(el.inputPlaylistName.value);
                closeAllModals();
            }
        });

        el.btnConfirmRenamePlaylist.addEventListener('click', () => {
            if (state.currentPlaylist) {
                renamePlaylist(state.currentPlaylist.id, el.inputRenamePlaylistName.value);
            }
            closeAllModals();
        });

        el.inputRenamePlaylistName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && state.currentPlaylist) {
                renamePlaylist(state.currentPlaylist.id, el.inputRenamePlaylistName.value);
                closeAllModals();
            }
        });

        el.btnModalCreateNewPlaylist.addEventListener('click', () => {
            const selectedTrack = targetTrackForModal;
            closeAllModals();
            targetTrackForModal = selectedTrack;
            el.inputPlaylistName.value = '';
            el.modalCreatePlaylist.classList.remove('hidden');
            el.inputPlaylistName.focus();
        });

        // Close modal on [data-close-modal]
        document.querySelectorAll('[data-close-modal]').forEach(b => {
            b.addEventListener('click', closeAllModals);
        });

        // Global Keyboard Shortcuts (Space to toggle play/pause)
        window.addEventListener('keydown', (e) => {
            if (['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())) {
                return;
            }
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlay();
            }
        });
    }

    // ==========================================
    // Application Initialization
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        cacheElements();
        initLocalAudio();
        loadSavedState();
        el.videoDock.classList.add('is-hidden');
        state.isDockHidden = true;
        if (window.YT?.Player) window.onYouTubeIframeAPIReady();
        bindEvents();
        setupSearch();

        updateVolumeUI();
        updateRepeatUI();
        el.btnShuffle.classList.toggle('is-active', state.isShuffle);
        updateQueueBadge();

        if (state.currentTrack) {
            updatePlayerBarUI(state.currentTrack);
        }

        loadPlaylists();
        loadLibrary();
    });

})();
