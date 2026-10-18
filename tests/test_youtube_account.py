"""OAuth security, credential storage, refresh, and YouTube API contracts."""

import base64
import hashlib
import logging
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import requests

from app import app
from youtube_account import SCOPE, TOKEN_URL, RedactOAuthCallback, _get, _set, _store


CLIENT = {'installed': {'client_id': '123-test.apps.googleusercontent.com',
                        'client_secret': 'test-only-client-secret'}}


class Response:
    def __init__(self, payload, status=200):
        self.payload, self.status_code = payload, status
        self.ok = 200 <= status < 300

    def json(self):
        return self.payload


class YouTubeAccountTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / 'youtube.sqlite3'
        self.config = patch.dict(app.config, TESTING=True, YOUTUBE_DB_PATH=str(self.db))
        self.config.start()
        self.client = app.test_client()

    def tearDown(self):
        self.config.stop()
        self.temp.cleanup()

    def configure(self):
        response = self.client.post('/api/youtube/config', json=CLIENT)
        self.assertEqual(response.status_code, 200)

    def begin(self):
        self.configure()
        response = self.client.post('/api/youtube/connect', json={})
        self.assertEqual(response.status_code, 200)
        self.assertIn('HttpOnly', response.headers['Set-Cookie'])
        self.assertIn('SameSite=Lax', response.headers['Set-Cookie'])
        return parse_qs(urlsplit(response.json['auth_url']).query)

    def authorize(self):
        flow = self.begin()
        token = {'access_token': 'TEST_ACCESS_TOKEN_123', 'refresh_token': 'TEST_REFRESH_TOKEN_456',
                 'expires_in': 3600, 'scope': SCOPE}
        with patch('youtube_account.requests.post', return_value=Response(token)) as post:
            response = self.client.get('/auth/youtube/callback', query_string={
                'state': flow['state'][0], 'code': 'test-only-code'})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.location, '/music#youtube')
        return flow, post

    def test_unconfigured_status_and_config_validation(self):
        response = self.client.get('/api/youtube/status')
        self.assertEqual(response.json, {'success': True, 'configured': False, 'connected': False, 'channel': None})
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertEqual(self.client.post('/api/youtube/connect', json={}).status_code, 409)
        for payload in ({'web': CLIENT['installed']}, {'installed': {}}, [], {'installed': {'client_id': 'bad'}}):
            self.assertEqual(self.client.post('/api/youtube/config', json=payload).status_code, 400)
        self.configure()
        status = self.client.get('/api/youtube/status')
        self.assertTrue(status.json['configured'])
        self.assertNotIn('client_secret', status.text)

    def test_account_routes_reject_cross_origin_and_nonlocal_access(self):
        for path in ('status', 'playlists'):
            self.assertEqual(self.client.get('/api/youtube/' + path,
                headers={'Origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.client.get('/api/youtube/status', base_url='http://evil.example').status_code, 403)
        self.assertEqual(self.client.get('/api/youtube/status', environ_overrides={'REMOTE_ADDR': '192.168.1.10'}).status_code, 403)
        self.assertEqual(self.client.post('/api/youtube/config', json=CLIENT,
            headers={'Sec-Fetch-Site': 'cross-site'}).status_code, 403)

    def test_pkce_readonly_scope_callback_and_encrypted_credentials(self):
        flow, post = self.authorize()
        self.assertEqual(flow['scope'], [SCOPE])
        self.assertEqual(flow['code_challenge_method'], ['S256'])
        self.assertEqual(post.call_args.args[0], TOKEN_URL)
        data = post.call_args.kwargs['data']
        expected = base64.urlsafe_b64encode(hashlib.sha256(data['code_verifier'].encode()).digest()).rstrip(b'=').decode()
        self.assertEqual(flow['code_challenge'][0], expected)
        self.assertEqual(data['redirect_uri'], 'http://localhost/auth/youtube/callback')
        status = self.client.get('/api/youtube/status')
        self.assertTrue(status.json['connected'])
        self.assertNotIn('TEST_ACCESS_TOKEN', status.text)
        if sys.platform == 'win32':
            for secret in (b'TEST_ACCESS_TOKEN_123', b'TEST_REFRESH_TOKEN_456', b'test-only-client-secret'):
                self.assertNotIn(secret, self.db.read_bytes())

    def test_state_is_browser_bound_expires_and_is_single_use(self):
        flow = self.begin()
        query = {'state': flow['state'][0], 'code': 'test-only-code'}
        with patch('youtube_account.requests.post') as post:
            foreign_client = app.test_client()
            self.assertEqual(foreign_client.get('/auth/youtube/callback', query_string=query).status_code, 400)
            post.assert_not_called()
        with app.app_context(), _store() as connection:
            connection.execute('UPDATE oauth_requests SET expires = 0')
        self.assertEqual(self.client.get('/auth/youtube/callback', query_string=query).status_code, 400)
        flow, _ = self.authorize()
        with patch('youtube_account.requests.post') as post:
            replay = self.client.get('/auth/youtube/callback', query_string={'state': flow['state'][0], 'code': 'replay'})
            self.assertEqual(replay.status_code, 400)
            post.assert_not_called()

    def test_denied_consent_and_missing_scope_do_not_connect(self):
        flow = self.begin()
        denied = self.client.get('/auth/youtube/callback', query_string={'state': flow['state'][0], 'error': 'access_denied'})
        self.assertEqual(denied.status_code, 400)
        self.assertFalse(self.client.get('/api/youtube/status').json['connected'])
        flow = self.begin()
        with patch('youtube_account.requests.post', return_value=Response({'access_token': 'x', 'scope': 'email'})):
            response = self.client.get('/auth/youtube/callback', query_string={'state': flow['state'][0], 'code': 'x'})
        self.assertEqual(response.status_code, 403)
        self.assertFalse(self.client.get('/api/youtube/status').json['connected'])

    def test_playlist_pagination_liked_videos_and_track_contract(self):
        self.authorize()
        channel = {'items': [{'id': 'UCtest', 'snippet': {'title': 'Kênh thử'},
            'contentDetails': {'relatedPlaylists': {'likes': 'LLtest'}}}]}
        playlist = {'items': [{'id': 'PLtest', 'snippet': {'title': 'Nhạc của tôi'},
            'contentDetails': {'itemCount': 72}, 'status': {'privacyStatus': 'private'}}], 'nextPageToken': 'page2'}
        with patch('youtube_account.requests.get', side_effect=[Response(channel), Response(playlist)]) as get:
            response = self.client.get('/api/youtube/playlists')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([p['id'] for p in response.json['playlists']], ['LLtest', 'PLtest'])
        self.assertEqual(response.json['next_page_token'], 'page2')
        self.assertEqual(get.call_args.kwargs['params']['mine'], 'true')
        with patch('youtube_account.requests.get', return_value=Response({'items': []})) as get:
            self.client.get('/api/youtube/playlists?page_token=page2')
            self.assertEqual(get.call_args.kwargs['params']['pageToken'], 'page2')
        items = {'items': [
            {'snippet': {'title': '<b>Bài thử</b>', 'videoOwnerChannelTitle': 'Nghệ sĩ',
                         'resourceId': {'videoId': 'jNQXAC9IVRw'}}},
            {'snippet': {'title': 'Deleted video', 'resourceId': {'videoId': 'M7lc1UVf-VE'}}},
        ], 'pageInfo': {'totalResults': 72}, 'nextPageToken': 'more-tracks'}
        with patch('youtube_account.requests.get', return_value=Response(items)):
            result = self.client.get('/api/youtube/playlists/PLtest/tracks').json
        self.assertEqual(len(result['tracks']), 1)
        self.assertEqual(result['tracks'][0]['source'], 'youtube')
        self.assertEqual(result['tracks'][0]['url'], 'https://www.youtube.com/watch?v=jNQXAC9IVRw')
        self.assertEqual(result['unavailable_count'], 1)
        self.assertEqual(result['total'], 72)

    def test_expired_token_refresh_and_revoked_session(self):
        self.authorize()
        with app.app_context(), _store() as connection:
            tokens = _get(connection, 'tokens'); tokens['expires_at'] = time.time() - 1
            _set(connection, 'tokens', tokens)
        with patch('youtube_account.requests.post', return_value=Response({'access_token': 'NEW_TOKEN', 'expires_in': 3600})) as post:
            with patch('youtube_account.requests.get', return_value=Response({'items': []})) as get:
                self.assertEqual(self.client.get('/api/youtube/playlists/PLtest/tracks').status_code, 200)
                self.assertEqual(get.call_args.kwargs['headers']['Authorization'], 'Bearer NEW_TOKEN')
            self.assertEqual(post.call_args.kwargs['data']['grant_type'], 'refresh_token')
        with app.app_context(), _store() as connection:
            tokens = _get(connection, 'tokens'); tokens['expires_at'] = 0; _set(connection, 'tokens', tokens)
        with patch('youtube_account.requests.post', return_value=Response({'error': 'invalid_grant'}, 400)):
            self.assertEqual(self.client.get('/api/youtube/playlists/PLtest/tracks').status_code, 401)
        self.assertFalse(self.client.get('/api/youtube/status').json['connected'])

    def test_disconnect_clears_session_even_when_google_is_offline(self):
        self.authorize()
        with patch('youtube_account.requests.post', side_effect=requests.ConnectionError()):
            response = self.client.post('/api/youtube/disconnect', json={})
        self.assertTrue(response.json['success'])
        self.assertFalse(response.json['revoked'])
        status = self.client.get('/api/youtube/status').json
        self.assertFalse(status['connected']); self.assertTrue(status['configured'])

    def test_api_error_messages_and_playlist_url_validation(self):
        self.authorize()
        with patch('youtube_account.requests.get', return_value=Response({
                'error': {'errors': [{'reason': 'accessNotConfigured'}]}}, 403)):
            result = self.client.get('/api/youtube/playlists/PLtest/tracks')
        self.assertEqual(result.json['code'], 'api_disabled')
        with patch('youtube_account.requests.get') as get:
            self.assertEqual(self.client.get('/api/youtube/playlists/lookup?url=https://evil.example/?list=PLtest').status_code, 400)
            self.assertEqual(self.client.get('/api/youtube/playlists/WL/tracks').status_code, 400)
            get.assert_not_called()

    def test_oauth_callback_query_is_redacted_from_request_logs(self):
        record = logging.LogRecord('werkzeug', logging.INFO, '', 0,
            'GET /auth/youtube/callback?state=PRIVATE_STATE&code=PRIVATE_CODE HTTP/1.1', (), None)
        RedactOAuthCallback().filter(record)
        self.assertNotIn('PRIVATE_CODE', record.getMessage())
        self.assertNotIn('PRIVATE_STATE', record.getMessage())


if __name__ == '__main__':
    unittest.main()
