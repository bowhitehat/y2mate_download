"""Persistent music library and playlists for the local Flask application."""

import hashlib
import json
import math
import re
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlsplit, parse_qs

from flask import Blueprint, current_app, jsonify, render_template, request, send_file

import downloader


music = Blueprint('music', __name__)
AUDIO_EXTENSIONS = {'.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac', '.opus', '.webm'}
VIDEO_ID = re.compile(r'^[A-Za-z0-9_-]{11}$')


class MusicError(Exception):
    def __init__(self, message, status=400):
        self.message = message
        self.status = status


@music.errorhandler(MusicError)
def music_error(error):
    return jsonify(success=False, error=error.message), error.status


@music.before_request
def protect_playlist_writes():
    # A third-party page must not be able to change the local user's library.
    if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
        origin = request.headers.get('Origin')
        if origin and origin != request.host_url.rstrip('/'):
            raise MusicError('Không cho phép thay đổi playlist từ trang khác.', 403)


@contextmanager
def database():
    path = Path(current_app.config.get(
        'MUSIC_DB_PATH', Path(__file__).parent / 'data' / 'music.sqlite3'))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys = ON')
    try:
        connection.executescript('''
            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
                track_id TEXT NOT NULL,
                metadata TEXT NOT NULL,
                position INTEGER NOT NULL,
                PRIMARY KEY (playlist_id, track_id)
            );
        ''')
        # Serialize edits so concurrent adds/removes cannot lose ordering updates.
        if request.method not in {'GET', 'HEAD'}:
            connection.execute('BEGIN IMMEDIATE')
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def body():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        raise MusicError('Dữ liệu phải là một đối tượng JSON.')
    return payload


def playlist_name(value):
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > 100:
        raise MusicError('Tên playlist cần từ 1 đến 100 ký tự.')
    return value.strip()


def get_playlist(connection, playlist_id):
    row = connection.execute('SELECT * FROM playlists WHERE id = ?', (playlist_id,)).fetchone()
    if row is None:
        raise MusicError('Không tìm thấy playlist.', 404)
    tracks = connection.execute(
        'SELECT metadata FROM playlist_tracks WHERE playlist_id = ? ORDER BY position, rowid',
        (playlist_id,)).fetchall()
    return {**dict(row), 'tracks': [json.loads(track['metadata']) for track in tracks]}


def local_file(filename):
    if (not isinstance(filename, str) or not filename or filename in {'.', '..'}
            or any(char in filename for char in ('/', '\\', '\x00', ':'))):
        raise MusicError('Tên tệp không hợp lệ.', 400)
    root = Path(downloader.DOWNLOAD_DIR).resolve()
    path = (root / filename).resolve()
    if path.parent != root or path.suffix.lower() not in AUDIO_EXTENSIONS:
        raise MusicError('Tệp âm thanh không hợp lệ.', 400)
    if not path.is_file():
        raise MusicError('Tệp đã bị xóa hoặc không còn trên máy.', 404)
    return path


def local_track(filename):
    path = local_file(filename)
    return {
        'id': 'local_' + hashlib.sha256(filename.encode('utf-8')).hexdigest()[:24],
        'source': 'local',
        'title': path.stem,
        'uploader': 'Nhạc trên máy',
        'duration': 0,
        'thumbnail': '',
        'filename': filename,
        'url': '/api/music/file/' + quote(filename, safe=''),
    }


def youtube_id(value):
    if not isinstance(value, str):
        return None
    if VIDEO_ID.fullmatch(value):
        return value
    try:
        url = urlsplit(value)
        if url.scheme not in {'https', 'http'}:
            return None
        host = (url.hostname or '').lower()
        if host == 'youtu.be':
            candidate = url.path.strip('/')
        elif host in {'youtube.com', 'www.youtube.com', 'music.youtube.com', 'm.youtube.com'}:
            parts = url.path.strip('/').split('/')
            candidate = (parse_qs(url.query).get('v', [''])[0] if url.path == '/watch'
                         else parts[1] if len(parts) == 2 and parts[0] in {'shorts', 'embed', 'live'} else '')
        else:
            return None
        return candidate if VIDEO_ID.fullmatch(candidate) else None
    except ValueError:
        return None


def normalize_track(track):
    if not isinstance(track, dict):
        raise MusicError('Thông tin bài hát không hợp lệ.')
    source = track.get('source', 'youtube')
    if source == 'local':
        return local_track(track.get('filename'))
    if source != 'youtube':
        raise MusicError('Nguồn bài hát không được hỗ trợ.')
    video_id = youtube_id(track.get('id')) or youtube_id(track.get('url'))
    if not video_id:
        raise MusicError('Liên kết hoặc mã video YouTube không hợp lệ.')
    title = track.get('title')
    if not isinstance(title, str) or not title.strip() or len(title) > 500:
        raise MusicError('Tên bài hát không hợp lệ.')
    uploader = track.get('uploader') or 'YouTube'
    if not isinstance(uploader, str) or len(uploader) > 300:
        raise MusicError('Tên nghệ sĩ không hợp lệ.')
    duration = track.get('duration') or 0
    if (not isinstance(duration, (int, float)) or isinstance(duration, bool)
            or not math.isfinite(duration) or duration < 0 or duration > 604800):
        raise MusicError('Thời lượng bài hát không hợp lệ.')
    return {
        'id': video_id, 'source': 'youtube', 'title': title.strip(),
        'uploader': uploader, 'duration': duration,
        'thumbnail': f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg',
        'url': f'https://www.youtube.com/watch?v={video_id}',
    }


@music.get('/music')
def music_page():
    return render_template('music.html')


@music.get('/api/music/search')
def search_music():
    query = request.args.get('q', '').strip()
    if not query or len(query) > 200:
        raise MusicError('Nhập tên bài hát, nghệ sĩ hoặc link YouTube (tối đa 200 ký tự).')
    try:
        video_id = youtube_id(query)
        if query.startswith(('https://', 'http://')) and not video_id:
            raise MusicError('Chỉ hỗ trợ liên kết video YouTube hợp lệ.')
        if video_id:
            entries = [downloader.get_video_info(f'https://www.youtube.com/watch?v={video_id}')]
        else:
            entries = downloader.search_youtube(query, max_results=12)
        tracks = []
        for entry in entries:
            try:
                tracks.append(normalize_track(entry))
            except MusicError:
                continue
        return jsonify(success=True, tracks=tracks)
    except MusicError:
        raise
    except Exception:
        current_app.logger.exception('Music search failed')
        raise MusicError('Chưa tìm được nhạc. Kiểm tra kết nối hoặc thử lại sau.', 502)


@music.get('/api/music/library')
def local_library():
    root = Path(downloader.DOWNLOAD_DIR)
    tracks = []
    if root.exists():
        for path in sorted(root.iterdir(), key=lambda item: item.name.casefold()):
            if path.suffix.lower() in AUDIO_EXTENSIONS:
                try:
                    tracks.append(local_track(path.name))
                except MusicError:
                    continue
    return jsonify(success=True, tracks=tracks)


@music.get('/api/music/file/<path:filename>')
def play_local_file(filename):
    return send_file(local_file(filename), conditional=True, as_attachment=False)


@music.get('/api/playlists')
def list_playlists():
    with database() as connection:
        ids = connection.execute('SELECT id FROM playlists ORDER BY created_at, rowid').fetchall()
        playlists = [get_playlist(connection, row['id']) for row in ids]
    return jsonify(success=True, playlists=playlists)


@music.post('/api/playlists')
def create_playlist():
    name = playlist_name(body().get('name'))
    playlist_id = uuid.uuid4().hex
    with database() as connection:
        connection.execute('INSERT INTO playlists VALUES (?, ?, ?)', (
            playlist_id, name, datetime.now(timezone.utc).isoformat()))
        playlist = get_playlist(connection, playlist_id)
    return jsonify(success=True, playlist=playlist), 201


@music.route('/api/playlists/<playlist_id>', methods=['GET', 'PATCH', 'DELETE'])
def edit_playlist(playlist_id):
    name = playlist_name(body().get('name')) if request.method == 'PATCH' else None
    with database() as connection:
        playlist = get_playlist(connection, playlist_id)
        if request.method == 'DELETE':
            connection.execute('DELETE FROM playlists WHERE id = ?', (playlist_id,))
        elif request.method == 'PATCH':
            connection.execute('UPDATE playlists SET name = ? WHERE id = ?', (name, playlist_id))
            playlist = get_playlist(connection, playlist_id)
    return jsonify(success=True, playlist=playlist)


@music.post('/api/playlists/<playlist_id>/tracks')
def add_track(playlist_id):
    track = normalize_track(body().get('track'))
    with database() as connection:
        get_playlist(connection, playlist_id)
        connection.execute('''
            INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, metadata, position)
            VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?))
        ''', (playlist_id, track['id'], json.dumps(track, ensure_ascii=False), playlist_id))
        playlist = get_playlist(connection, playlist_id)
    return jsonify(success=True, playlist=playlist)


@music.delete('/api/playlists/<playlist_id>/tracks/<track_id>')
def remove_track(playlist_id, track_id):
    with database() as connection:
        get_playlist(connection, playlist_id)
        connection.execute('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
                           (playlist_id, track_id))
        playlist = get_playlist(connection, playlist_id)
    return jsonify(success=True, playlist=playlist)


@music.put('/api/playlists/<playlist_id>/tracks')
def reorder_tracks(playlist_id):
    track_ids = body().get('track_ids')
    if not isinstance(track_ids, list) or any(not isinstance(item, str) for item in track_ids):
        raise MusicError('Danh sách thứ tự bài hát không hợp lệ.')
    with database() as connection:
        playlist = get_playlist(connection, playlist_id)
        expected = {track['id'] for track in playlist['tracks']}
        if len(track_ids) != len(expected) or set(track_ids) != expected:
            raise MusicError('Thứ tự mới phải chứa mỗi bài hiện có đúng một lần.')
        connection.executemany(
            'UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?',
            ((index, playlist_id, track_id) for index, track_id in enumerate(track_ids)))
        playlist = get_playlist(connection, playlist_id)
    return jsonify(success=True, playlist=playlist)
