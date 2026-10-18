"""Read-only YouTube account access using Google's desktop OAuth + PKCE flow."""

import base64
import ctypes
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import sqlite3
import sys
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit

import requests
from flask import Blueprint, current_app, jsonify, make_response, redirect, render_template, request


youtube_account = Blueprint('youtube_account', __name__)
SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'
AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
API_URL = 'https://www.googleapis.com/youtube/v3/'
COOKIE = 'y2music_youtube_oauth'
LOCK = threading.RLock()
LOOPBACK = {'localhost', '127.0.0.1', '::1'}


class RedactOAuthCallback(logging.Filter):
    def filter(self, record):
        message = record.getMessage()
        if '/auth/youtube/callback?' in message:
            record.msg = re.sub(r'/auth/youtube/callback\?[^\s\"]+',
                                '/auth/youtube/callback?[redacted]', message)
            record.args = ()
        return True


class YouTubeError(Exception):
    def __init__(self, message, status=400, code='youtube_error'):
        self.message, self.status, self.code = message, status, code


@youtube_account.errorhandler(YouTubeError)
def youtube_error(error):
    return jsonify(success=False, error=error.message, code=error.code), error.status


@youtube_account.before_request
def local_account_only():
    # Account data is available only to this computer and this web origin.
    if request.remote_addr not in LOOPBACK or urlsplit(request.host_url).hostname not in LOOPBACK:
        raise YouTubeError('Chỉ kết nối tài khoản từ máy đang chạy Y2Music.', 403)
    if request.endpoint != 'youtube_account.oauth_callback':
        origin = request.headers.get('Origin')
        if (origin and origin != request.host_url.rstrip('/')) or request.headers.get('Sec-Fetch-Site') == 'cross-site':
            raise YouTubeError('Không cho phép truy cập tài khoản từ trang khác.', 403)


@youtube_account.after_request
def private_response(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


def _crypt(data, decrypt=False):
    """Windows DPAPI binds stored credentials to the current Windows user."""
    if sys.platform != 'win32':
        return data
    from ctypes import wintypes

    class Blob(ctypes.Structure):
        _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]

    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = Blob()
    method = (ctypes.windll.crypt32.CryptUnprotectData if decrypt
              else ctypes.windll.crypt32.CryptProtectData)
    if not method(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(target)):
        raise YouTubeError('Không đọc được dữ liệu tài khoản trên máy này. Hãy thiết lập lại.', 500)
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        ctypes.windll.kernel32.LocalFree(ctypes.cast(target.data, ctypes.c_void_p))


def _pack(value):
    data = json.dumps(value, ensure_ascii=False).encode('utf-8')
    return _crypt(data)


def _unpack(value):
    try:
        return json.loads(_crypt(value, decrypt=True).decode('utf-8'))
    except (ValueError, UnicodeError):
        raise YouTubeError('Cấu hình tài khoản bị hỏng. Hãy chọn lại file OAuth JSON.', 500)


@contextmanager
def _store():
    path = Path(current_app.config.get('YOUTUBE_DB_PATH', Path(__file__).parent / 'data' / 'youtube.sqlite3'))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=15)
    if sys.platform != 'win32':
        os.chmod(path, 0o600)
    try:
        connection.execute('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value BLOB NOT NULL)')
        connection.execute('''CREATE TABLE IF NOT EXISTS oauth_requests (
            state TEXT PRIMARY KEY, payload BLOB NOT NULL, expires REAL NOT NULL)''')
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _get(connection, key, default=None):
    row = connection.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
    return _unpack(row[0]) if row else default


def _set(connection, key, value):
    connection.execute('INSERT OR REPLACE INTO settings VALUES (?, ?)', (key, _pack(value)))


def _client():
    with _store() as connection:
        client = _get(connection, 'client')
    if not client:
        raise YouTubeError('Chọn file OAuth Client JSON để thiết lập kết nối Google.', 409, 'setup_required')
    return client


def _json_body():
    value = request.get_json(silent=True)
    if not isinstance(value, dict):
        raise YouTubeError('Dữ liệu gửi lên phải là JSON.')
    return value


def _google_post(url, data):
    try:
        response = requests.post(url, data=data, timeout=20, allow_redirects=False)
        payload = response.json()
    except (requests.RequestException, ValueError):
        raise YouTubeError('Chưa kết nối được Google. Kiểm tra mạng rồi thử lại.', 502)
    if not isinstance(payload, dict):
        raise YouTubeError('Google trả dữ liệu không hợp lệ. Hãy thử lại.', 502)
    if not response.ok or 'error' in payload:
        if payload.get('error') == 'invalid_grant':
            raise YouTubeError('Phiên Google đã hết hạn hoặc bị thu hồi. Hãy kết nối lại.', 401, 'reconnect_required')
        if payload.get('error') in {'invalid_client', 'unauthorized_client'}:
            raise YouTubeError('OAuth Client không hợp lệ. Chọn file JSON loại Desktop app.', 400, 'setup_required')
        raise YouTubeError('Google chưa cấp quyền. Kiểm tra Test users và quyền chỉ đọc YouTube.', 400)
    return payload


def _token_record(payload, previous=None):
    previous = previous or {}
    if not isinstance(payload.get('access_token'), str) or not payload['access_token']:
        raise YouTubeError('Google chưa trả mã truy cập hợp lệ.', 502)
    if SCOPE not in payload.get('scope', SCOPE).split():
        raise YouTubeError('Bạn chưa cấp quyền đọc YouTube. Hãy kết nối lại và chọn quyền này.', 403)
    try:
        lifetime = max(60, min(int(payload.get('expires_in', 3600)), 86400))
    except (ValueError, TypeError):
        raise YouTubeError('Google trả thời hạn phiên không hợp lệ.', 502)
    return {'access_token': payload['access_token'],
            'refresh_token': payload.get('refresh_token') or previous.get('refresh_token'),
            'expires_at': time.time() + lifetime}


def _access_token(force_refresh=False):
    with LOCK:
        with _store() as connection:
            tokens = _get(connection, 'tokens')
            generation = _get(connection, 'generation')
        if not tokens:
            raise YouTubeError('Kết nối Google để xem playlist YouTube của bạn.', 401, 'connect_required')
        if not force_refresh and tokens['expires_at'] > time.time() + 60:
            return tokens['access_token']
        if not tokens.get('refresh_token'):
            raise YouTubeError('Phiên Google đã hết hạn. Hãy kết nối lại.', 401, 'reconnect_required')
        client = _client()
        try:
            payload = _google_post(TOKEN_URL, {'client_id': client['client_id'],
                'client_secret': client['client_secret'], 'refresh_token': tokens['refresh_token'],
                'grant_type': 'refresh_token'})
        except YouTubeError as error:
            if error.code == 'reconnect_required':
                with _store() as connection:
                    if _get(connection, 'generation') == generation:
                        connection.execute("DELETE FROM settings WHERE key IN ('tokens', 'channel')")
            raise
        refreshed = _token_record(payload, tokens)
        with _store() as connection:
            if generation != _get(connection, 'generation'):
                raise YouTubeError('Tài khoản đã thay đổi. Hãy kết nối lại.', 401, 'reconnect_required')
            _set(connection, 'tokens', refreshed)
        return refreshed['access_token']


def _api_get(resource, parameters, retry=True):
    token = _access_token()
    try:
        response = requests.get(API_URL + resource, params=parameters,
            headers={'Authorization': 'Bearer ' + token}, timeout=20, allow_redirects=False)
        payload = response.json()
    except (requests.RequestException, ValueError):
        raise YouTubeError('Không tải được dữ liệu YouTube. Kiểm tra mạng rồi thử lại.', 502)
    if response.status_code == 401 and retry:
        _access_token(force_refresh=True)
        return _api_get(resource, parameters, retry=False)
    if not isinstance(payload, dict):
        raise YouTubeError('YouTube trả dữ liệu không hợp lệ.', 502)
    if not response.ok or 'error' in payload:
        error = payload.get('error', {})
        reason = next(iter(error.get('errors', [])), {}).get('reason', '') if isinstance(error, dict) else ''
        if reason in {'accessNotConfigured', 'serviceDisabled'}:
            raise YouTubeError('Bật YouTube Data API v3 trong Google Cloud rồi thử lại.', 403, 'api_disabled')
        if reason in {'quotaExceeded', 'dailyLimitExceeded'}:
            raise YouTubeError('Dự án Google đã hết hạn mức API. Hãy thử lại sau.', 429, 'quota_exceeded')
        if response.status_code == 401:
            raise YouTubeError('Google yêu cầu kết nối lại tài khoản.', 401, 'reconnect_required')
        if response.status_code == 404:
            raise YouTubeError('Không tìm thấy playlist hoặc playlist đã bị xóa.', 404)
        raise YouTubeError('Không đọc được playlist. Kiểm tra tài khoản, quyền truy cập và cấu hình API.', 403)
    return payload


def _thumbnail(snippet):
    thumbnails = snippet.get('thumbnails') or {}
    for size in ('medium', 'default', 'high'):
        value = thumbnails.get(size, {}).get('url', '')
        if isinstance(value, str) and value.startswith('https://'):
            return value
    return ''


def _channel():
    with _store() as connection:
        generation = _get(connection, 'generation')
    data = _api_get('channels', {'part': 'snippet,contentDetails', 'mine': 'true', 'maxResults': 1})
    item = next(iter(data.get('items', [])), {})
    snippet = item.get('snippet', {})
    channel = {'id': item.get('id', ''), 'title': snippet.get('title') or 'Tài khoản YouTube',
        'thumbnail': _thumbnail(snippet),
        'likes_id': item.get('contentDetails', {}).get('relatedPlaylists', {}).get('likes', '')}
    with _store() as connection:
        if _get(connection, 'generation') != generation or not _get(connection, 'tokens'):
            raise YouTubeError('Tài khoản đã thay đổi. Hãy tải lại danh sách.', 401, 'reconnect_required')
        _set(connection, 'channel', channel)
    return channel


def _playlist(item):
    snippet = item.get('snippet', {})
    return {'id': item['id'], 'name': snippet.get('title') or 'Playlist YouTube',
        'description': snippet.get('description', ''), 'thumbnail': _thumbnail(snippet),
        'count': item.get('contentDetails', {}).get('itemCount', 0),
        'privacy': item.get('status', {}).get('privacyStatus', ''),
        'url': 'https://www.youtube.com/playlist?list=' + item['id']}


def _playlist_id(value):
    if not isinstance(value, str):
        raise YouTubeError('Liên kết playlist không hợp lệ.')
    if value.startswith(('http://', 'https://')):
        parsed = urlsplit(value)
        if parsed.hostname not in {'youtube.com', 'www.youtube.com', 'music.youtube.com', 'm.youtube.com'}:
            raise YouTubeError('Chỉ hỗ trợ liên kết playlist YouTube hoặc YouTube Music.')
        value = parse_qs(parsed.query).get('list', [''])[0]
    if not re.fullmatch(r'[A-Za-z0-9_-]{2,150}', value) or value in {'WL', 'HL'}:
        raise YouTubeError('Playlist không hợp lệ hoặc không được YouTube API hỗ trợ.')
    return value


def _page_token():
    value = request.args.get('page_token', '')
    if len(value) > 1000:
        raise YouTubeError('Mã trang không hợp lệ.')
    return value


@youtube_account.get('/api/youtube/status')
def account_status():
    with _store() as connection:
        configured = bool(_get(connection, 'client'))
        tokens = _get(connection, 'tokens')
        channel = _get(connection, 'channel') if tokens else None
    return jsonify(success=True, configured=configured, connected=bool(tokens), channel=channel)


@youtube_account.post('/api/youtube/config')
def configure_account():
    if request.content_length and request.content_length > 65536:
        raise YouTubeError('File OAuth JSON quá lớn.')
    client = _json_body().get('installed')
    if not isinstance(client, dict):
        raise YouTubeError('Chọn file JSON của OAuth Client loại Desktop app, không phải API key hay Web application.')
    client_id, secret = client.get('client_id', ''), client.get('client_secret', '')
    if (not isinstance(client_id, str) or not re.fullmatch(r'[\w.-]+\.apps\.googleusercontent\.com', client_id)
            or not isinstance(secret, str) or not secret or len(secret) > 1000):
        raise YouTubeError('File OAuth Client JSON không hợp lệ.')
    with LOCK, _store() as connection:
        _set(connection, 'client', {'client_id': client_id, 'client_secret': secret})
        _set(connection, 'generation', secrets.token_urlsafe(24))
        connection.execute("DELETE FROM settings WHERE key IN ('tokens', 'channel')")
        connection.execute('DELETE FROM oauth_requests')
    return jsonify(success=True)


@youtube_account.post('/api/youtube/connect')
def connect_account():
    _json_body()
    client = _client()
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    browser = secrets.token_urlsafe(32)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode('ascii')).digest()).rstrip(b'=').decode('ascii')
    redirect_uri = request.host_url.rstrip('/') + '/auth/youtube/callback'
    with _store() as connection:
        generation = _get(connection, 'generation')
        connection.execute('DELETE FROM oauth_requests WHERE expires < ?', (time.time(),))
        connection.execute('INSERT INTO oauth_requests VALUES (?, ?, ?)', (hashlib.sha256(state.encode()).hexdigest(),
            _pack({'verifier': verifier, 'browser': hashlib.sha256(browser.encode()).hexdigest(),
                   'redirect_uri': redirect_uri, 'generation': generation}), time.time() + 600))
    response = jsonify(success=True, auth_url=AUTH_URL + '?' + urlencode({
        'client_id': client['client_id'], 'redirect_uri': redirect_uri, 'response_type': 'code',
        'scope': SCOPE, 'state': state, 'code_challenge': challenge, 'code_challenge_method': 'S256',
        'access_type': 'offline', 'prompt': 'consent select_account'}))
    response.set_cookie(COOKIE, browser, max_age=600, httponly=True, samesite='Lax', path='/')
    return response


@youtube_account.get('/auth/youtube/callback')
def oauth_callback():
    try:
        state = request.args.get('state', '')
        cookie = request.cookies.get(COOKIE, '')
        if not state or not cookie or len(state) > 200:
            raise YouTubeError('Phiên kết nối không hợp lệ hoặc đã hết hạn. Hãy bấm kết nối lại.')
        key = hashlib.sha256(state.encode()).hexdigest()
        with _store() as connection:
            connection.execute('BEGIN IMMEDIATE')
            row = connection.execute('SELECT payload, expires FROM oauth_requests WHERE state = ?', (key,)).fetchone()
            flow = _unpack(row[0]) if row else None
            if (not flow or row[1] < time.time() or not hmac.compare_digest(
                    flow['browser'], hashlib.sha256(cookie.encode()).hexdigest())
                    or flow['redirect_uri'] != request.base_url):
                raise YouTubeError('Phiên kết nối không khớp trình duyệt. Hãy bấm kết nối lại.')
            connection.execute('DELETE FROM oauth_requests WHERE state = ?', (key,))
        if request.args.get('error'):
            raise YouTubeError('Bạn chưa cấp quyền YouTube. Có thể quay lại và kết nối khi sẵn sàng.')
        code = request.args.get('code', '')
        if not code or len(code) > 4096:
            raise YouTubeError('Google chưa trả mã xác nhận. Hãy kết nối lại.')
        client = _client()
        payload = _google_post(TOKEN_URL, {'client_id': client['client_id'], 'client_secret': client['client_secret'],
            'code': code, 'code_verifier': flow['verifier'], 'redirect_uri': flow['redirect_uri'],
            'grant_type': 'authorization_code'})
        tokens = _token_record(payload)
        with LOCK, _store() as connection:
            if flow['generation'] != _get(connection, 'generation'):
                raise YouTubeError('Cấu hình đã thay đổi. Hãy kết nối lại.')
            _set(connection, 'tokens', tokens)
            connection.execute("DELETE FROM settings WHERE key = 'channel'")
        # Fetch channel lazily in the account view; OAuth can succeed even if API setup needs fixing.
        response = redirect('/music#youtube')
    except YouTubeError as error:
        response = make_response(render_template('youtube_callback.html', message=error.message), error.status)
    response.delete_cookie(COOKIE, path='/')
    return response


@youtube_account.post('/api/youtube/disconnect')
def disconnect_account():
    _json_body()
    with LOCK, _store() as connection:
        tokens = _get(connection, 'tokens') or {}
        connection.execute("DELETE FROM settings WHERE key IN ('tokens', 'channel')")
        connection.execute('DELETE FROM oauth_requests')
        _set(connection, 'generation', secrets.token_urlsafe(24))
    revoked = True
    if tokens:
        try:
            result = requests.post(REVOKE_URL, data={'token': tokens.get('refresh_token') or tokens['access_token']},
                                   timeout=15, allow_redirects=False)
            revoked = result.ok or result.status_code == 400
        except requests.RequestException:
            revoked = False
    return jsonify(success=True, revoked=revoked)


@youtube_account.get('/api/youtube/playlists')
def account_playlists():
    token = _page_token()
    with _store() as connection:
        channel = _get(connection, 'channel')
    channel = channel or _channel()
    parameters = {'part': 'snippet,contentDetails,status', 'mine': 'true', 'maxResults': 50}
    if token:
        parameters['pageToken'] = token
    data = _api_get('playlists', parameters)
    playlists = [_playlist(item) for item in data.get('items', []) if item.get('id')]
    if not token and channel.get('likes_id') and channel['likes_id'] not in {item['id'] for item in playlists}:
        playlists.insert(0, {'id': channel['likes_id'], 'name': 'Video đã thích trên YouTube',
            'description': 'Danh sách video bạn đã thích, có thể bao gồm cả video không phải nhạc.',
            'thumbnail': '', 'count': None, 'privacy': 'private',
            'url': 'https://www.youtube.com/playlist?list=' + channel['likes_id']})
    return jsonify(success=True, playlists=playlists, channel=channel, next_page_token=data.get('nextPageToken'))


@youtube_account.get('/api/youtube/playlists/lookup')
def lookup_playlist():
    playlist_id = _playlist_id(request.args.get('url', ''))
    data = _api_get('playlists', {'part': 'snippet,contentDetails,status', 'id': playlist_id})
    if not data.get('items'):
        raise YouTubeError('Không tìm thấy playlist hoặc tài khoản chưa có quyền xem.', 404)
    return jsonify(success=True, playlist=_playlist(data['items'][0]))


@youtube_account.get('/api/youtube/playlists/<playlist_id>/tracks')
def account_playlist_tracks(playlist_id):
    playlist_id = _playlist_id(playlist_id)
    parameters = {'part': 'snippet,contentDetails,status', 'playlistId': playlist_id, 'maxResults': 50}
    token = _page_token()
    if token:
        parameters['pageToken'] = token
    data = _api_get('playlistItems', parameters)
    tracks, unavailable = [], 0
    for item in data.get('items', []):
        snippet = item.get('snippet', {})
        video_id = snippet.get('resourceId', {}).get('videoId', '')
        if (not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id)
                or snippet.get('title') in {'Private video', 'Deleted video'}):
            unavailable += 1
            continue
        tracks.append({'id': video_id, 'source': 'youtube', 'title': snippet.get('title') or 'Video YouTube',
            'uploader': snippet.get('videoOwnerChannelTitle') or snippet.get('channelTitle') or 'YouTube',
            'duration': 0, 'thumbnail': f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg',
            'url': f'https://www.youtube.com/watch?v={video_id}'})
    return jsonify(success=True, tracks=tracks, unavailable_count=unavailable,
                   total=data.get('pageInfo', {}).get('totalResults', len(tracks)),
                   next_page_token=data.get('nextPageToken'))
