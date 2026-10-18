"""
Y2Mate Local - YouTube Video & Audio Downloader Web Application
Flask Server Backend
"""

import os
import sys
import subprocess
from flask import Flask, request, jsonify, render_template, send_file, send_from_directory, redirect
from flask_cors import CORS
import downloader
from music import music

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)
app.register_blueprint(music)

# Ensure downloads directory exists
os.makedirs(downloader.DOWNLOAD_DIR, exist_ok=True)


@app.route('/')
def index():
    """Open the music player by default."""
    return redirect('/music')


@app.route('/download')
def download_page():
    """Keep the video and audio downloader accessible from the music menu."""
    return render_template('index.html')


@app.route('/api/info', methods=['GET'])
def get_info():
    """
    Get video info or perform search based on input query.
    If query is a URL, returns full video format metadata.
    If query is text, returns search results.
    """
    query = request.args.get('url') or request.args.get('q') or ''
    query = query.strip()
    if not query:
        return jsonify({'success': False, 'error': 'Vui lòng nhập đường link YouTube hoặc từ khóa tìm kiếm.'}), 400

    try:
        if downloader.is_url(query):
            info = downloader.get_video_info(query)
            return jsonify({'success': True, 'is_search': False, 'data': info})
        else:
            results = downloader.search_youtube(query, max_results=8)
            return jsonify({'success': True, 'is_search': True, 'results': results, 'query': query})
    except Exception as e:
        print(f"[Error] /api/info: {e}")
        return jsonify({'success': False, 'error': f'Không thể lấy dữ liệu: {str(e)}'}), 500


@app.route('/api/search', methods=['GET'])
def search():
    """Explicit search endpoint."""
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'success': False, 'error': 'Vui lòng cung cấp từ khóa tìm kiếm.'}), 400

    try:
        results = downloader.search_youtube(q, max_results=10)
        return jsonify({'success': True, 'results': results, 'query': q})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/download', methods=['POST'])
def start_dl():
    """Start a download task."""
    data = request.get_json(force=True, silent=True) or {}
    url = data.get('url', '').strip()
    dl_type = data.get('type', 'video')  # 'video' or 'audio'
    quality = data.get('quality', '720')  # '1080', '720', '320', etc.
    ext = data.get('ext', 'mp4')         # 'mp4', 'mp3', 'm4a'
    title_hint = data.get('title', '')

    if not url:
        return jsonify({'success': False, 'error': 'Thiếu đường dẫn URL tải xuống.'}), 400

    try:
        task_id = downloader.start_download(url, dl_type, quality, ext, title_hint)
        return jsonify({'success': True, 'task_id': task_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/progress/<task_id>', methods=['GET'])
def get_progress(task_id):
    """Poll progress of an ongoing download task."""
    task = downloader.get_task_status(task_id)
    if not task:
        return jsonify({'success': False, 'error': 'Không tìm thấy tác vụ tải.'}), 404
    return jsonify({'success': True, 'task': task})


@app.route('/api/file/<task_id>', methods=['GET'])
def download_file(task_id):
    """Download the completed file directly to the browser."""
    task = downloader.get_task_status(task_id)
    if not task:
        return jsonify({'success': False, 'error': 'Không tìm thấy tác vụ.'}), 404

    filepath = task.get('filepath')
    filename = task.get('filename') or 'downloaded_media'

    if not filepath or not os.path.exists(filepath):
        return jsonify({'success': False, 'error': 'File chưa sẵn sàng hoặc đã bị xóa.'}), 404

    return send_file(
        filepath,
        as_attachment=True,
        download_name=filename,
        mimetype='application/octet-stream'
    )


@app.route('/api/stream-file/<path:filename>', methods=['GET'])
def stream_saved_file(filename):
    """Download any saved file from downloads directory."""
    file_path = os.path.join(downloader.DOWNLOAD_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify({'success': False, 'error': 'File không tồn tại.'}), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/open-folder', methods=['POST'])
def open_folder():
    """Open the downloads folder in Windows Explorer."""
    try:
        if sys.platform == 'win32':
            os.startfile(downloader.DOWNLOAD_DIR)
        elif sys.platform == 'darwin':
            subprocess.run(['open', downloader.DOWNLOAD_DIR], check=True)
        else:
            subprocess.run(['xdg-open', downloader.DOWNLOAD_DIR], check=True)
        return jsonify({'success': True, 'path': downloader.DOWNLOAD_DIR})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/open-file', methods=['POST'])
def open_file():
    """Open a specific file in the system default media player."""
    data = request.get_json(force=True, silent=True) or {}
    filename = data.get('filename', '')
    task_id = data.get('task_id', '')

    target_path = None
    if task_id:
        task = downloader.get_task_status(task_id)
        if task and task.get('filepath'):
            target_path = task.get('filepath')
    elif filename:
        target_path = os.path.join(downloader.DOWNLOAD_DIR, filename)

    if not target_path or not os.path.exists(target_path):
        return jsonify({'success': False, 'error': 'File không tồn tại.'}), 404

    try:
        if sys.platform == 'win32':
            os.startfile(target_path)
        elif sys.platform == 'darwin':
            subprocess.run(['open', target_path], check=True)
        else:
            subprocess.run(['xdg-open', target_path], check=True)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/history', methods=['GET'])
def get_history():
    """Get list of downloaded files in the downloads directory."""
    files = downloader.list_downloaded_files()
    return jsonify({'success': True, 'files': files, 'folder': downloader.DOWNLOAD_DIR})


@app.route('/api/delete-file', methods=['POST'])
def delete_file():
    """Delete a downloaded file."""
    data = request.get_json(force=True, silent=True) or {}
    filename = data.get('filename', '')
    if not filename:
        return jsonify({'success': False, 'error': 'Thiếu tên file.'}), 400

    target = os.path.join(downloader.DOWNLOAD_DIR, filename)
    if os.path.exists(target) and os.path.isfile(target):
        try:
            os.remove(target)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    return jsonify({'success': False, 'error': 'Không tìm thấy file.'}), 404


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Y2Mate Downloader đang chạy tại: http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
