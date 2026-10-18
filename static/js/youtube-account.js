/* Google account connection and paginated, read-only YouTube playlists. */
(() => {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const byId = id => document.getElementById(id);
        const ui = Object.fromEntries(['AccountTitle', 'AccountDescription', 'Connect', 'Refresh', 'Disconnect',
            'Feedback', 'Setup', 'SetupBadge', 'ClientFile', 'ConnectedLibrary', 'LookupForm', 'PlaylistUrl',
            'PlaylistsLoading', 'PlaylistsEmpty', 'PlaylistsGrid', 'MorePlaylists', 'SelectedPlaylist',
            'SelectedTitle', 'TracksCount', 'PlayPlaylist', 'TracksLoading', 'TracksEmpty', 'TracksBody',
            'MoreTracks'].map(key => [key, byId('yt' + key)]));
        let account = {}, playlists = [], nextPlaylists = null, selected = null, tracks = [], nextTracks = null;
        let libraryVersion = 0, trackVersion = 0, libraryLoading = false, tracksLoading = false;
        const player = window.Y2Music;
        const toggle = (node, visible) => node.classList.toggle('hidden', !visible);

        function message(text, success = false) {
            ui.Feedback.textContent = text;
            ui.Feedback.classList.toggle('is-success', success);
            toggle(ui.Feedback, Boolean(text));
        }

        async function api(path, options = {}) {
            const response = await fetch('/api/youtube/' + path, {cache: 'no-store', ...options});
            let data;
            try { data = await response.json(); }
            catch { throw new Error('Chưa đọc được phản hồi. Hãy khởi động lại ứng dụng và thử lại.'); }
            if (!response.ok || !data.success) {
                if (['connect_required', 'reconnect_required'].includes(data.code)) {
                    ui.Connect.disabled = false;
                    toggle(ui.Connect, true);
                    ui.Connect.textContent = 'Kết nối lại Google';
                }
                throw new Error(data.error || 'Chưa kết nối được YouTube.');
            }
            return data;
        }

        const post = (path, data = {}) => api(path, {method: 'POST',
            headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});

        async function loadStatus() {
            const data = await api('status');
            account = data;
            ui.Connect.disabled = false;
            ui.Connect.textContent = data.connected ? 'Kết nối lại Google' : 'Kết nối Google';
            toggle(ui.Connect, !data.connected);
            toggle(ui.Refresh, data.connected);
            toggle(ui.Disconnect, data.connected);
            toggle(ui.ConnectedLibrary, data.connected);
            ui.SetupBadge.textContent = data.configured ? 'Đã có cấu hình' : 'Cần file OAuth JSON';
            if (!data.configured) ui.Setup.open = true;
            ui.AccountTitle.textContent = data.connected
                ? data.channel?.title || 'Đã kết nối YouTube' : 'Kết nối thư viện YouTube';
            ui.AccountDescription.textContent = data.connected
                ? 'Đang dùng quyền chỉ đọc. Playlist gốc trên YouTube được giữ nguyên.'
                : 'Đăng nhập Google để xem và nghe playlist riêng của bạn.';
            return data;
        }

        function renderPlaylists() {
            ui.PlaylistsGrid.replaceChildren();
            for (const item of playlists) {
                const card = document.createElement('button');
                card.type = 'button'; card.className = 'playlist-card yt-playlist-card';
                let cover;
                if (item.thumbnail) {
                    cover = document.createElement('img'); cover.src = item.thumbnail; cover.alt = ''; cover.loading = 'lazy';
                } else {
                    cover = document.createElement('span'); cover.textContent = '♫';
                }
                cover.className = 'yt-remote-cover';
                const title = document.createElement('span'); title.className = 'yt-remote-title'; title.textContent = item.name;
                const meta = document.createElement('span'); meta.className = 'yt-remote-meta';
                const privacy = {private: 'Riêng tư', unlisted: 'Không công khai', public: 'Công khai'}[item.privacy];
                meta.textContent = [item.count == null ? 'YouTube' : `${item.count} video`, privacy].filter(Boolean).join(' · ');
                card.append(cover, title, meta);
                card.addEventListener('click', () => openPlaylist(item));
                ui.PlaylistsGrid.append(card);
            }
            toggle(ui.PlaylistsEmpty, !playlists.length);
            toggle(ui.MorePlaylists, Boolean(nextPlaylists));
        }

        async function loadPlaylists(append = false) {
            if (libraryLoading && append) return;
            const version = append ? libraryVersion : ++libraryVersion;
            libraryLoading = true;
            ui.MorePlaylists.disabled = true;
            toggle(ui.PlaylistsLoading, true);
            if (!append) {
                playlists = []; nextPlaylists = null; renderPlaylists(); toggle(ui.PlaylistsEmpty, false);
            }
            try {
                const suffix = append && nextPlaylists ? '?page_token=' + encodeURIComponent(nextPlaylists) : '';
                const data = await api('playlists' + suffix);
                if (version !== libraryVersion) return;
                const combined = append ? [...playlists, ...data.playlists] : data.playlists;
                playlists = [...new Map(combined.map(item => [item.id, item])).values()];
                nextPlaylists = data.next_page_token;
                if (data.channel) ui.AccountTitle.textContent = data.channel.title;
                renderPlaylists();
            } catch (error) {
                if (version === libraryVersion) message(error.message);
            } finally {
                if (version === libraryVersion) {
                    libraryLoading = false;
                    ui.MorePlaylists.disabled = false;
                    toggle(ui.PlaylistsLoading, false);
                }
            }
        }

        function renderTracks() {
            ui.TracksBody.replaceChildren();
            tracks.forEach((track, index) => ui.TracksBody.append(player.createTrackRow(track, index, {
                showPlayBtn: true, showAddBtn: true,
                onPlay: () => player.playTracks([...tracks], index),
            })));
            ui.PlayPlaylist.disabled = !tracks.length;
            toggle(ui.TracksEmpty, !tracks.length);
            toggle(ui.MoreTracks, Boolean(nextTracks));
        }

        async function loadTracks(append = false) {
            if (!selected || (tracksLoading && append)) return;
            const version = append ? trackVersion : ++trackVersion;
            const playlist = selected;
            tracksLoading = true; ui.MoreTracks.disabled = true;
            toggle(ui.TracksLoading, true); toggle(ui.TracksEmpty, false);
            try {
                const suffix = append && nextTracks ? '?page_token=' + encodeURIComponent(nextTracks) : '';
                const data = await api(`playlists/${encodeURIComponent(playlist.id)}/tracks` + suffix);
                if (version !== trackVersion) return;
                tracks = append ? [...tracks, ...data.tracks] : data.tracks;
                nextTracks = data.next_page_token;
                ui.TracksCount.textContent = `${tracks.length} bài đang hiển thị · ${data.total} mục trong playlist`
                    + (data.unavailable_count ? ' · Một số video không khả dụng' : '');
                renderTracks();
            } catch (error) {
                if (version === trackVersion) message(error.message);
            } finally {
                if (version === trackVersion) {
                    tracksLoading = false; ui.MoreTracks.disabled = false; toggle(ui.TracksLoading, false);
                }
            }
        }

        async function openPlaylist(playlist) {
            selected = playlist; tracks = []; nextTracks = null;
            ui.SelectedTitle.textContent = playlist.name;
            ui.TracksCount.textContent = '';
            toggle(ui.SelectedPlaylist, true);
            renderTracks(); message('');
            ui.SelectedPlaylist.scrollIntoView({behavior: 'smooth', block: 'start'});
            await loadTracks();
        }

        async function refresh() {
            message('');
            try {
                const data = await loadStatus();
                if (data.connected) await loadPlaylists();
            } catch (error) { message(error.message); ui.Connect.disabled = false; }
        }

        ui.ClientFile.addEventListener('change', async () => {
            const file = ui.ClientFile.files[0];
            if (!file) return;
            if (file.size > 65536) { message('File OAuth JSON quá lớn. Chọn đúng file tải từ Google Cloud.'); return; }
            try {
                const configuration = JSON.parse(await file.text());
                await post('config', configuration);
                libraryVersion++; trackVersion++; playlists = []; tracks = [];
                toggle(ui.SelectedPlaylist, false);
                await loadStatus(); ui.Setup.open = false;
                message('Đã lưu cấu hình trên máy. Bấm Kết nối Google để tiếp tục.', true);
            } catch (error) { message(error instanceof SyntaxError ? 'File đã chọn không phải JSON hợp lệ.' : error.message); }
            finally { ui.ClientFile.value = ''; }
        });

        ui.Connect.addEventListener('click', async () => {
            if (!account.configured) {
                ui.Setup.open = true; ui.Setup.scrollIntoView({behavior: 'smooth'});
                message('Làm theo hướng dẫn và chọn file OAuth JSON trước khi đăng nhập.'); return;
            }
            ui.Connect.disabled = true;
            try {
                const data = await post('connect');
                const url = new URL(data.auth_url);
                if (url.origin !== 'https://accounts.google.com') throw new Error('Địa chỉ đăng nhập Google không hợp lệ.');
                window.location.assign(url.href);
            } catch (error) { message(error.message); ui.Connect.disabled = false; }
        });

        ui.Disconnect.addEventListener('click', async () => {
            ui.Disconnect.disabled = true;
            try {
                const data = await post('disconnect');
                libraryVersion++; trackVersion++; playlists = []; tracks = [];
                ui.PlaylistsGrid.replaceChildren(); ui.TracksBody.replaceChildren();
                toggle(ui.SelectedPlaylist, false);
                await loadStatus();
                message(data.revoked ? 'Đã ngắt kết nối và xóa phiên Google trên máy.'
                    : 'Đã xóa phiên trên máy. Chưa thu hồi được quyền ở Google do lỗi mạng; bạn có thể quản lý quyền tại tài khoản Google.', data.revoked);
            } catch (error) { message(error.message); }
            finally { ui.Disconnect.disabled = false; }
        });

        ui.LookupForm.addEventListener('submit', async event => {
            event.preventDefault(); message('');
            const button = ui.LookupForm.querySelector('button'); button.disabled = true;
            try {
                const data = await api('playlists/lookup?url=' + encodeURIComponent(ui.PlaylistUrl.value.trim()));
                await openPlaylist(data.playlist);
            } catch (error) { message(error.message); }
            finally { button.disabled = false; }
        });
        ui.Refresh.addEventListener('click', refresh);
        ui.MorePlaylists.addEventListener('click', () => loadPlaylists(true));
        ui.MoreTracks.addEventListener('click', () => loadTracks(true));
        ui.PlayPlaylist.addEventListener('click', () => { if (tracks.length) player.playTracks([...tracks], 0); });
        document.addEventListener('y2music:youtube-open', refresh);
        if (window.location.hash === '#youtube') player.openYouTube();
    });
})();
