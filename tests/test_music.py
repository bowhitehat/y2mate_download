"""Music API integration tests with an isolated database and media directory."""

import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from app import app


class MusicAPITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.media = self.root / 'downloads'
        self.media.mkdir()
        self.config = patch.dict(app.config, TESTING=True, MUSIC_DB_PATH=str(self.root / 'music.sqlite3'))
        self.config.start()
        self.downloads = patch('downloader.DOWNLOAD_DIR', str(self.media))
        self.downloads.start()
        self.client = app.test_client()

    def tearDown(self):
        self.downloads.stop()
        self.config.stop()
        self.temp.cleanup()

    def create(self, name='Buổi tối'):
        response = self.client.post('/api/playlists', json={'name': name})
        self.assertEqual(response.status_code, 201)
        return response.json['playlist']

    def track(self, video_id='jNQXAC9IVRw', **changes):
        return {'id': video_id, 'source': 'youtube', 'title': 'Bài hát thử',
                'uploader': 'Nghệ sĩ', 'duration': 123, **changes}

    def add(self, playlist_id, track):
        return self.client.post(f'/api/playlists/{playlist_id}/tracks', json={'track': track})

    def test_playlist_persists_rename_and_delete_cascades(self):
        playlist = self.create()
        self.add(playlist['id'], self.track())
        other_client = app.test_client()
        saved = other_client.get('/api/playlists').json['playlists'][0]
        self.assertEqual(saved['tracks'][0]['title'], 'Bài hát thử')
        renamed = self.client.patch(f"/api/playlists/{playlist['id']}", json={'name': '  Đêm yên  '})
        self.assertEqual(renamed.json['playlist']['name'], 'Đêm yên')
        self.assertEqual(self.client.delete(f"/api/playlists/{playlist['id']}").status_code, 200)
        self.assertEqual(other_client.get('/api/playlists').json['playlists'], [])
        with closing(sqlite3.connect(self.root / 'music.sqlite3')) as connection:
            self.assertEqual(connection.execute('SELECT COUNT(*) FROM playlist_tracks').fetchone()[0], 0)

    def test_duplicates_and_reorder_validation_preserve_tracks(self):
        playlist_id = self.create()['id']
        a, b, c = 'jNQXAC9IVRw', 'M7lc1UVf-VE', 'dQw4w9WgXcQ'
        for video_id in (a, b, a, c):
            self.assertEqual(self.add(playlist_id, self.track(video_id)).status_code, 200)
        endpoint = f'/api/playlists/{playlist_id}/tracks'
        self.assertEqual(self.client.put(endpoint, json={'track_ids': [a, a, b]}).status_code, 400)
        self.assertEqual(self.client.put(endpoint, json={'track_ids': [a, b]}).status_code, 400)
        result = self.client.put(endpoint, json={'track_ids': [c, a, b]})
        self.assertEqual([t['id'] for t in result.json['playlist']['tracks']], [c, a, b])
        self.client.delete(f'{endpoint}/{a}')
        self.add(playlist_id, self.track(a))
        result = self.client.get(f'/api/playlists/{playlist_id}')
        self.assertEqual([t['id'] for t in result.json['playlist']['tracks']], [c, b, a])

    def test_invalid_payloads_missing_playlist_and_cross_origin(self):
        for payload in ({}, {'name': ''}, {'name': 'a' * 101}, [], None):
            response = self.client.post('/api/playlists', json=payload)
            self.assertEqual(response.status_code, 400)
            self.assertFalse(response.json['success'])
        self.assertEqual(self.client.get('/api/playlists/missing').status_code, 404)
        blocked = self.client.post('/api/playlists', json={'name': 'bad'}, headers={'Origin': 'https://evil.example'})
        self.assertEqual(blocked.status_code, 403)
        allowed = self.client.post('/api/playlists', json={'name': 'ok'}, headers={'Origin': 'http://localhost'})
        self.assertEqual(allowed.status_code, 201)

    def test_track_metadata_is_validated_and_urls_are_canonical(self):
        playlist_id = self.create()['id']
        for track in ([], self.track('bad'), self.track(duration=-1), self.track(source='remote'),
                      self.track(duration='123'), self.track(title=[])):
            self.assertEqual(self.add(playlist_id, track).status_code, 400)
        result = self.add(playlist_id, self.track(url='javascript:alert(1)', thumbnail='javascript:alert(1)'))
        saved = result.json['playlist']['tracks'][0]
        self.assertEqual(saved['url'], 'https://www.youtube.com/watch?v=jNQXAC9IVRw')
        self.assertEqual(saved['thumbnail'], 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg')

    def test_local_files_range_playback_and_path_boundaries(self):
        (self.media / 'Nhạc thử.mp3').write_bytes(b'ID3' + bytes(range(256)) * 4)
        (self.media / 'private.txt').write_text('private', encoding='utf-8')
        tracks = self.client.get('/api/music/library').json['tracks']
        self.assertEqual(len(tracks), 1)
        track = tracks[0]
        playlist_id = self.create()['id']
        self.assertEqual(self.add(playlist_id, track).status_code, 200)
        response = self.client.get(track['url'], headers={'Range': 'bytes=3-12'})
        self.assertEqual(response.status_code, 206)
        self.assertEqual(response.data, bytes(range(10)))
        self.assertIn('inline', response.headers['Content-Disposition'])
        response.close()
        self.assertEqual(self.client.get('/api/music/file/private.txt').status_code, 400)
        self.assertEqual(self.client.get('/api/music/file/../private.mp3').status_code, 400)
        self.assertEqual(self.client.get('/api/music/file/..%5Cprivate.mp3').status_code, 400)
        self.assertEqual(self.client.get('/api/music/file/missing.mp3').status_code, 404)
        self.assertEqual(self.add(playlist_id, {'source': 'local', 'filename': '../private.mp3'}).status_code, 400)

    def test_search_contract_empty_and_upstream_error(self):
        with patch('downloader.search_youtube', return_value=[self.track(), {'id': 'bad'}]) as search:
            response = self.client.get('/api/music/search?q=nhạc+chill')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.json['tracks']), 1)
            search.assert_called_once_with('nhạc chill', max_results=12)
        with patch('downloader.search_youtube', return_value=[]):
            self.assertEqual(self.client.get('/api/music/search?q=empty').json['tracks'], [])
        with patch('downloader.search_youtube', side_effect=RuntimeError('upstream private details')):
            with self.assertLogs(app.logger, level='ERROR'):
                response = self.client.get('/api/music/search?q=offline')
            self.assertEqual(response.status_code, 502)
            self.assertNotIn('private details', response.json['error'])
        self.assertEqual(self.client.get('/api/music/search?q=').status_code, 400)
        self.assertEqual(self.client.get('/api/music/search?q=https://evil.example/watch').status_code, 400)
        with patch('downloader.get_video_info', return_value=self.track()) as extract:
            self.assertEqual(self.client.get('/api/music/search?q=https://youtu.be/jNQXAC9IVRw').status_code, 200)
            extract.assert_called_once_with('https://www.youtube.com/watch?v=jNQXAC9IVRw')


if __name__ == '__main__':
    unittest.main()
