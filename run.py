"""
Launcher for Y2Downloader
Runs Flask server and opens default web browser automatically.
"""

import os
import sys
import time
import socket
import webbrowser
import threading
from app import app


def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0


def find_available_port(start_port=5000, max_attempts=20):
    port = start_port
    while port < start_port + max_attempts:
        if not is_port_in_use(port):
            return port
        port += 1
    return start_port


def open_browser(url, delay=1.2):
    def _open():
        time.sleep(delay)
        print(f"\n🌐 Đang tự động mở trình duyệt tại: {url}\n")
        webbrowser.open(url)
    t = threading.Thread(target=_open, daemon=True)
    t.start()


if __name__ == '__main__':
    port = find_available_port(5000)
    url = f"http://localhost:{port}"

    print("=" * 65)
    print("  🎬 Y2Downloader - YouTube Video & MP3 Downloader (Y2Mate Local)")
    print("=" * 65)
    print(f"  👉 Truy cập web:   {url}")
    print(f"  📁 Thư mục tải về: {os.path.abspath('downloads')}")
    print("  ⚙️  Nhấn Ctrl+C trong cửa sổ này để dừng ứng dụng.")
    print("=" * 65)

    open_browser(url)

    # Disable Flask banner clutter for cleaner console
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)

    app.run(host='0.0.0.0', port=port, debug=False)
